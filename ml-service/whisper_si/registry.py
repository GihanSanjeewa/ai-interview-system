"""Model selection: pick the best available Sinhala Whisper model.

Resolution order for Sinhala:
    1. WHISPER_SI_MODEL env var (HF id or local dir) — explicit override
    2. WHISPER_FT_DIR if it exists on disk — fine-tuned checkpoint
    3. WHISPER_SI_FALLBACK (default openai/whisper-large-v3) — strong baseline

Reports a deterministic `model_used` string so the UI can show provenance.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from .config import (
    FT_DIR,
    SI_FALLBACK_HF,
    SI_MODEL_OVERRIDE,
)

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class ModelChoice:
    """Resolved model reference."""

    identifier: str        # HF id or absolute local path
    backend: str           # "hf-finetuned" | "hf-base" | "openai-whisper"
    label: str             # human label for the UI


def _is_local_dir(p: str) -> bool:
    return Path(p).expanduser().is_dir()


def pick_sinhala_model() -> ModelChoice:
    if SI_MODEL_OVERRIDE:
        if _is_local_dir(SI_MODEL_OVERRIDE):
            return ModelChoice(
                identifier=str(Path(SI_MODEL_OVERRIDE).expanduser().resolve()),
                backend="hf-finetuned",
                label=f"Custom (local) · {Path(SI_MODEL_OVERRIDE).name}",
            )
        return ModelChoice(
            identifier=SI_MODEL_OVERRIDE,
            backend="hf-base",
            label=f"Custom · {SI_MODEL_OVERRIDE}",
        )

    if FT_DIR.is_dir() and any(FT_DIR.iterdir()):
        return ModelChoice(
            identifier=str(FT_DIR.resolve()),
            backend="hf-finetuned",
            label="Fine-tuned Sinhala Whisper",
        )

    return ModelChoice(
        identifier=SI_FALLBACK_HF,
        backend="hf-base",
        label=f"Whisper baseline · {SI_FALLBACK_HF.split('/')[-1]}",
    )


def has_finetuned_model() -> bool:
    """Cheap probe for the UI to show a 'Fine-tuned' badge."""
    if SI_MODEL_OVERRIDE and _is_local_dir(SI_MODEL_OVERRIDE):
        return True
    return FT_DIR.is_dir() and any(FT_DIR.iterdir())
