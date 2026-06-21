"""Unified transcribe() entry point.

Backend selection:
    English audio              → openai-whisper (existing path, cheap)
    Sinhala audio              → HuggingFace transformers (fine-tuned if available,
                                  else openai/whisper-large-v3). If HF stack isn't
                                  installed at runtime, falls back to openai-whisper
                                  with language='si'.

Models are loaded lazily and cached for the process lifetime.
"""
from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Optional

from .config import DEVICE, EN_MODEL_NAME, TARGET_SR, USE_HF
from .postprocess import clean
from .preprocess import prepare
from .registry import ModelChoice, has_finetuned_model, pick_sinhala_model

log = logging.getLogger(__name__)

_LOCK = threading.Lock()
_CACHE: dict[str, Any] = {}


# ---------- public API ----------------------------------------------------

@dataclass
class TranscriptionResult:
    text: str
    language: str
    model_used: str
    backend: str
    finetuned: bool
    duration_sec: float
    latency_ms: int
    segments: list[dict]

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "language": self.language,
            "model": self.model_used,
            "backend": self.backend,
            "finetuned": self.finetuned,
            "duration_sec": round(self.duration_sec, 2),
            "latency_ms": self.latency_ms,
            "segments": self.segments,
        }


def model_info(language: str = "si") -> dict:
    """Lightweight introspection for the UI."""
    if language == "si":
        choice = pick_sinhala_model()
        return {
            "language": "si",
            "model": choice.identifier,
            "backend": choice.backend,
            "label": choice.label,
            "finetuned": has_finetuned_model(),
        }
    return {
        "language": "en",
        "model": EN_MODEL_NAME,
        "backend": "openai-whisper",
        "label": f"Whisper {EN_MODEL_NAME}",
        "finetuned": False,
    }


def transcribe(audio_path: str, language: Optional[str] = None) -> TranscriptionResult:
    """Transcribe `audio_path` (any container ffmpeg understands).

    `language` is a 2-letter code: 'en' | 'si'. None ⇒ Whisper auto-detects.
    """
    lang = (language or "").lower().strip() or None
    start = time.perf_counter()

    audio, sr = prepare(audio_path, language=lang)
    duration_sec = audio.size / sr if sr else 0.0

    if lang == "si":
        result = _transcribe_sinhala(audio, sr, audio_path)
    else:
        result = _transcribe_english(audio, sr, audio_path, lang)

    result.text = clean(result.text, result.language)
    result.duration_sec = duration_sec
    result.latency_ms = int((time.perf_counter() - start) * 1000)
    return result


# ---------- backends ------------------------------------------------------

def _transcribe_english(audio, sr: int, audio_path: str, lang: Optional[str]):
    model = _get_openai_whisper(EN_MODEL_NAME)
    kwargs: dict = {"fp16": False}
    if lang:
        kwargs["language"] = lang
    if USE_HF:
        # power user override — but HF path is still language-aware
        return _transcribe_with_hf(audio, sr, "openai/whisper-base", lang or "en")
    raw = model.transcribe(audio_path, **kwargs)
    segments = [
        {
            "start": float(s.get("start", 0.0)),
            "end": float(s.get("end", 0.0)),
            "text": s.get("text", ""),
            "avg_logprob": s.get("avg_logprob"),
        }
        for s in raw.get("segments", [])
    ]
    return TranscriptionResult(
        text=raw.get("text", "").strip(),
        language=raw.get("language", lang or "en"),
        model_used=EN_MODEL_NAME,
        backend="openai-whisper",
        finetuned=False,
        duration_sec=0.0,
        latency_ms=0,
        segments=segments,
    )


def _transcribe_sinhala(audio, sr: int, audio_path: str):
    choice = pick_sinhala_model()
    try:
        return _transcribe_with_hf(audio, sr, choice.identifier, "si", choice=choice)
    except ImportError as exc:
        log.warning(
            "HF transformers not installed (%s). Falling back to openai-whisper large for Sinhala.",
            exc,
        )
        return _transcribe_openai_si(audio_path)


def _transcribe_with_hf(
    audio,
    sr: int,
    identifier: str,
    language: str,
    *,
    choice: Optional[ModelChoice] = None,
):
    """Use HuggingFace transformers Whisper. Imported lazily."""
    import numpy as np
    import torch  # type: ignore
    from transformers import (  # type: ignore
        WhisperForConditionalGeneration,
        WhisperProcessor,
    )

    device = _resolve_device(DEVICE)
    cache_key = f"hf:{identifier}:{device}"

    with _LOCK:
        bundle = _CACHE.get(cache_key)
        if bundle is None:
            log.info("Loading HF Whisper model: %s (device=%s)", identifier, device)
            processor = WhisperProcessor.from_pretrained(identifier)
            model = WhisperForConditionalGeneration.from_pretrained(identifier)
            model.to(device)
            model.eval()
            bundle = (processor, model)
            _CACHE[cache_key] = bundle
    processor, model = bundle

    if audio.dtype != np.float32:
        audio = audio.astype(np.float32)
    if sr != TARGET_SR:
        # prepare() already targets 16k, but be defensive
        import librosa

        audio = librosa.resample(audio, orig_sr=sr, target_sr=TARGET_SR)

    # 30 s window is Whisper's native context — split longer clips.
    window = 30 * TARGET_SR
    chunks = (
        [audio]
        if audio.size <= window
        else [audio[i : i + window] for i in range(0, audio.size, window)]
    )

    full_text = []
    segments = []
    cursor_sec = 0.0
    forced_ids = processor.get_decoder_prompt_ids(language=language, task="transcribe")

    for chunk in chunks:
        if chunk.size == 0:
            continue
        inputs = processor(
            chunk, sampling_rate=TARGET_SR, return_tensors="pt"
        ).input_features.to(device)

        with torch.no_grad():
            pred_ids = model.generate(
                inputs,
                forced_decoder_ids=forced_ids,
                num_beams=1,
                max_new_tokens=440,
                no_repeat_ngram_size=3,
            )
        text = processor.batch_decode(pred_ids, skip_special_tokens=True)[0].strip()
        full_text.append(text)
        segments.append(
            {
                "start": cursor_sec,
                "end": cursor_sec + chunk.size / TARGET_SR,
                "text": text,
                "avg_logprob": None,
            }
        )
        cursor_sec += chunk.size / TARGET_SR

    backend = choice.backend if choice else "hf-base"
    return TranscriptionResult(
        text=" ".join(t for t in full_text if t),
        language=language,
        model_used=identifier,
        backend=backend,
        finetuned=(backend == "hf-finetuned"),
        duration_sec=0.0,
        latency_ms=0,
        segments=segments,
    )


def _transcribe_openai_si(audio_path: str):
    """Last-resort: openai-whisper with language='si', upgraded model if available."""
    model_name = os.getenv("WHISPER_SI_OPENAI_MODEL", "large-v3")
    model = _get_openai_whisper(model_name)
    raw = model.transcribe(audio_path, language="si", fp16=False)
    segments = [
        {
            "start": float(s.get("start", 0.0)),
            "end": float(s.get("end", 0.0)),
            "text": s.get("text", ""),
            "avg_logprob": s.get("avg_logprob"),
        }
        for s in raw.get("segments", [])
    ]
    return TranscriptionResult(
        text=raw.get("text", "").strip(),
        language="si",
        model_used=f"openai-whisper:{model_name}",
        backend="openai-whisper",
        finetuned=False,
        duration_sec=0.0,
        latency_ms=0,
        segments=segments,
    )


# ---------- helpers -------------------------------------------------------

def _get_openai_whisper(name: str):
    import whisper  # openai-whisper, lazy import

    key = f"openai:{name}"
    with _LOCK:
        model = _CACHE.get(key)
        if model is None:
            log.info("Loading openai-whisper model: %s", name)
            model = whisper.load_model(name)
            _CACHE[key] = model
    return model


def _resolve_device(pref: str) -> str:
    if pref and pref != "auto":
        return pref
    try:
        import torch  # type: ignore

        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"
