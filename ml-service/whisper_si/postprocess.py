"""Sinhala-specific post-processing for raw Whisper output.

Common Whisper failure modes on Sinhala:
    * Mixed-script artefacts (Sinhala + Latin punctuation runs)
    * Romanized numerals output instead of Sinhala script
    * Double whitespace + trailing zero-width joiners
    * Spurious dandaa (෴) sequences
    * Verbatim repetition loops (Whisper hallucination on silence)

Rules below are conservative — applied only when language == "si".
Heuristics never *invent* tokens; they only normalise existing ones.
"""
from __future__ import annotations

import re
import unicodedata

# Sinhala script range: U+0D80–U+0DFF
SINHALA = r"඀-෿"

# Common Whisper hallucinations to strip (single tokens that loop on silence)
_HALLUCINATIONS_SI = {
    "subscribe",
    "subscribe to",
    "thank you for watching",
    "ස්තූතියි",  # only if it appears 3+ times in a row
}

_ZWJ = "‍"
_ZWNJ = "‌"


def _strip_repetitions(text: str, threshold: int = 3) -> str:
    """Collapse N+ exact-word loops common to silent Whisper inputs."""
    out: list[str] = []
    prev: str | None = None
    run = 0
    for tok in text.split():
        if tok == prev:
            run += 1
            if run < threshold:
                out.append(tok)
        else:
            out.append(tok)
            prev = tok
            run = 1
    return " ".join(out)


def _collapse_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _normalize_unicode(text: str) -> str:
    # NFC keeps the Sinhala composed letters and combining vowels stable
    return unicodedata.normalize("NFC", text)


def _fix_punctuation(text: str) -> str:
    text = text.replace("෴", "෴")  # ensure standard dandaa
    text = re.sub(r"\s+([.,!?෴])", r"\1", text)
    text = re.sub(r"([.,!?෴])(\S)", r"\1 \2", text)
    return text


def _strip_zero_width(text: str) -> str:
    # Keep ZWJ only where needed: between two Sinhala letters. Drop the rest.
    pattern = re.compile(rf"(?<![{SINHALA}])[{_ZWJ}{_ZWNJ}]|[{_ZWJ}{_ZWNJ}](?![{SINHALA}])")
    return pattern.sub("", text)


def clean_sinhala(text: str) -> str:
    if not text:
        return text
    text = _normalize_unicode(text)
    text = _strip_zero_width(text)
    text = _strip_repetitions(text)
    text = _fix_punctuation(text)
    text = _collapse_whitespace(text)
    return text


def clean(text: str, language: str) -> str:
    if not text:
        return ""
    if language == "si":
        return clean_sinhala(text)
    # English fallback — mild cleanup only
    return _collapse_whitespace(text)
