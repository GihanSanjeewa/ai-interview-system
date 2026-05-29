"""Runtime configuration for the Sinhala Whisper pipeline.

Environment variables (all optional):

    WHISPER_EN_MODEL       openai-whisper model size for English (default: "base")
    WHISPER_SI_MODEL       Override: HF model id OR local checkpoint dir for Sinhala
    WHISPER_SI_FALLBACK    HF id used when no fine-tune exists (default: "openai/whisper-large-v3")
    WHISPER_FT_DIR         Local directory where fine-tuned checkpoints live
                           (default: ./models/whisper-si-finetuned)
    WHISPER_DEVICE         "cuda" | "cpu" | "auto" (default: auto)
    WHISPER_USE_HF         "1" to force HuggingFace inference path even for English
    WHISPER_DENOISE        "1" enables spectral denoising (default: "1")
    WHISPER_VAD            "1" enables silence trimming (default: "1")
"""
from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

EN_MODEL_NAME = os.getenv("WHISPER_EN_MODEL", "base")
SI_FALLBACK_HF = os.getenv("WHISPER_SI_FALLBACK", "openai/whisper-large-v3")
FT_DIR = Path(os.getenv("WHISPER_FT_DIR", REPO_ROOT / "models" / "whisper-si-finetuned"))
SI_MODEL_OVERRIDE = os.getenv("WHISPER_SI_MODEL")

DEVICE = os.getenv("WHISPER_DEVICE", "auto")
USE_HF = os.getenv("WHISPER_USE_HF", "0") == "1"
DENOISE = os.getenv("WHISPER_DENOISE", "1") == "1"
USE_VAD = os.getenv("WHISPER_VAD", "1") == "1"

TARGET_SR = 16_000  # Whisper requires 16 kHz mono
