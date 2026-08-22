"""
Local QLoRA Fine-Tuning Pipeline for Software Engineering Interview Assistant
Fine-tunes base models (Llama 3 / Mistral) using QLoRA (Quantized Low-Rank Adaptation).

The Question Generator dataset is built by
`dataset/prepare_question_generator.py` and lands in
`dataset/processed/question_generator/` as train/validation/test JSONL, each row
carrying instruction / input / output alongside the interview schema.

Usage:
    python train_qlora.py --dry_run
    python train_qlora.py --base_model "meta-llama/Meta-Llama-3-8B" \
                          --dataset dataset/processed/question_generator
"""

import argparse
import json
import os

DEFAULT_DATASET = os.path.join("dataset", "processed", "question_generator")

PROMPT_TEMPLATE = (
    "### Instruction:\n{instruction}\n\n"
    "### Input:\n{input}\n\n"
    "### Response:\n{output}"
)


def load_split(dataset_path, split):
    """Read one split. Accepts either the processed directory or a single file."""
    if os.path.isdir(dataset_path):
        path = os.path.join(dataset_path, f"{split}.jsonl")
    elif split == "train":
        path = dataset_path
    else:
        return []
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as fh:
        if path.endswith(".jsonl"):
            return [json.loads(line) for line in fh if line.strip()]
        return json.load(fh)


def format_example(record):
    """Render one record into the SFT prompt the model is trained on."""
    return PROMPT_TEMPLATE.format(
        instruction=record.get("instruction", "Generate a technical interview question."),
        input=record.get("input", ""),
        output=record.get("output") or record.get("question", ""),
    )


def train():
    parser = argparse.ArgumentParser(description="QLoRA Fine-Tuning Script")
    parser.add_argument("--base_model", type=str, default="meta-llama/Meta-Llama-3-8B", help="Base model path or HuggingFace ID")
    parser.add_argument("--dataset", type=str, default=DEFAULT_DATASET, help="Processed dataset directory (or a single JSON/JSONL file)")
    parser.add_argument("--output_dir", type=str, default="./models/interview_llm/qlora_question_generator", help="Directory to save fine-tuned weights")
    parser.add_argument("--epochs", type=float, default=3.0)
    parser.add_argument("--batch_size", type=int, default=4)
    parser.add_argument("--grad_accum", type=int, default=4)
    parser.add_argument("--learning_rate", type=float, default=2e-4)
    parser.add_argument("--max_seq_length", type=int, default=512)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--dry_run", action="store_true", help="Load and format the dataset, print samples, then stop")
    args = parser.parse_args()

    train_rows = load_split(args.dataset, "train")
    eval_rows = load_split(args.dataset, "validation")

    print("=" * 60)
    print("      SOFTWARE ENGINEERING INTERVIEW LLM QLORA FINE-TUNING     ")
    print("=" * 60)
    print(f"Base Model : {args.base_model}")
    print(f"Dataset    : {args.dataset}")
    print(f"Train rows : {len(train_rows)}")
    print(f"Eval rows  : {len(eval_rows)}")
    print(f"Output Dir : {args.output_dir}")

    if not train_rows:
        print("No training rows found. Build the dataset first:")
        print("    python dataset/prepare_question_generator.py")
        return

    print("-" * 60)
    print("Sample formatted prompt:")
    print(format_example(train_rows[0]))
    print("-" * 60)

    if args.dry_run:
        print("Dry run requested — dataset is loadable and formatted. Stopping before training.")
        return

    try:
        import torch
        from datasets import Dataset
        from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
        from peft import LoraConfig, prepare_model_for_kbit_training
        from trl import SFTConfig, SFTTrainer

        print("Torch CUDA available:", torch.cuda.is_available())
        if torch.cuda.is_available():
            print("GPU Device:", torch.cuda.get_device_name(0))

        # 4-bit Quantization Config
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True
        )

        # LoRA Adapter Parameters
        peft_config = LoraConfig(
            r=16,
            lora_alpha=32,
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM"
        )

        tokenizer = AutoTokenizer.from_pretrained(args.base_model)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        model = AutoModelForCausalLM.from_pretrained(
            args.base_model, quantization_config=bnb_config, device_map="auto")
        model = prepare_model_for_kbit_training(model)

        train_ds = Dataset.from_dict({"text": [format_example(r) for r in train_rows]})
        eval_ds = (Dataset.from_dict({"text": [format_example(r) for r in eval_rows]})
                   if eval_rows else None)

        sft_config = SFTConfig(
            output_dir=args.output_dir,
            num_train_epochs=args.epochs,
            per_device_train_batch_size=args.batch_size,
            gradient_accumulation_steps=args.grad_accum,
            learning_rate=args.learning_rate,
            max_seq_length=args.max_seq_length,
            logging_steps=25,
            save_strategy="epoch",
            seed=args.seed,
            fp16=torch.cuda.is_available(),
            dataset_text_field="text",
        )

        trainer = SFTTrainer(
            model=model,
            args=sft_config,
            train_dataset=train_ds,
            eval_dataset=eval_ds,
            peft_config=peft_config,
            processing_class=tokenizer,
        )
        trainer.train()
        trainer.save_model(args.output_dir)
        tokenizer.save_pretrained(args.output_dir)
        print(f"Adapter weights written to {args.output_dir}")

    except ImportError as exc:
        print(f"Fine-tuning dependencies notice: {exc}")
        print("To run QLoRA training, install dependencies: pip install torch transformers peft bitsandbytes trl datasets")


if __name__ == "__main__":
    train()
