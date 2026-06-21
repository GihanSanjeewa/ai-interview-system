"""Word Error Rate evaluation harness.

Compares any HF Whisper checkpoint (base, large-v3, or your fine-tuned dir)
against a held-out test split, with Sinhala-aware normalization.

Usage:
    python -m whisper_si.training.evaluate \\
        --data ./data/whisper-si \\
        --models openai/whisper-small ./models/whisper-si-finetuned \\
        --split test \\
        --max-samples 500

The CSV report makes it trivial to drop into your thesis chapter.
"""
from __future__ import annotations

import argparse
import csv
import logging
import time
import unicodedata
from pathlib import Path

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def _normalize_si(text: str) -> str:
    """Light normalization shared with postprocess.clean_sinhala — done here
    inline to avoid pulling the inference package into a GPU box."""
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    text = text.replace("‍", "").replace("‌", "")
    # collapse whitespace
    return " ".join(text.split()).strip()


def _evaluate_one(model_id: str, dataset, max_samples: int) -> dict:
    import torch
    from jiwer import wer, cer
    from transformers import WhisperForConditionalGeneration, WhisperProcessor

    device = "cuda" if torch.cuda.is_available() else "cpu"
    processor = WhisperProcessor.from_pretrained(model_id, language="sinhala", task="transcribe")
    model = WhisperForConditionalGeneration.from_pretrained(model_id).to(device)
    model.eval()
    forced_ids = processor.get_decoder_prompt_ids(language="si", task="transcribe")

    refs: list[str] = []
    hyps: list[str] = []
    started = time.perf_counter()

    n = min(max_samples, len(dataset)) if max_samples else len(dataset)
    for i, example in enumerate(dataset.select(range(n))):
        audio = example["audio"]
        inputs = processor(
            audio["array"], sampling_rate=audio["sampling_rate"], return_tensors="pt"
        ).input_features.to(device)
        with torch.no_grad():
            ids = model.generate(
                inputs,
                forced_decoder_ids=forced_ids,
                num_beams=1,
                max_new_tokens=440,
                no_repeat_ngram_size=3,
            )
        hyp = processor.batch_decode(ids, skip_special_tokens=True)[0]
        refs.append(_normalize_si(example["text"]))
        hyps.append(_normalize_si(hyp))
        if (i + 1) % 25 == 0:
            log.info("  %d / %d", i + 1, n)

    elapsed = time.perf_counter() - started
    return {
        "model": model_id,
        "samples": n,
        "wer": round(wer(refs, hyps), 4),
        "cer": round(cer(refs, hyps), 4),
        "seconds": round(elapsed, 1),
        "rtf": round(elapsed / max(1, n), 3),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="Dataset dir from prepare_dataset.py")
    ap.add_argument("--split", default="test", choices=["train", "validation", "test"])
    ap.add_argument("--models", nargs="+", required=True, help="HF ids or local dirs")
    ap.add_argument("--max-samples", type=int, default=500)
    ap.add_argument("--report", default="./eval-report.csv")
    args = ap.parse_args()

    from datasets import load_from_disk

    ds_root = Path(args.data) / args.split
    if not ds_root.exists():
        raise SystemExit(f"Split not found: {ds_root}")
    dataset = load_from_disk(str(ds_root))
    log.info("Loaded %d samples from %s", len(dataset), ds_root)

    rows = []
    for m in args.models:
        log.info("Evaluating %s", m)
        try:
            rows.append(_evaluate_one(m, dataset, args.max_samples))
        except Exception as exc:
            log.exception("Failed to evaluate %s: %s", m, exc)
            rows.append({"model": m, "error": str(exc)})

    Path(args.report).parent.mkdir(parents=True, exist_ok=True)
    with open(args.report, "w", newline="", encoding="utf-8") as fp:
        keys = sorted({k for r in rows for k in r.keys()})
        writer = csv.DictWriter(fp, fieldnames=keys)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

    log.info("\n%s", "-" * 72)
    for r in rows:
        if "error" in r:
            log.info("%-50s ERROR  %s", r["model"], r["error"])
        else:
            log.info(
                "%-50s WER=%.3f  CER=%.3f  (%d samples, %.1fs)",
                r["model"], r["wer"], r["cer"], r["samples"], r["seconds"],
            )
    log.info("CSV report → %s", args.report)


if __name__ == "__main__":
    main()
