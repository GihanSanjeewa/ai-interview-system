"""Audio preprocessing for Whisper.

Pipeline:
    1. Decode to mono 16 kHz (librosa)
    2. Trim leading/trailing silence (librosa)
    3. Optional VAD-based segmentation (librosa-only — keeps loud frames)
    4. Optional spectral noise reduction
    5. Peak normalization

All steps are best-effort: failures fall through to raw decode.
"""
from __future__ import annotations

import logging
from typing import Optional, Tuple

import numpy as np

from .config import DENOISE, TARGET_SR, USE_VAD

log = logging.getLogger(__name__)


def load_audio(path: str, sr: int = TARGET_SR) -> Tuple[np.ndarray, int]:
    """Decode any audio container to mono float32 at `sr`."""
    import librosa

    audio, _ = librosa.load(path, sr=sr, mono=True)
    return audio.astype(np.float32), sr


def trim_silence(audio: np.ndarray, top_db: int = 35) -> np.ndarray:
    import librosa

    trimmed, _ = librosa.effects.trim(audio, top_db=top_db)
    return trimmed if trimmed.size else audio


def vad_keep_speech(audio: np.ndarray, sr: int) -> np.ndarray:
    """Lightweight VAD using librosa's split — keeps only speech intervals.
    Cheap and CPU-only; not as accurate as Silero VAD but adequate for cleanup.
    """
    if not USE_VAD or audio.size == 0:
        return audio
    try:
        import librosa

        intervals = librosa.effects.split(audio, top_db=30)
        if intervals.size == 0:
            return audio
        kept = np.concatenate([audio[s:e] for s, e in intervals])
        # If too aggressive (kept < 30% of original), fall back to original
        if kept.size < 0.3 * audio.size:
            return audio
        return kept
    except Exception as exc:  # pragma: no cover - defensive
        log.warning("vad_keep_speech failed: %s", exc)
        return audio


def denoise(audio: np.ndarray, sr: int) -> np.ndarray:
    """Optional spectral denoising. Skips silently if `noisereduce` is missing."""
    if not DENOISE or audio.size == 0:
        return audio
    try:
        import noisereduce as nr

        return nr.reduce_noise(y=audio, sr=sr, stationary=False).astype(np.float32)
    except Exception:
        return audio


def peak_normalize(audio: np.ndarray, target_db: float = -1.0) -> np.ndarray:
    if audio.size == 0:
        return audio
    peak = float(np.max(np.abs(audio)))
    if peak < 1e-6:
        return audio
    target = 10 ** (target_db / 20.0)
    return (audio * (target / peak)).astype(np.float32)


def prepare(path: str, language: Optional[str] = None) -> Tuple[np.ndarray, int]:
    """Full preprocessing pipeline. Returns (audio, sr).

    `language` is accepted for symmetry with the transcriber; current rules
    are language-agnostic but kept as a hook for future Sinhala-specific
    pre-emphasis or RIR augmentation removal.
    """
    audio, sr = load_audio(path, sr=TARGET_SR)
    audio = trim_silence(audio)
    audio = vad_keep_speech(audio, sr)
    audio = denoise(audio, sr)
    audio = peak_normalize(audio)
    _ = language  # reserved
    return audio, sr
