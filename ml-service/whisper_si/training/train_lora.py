"""Parameter-efficient fine-tuning (LoRA) of Whisper on Sinhala data.

Why LoRA?
    * A LoRA adapter on Whisper-small adds ~1-3M trainable params (vs 244M base)
    * Fits in a single 12 GB GPU; runs in 1-3 hours on Common Voice si
    * Final checkpoint is small (~10-15 MB) and can be merged for deployment

Output:
    <out>/                # full merged checkpoint (HF-loadable)
    <out>/adapter/        # LoRA adapter only (drop-in for the base model)

Usage:
    python -m whisper_si.training.train_lora \\
        --data ./data/whisper-si \\
        --base openai/whisper-small \\
        --out ./models/whisper-si-finetuned \\
        --epochs 5 --batch 8 --lr 1e-4
"""
from __future__ import annotations

import argparse
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


@dataclass
class DataCollatorSpeechSeq2SeqWithPadding:
    processor: Any

    def __call__(self, features: list[dict]) -> dict:
        import torch

        input_features = [{"input_features": f["input_features"]} for f in features]
        batch = self.processor.feature_extractor.pad(input_features, return_tensors="pt")
        label_features = [{"input_ids": f["labels"]} for f in features]
        labels_batch = self.processor.tokenizer.pad(label_features, return_tensors="pt")
        labels = labels_batch["input_ids"].masked_fill(
            labels_batch.attention_mask.ne(1), -100
        )
        # Drop the leading <bos>; Whisper adds it automatically during training.
        if (labels[:, 0] == self.processor.tokenizer.bos_token_id).all().item():
            labels = labels[:, 1:]
        batch["labels"] = labels
        return batch


def _prepare_example(example, processor, max_label_tokens: int):
    audio = example["audio"]
    example["input_features"] = processor.feature_extractor(
        audio["array"], sampling_rate=audio["sampling_rate"]
    ).input_features[0]
    tok = processor.tokenizer(example["text"], truncation=True, max_length=max_label_tokens)
    example["labels"] = tok.input_ids
    return example


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="Dataset dir from prepare_dataset.py")
    ap.add_argument("--base", default="openai/whisper-small")
    ap.add_argument("--out", default="./models/whisper-si-finetuned")
    ap.add_argument("--epochs", type=int, default=5)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--grad-accum", type=int, default=2)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--max-label-tokens", type=int, default=225)
    ap.add_argument("--lora-r", type=int, default=32)
    ap.add_argument("--lora-alpha", type=int, default=64)
    ap.add_argument("--no-merge", action="store_true", help="Skip the LoRA merge step")
    args = ap.parse_args()

    # Heavy imports stay inside main() so `--help` works without GPU deps installed.
    import torch
    from datasets import load_from_disk
    from peft import LoraConfig, PeftModel, get_peft_model
    from transformers import (
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
        WhisperForConditionalGeneration,
        WhisperProcessor,
    )

    log.info("Loading processor + base model: %s", args.base)
    processor = WhisperProcessor.from_pretrained(args.base, language="sinhala", task="transcribe")
    model = WhisperForConditionalGeneration.from_pretrained(args.base)
    model.generation_config.language = "sinhala"
    model.generation_config.task = "transcribe"
    model.generation_config.forced_decoder_ids = None
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []

    lora_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="SEQ_2_SEQ_LM",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    log.info("Loading dataset from %s", args.data)
    data_root = Path(args.data)
    train = load_from_disk(str(data_root / "train"))
    eval_split = "validation" if (data_root / "validation").exists() else "test"
    eval_ds = load_from_disk(str(data_root / eval_split))

    train = train.map(
        lambda e: _prepare_example(e, processor, args.max_label_tokens),
        remove_columns=train.column_names,
        num_proc=1,
    )
    eval_ds = eval_ds.map(
        lambda e: _prepare_example(e, processor, args.max_label_tokens),
        remove_columns=eval_ds.column_names,
        num_proc=1,
    )

    collator = DataCollatorSpeechSeq2SeqWithPadding(processor=processor)

    bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    out_adapter = Path(args.out) / "adapter"
    out_adapter.parent.mkdir(parents=True, exist_ok=True)

    training_args = Seq2SeqTrainingArguments(
        output_dir=str(out_adapter),
        per_device_train_batch_size=args.batch,
        per_device_eval_batch_size=args.batch,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        warmup_steps=200,
        num_train_epochs=args.epochs,
        bf16=bf16,
        fp16=(torch.cuda.is_available() and not bf16),
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        logging_steps=50,
        report_to="none",
        predict_with_generate=True,
        generation_max_length=args.max_label_tokens,
        push_to_hub=False,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        remove_unused_columns=False,
        label_names=["labels"],
    )

    trainer = Seq2SeqTrainer(
        args=training_args,
        model=model,
        train_dataset=train,
        eval_dataset=eval_ds,
        data_collator=collator,
        tokenizer=processor.feature_extractor,
    )

    log.info("Starting training…")
    trainer.train()
    log.info("Saving adapter to %s", out_adapter)
    model.save_pretrained(str(out_adapter))
    processor.save_pretrained(str(out_adapter))

    if args.no_merge:
        log.info("Skipping merge — adapter saved at %s", out_adapter)
        return

    log.info("Merging adapter into base model for deployment…")
    base = WhisperForConditionalGeneration.from_pretrained(args.base)
    merged = PeftModel.from_pretrained(base, str(out_adapter))
    merged = merged.merge_and_unload()
    merged.save_pretrained(args.out, safe_serialization=True)
    processor.save_pretrained(args.out)
    log.info("Done. Drop %s into WHISPER_FT_DIR to serve.", args.out)


if __name__ == "__main__":
    os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")
    main()
