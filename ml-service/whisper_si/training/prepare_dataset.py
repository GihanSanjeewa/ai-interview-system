"""Build a HuggingFace dataset for Sinhala Whisper fine-tuning.

Sources (in order of priority):
    * Mozilla Common Voice 17 (`mozilla-foundation/common_voice_17_0`, lang='si')
    * Google FLEURS (`google/fleurs`, lang='si_lk')

You can mix both; FLEURS is small but high quality, CV provides volume.

Usage:
    python -m whisper_si.training.prepare_dataset \\
        --out ./data/whisper-si \\
        --sources cv fleurs \\
        --max-seconds 30 \\
        --hf-token $HF_TOKEN
"""
from __future__ import annotations

import argparse
import logging
import os
from pathlib import Path

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def _load_common_voice(hf_token: str | None):
    from datasets import Audio, load_dataset

    log.info("Loading Common Voice 17 Sinhala…")
    ds = load_dataset(
        "mozilla-foundation/common_voice_17_0",
        "si",
        split={"train": "train", "validation": "validation", "test": "test"},
        token=hf_token,
    )
    ds = {
        split: d.cast_column("audio", Audio(sampling_rate=16_000)).rename_column(
            "sentence", "text"
        )
        for split, d in ds.items()
    }
    return ds


def _load_fleurs():
    from datasets import Audio, load_dataset

    log.info("Loading FLEURS si_lk…")
    ds = load_dataset("google/fleurs", "si_lk")
    out = {}
    for split, name in [("train", "train"), ("validation", "validation"), ("test", "test")]:
        if name not in ds:
            continue
        d = ds[name]
        d = d.cast_column("audio", Audio(sampling_rate=16_000))
        if "transcription" in d.column_names:
            d = d.rename_column("transcription", "text")
        out[split] = d
    return out


def _filter_keep(example, max_seconds: float):
    audio = example.get("audio") or {}
    arr = audio.get("array")
    sr = audio.get("sampling_rate", 16_000)
    text = (example.get("text") or "").strip()
    if not arr or not text:
        return False
    seconds = len(arr) / sr
    return 1.0 <= seconds <= max_seconds and len(text) >= 4


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="Output directory")
    ap.add_argument(
        "--sources",
        nargs="+",
        default=["cv", "fleurs"],
        choices=["cv", "fleurs"],
    )
    ap.add_argument("--max-seconds", type=float, default=30.0)
    ap.add_argument("--hf-token", default=os.getenv("HF_TOKEN"))
    args = ap.parse_args()

    from datasets import concatenate_datasets

    keep_cols = ["audio", "text"]
    splits: dict[str, list] = {"train": [], "validation": [], "test": []}

    if "cv" in args.sources:
        cv = _load_common_voice(args.hf_token)
        for split, d in cv.items():
            d = d.filter(lambda e: _filter_keep(e, args.max_seconds))
            d = d.remove_columns([c for c in d.column_names if c not in keep_cols])
            splits[split].append(d)

    if "fleurs" in args.sources:
        fl = _load_fleurs()
        for split, d in fl.items():
            d = d.filter(lambda e: _filter_keep(e, args.max_seconds))
            d = d.remove_columns([c for c in d.column_names if c not in keep_cols])
            splits[split].append(d)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    for split, ds_list in splits.items():
        if not ds_list:
            continue
        merged = ds_list[0] if len(ds_list) == 1 else concatenate_datasets(ds_list)
        target = out_dir / split
        merged.save_to_disk(str(target))
        log.info("Saved %s: %d examples → %s", split, len(merged), target)


if __name__ == "__main__":
    main()
