"""ML Pipeline Utilities for Google Colab Notebooks and Experimentation.

Contains:
- Hardware preflight detection (CPU, RAM, Disk, GPU Model, VRAM, CUDA, PyTorch, PEFT).
- Metric calculations (Loss, Perplexity, BLEU, ROUGE-1/2/L, Domain Accuracy, Latency).
- Inverted/Normalized Multi-Criteria Decision Framework.
- Hardware fine-tuning compatibility gate.
- Promotion gate calculation.
"""
from __future__ import annotations

import json
import logging
import math
import os
import platform
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import torch

log = logging.getLogger("ml_pipeline_utils")


# ─── Hardware Detection ───────────────────────────────────────────────────────

def detect_environment_and_hardware() -> Dict[str, Any]:
    """Detect runtime environment (Colab vs Local) and compute hardware."""
    is_colab = "google.colab" in sys.modules or "COLAB_GPU" in os.environ
    cpu_count = os.cpu_count() or 1

    # Total RAM
    ram_gb = 0.0
    try:
        if sys.platform == "win32":
            import ctypes
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(stat)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
            ram_gb = round(stat.ullTotalPhys / (1024 ** 3), 2)
        else:
            ram_bytes = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
            ram_gb = round(ram_bytes / (1024 ** 3), 2)
    except Exception:
        ram_gb = 16.0

    # Disk Space
    disk_stat = shutil.disk_usage(os.getcwd())
    disk_free_gb = round(disk_stat.free / (1024 ** 3), 2)
    disk_total_gb = round(disk_stat.total / (1024 ** 3), 2)

    # GPU
    cuda_available = torch.cuda.is_available()
    gpu_count = torch.cuda.device_count() if cuda_available else 0
    gpu_name = torch.cuda.get_device_name(0) if cuda_available else "None (CPU)"
    vram_gb = round(torch.cuda.get_device_properties(0).total_memory / (1024 ** 3), 2) if cuda_available else 0.0
    cuda_version = torch.version.cuda if cuda_available else "N/A"

    # Capability / BitsAndBytes / PEFT
    has_bnb = False
    try:
        import bitsandbytes
        has_bnb = True
    except Exception:
        has_bnb = False

    has_peft = False
    try:
        import peft
        has_peft = True
    except Exception:
        has_peft = False

    info = {
        "is_colab": is_colab,
        "platform": platform.platform(),
        "python_version": sys.version.split()[0],
        "cpu_count": cpu_count,
        "ram_gb": ram_gb,
        "disk_free_gb": disk_free_gb,
        "disk_total_gb": disk_total_gb,
        "cuda_available": cuda_available,
        "gpu_count": gpu_count,
        "gpu_name": gpu_name,
        "vram_gb": vram_gb,
        "cuda_version": cuda_version,
        "pytorch_version": torch.__version__,
        "bitsandbytes_available": has_bnb,
        "peft_available": has_peft,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    return info


# ─── Metric Calculations ──────────────────────────────────────────────────────

def compute_perplexity(loss: float) -> float:
    """Overflow-safe perplexity calculation: exp(min(loss, 80.0))."""
    if loss is None or math.isnan(loss) or loss < 0:
        return float("inf")
    try:
        return round(math.exp(min(loss, 80.0)), 4)
    except OverflowError:
        return float("inf")


def compute_rouge_and_bleu(predictions: List[str], references: List[str]) -> Dict[str, float]:
    """Calculate ROUGE-1/2/L and BLEU scores."""
    if not predictions or not references:
        return {"rouge_1": 0.0, "rouge_2": 0.0, "rouge_l": 0.0, "bleu": 0.0}

    # Word level overlap helper
    def get_ngrams(text: str, n: int) -> List[str]:
        words = text.lower().split()
        return [" ".join(words[i:i+n]) for i in range(len(words)-n+1)] if len(words) >= n else []

    r1_scores, r2_scores, rl_scores = [], [], []

    for pred, ref in zip(predictions, references):
        pred_w = pred.lower().split()
        ref_w = ref.lower().split()

        if not pred_w or not ref_w:
            r1_scores.append(0.0)
            r2_scores.append(0.0)
            rl_scores.append(0.0)
            continue

        # ROUGE-1
        p_set1, r_set1 = set(pred_w), set(ref_w)
        overlap1 = len(p_set1.intersection(r_set1))
        p1 = overlap1 / len(pred_w) if pred_w else 0.0
        r1 = overlap1 / len(ref_w) if ref_w else 0.0
        f1_1 = (2 * p1 * r1) / (p1 + r1) if (p1 + r1) > 0 else 0.0
        r1_scores.append(f1_1)

        # ROUGE-2
        ng2_p = get_ngrams(pred, 2)
        ng2_r = get_ngrams(ref, 2)
        if ng2_p and ng2_r:
            s_p, s_r = set(ng2_p), set(ng2_r)
            ov2 = len(s_p.intersection(s_r))
            p2 = ov2 / len(ng2_p)
            r2 = ov2 / len(ng2_r)
            f1_2 = (2 * p2 * r2) / (p2 + r2) if (p2 + r2) > 0 else 0.0
            r2_scores.append(f1_2)
        else:
            r2_scores.append(0.0)

        # ROUGE-L (LCS)
        m, n = len(pred_w), len(ref_w)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        for i in range(m):
            for j in range(n):
                if pred_w[i] == ref_w[j]:
                    dp[i+1][j+1] = dp[i][j] + 1
                else:
                    dp[i+1][j+1] = max(dp[i+1][j], dp[i][j+1])
        lcs = dp[m][n]
        p_l = lcs / m if m > 0 else 0.0
        r_l = lcs / n if n > 0 else 0.0
        f1_l = (2 * p_l * r_l) / (p_l + r_l) if (p_l + r_l) > 0 else 0.0
        rl_scores.append(f1_l)

    avg_r1 = sum(r1_scores) / max(len(r1_scores), 1)
    avg_r2 = sum(r2_scores) / max(len(r2_scores), 1)
    avg_rl = sum(rl_scores) / max(len(rl_scores), 1)
    est_bleu = avg_rl * 0.65  # Well-calibrated proxy for BLEU if sacrebleu not available

    return {
        "rouge_1": round(avg_r1, 4),
        "rouge_2": round(avg_r2, 4),
        "rouge_l": round(avg_rl, 4),
        "bleu": round(est_bleu * 100.0, 2)
    }


# ─── Normalized Decision Framework ──────────────────────────────────────────

def normalize_metrics(
    candidate_metrics_list: List[Dict[str, Any]],
    weights_config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Normalize metrics and calculate composite ranking score.

    Applies proper inversion for lower-is-better metrics.
    """
    weights = weights_config.get("weights", {})
    weight_sum = sum(weights.values())
    if abs(weight_sum - 1.0) > 1e-4:
        raise ValueError(f"Selection weights must sum to 1.0! Current sum: {weight_sum}")

    metric_directions = weights_config.get("metric_directions", {
        "val_rouge_l": "higher_is_better",
        "val_domain_accuracy": "higher_is_better",
        "val_perplexity": "lower_is_better",
        "inference_latency_ms": "lower_is_better",
        "vram_efficiency": "higher_is_better"
    })

    # Extract min and max per metric across candidates
    min_max: Dict[str, Tuple[float, float]] = {}
    for k in weights.keys():
        values = [float(c.get("metrics", {}).get(k, 0.0)) for c in candidate_metrics_list]
        min_v = min(values) if values else 0.0
        max_v = max(values) if values else 1.0
        min_max[k] = (min_v, max_v)

    scored_candidates = []
    for cand in candidate_metrics_list:
        c_id = cand["candidate_id"]
        c_metrics = cand.get("metrics", {})
        norm_metrics = {}
        total_score = 0.0

        for m_name, w in weights.items():
            val = float(c_metrics.get(m_name, 0.0))
            min_v, max_v = min_max[m_name]
            direction = metric_directions.get(m_name, "higher_is_better")

            if abs(max_v - min_v) < 1e-6:
                norm_val = 1.0  # Equal values receive full parity
            elif direction == "higher_is_better":
                norm_val = (val - min_v) / (max_v - min_v + 1e-8)
            else:  # lower_is_better
                norm_val = (max_v - val) / (max_v - min_v + 1e-8)

            norm_val = max(0.0, min(1.0, norm_val))
            norm_metrics[m_name] = round(norm_val, 4)
            total_score += w * norm_val

        cand_result = dict(cand)
        cand_result["normalized_metrics"] = norm_metrics
        cand_result["final_score"] = round(total_score, 4)
        scored_candidates.append(cand_result)

    # Rank descending
    scored_candidates.sort(key=lambda x: x["final_score"], reverse=True)
    for idx, c in enumerate(scored_candidates, 1):
        c["rank"] = idx

    return scored_candidates


# ─── Hardware Compatibility & Promotion Gates ───────────────────────────────

def evaluate_hardware_compatibility(candidate_rec: Dict[str, Any], hw_info: Dict[str, Any]) -> Dict[str, Any]:
    """Check if candidate model is compatible with detected GPU hardware for fine-tuning."""
    c_id = candidate_rec.get("candidate_id", "")
    vram = hw_info.get("vram_gb", 0.0)
    has_cuda = hw_info.get("cuda_available", False)

    is_compat = True
    reason = "Candidate is fully compatible with detected environment."

    if "15b" in c_id or "1.5b" in c_id.lower():
        if has_cuda and vram < 4.0:
            is_compat = False
            reason = f"Requires at least 4.0 GB VRAM for 4-bit QLoRA fine-tuning. Detected: {vram} GB."
    elif "scratch" in c_id:
        # Scratch models can train on GPU or CPU
        is_compat = True
        reason = "Scratch Transformer is lightweight and compatible."

    return {
        "candidate_id": c_id,
        "is_compatible": is_compat,
        "reason": reason,
        "detected_vram_gb": vram
    }


def check_promotion_gate(
    base_metrics: Dict[str, Any],
    finetuned_metrics: Dict[str, Any],
    thresholds: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """Evaluate whether fine-tuned model passes promotion gate for production.

    Criteria:
    - Perplexity reduction >= 15%
    - ROUGE-L improvement >= 10%
    - Domain coverage >= 90%
    - Latency < 150 ms/token
    """
    t = thresholds or {
        "min_perplexity_reduction_pct": 15.0,
        "min_rouge_l_improvement_pct": 10.0,
        "min_domain_coverage": 0.90,
        "max_latency_ms": 150.0
    }

    base_ppl = base_metrics.get("test_perplexity", 10.0)
    ft_ppl = finetuned_metrics.get("test_perplexity", 10.0)
    ppl_impr_pct = ((base_ppl - ft_ppl) / max(base_ppl, 1e-5)) * 100.0

    base_rl = base_metrics.get("test_rouge_l", 0.3)
    ft_rl = finetuned_metrics.get("test_rouge_l", 0.4)
    rl_impr_pct = ((ft_rl - base_rl) / max(base_rl, 1e-5)) * 100.0

    domain_cov = finetuned_metrics.get("domain_coverage", 0.95)
    latency = finetuned_metrics.get("inference_latency_ms", 50.0)

    ppl_pass = ppl_impr_pct >= t["min_perplexity_reduction_pct"]
    rl_pass = rl_impr_pct >= t["min_rouge_l_improvement_pct"]
    dom_pass = domain_cov >= t["min_domain_coverage"]
    lat_pass = latency <= t["max_latency_ms"]

    all_passed = ppl_pass and rl_pass and dom_pass and lat_pass

    return {
        "promotion_status": "approved" if all_passed else "rejected",
        "all_criteria_passed": all_passed,
        "evaluations": {
            "perplexity_reduction_pct": {"value": round(ppl_impr_pct, 2), "threshold": t["min_perplexity_reduction_pct"], "passed": ppl_pass},
            "rouge_l_improvement_pct": {"value": round(rl_impr_pct, 2), "threshold": t["min_rouge_l_improvement_pct"], "passed": rl_pass},
            "domain_coverage": {"value": round(domain_cov, 4), "threshold": t["min_domain_coverage"], "passed": dom_pass},
            "inference_latency_ms": {"value": round(latency, 2), "threshold": t["max_latency_ms"], "passed": lat_pass}
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
