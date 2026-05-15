"""
Audio-based ML feature extraction using librosa.
Computes: confidence level, fluency, and speaking speed from raw audio.
"""

import numpy as np

try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    print("librosa not installed — audio ML features will use Whisper fallback only.")


def extract_audio_features(audio_path: str) -> dict:
    """
    Extract ML features from an audio file using librosa.
    Returns a dict of raw feature arrays used for scoring.
    """
    if not LIBROSA_AVAILABLE:
        return {}

    y, sr = librosa.load(audio_path, sr=None)

    # MFCCs — capture vocal tract shape (articulation quality)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_mean = np.mean(mfcc, axis=1)
    mfcc_std  = np.std(mfcc, axis=1)

    # RMS energy — how loud/strong the voice is
    rms = librosa.feature.rms(y=y)[0]

    # Zero-crossing rate — related to voice clarity
    zcr = librosa.feature.zero_crossing_rate(y)[0]

    # Pitch (F0) — confidence marker: stable pitch = confident speaker
    f0, voiced_flag, _ = librosa.pyin(
        y,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7"),
        sr=sr
    )

    # Silence detection — frames with very low energy are pauses
    silence_threshold = np.percentile(rms, 20)
    silence_frames = np.sum(rms < silence_threshold)
    total_frames = len(rms)

    return {
        "mfcc_mean": mfcc_mean,
        "mfcc_std": mfcc_std,
        "rms": rms,
        "zcr": zcr,
        "f0": f0,
        "voiced_flag": voiced_flag,
        "silence_ratio": silence_frames / total_frames if total_frames > 0 else 0,
        "duration_seconds": librosa.get_duration(y=y, sr=sr),
        "sr": sr
    }


def compute_confidence_score(features: dict, whisper_confidence: float = 50.0) -> float:
    """
    Confidence Level — scored 0-100.

    ML approach:
      - Pitch stability: low F0 variance → confident (no voice trembling)
      - RMS energy: strong consistent voice → confident
      - MFCC variance: clear articulation → confident
      - Blended with Whisper's log-probability score
    """
    if not features:
        return whisper_confidence

    f0 = features.get("f0")
    rms = features.get("rms", np.array([]))

    # Pitch stability (lower variance = more confident)
    voiced_f0 = f0[~np.isnan(f0)] if f0 is not None else np.array([])
    if len(voiced_f0) > 5:
        f0_cv = np.std(voiced_f0) / (np.mean(voiced_f0) + 1e-6)  # coefficient of variation
        # cv near 0 = stable (confident), cv > 0.3 = shaky (nervous)
        pitch_score = max(0.0, min(100.0, 100.0 - f0_cv * 200))
    else:
        pitch_score = 50.0

    # Energy level (louder but not shouting = confident)
    if len(rms) > 0:
        mean_rms = np.mean(rms)
        # Normalize: very quiet (<0.02) = unconfident, loud (>0.2) = very confident
        energy_score = min(100.0, max(0.0, (mean_rms / 0.15) * 80))
    else:
        energy_score = 50.0

    # Energy consistency (less variance = steady voice = confident)
    if len(rms) > 0:
        rms_cv = np.std(rms) / (np.mean(rms) + 1e-6)
        consistency_score = max(0.0, min(100.0, 100.0 - rms_cv * 60))
    else:
        consistency_score = 50.0

    # Blend: audio features 70%, Whisper log-prob 30%
    audio_confidence = pitch_score * 0.40 + energy_score * 0.35 + consistency_score * 0.25
    final = audio_confidence * 0.70 + whisper_confidence * 0.30

    return round(float(final), 1)


def compute_fluency_score(features: dict, filler_count: int = 0, word_count: int = 50) -> float:
    """
    Fluency — scored 0-100.

    ML approach:
      - Silence/pause ratio: too many pauses = disfluent
      - Energy consistency: smooth delivery = fluent
      - Filler word penalty (from text analysis)
      - ZCR stability: consistent articulation
    """
    if not features:
        filler_penalty = min(50, filler_count * 8)
        return max(0.0, 100.0 - filler_penalty)

    silence_ratio = features.get("silence_ratio", 0.3)
    rms = features.get("rms", np.array([]))
    zcr = features.get("zcr", np.array([]))

    # Pause score (ideal: 10-25% silence, natural speech rhythm)
    if silence_ratio < 0.10:
        pause_score = 75.0   # too fast, no pauses
    elif silence_ratio <= 0.30:
        pause_score = 100.0  # natural rhythm
    elif silence_ratio <= 0.50:
        pause_score = max(0.0, 100.0 - (silence_ratio - 0.30) * 200)
    else:
        pause_score = 10.0   # too many hesitations

    # ZCR consistency (stable = clear articulation)
    if len(zcr) > 0:
        zcr_cv = np.std(zcr) / (np.mean(zcr) + 1e-6)
        zcr_score = max(0.0, min(100.0, 100.0 - zcr_cv * 80))
    else:
        zcr_score = 60.0

    # Filler word penalty
    filler_rate = filler_count / max(word_count, 1) * 100  # fillers per 100 words
    filler_score = max(0.0, 100.0 - filler_rate * 15)

    fluency = pause_score * 0.40 + zcr_score * 0.25 + filler_score * 0.35
    return round(float(fluency), 1)


def compute_speaking_speed_score(wpm: float) -> float:
    """
    Speaking Speed — scored 0-100.
    Ideal interview pace: 120-160 WPM.
    """
    if wpm <= 0:
        return 50.0
    elif wpm < 80:
        score = (wpm / 80.0) * 55.0
    elif wpm < 120:
        score = 55.0 + ((wpm - 80) / 40.0) * 25.0
    elif wpm <= 160:
        score = 80.0 + ((wpm - 120) / 40.0) * 20.0
    elif wpm <= 200:
        score = max(50.0, 100.0 - ((wpm - 160) / 40.0) * 30.0)
    else:
        score = 20.0
    return round(float(score), 1)


def get_feature_vector(features: dict, wpm: float, fluency: float, confidence: float) -> list:
    """
    Build the feature vector used for the RandomForest performance classifier.
    Shape: [wpm, confidence, fluency, speaking_speed_score,
            mean_rms, f0_mean, f0_std, silence_ratio, mfcc1..13_mean]
    """
    speed_score = compute_speaking_speed_score(wpm)

    rms = features.get("rms", np.array([0.05]))
    f0  = features.get("f0")
    mfcc_mean = features.get("mfcc_mean", np.zeros(13))

    voiced_f0 = f0[~np.isnan(f0)] if f0 is not None else np.array([100.0])
    f0_mean = float(np.mean(voiced_f0)) if len(voiced_f0) > 0 else 100.0
    f0_std  = float(np.std(voiced_f0))  if len(voiced_f0) > 0 else 0.0

    base = [
        float(wpm),
        float(confidence),
        float(fluency),
        float(speed_score),
        float(np.mean(rms)),
        float(f0_mean),
        float(f0_std),
        float(features.get("silence_ratio", 0.3))
    ]
    mfcc_feats = [float(v) for v in mfcc_mean[:13]]
    return base + mfcc_feats
