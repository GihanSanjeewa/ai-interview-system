"""Sinhala-optimized Whisper transcription package.

Layout:
    config.py         – paths, model IDs, runtime knobs
    preprocess.py     – audio cleanup (resample, denoise, VAD)
    postprocess.py    – Sinhala text normalization + fixups
    registry.py       – picks the best available model (base / large-v3 / fine-tuned)
    transcriber.py    – unified transcribe() with backend selection + cache
    training/         – LoRA fine-tuning scripts (run separately on GPU)
"""

from .transcriber import transcribe, model_info

__all__ = ["transcribe", "model_info"]
