"""QLoRA fine-tuning for the Software Engineering Interview Assistant.

Fine-tunes an open-weights causal LM (Llama 3 / Mistral / Phi-3 / Qwen / Gemma)
with 4-bit NF4 quantisation + LoRA adapters, using HuggingFace TRL's SFTTrainer.
Tuned for a single NVIDIA Tesla T4 (~14.5 GB, compute capability 7.5 — fp16 only,
no bf16, no FlashAttention-2).

Only the LoRA adapter is saved, never the 8B base model.

Usage (run from ml-service/):

    # look at the dataset without loading a model
    python training/train_qlora.py --inspect_dataset

    # validate everything end to end without touching the GPU
    python training/train_qlora.py --dry_run

    # the real run
    python training/train_qlora.py \\
        --base_model meta-llama/Meta-Llama-3-8B \\
        --dataset dataset/processed/question_generator \\
        --output_dir training/output/interview_llm \\
        --epochs 3 --batch_size 1 --gradient_accumulation_steps 8

Authentication: gated repositories (Meta Llama 3) need a HuggingFace token.
Use `huggingface-cli login` or export HF_TOKEN. The token is never read from,
written to, or printed by this file.
"""
from __future__ import annotations

import argparse
import dataclasses
import inspect
import json
import logging
import os
import platform
import random
import sys
import time
from pathlib import Path
from typing import Any, Callable, Iterable

log = logging.getLogger("train_qlora")

ML_SERVICE = Path(__file__).resolve().parent.parent

DEFAULT_DATASET = ML_SERVICE / "dataset" / "processed" / "question_generator"
DEFAULT_OUTPUT = ML_SERVICE / "training" / "output" / "interview_llm"

# Bumped whenever the T4 precision handling changes. Printed at startup so it is
# immediately obvious which copy of this file a remote machine is running.
PRECISION_FIX_BUILD = "t4-fp16-guard-4"

SYSTEM_PROMPT = (
    "You are a senior software engineering interviewer. You ask precise "
    "technical interview questions and give accurate, concise technical answers."
)

# Attention + MLP projections per architecture. Verified against the loaded
# model before use; anything unknown falls back to auto-discovery.
ARCH_TARGET_MODULES: dict[str, list[str]] = {
    "llama": ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    "mistral": ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    "mixtral": ["q_proj", "k_proj", "v_proj", "o_proj"],
    "qwen2": ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    "qwen3": ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    "gemma": ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    "gemma2": ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    "phi3": ["qkv_proj", "o_proj", "gate_up_proj", "down_proj"],
    "phi": ["q_proj", "k_proj", "v_proj", "dense", "fc1", "fc2"],
    "falcon": ["query_key_value", "dense", "dense_h_to_4h", "dense_4h_to_h"],
    "gpt_neox": ["query_key_value", "dense", "dense_h_to_4h", "dense_4h_to_h"],
}
ATTENTION_ONLY = ["q_proj", "k_proj", "v_proj", "o_proj"]

NEVER_TARGET = {"lm_head", "score", "embed_out", "embed_tokens", "classifier"}


# ══════════════════════════════════════════════════════════════════════════════
# Dataset loading
# ══════════════════════════════════════════════════════════════════════════════

def read_records(path: Path) -> list[dict]:
    """Read one .json (list or {"data": [...]}) or .jsonl file into dicts.

    Malformed JSONL lines are reported by line number rather than swallowed.
    """
    if not path.exists():
        raise FileNotFoundError(f"dataset file not found: {path}")

    text = path.read_text(encoding="utf-8")
    if path.suffix == ".jsonl":
        records, bad = [], []
        for lineno, line in enumerate(text.splitlines(), 1):
            if not line.strip():
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                bad.append((lineno, str(exc)))
        if bad:
            log.warning("%s: %d unparseable JSONL lines (first: line %d — %s)",
                        path.name, len(bad), bad[0][0], bad[0][1])
        return records

    payload = json.loads(text)
    if isinstance(payload, dict):
        for key in ("data", "records", "samples", "examples"):
            if isinstance(payload.get(key), list):
                return payload[key]
        raise ValueError(f"{path}: JSON object has no list under data/records/samples/examples")
    if not isinstance(payload, list):
        raise ValueError(f"{path}: expected a JSON list, got {type(payload).__name__}")
    return payload


SPLIT_ALIASES = {
    "train": ("train",),
    "validation": ("validation", "val", "valid", "dev", "eval"),
    "test": ("test",),
}


def _find_split_file(directory: Path, split: str) -> Path | None:
    for stem in SPLIT_ALIASES[split]:
        for suffix in (".jsonl", ".json"):
            candidate = directory / f"{stem}{suffix}"
            if candidate.exists():
                return candidate
    return None


def load_dataset_files(dataset_arg: str, eval_arg: str | None) -> tuple[list[dict], list[dict], dict]:
    """Resolve --dataset (file or directory) into raw train/eval record lists.

    A directory is searched for train/validation files. A single file named
    `train.*` gets its sibling `val.*` / `validation.*` picked up automatically
    when one exists and is non-empty. Otherwise the caller splits.
    """
    path = Path(dataset_arg)
    if not path.is_absolute():
        path = (Path.cwd() / path).resolve()
    provenance: dict[str, Any] = {"dataset_arg": str(dataset_arg)}

    if path.is_dir():
        train_file = _find_split_file(path, "train")
        if train_file is None:
            raise FileNotFoundError(
                f"{path} is a directory but contains no train.json / train.jsonl")
        eval_file = _find_split_file(path, "validation")
        provenance["mode"] = "directory"
    else:
        train_file = path
        eval_file = None
        provenance["mode"] = "single file"
        # Sibling validation file, e.g. dataset/training/train.json + val.json
        if train_file.stem.lower() in SPLIT_ALIASES["train"]:
            sibling = _find_split_file(train_file.parent, "validation")
            if sibling is not None:
                eval_file = sibling

    if eval_arg:
        eval_path = Path(eval_arg)
        if not eval_path.is_absolute():
            eval_path = (Path.cwd() / eval_path).resolve()
        eval_file = eval_path
        provenance["eval_explicit"] = True

    train_records = read_records(train_file)
    provenance["train_file"] = str(train_file)

    eval_records: list[dict] = []
    if eval_file is not None:
        eval_records = read_records(eval_file)
        if eval_records:
            provenance["eval_file"] = str(eval_file)
        else:
            log.warning("validation file %s is empty — falling back to an in-script split",
                        eval_file)
            provenance["eval_file_empty"] = str(eval_file)

    return train_records, eval_records, provenance


# ══════════════════════════════════════════════════════════════════════════════
# Schema detection and formatting
# ══════════════════════════════════════════════════════════════════════════════

def _clean(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return ", ".join(str(v).strip() for v in value if str(v).strip())
    return str(value).strip()


def detect_schema(record: dict) -> str:
    """Name the schema of a single record. Order matters — most specific first."""
    if not isinstance(record, dict):
        return "unknown"
    keys = set(record)
    if "messages" in keys and isinstance(record.get("messages"), list):
        return "chat_messages"
    if "output" in keys and ({"instruction", "input"} & keys):
        return "instruction_io"
    if "interview_question" in keys:
        return "research_plan"
    if "prompt" in keys and "completion" in keys:
        return "prompt_completion"
    if "question" in keys and ({"answer", "expected_answer", "response"} & keys):
        return "question_answer"
    if "question" in keys:
        return "question_only"
    if "text" in keys:
        return "raw_text"
    return "unknown"


def _generation_request(record: dict) -> str:
    """The 'ask me a question about X' user turn, built only from present fields."""
    difficulty = _clean(record.get("difficulty_level") or record.get("difficulty"))
    topic = _clean(record.get("technology") or record.get("domain")
                   or record.get("topic") or record.get("category")
                   or record.get("topic_category"))

    head = "Ask me a"
    if difficulty:
        head += f" {difficulty.lower()}"
    head += " software engineering interview question"
    if topic:
        head += f" about {topic}"
    head += "."

    lines = [head]
    for label, value in (("Role", record.get("role")),
                         ("Experience", record.get("experience_level")),
                         ("Question type", record.get("question_type"))):
        cleaned = _clean(value)
        if cleaned:
            lines.append(f"{label}: {cleaned}")
    return "\n".join(lines)


def record_to_examples(record: dict, schema: str, task: str) -> list[tuple[str, str, str]]:
    """Turn one record into (user_turn, assistant_turn, kind) triples.

    Nothing is invented: every assistant turn is text that already exists in the
    record. `task` selects which of the available pairs to emit, and `kind` says
    which supervision each pair provides.
    """
    want_generation = task in ("question_generation", "both")
    want_answer = task in ("answer", "both")
    pairs: list[tuple[str, str, str]] = []

    if schema == "chat_messages":
        messages = record.get("messages") or []
        user = next((_clean(m.get("content")) for m in reversed(messages)
                     if m.get("role") == "user"), "")
        assistant = next((_clean(m.get("content")) for m in reversed(messages)
                          if m.get("role") == "assistant"), "")
        if user and assistant:
            pairs.append((user, assistant, "chat"))
        return pairs

    if schema == "prompt_completion":
        user, assistant = _clean(record.get("prompt")), _clean(record.get("completion"))
        if user and assistant:
            pairs.append((user, assistant, "prompt_completion"))
        return pairs

    if schema == "raw_text":
        return pairs  # handled separately: no prompt/completion structure

    if schema == "instruction_io":
        # Already an instruction dataset — preserve it rather than rewriting.
        instruction = _clean(record.get("instruction"))
        extra = _clean(record.get("input"))
        user = f"{instruction}\n{extra}".strip() if extra else instruction
        assistant = _clean(record.get("output"))
        if want_generation and user and assistant:
            pairs.append((user, assistant, "question_generation"))
        if want_answer:
            question = _clean(record.get("question")) or assistant
            answer = _clean(record.get("expected_answer") or record.get("answer"))
            if question and answer:
                pairs.append((question, answer, "answer"))
        return pairs

    question = _clean(record.get("interview_question") or record.get("question"))
    answer = _clean(record.get("expected_answer") or record.get("answer")
                    or record.get("response"))

    if want_generation and question:
        pairs.append((_generation_request(record), question, "question_generation"))
    if want_answer and question and answer:
        pairs.append((question, answer, "answer"))
    return pairs


MIN_USER_CHARS = 8
MIN_ASSISTANT_CHARS = 8


class DatasetReport:
    """Counts every record the loader saw, and why it was dropped."""

    def __init__(self) -> None:
        self.schemas: dict[str, int] = {}
        self.drops: dict[str, int] = {}
        self.examples_from_task: dict[str, int] = {}
        self.warnings: list[str] = []
        self.records = 0
        self.examples = 0
        self.duplicates = 0

    def bump(self, bucket: dict[str, int], key: str) -> None:
        bucket[key] = bucket.get(key, 0) + 1

    def warn(self, message: str, cap: int = 10) -> None:
        if len(self.warnings) < cap:
            self.warnings.append(message)
            log.warning("%s", message)
        elif len(self.warnings) == cap:
            self.warnings.append("... further per-record warnings suppressed")
            log.warning("... further per-record warnings suppressed "
                        "(see the drop counts in the dataset report)")

    def as_dict(self) -> dict:
        return {
            "records_read": self.records,
            "examples_built": self.examples,
            "duplicate_examples_removed": self.duplicates,
            "schemas_detected": dict(sorted(self.schemas.items())),
            "records_dropped": dict(sorted(self.drops.items())),
            "examples_per_task": dict(sorted(self.examples_from_task.items())),
        }


def build_examples(records: Iterable[dict], task: str, report: DatasetReport,
                   label: str) -> list[dict]:
    """Validate records and expand them into {"user", "assistant"} examples."""
    out: list[dict] = []
    for index, record in enumerate(records):
        report.records += 1
        if not isinstance(record, dict):
            report.bump(report.drops, "not_an_object")
            report.warn(f"{label}[{index}]: record is {type(record).__name__}, not an object")
            continue

        schema = detect_schema(record)
        report.bump(report.schemas, schema)
        if schema == "unknown":
            report.bump(report.drops, "unrecognised_schema")
            report.warn(f"{label}[{index}]: no recognised fields "
                        f"(keys: {sorted(record)[:8]})")
            continue
        if schema == "raw_text":
            text = _clean(record.get("text"))
            if len(text) < MIN_ASSISTANT_CHARS:
                report.bump(report.drops, "empty_text")
                continue
            out.append({"user": "", "assistant": "", "text": text, "schema": schema})
            report.bump(report.examples_from_task, "raw_text")
            continue

        pairs = record_to_examples(record, schema, task)
        if not pairs:
            report.bump(report.drops, f"no_usable_pair_{schema}")
            report.warn(f"{label}[{index}]: schema '{schema}' produced no usable "
                        f"user/assistant pair for task '{task}'")
            continue

        for user, assistant, kind in pairs:
            if len(user) < MIN_USER_CHARS:
                report.bump(report.drops, "user_turn_too_short")
                report.warn(f"{label}[{index}]: user turn too short ({len(user)} chars)")
                continue
            if len(assistant) < MIN_ASSISTANT_CHARS:
                report.bump(report.drops, "assistant_turn_too_short")
                report.warn(f"{label}[{index}]: assistant turn too short "
                            f"({len(assistant)} chars)")
                continue
            out.append({"user": user, "assistant": assistant,
                        "schema": schema, "kind": kind})
            report.bump(report.examples_from_task, kind)

    report.examples += len(out)
    return out


def deduplicate_examples(examples: list[dict], report: DatasetReport) -> list[dict]:
    """Drop identical (user, assistant) pairs — first occurrence wins.

    Runs before the split, so an example cannot land in both train and eval.
    """
    seen: set[tuple[str, str]] = set()
    out = []
    for example in examples:
        key = (example.get("user", ""), example.get("assistant", "") or example.get("text", ""))
        if key in seen:
            report.duplicates += 1
            continue
        seen.add(key)
        out.append(example)
    return out


# ══════════════════════════════════════════════════════════════════════════════
# Prompt rendering
# ══════════════════════════════════════════════════════════════════════════════

def make_renderer(tokenizer: Any, style: str, use_system: bool) -> tuple[Callable, Callable, str]:
    """Return (render_prompt, render_completion, resolved_style).

    `chat` uses the tokenizer's own chat template — correct for *-Instruct
    checkpoints. `plain` is the documented User:/Assistant: layout, which is what
    base checkpoints (Meta-Llama-3-8B has no chat template) need.
    """
    has_template = bool(getattr(tokenizer, "chat_template", None))
    resolved = style
    if style == "auto":
        resolved = "chat" if has_template else "plain"
    if resolved == "chat" and not has_template:
        log.warning("--prompt_style chat requested but %s has no chat_template; "
                    "falling back to plain", getattr(tokenizer, "name_or_path", "tokenizer"))
        resolved = "plain"

    if resolved == "chat":
        def render_prompt(user: str) -> str:
            messages = ([{"role": "system", "content": SYSTEM_PROMPT}] if use_system else [])
            messages.append({"role": "user", "content": user})
            return tokenizer.apply_chat_template(messages, tokenize=False,
                                                 add_generation_prompt=True)

        def render_completion(assistant: str) -> str:
            return assistant + (tokenizer.eos_token or "")
    else:
        header = f"{SYSTEM_PROMPT}\n\n" if use_system else ""

        def render_prompt(user: str) -> str:
            return f"{header}User:\n{user}\n\nAssistant:\n"

        def render_completion(assistant: str) -> str:
            return assistant + (tokenizer.eos_token or "")

    return render_prompt, render_completion, resolved


# ══════════════════════════════════════════════════════════════════════════════
# Version-tolerant kwargs
# ══════════════════════════════════════════════════════════════════════════════

def accepted_fields(cls: type) -> set[str]:
    """Field names a dataclass-style config actually accepts, in any version."""
    names: set[str] = set()
    if dataclasses.is_dataclass(cls):
        names |= {f.name for f in dataclasses.fields(cls)}
    try:
        names |= set(inspect.signature(cls.__init__).parameters) - {"self"}
    except (TypeError, ValueError):
        pass
    return names


def filter_kwargs(cls: type, kwargs: dict, aliases: dict[str, list[str]] | None = None
                  ) -> tuple[dict, list[str]]:
    """Keep only kwargs `cls` accepts, renaming through `aliases` where needed.

    TRL and transformers have renamed several of these across versions
    (`max_seq_length`→`max_length`, `evaluation_strategy`→`eval_strategy`,
    `warmup_ratio` removed). Rather than pinning one version, ask the class.
    """
    supported = accepted_fields(cls)
    out, dropped = {}, []
    for key, value in kwargs.items():
        if key in supported:
            out[key] = value
            continue
        renamed = False
        for candidate in (aliases or {}).get(key, []):
            if candidate in supported:
                out[candidate] = value
                renamed = True
                break
        if not renamed:
            dropped.append(key)
    return out, dropped


CONFIG_ALIASES = {
    "max_length": ["max_seq_length"],
    "max_seq_length": ["max_length"],
    "eval_strategy": ["evaluation_strategy"],
    "evaluation_strategy": ["eval_strategy"],
}


# ══════════════════════════════════════════════════════════════════════════════
# Environment
# ══════════════════════════════════════════════════════════════════════════════

def set_seed_everywhere(seed: int) -> None:
    random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    try:
        import numpy as np
        np.random.seed(seed)
    except ImportError:
        pass
    try:
        import torch
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
    except ImportError:
        pass


def library_versions() -> dict[str, str]:
    import importlib
    versions = {"python": platform.python_version(), "platform": platform.platform()}
    for module in ("torch", "transformers", "datasets", "peft", "trl",
                   "bitsandbytes", "accelerate", "huggingface_hub"):
        try:
            versions[module] = getattr(importlib.import_module(module), "__version__", "unknown")
        except Exception:
            versions[module] = "not installed"
    return versions


def force_fp16_mixed_precision_env() -> dict[str, Any]:
    """Pin Accelerate to fp16 before transformers builds its Accelerator.

    transformers resolves mixed precision like this (training_args.py):

        self.mixed_precision = os.environ.get("ACCELERATE_MIXED_PRECISION", "no")
        if self.fp16:   self.mixed_precision = "fp16"
        elif self.bf16: self.mixed_precision = "bf16"

    and then passes it straight to `Accelerator(mixed_precision=...)`. The env
    var is the *base* value, so a stale `ACCELERATE_MIXED_PRECISION=bf16` left by
    an `accelerate config`, a Colab magic, or an earlier cell would take effect
    for any code path that does not set fp16 explicitly. AcceleratorState is also
    a process-wide shared singleton, so an Accelerator built earlier in the same
    Python process pins the mode for everything created afterwards.

    This pins the env to fp16 and clears a previously initialised state so the
    Trainer's Accelerator is guaranteed to be built fresh in fp16.
    """
    before = {k: os.environ.get(k) for k in
              ("ACCELERATE_MIXED_PRECISION", "ACCELERATE_USE_FP16", "ACCELERATE_USE_BF16")}
    os.environ["ACCELERATE_MIXED_PRECISION"] = "fp16"
    os.environ.pop("ACCELERATE_USE_BF16", None)

    reset = False
    try:
        from accelerate.state import AcceleratorState, PartialState
        if getattr(AcceleratorState, "_shared_state", None):
            AcceleratorState._reset_state()
            PartialState._reset_state()
            reset = True
    except Exception as exc:
        log.debug("could not reset AcceleratorState (%s) — continuing", exc)

    return {"env_before": before, "env_after": "fp16", "accelerator_state_reset": reset}


def non_fp32_trainable(model: Any) -> list[tuple[str, str, int]]:
    """Every trainable parameter that is not float32: (name, dtype, numel)."""
    out = []
    for name, param in model.named_parameters():
        if param.requires_grad and str(param.dtype) != "torch.float32":
            out.append((name, str(param.dtype), param.numel()))
    return out


def assert_fp16_grad_safe(model: Any, where: str) -> None:
    """Fail loudly, with the offending parameters named, instead of deep in torch.

    Under fp16 AMP `GradScaler.unscale_()` accepts only fp32 gradients:
      * bfloat16 -> `_amp_foreach_non_finite_check_and_unscale_cuda` has no bf16
        kernel  -> NotImplementedError
      * float16  -> explicit `ValueError: Attempting to unscale FP16 gradients.`
    Gradients inherit the parameter dtype, so fp32 parameters are the requirement.
    """
    offenders = non_fp32_trainable(model)
    if not offenders:
        return
    total = sum(n for _, _, n in offenders)
    lines = [f"    {name}  {dtype}  ({numel:,} params)"
             for name, dtype, numel in offenders[:10]]
    if len(offenders) > 10:
        lines.append(f"    ... and {len(offenders) - 10} more tensors")
    raise RuntimeError(
        f"precision guard failed at {where}: {len(offenders)} trainable tensors "
        f"({total:,} parameters) are not float32 while fp16 AMP is active.\n"
        + "\n".join(lines)
        + "\n\nThe GradScaler would raise NotImplementedError on the first "
          "optimizer step. Report this output — it names exactly which module "
          "re-introduced the dtype."
    )


def make_precision_guard_callback():
    """TrainerCallback that re-asserts fp32 trainable params inside train().

    The one-shot cast after SFTTrainer() is not sufficient on its own: anything
    that runs later inside `Trainer.train()` — `accelerator.prepare()`, a model
    re-wrap, a second PEFT pass — could reintroduce a non-fp32 dtype. This hooks
    the two events that still precede the first `_clip_grad_norm`:

        on_train_begin  -> after create_optimizer_and_scheduler + prepare()
        on_step_begin   -> before the forward/backward of each accumulation step

    `on_pre_optimizer_step` is deliberately NOT used: in transformers 5.x it
    fires *after* `_clip_grad_norm`, which is where the crash happens.
    """
    from transformers import TrainerCallback

    class Fp16PrecisionGuard(TrainerCallback):
        def __init__(self) -> None:
            self.recasts: list[dict] = []

        def _apply(self, model, where: str) -> None:
            if model is None:
                return
            recast = enforce_fp16_safe_trainable_dtype(model)
            if recast:
                self.recasts.append({"where": where, "recast": recast})
                log.warning("precision guard (%s): recast %s back to float32", where,
                            ", ".join(f"{n:,} params from {d}" for d, n in recast.items()))
            assert_fp16_grad_safe(model, where)

        def on_train_begin(self, args, state, control, model=None, **kwargs):
            self._apply(model, "on_train_begin")

        def on_step_begin(self, args, state, control, model=None, **kwargs):
            # Only the first optimizer step needs checking; after that the dtype
            # is stable and this would be pure overhead.
            if state.global_step == 0:
                self._apply(model, "on_step_begin(step 0)")

    return Fp16PrecisionGuard()


def native_bf16_supported() -> bool:
    """True only when the GPU has *native* bfloat16 tensor cores (Ampere, sm_80+).

    Deliberately NOT `torch.cuda.is_bf16_supported()`. That function falls back to
    an emulation probe — it simply allocates a bf16 tensor — which succeeds on a
    Tesla T4 (sm_75) even though the hardware has no bf16 tensor cores and the
    AMP GradScaler has no bf16 kernels. Trusting it is what leads libraries to
    select bf16 on a T4 and fail at the first optimizer step.
    """
    try:
        import torch
    except ImportError:
        return False
    if not torch.cuda.is_available():
        return False
    return torch.cuda.get_device_properties(0).major >= 8


def dtype_census(model: Any) -> tuple[dict[str, int], dict[str, int]]:
    """(frozen, trainable) parameter-count breakdown by dtype."""
    frozen: dict[str, int] = {}
    trainable: dict[str, int] = {}
    for _, param in model.named_parameters():
        key = str(param.dtype).replace("torch.", "")
        if param.__class__.__name__ == "Params4bit":
            key += " (4-bit NF4)"
        bucket = trainable if param.requires_grad else frozen
        bucket[key] = bucket.get(key, 0) + param.numel()
    return frozen, trainable


def enforce_fp16_safe_trainable_dtype(model: Any) -> dict[str, int]:
    """Force every trainable parameter to fp32 and report what had to change.

    Required because TRL casts LoRA adapter weights to bfloat16 whenever the base
    model is quantized (trl/trainer/sft_trainer.py, "the PEFT adapter weights are
    converted to bf16 to follow the recommendations from the original paper").
    That cast is unconditional — it does not check GPU capability, and it does not
    check whether fp16 AMP is active. Under fp16 AMP the backward pass then
    produces bfloat16 gradients, and `GradScaler.unscale_()` dispatches to
    `_amp_foreach_non_finite_check_and_unscale_cuda`, which has no bfloat16
    kernel:

        NotImplementedError: "_amp_foreach_non_finite_check_and_unscale_cuda"
                             not implemented for 'BFloat16'

    fp32 master weights are the correct target: `torch.autocast` still runs the
    matmuls in fp16, so speed and activation memory are unaffected, while the
    gradients land in fp32 where the scaler has kernels. This is the standard AMP
    recipe and what QLoRA reference implementations use on pre-Ampere hardware.

    Idempotent: on a TRL build that does not perform the cast it changes nothing.
    """
    import torch

    changed: dict[str, int] = {}
    for _, param in model.named_parameters():
        if param.requires_grad and param.dtype != torch.float32:
            key = str(param.dtype).replace("torch.", "")
            changed[key] = changed.get(key, 0) + param.numel()
            # Reassigning .data keeps the Parameter object identity, so any
            # optimizer param group already referencing it stays valid.
            param.data = param.data.to(torch.float32)
    return changed


def print_precision_report(model: Any, sft_config: Any, gpu: dict,
                           trainer: Any = None) -> dict:
    """Print the precision diagnostics and return them for the metadata file."""
    import torch

    scaler = None
    if trainer is not None:
        accelerator = getattr(trainer, "accelerator", None)
        scaler = getattr(accelerator, "scaler", None) if accelerator else None

    accelerator = getattr(trainer, "accelerator", None) if trainer is not None else None
    first_trainable = next(((n, str(pp.dtype)) for n, pp in model.named_parameters()
                            if pp.requires_grad), (None, None))

    frozen, trainable = dtype_census(model)
    report = {
        "precision_fix_build": PRECISION_FIX_BUILD,
        "torch_version": torch.__version__,
        "cuda_version": torch.version.cuda,
        "gpu_name": gpu.get("name"),
        "compute_capability": gpu.get("capability"),
        "torch_cuda_is_bf16_supported": (torch.cuda.is_bf16_supported()
                                         if torch.cuda.is_available() else None),
        "device_capability_tuple": (list(torch.cuda.get_device_capability(0))
                                   if torch.cuda.is_available() else None),
        "native_bf16_tensor_cores": native_bf16_supported(),
        "accelerator_mixed_precision": getattr(accelerator, "mixed_precision", None),
        "accelerator_native_amp": getattr(accelerator, "native_amp", None),
        "env_ACCELERATE_MIXED_PRECISION": os.environ.get("ACCELERATE_MIXED_PRECISION"),
        "first_trainable_param": first_trainable[0],
        "first_trainable_param_dtype": first_trainable[1],
        "bnb_4bit_compute_dtype": "torch.float16",
        "fp16": bool(getattr(sft_config, "fp16", False)),
        "bf16": bool(getattr(sft_config, "bf16", False)),
        "grad_scaler": type(scaler).__name__ if scaler is not None else "none",
        "grad_scaler_enabled": bool(getattr(scaler, "is_enabled", lambda: False)())
                               if scaler is not None else False,
        "frozen_parameter_dtypes": frozen,
        "trainable_parameter_dtypes": trainable,
    }

    print("-" * 60)
    print("PRECISION DIAGNOSTICS")
    print("-" * 60)
    print(f"  precision fix build          {report['precision_fix_build']}")
    print(f"  torch                        {report['torch_version']}")
    print(f"  CUDA                         {report['cuda_version']}")
    print(f"  GPU                          {report['gpu_name']} "
          f"(compute capability {report['compute_capability']})")
    print(f"  torch.cuda.is_bf16_supported {report['torch_cuda_is_bf16_supported']}"
          f"   <- emulation probe, True on a T4; do not trust it")
    print(f"  native bf16 tensor cores     {report['native_bf16_tensor_cores']}"
          f"   <- the value that actually matters")
    print(f"  bnb_4bit_compute_dtype       {report['bnb_4bit_compute_dtype']}")
    print(f"  SFTConfig.fp16               {report['fp16']}")
    print(f"  SFTConfig.bf16               {report['bf16']}")
    print(f"  device capability tuple      {report['device_capability_tuple']}")
    print(f"  Accelerator.mixed_precision  {report['accelerator_mixed_precision']}")
    print(f"  Accelerator.native_amp       {report['accelerator_native_amp']}")
    print(f"  ACCELERATE_MIXED_PRECISION   {report['env_ACCELERATE_MIXED_PRECISION']}")
    print(f"  gradient scaler              {report['grad_scaler']} "
          f"(enabled={report['grad_scaler_enabled']})")
    print(f"  first trainable parameter    {report['first_trainable_param']}")
    print(f"                        dtype  {report['first_trainable_param_dtype']}")
    print("  frozen parameters:")
    for dtype, count in sorted(frozen.items(), key=lambda kv: -kv[1]):
        print(f"      {dtype:24} {count:>14,}")
    print("  trainable parameters (LoRA):")
    for dtype, count in sorted(trainable.items(), key=lambda kv: -kv[1]):
        print(f"      {dtype:24} {count:>14,}")
    print("-" * 60)
    return report


def gpu_info() -> dict[str, Any]:
    try:
        import torch
    except ImportError:
        return {"cuda_available": False, "name": None, "vram_gb": None,
                "note": "torch is not installed"}
    if not torch.cuda.is_available():
        return {"cuda_available": False, "name": None, "vram_gb": None}
    props = torch.cuda.get_device_properties(0)
    return {
        "cuda_available": True,
        "name": props.name,
        "vram_gb": round(props.total_memory / 1024 ** 3, 2),
        "capability": f"{props.major}.{props.minor}",
        # props.major >= 8 is the real test. torch.cuda.is_bf16_supported() also
        # returns True on a T4 via an emulation probe, which is misleading here.
        "supports_bf16": props.major >= 8,
        "torch_reports_bf16": torch.cuda.is_bf16_supported(),
    }


def resolve_optimizer(requested: str) -> str:
    """Fall back off the bitsandbytes optimisers when bitsandbytes is missing."""
    if "8bit" not in requested and "paged" not in requested:
        return requested
    try:
        import bitsandbytes  # noqa: F401
        return requested
    except Exception:
        log.warning("bitsandbytes is unavailable, so '%s' cannot be used — "
                    "falling back to adamw_torch (uses more VRAM)", requested)
        return "adamw_torch"


def hf_token() -> str | None:
    """Token from the standard HF mechanisms. Never logged, never persisted."""
    for variable in ("HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "HUGGINGFACEHUB_API_TOKEN"):
        value = os.environ.get(variable)
        if value:
            return value
    try:
        from huggingface_hub import get_token
        return get_token()
    except Exception:
        return None


def explain_access_error(model_id: str, token: str | None, exc: BaseException) -> None:
    """Turn a hub 401/403 into instructions. Never echoes the token itself."""
    message = str(exc).lower()
    gated = ("gated" in message or "403" in message or "401" in message
             or "restricted" in message or "authorized list" in message
             or type(exc).__name__ in ("GatedRepoError", "LocalTokenNotFoundError"))
    print()
    print("=" * 60)
    if gated:
        print(f"ACCESS DENIED: {model_id} is a gated repository")
        print("=" * 60)
        print(f"HuggingFace token detected: {'yes' if token else 'no'}")
        print("To use this model you must:")
        print(f"  1. Accept the licence at https://huggingface.co/{model_id}")
        print("     (Meta approval for Llama 3 is usually granted within minutes.)")
        print("  2. Authenticate, using any of:")
        print("        huggingface-cli login")
        print("        python -c 'from huggingface_hub import login; login()'   # Colab")
        print("        export HF_TOKEN=<your token>")
        if token:
            print()
            print("  A token was found, so step 2 is already done — step 1 is what is")
            print("  missing: this account has not been granted access to the repo yet.")
        print()
        print("Ungated alternatives that need no approval:")
        print("        mistralai/Mistral-7B-v0.3")
        print("        microsoft/Phi-3-mini-4k-instruct")
        print("        Qwen/Qwen2.5-7B-Instruct")
    else:
        print(f"COULD NOT LOAD: {model_id}")
        print("=" * 60)
        print(f"{type(exc).__name__}: {exc}")
    print("=" * 60)


def check_model_access(model_id: str, token: str | None) -> None:
    """Catch a plainly missing repo before any multi-GB download starts.

    A gated repo often answers 200 on the metadata endpoint while refusing the
    weight files, so this is a cheap pre-check only — the authoritative check
    is the tokenizer load in train().
    """
    if Path(model_id).exists():
        return
    try:
        from huggingface_hub import model_info
        model_info(model_id, token=token)
    except Exception as exc:
        if type(exc).__name__ == "RepositoryNotFoundError":
            log.error("No such model on the HuggingFace Hub: '%s'", model_id)
            raise SystemExit(2)
        log.debug("hub pre-check for '%s' was inconclusive (%s: %s)",
                  model_id, type(exc).__name__, exc)


# ══════════════════════════════════════════════════════════════════════════════
# Model
# ══════════════════════════════════════════════════════════════════════════════

def resolve_target_modules(model: Any, requested: str) -> list[str]:
    """Pick LoRA target modules for whatever architecture actually loaded."""
    present = {name.split(".")[-1] for name, _ in model.named_modules()}

    if requested not in ("auto", "attention"):
        chosen = [m.strip() for m in requested.split(",") if m.strip()]
        missing = [m for m in chosen if m not in present]
        if missing:
            raise SystemExit(
                f"--lora_target_modules names modules this model does not have: {missing}\n"
                f"Available leaf module names include: {sorted(present)[:40]}")
        return chosen

    if requested == "attention":
        chosen = [m for m in ATTENTION_ONLY if m in present]
        if chosen:
            return chosen

    model_type = getattr(getattr(model, "config", None), "model_type", "") or ""
    for arch, modules in ARCH_TARGET_MODULES.items():
        if model_type.startswith(arch):
            chosen = [m for m in modules if m in present]
            if chosen:
                log.info("LoRA targets from the '%s' architecture map", arch)
                return chosen

    discovered = set()
    for name, module in model.named_modules():
        if module.__class__.__name__ in ("Linear4bit", "Linear8bitLt", "Linear"):
            leaf = name.split(".")[-1]
            if leaf and leaf not in NEVER_TARGET and not leaf.isdigit():
                discovered.add(leaf)
    if not discovered:
        raise SystemExit("could not determine LoRA target modules; pass "
                         "--lora_target_modules q_proj,k_proj,v_proj,o_proj")
    log.info("LoRA targets auto-discovered from the loaded model (model_type=%r)", model_type)
    return sorted(discovered)


def load_tokenizer(model_id: str, token: str | None):
    from transformers import AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(model_id, token=token, use_fast=True)
    if tokenizer.pad_token is None:
        # Never reuse eos as pad without also keeping them distinct in the labels;
        # SFTTrainer masks padding via the attention mask, so eos-as-pad is safe.
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"  # left padding corrupts causal-LM training
    return tokenizer


def load_quantised_model(model_id: str, token: str | None, gradient_checkpointing: bool,
                         quantise: bool = True):
    """Load the base model, 4-bit NF4 by default.

    `quantise=False` (--no_4bit) skips bitsandbytes entirely so the pipeline can
    be smoke-tested on CPU or run on a small model in full precision.
    """
    import torch
    import transformers
    from transformers import AutoModelForCausalLM

    on_cuda = torch.cuda.is_available()
    kwargs: dict[str, Any] = {
        "device_map": {"": 0} if on_cuda else "cpu",
        "token": token,
    }
    if quantise:
        from transformers import BitsAndBytesConfig
        kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            # T4 is compute capability 7.5 — bfloat16 is not supported, fp16 is.
            bnb_4bit_compute_dtype=torch.float16,
        )
    # transformers renamed torch_dtype -> dtype in v5.
    major = int(str(transformers.__version__).split(".")[0])
    kwargs["dtype" if major >= 5 else "torch_dtype"] = (
        torch.float16 if on_cuda else torch.float32)

    # FlashAttention-2 needs Ampere or newer; sdpa is the fast path on a T4.
    try:
        model = AutoModelForCausalLM.from_pretrained(
            model_id, attn_implementation="sdpa", **kwargs)
    except (ValueError, ImportError, TypeError) as exc:
        log.warning("sdpa attention unavailable (%s); using the default implementation", exc)
        model = AutoModelForCausalLM.from_pretrained(model_id, **kwargs)

    model.config.use_cache = False  # incompatible with gradient checkpointing
    if getattr(model.config, "pretraining_tp", 1) != 1:
        model.config.pretraining_tp = 1

    if quantise:
        from peft import prepare_model_for_kbit_training
        prepare_kwargs: dict[str, Any] = {"use_gradient_checkpointing": gradient_checkpointing}
        if "gradient_checkpointing_kwargs" in inspect.signature(
                prepare_model_for_kbit_training).parameters:
            prepare_kwargs["gradient_checkpointing_kwargs"] = {"use_reentrant": False}
        model = prepare_model_for_kbit_training(model, **prepare_kwargs)
    elif gradient_checkpointing:
        model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
        model.enable_input_require_grads()
    return model


# ══════════════════════════════════════════════════════════════════════════════
# Reporting
# ══════════════════════════════════════════════════════════════════════════════

def banner(args, gpu: dict, n_train: int, n_eval: int, n_records: int,
           effective_batch: int) -> None:
    line = "=" * 60
    print(line)
    print("SOFTWARE ENGINEERING INTERVIEW ASSISTANT - QLoRA TRAINING")
    print(line)
    print()
    rows = [
        ("Base Model", args.base_model),
        ("Dataset", args.dataset),
        ("Output Directory", args.output_dir),
        ("GPU", gpu.get("name") or "none (CPU)"),
        ("CUDA Available", gpu.get("cuda_available")),
        ("VRAM", f"{gpu['vram_gb']} GB" if gpu.get("vram_gb") else "n/a"),
        ("Dataset Size", f"{n_records} records"),
        ("Training Samples", n_train),
        ("Validation Samples", n_eval),
        ("Epochs", args.epochs),
        ("Batch Size", args.batch_size),
        ("Gradient Accumulation", args.gradient_accumulation_steps),
        ("Effective Batch Size", effective_batch),
        ("Max Sequence Length", args.max_seq_length),
        ("Learning Rate", args.learning_rate),
        ("LoRA r / alpha / dropout",
         f"{args.lora_r} / {args.lora_alpha} / {args.lora_dropout}"),
        ("Quantization", "none (--no_4bit)" if args.no_4bit
         else "4-bit NF4 (double quant, fp16 compute)"),
        ("Seed", args.seed),
    ]
    for label, value in rows:
        print(f"{label + ':':26} {value}")
    print(line)


def print_dataset_report(report: DatasetReport, provenance: dict) -> None:
    print("-" * 60)
    print("DATASET REPORT")
    print("-" * 60)
    for key, value in provenance.items():
        print(f"  {key:26} {value}")
    data = report.as_dict()
    print(f"  {'records read':26} {data['records_read']}")
    print(f"  {'examples built':26} {data['examples_built']}")
    print(f"  {'duplicates removed':26} {data['duplicate_examples_removed']}")
    print("  schemas detected:")
    for name, count in data["schemas_detected"].items():
        print(f"      {name:24} {count}")
    if data["examples_per_task"]:
        print("  examples per task:")
        for name, count in data["examples_per_task"].items():
            print(f"      {name:24} {count}")
    if data["records_dropped"]:
        print("  records dropped:")
        for name, count in data["records_dropped"].items():
            print(f"      {name:24} {count}")
    else:
        print("  records dropped:           none")
    print("-" * 60)


def length_stats(texts: list[str]) -> dict:
    if not texts:
        return {"count": 0}
    lengths = sorted(len(t) for t in texts)
    n = len(lengths)
    return {
        "count": n,
        "chars_min": lengths[0],
        "chars_median": lengths[n // 2],
        "chars_p95": lengths[min(n - 1, int(n * 0.95))],
        "chars_max": lengths[-1],
        "chars_mean": round(sum(lengths) / n, 1),
    }


# ══════════════════════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════════════════════

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)

    parser.add_argument("--base_model", type=str, default="meta-llama/Meta-Llama-3-8B",
                        help="HuggingFace model id or a local checkpoint directory")
    parser.add_argument("--dataset", type=str, default=str(DEFAULT_DATASET),
                        help="JSON/JSONL file, or a directory holding train/validation files")
    parser.add_argument("--eval_dataset", type=str, default=None,
                        help="explicit validation file; overrides auto-detection")
    parser.add_argument("--output_dir", type=str, default=str(DEFAULT_OUTPUT))

    parser.add_argument("--epochs", type=float, default=3.0)
    parser.add_argument("--batch_size", type=int, default=1,
                        help="per-device micro-batch; 1 is the safe value on a T4")
    parser.add_argument("--gradient_accumulation_steps", type=int, default=8)
    parser.add_argument("--learning_rate", type=float, default=2e-4)
    parser.add_argument("--max_seq_length", type=int, default=512,
                        help="tokens; 512 fits an 8B QLoRA run on a 14.5 GB T4")
    parser.add_argument("--weight_decay", type=float, default=0.0)
    parser.add_argument("--warmup_steps", type=int, default=20)
    parser.add_argument("--max_grad_norm", type=float, default=0.3)
    parser.add_argument("--lr_scheduler_type", type=str, default="cosine")

    parser.add_argument("--validation_split", type=float, default=0.1,
                        help="used only when the dataset has no validation file")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max_train_samples", type=int, default=None)
    parser.add_argument("--max_eval_samples", type=int, default=None)

    parser.add_argument("--lora_r", type=int, default=16)
    parser.add_argument("--lora_alpha", type=int, default=32)
    parser.add_argument("--lora_dropout", type=float, default=0.05)
    parser.add_argument("--lora_target_modules", type=str, default="auto",
                        help="'auto', 'attention', or a comma-separated module list")

    parser.add_argument("--task", choices=["question_generation", "answer", "both"],
                        default="both",
                        help="which supervision to build from records that carry both")
    parser.add_argument("--prompt_style", choices=["auto", "chat", "plain"], default="auto",
                        help="'chat' uses the tokenizer chat template; base models need 'plain'")
    parser.add_argument("--no_system_prompt", action="store_true")

    parser.add_argument("--logging_steps", type=int, default=10)
    parser.add_argument("--save_steps", type=int, default=200)
    parser.add_argument("--eval_steps", type=int, default=200)
    parser.add_argument("--save_total_limit", type=int, default=2)
    parser.add_argument("--optim", type=str, default="paged_adamw_8bit")
    parser.add_argument("--no_gradient_checkpointing", action="store_true")
    parser.add_argument("--no_grad_scaler", action="store_true",
                        help="disable the fp16 GradScaler (keeps autocast and clipping). "
                             "Safe only because trainable params are fp32 — see "
                             "the note in train(); use if the scaler still misbehaves")
    parser.add_argument("--no_4bit", action="store_true",
                        help="skip bitsandbytes quantisation — for CPU smoke tests "
                             "or small models; an 8B model will not fit on a T4 this way")
    parser.add_argument("--resume_from_checkpoint", type=str, default=None)
    parser.add_argument("--report_to", type=str, default="none")

    parser.add_argument("--inspect_dataset", action="store_true",
                        help="print the dataset report and sample prompts, then exit")
    parser.add_argument("--dry_run", action="store_true",
                        help="do everything except load the model and train")
    parser.add_argument("--verbose", action="store_true")
    return parser


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

def train(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s")

    set_seed_everywhere(args.seed)
    started = time.time()

    # ── dataset ──────────────────────────────────────────────────────────────
    train_records, eval_records, provenance = load_dataset_files(args.dataset, args.eval_dataset)
    report = DatasetReport()

    train_examples = build_examples(train_records, args.task, report, "train")
    eval_examples = build_examples(eval_records, args.task, report, "validation") if eval_records else []

    train_examples = deduplicate_examples(train_examples, report)
    if eval_examples:
        eval_examples = deduplicate_examples(eval_examples, report)
        # Guard against the same example appearing in both files.
        train_keys = {(e.get("user"), e.get("assistant")) for e in train_examples}
        before = len(eval_examples)
        eval_examples = [e for e in eval_examples
                         if (e.get("user"), e.get("assistant")) not in train_keys]
        if before != len(eval_examples):
            log.warning("removed %d validation examples that also appear in train",
                        before - len(eval_examples))
            provenance["eval_leakage_removed"] = before - len(eval_examples)
    else:
        rng = random.Random(args.seed)
        rng.shuffle(train_examples)
        cut = int(len(train_examples) * args.validation_split)
        if cut == 0 and len(train_examples) >= 10 and args.validation_split > 0:
            cut = 1
        eval_examples, train_examples = train_examples[:cut], train_examples[cut:]
        provenance["split"] = (f"in-script {1 - args.validation_split:.0%}/"
                               f"{args.validation_split:.0%} (seed {args.seed})")

    if not train_examples:
        log.error("no usable training examples were produced")
        print_dataset_report(report, provenance)
        return 1

    if args.max_train_samples:
        train_examples = train_examples[:args.max_train_samples]
    if args.max_eval_samples:
        eval_examples = eval_examples[:args.max_eval_samples]

    print_dataset_report(report, provenance)

    if len(train_examples) < 16:
        log.warning("only %d training examples — this is a smoke test, not a real "
                    "fine-tune. Point --dataset at a larger set for real results.",
                    len(train_examples))

    # ── environment ──────────────────────────────────────────────────────────
    gpu = gpu_info()
    versions = library_versions()
    effective_batch = args.batch_size * args.gradient_accumulation_steps
    banner(args, gpu, len(train_examples), len(eval_examples), report.records, effective_batch)

    if gpu.get("cuda_available") and gpu.get("vram_gb", 0) and gpu["vram_gb"] < 13:
        log.warning("only %.1f GB of VRAM detected; an 8B QLoRA run needs ~11-13 GB at "
                    "seq len %d. Reduce --max_seq_length or pick a smaller base model.",
                    gpu["vram_gb"], args.max_seq_length)

    token = hf_token()
    print(f"HuggingFace token detected: {'yes' if token else 'no'}")
    if not token:
        print("  (fine for open models; gated ones such as Meta Llama 3 need "
              "`huggingface-cli login` or HF_TOKEN)")

    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = (Path.cwd() / output_dir).resolve()
    checkpoints_dir = output_dir / "checkpoints"

    metadata = {
        "base_model": args.base_model,
        "dataset": str(provenance.get("train_file", args.dataset)),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "gradient_accumulation_steps": args.gradient_accumulation_steps,
        "effective_batch_size": effective_batch,
        "learning_rate": args.learning_rate,
        "max_seq_length": args.max_seq_length,
        "lora_r": args.lora_r,
        "lora_alpha": args.lora_alpha,
        "lora_dropout": args.lora_dropout,
        "quantization": "none (--no_4bit)" if args.no_4bit else "4-bit NF4",
        "gpu": gpu.get("name") or "cpu",
        "gpu_vram_gb": gpu.get("vram_gb"),
        "training_samples": len(train_examples),
        "validation_samples": len(eval_examples),
        "task": args.task,
        "seed": args.seed,
        "dataset_report": report.as_dict(),
        "dataset_provenance": provenance,
        "library_versions": versions,
    }

    # ── tokenizer + prompt rendering ─────────────────────────────────────────
    if args.dry_run and not args.inspect_dataset:
        log.info("--dry_run: loading the tokenizer (small) but not the model")

    tokenizer = None
    render_prompt = render_completion = None
    resolved_style = args.prompt_style
    try:
        check_model_access(args.base_model, token)
        tokenizer = load_tokenizer(args.base_model, token)
        render_prompt, render_completion, resolved_style = make_renderer(
            tokenizer, args.prompt_style, not args.no_system_prompt)
    except SystemExit:
        raise
    except Exception as exc:
        if not args.inspect_dataset:
            explain_access_error(args.base_model, token, exc)
            return 2
        log.warning("tokenizer unavailable (%s: %s) — rendering prompts in the plain "
                    "style so the dataset can still be inspected",
                    type(exc).__name__, exc)
        header = f"{SYSTEM_PROMPT}\n\n" if not args.no_system_prompt else ""
        render_prompt = lambda user: f"{header}User:\n{user}\n\nAssistant:\n"  # noqa: E731
        render_completion = lambda assistant: assistant  # noqa: E731
        resolved_style = "plain"
    metadata["prompt_style"] = resolved_style

    def to_columns(examples: list[dict], completion_only: bool) -> dict:
        if completion_only:
            return {
                "prompt": [render_prompt(e["user"]) for e in examples],
                "completion": [render_completion(e["assistant"]) for e in examples],
            }
        return {"text": [render_prompt(e["user"]) + render_completion(e["assistant"])
                         for e in examples]}

    full_texts = [render_prompt(e["user"]) + render_completion(e["assistant"])
                  for e in train_examples]
    metadata["train_text_length_chars"] = length_stats(full_texts)

    print()
    print("-" * 60)
    print(f"SAMPLE FORMATTED EXAMPLE  (prompt_style={resolved_style}, task={args.task})")
    print("-" * 60)
    print(full_texts[0][:1200])
    print("-" * 60)

    if args.inspect_dataset:
        for extra in full_texts[1:3]:
            print(extra[:600])
            print("-" * 60)
        print("--inspect_dataset: stopping before training.")
        return 0

    # ── build the trainer ────────────────────────────────────────────────────
    print(f"precision fix build: {PRECISION_FIX_BUILD}")
    print("-" * 60)
    print("STARTUP PRECISION VALIDATION")
    print("-" * 60)
    print(f"  GPU:                  {gpu.get('name') or 'none (CPU)'}")
    print(f"  CUDA available:       {gpu.get('cuda_available')}")
    print(f"  Compute capability:   {gpu.get('capability')}")
    print(f"  Native bf16 support:  {native_bf16_supported()}")
    print(f"  FP16:                 {'enabled' if gpu.get('cuda_available') else 'disabled (no CUDA)'}")
    print(f"  BF16:                 disabled")
    print(f"  4-bit compute dtype:  {'torch.float16' if not args.no_4bit else 'n/a (--no_4bit)'}")
    print("-" * 60)
    if gpu.get("cuda_available"):
        # Must happen before transformers constructs its Accelerator.
        metadata["accelerate_env"] = force_fp16_mixed_precision_env()
        log.info("pinned ACCELERATE_MIXED_PRECISION=fp16 (state reset: %s)",
                 metadata["accelerate_env"]["accelerator_state_reset"])

    try:
        import torch
        from datasets import Dataset
        from peft import LoraConfig
        from trl import SFTConfig, SFTTrainer
    except ImportError as exc:
        log.error("missing training dependency: %s", exc)
        log.error("install with:")
        log.error("    pip install -r requirements.txt -r requirements-train.txt")
        return 1

    sft_fields = accepted_fields(SFTConfig)
    completion_only = "completion_only_loss" in sft_fields
    if completion_only:
        log.info("TRL supports completion-only loss — the prompt will be masked out")
    else:
        log.info("this TRL version has no completion_only_loss; training on the full text")

    train_ds = Dataset.from_dict(to_columns(train_examples, completion_only))
    eval_ds = (Dataset.from_dict(to_columns(eval_examples, completion_only))
               if eval_examples else None)

    use_gc = not args.no_gradient_checkpointing
    wanted_config: dict[str, Any] = {
        "output_dir": str(checkpoints_dir),
        "num_train_epochs": args.epochs,
        "per_device_train_batch_size": args.batch_size,
        "per_device_eval_batch_size": args.batch_size,
        "gradient_accumulation_steps": args.gradient_accumulation_steps,
        "learning_rate": args.learning_rate,
        "weight_decay": args.weight_decay,
        "warmup_steps": args.warmup_steps,
        "max_grad_norm": args.max_grad_norm,
        "lr_scheduler_type": args.lr_scheduler_type,
        "logging_steps": args.logging_steps,
        "logging_first_step": True,
        "save_strategy": "steps",
        "save_steps": args.save_steps,
        "save_total_limit": args.save_total_limit,
        "eval_strategy": "steps" if eval_ds is not None else "no",
        "eval_steps": args.eval_steps if eval_ds is not None else None,
        "optim": resolve_optimizer(args.optim),
        "fp16": bool(gpu.get("cuda_available")),      # T4: fp16, never bf16
        "bf16": False,
        "gradient_checkpointing": use_gc,
        "gradient_checkpointing_kwargs": {"use_reentrant": False} if use_gc else None,
        "seed": args.seed,
        "data_seed": args.seed,
        "report_to": args.report_to,
        "max_length": args.max_seq_length,
        "packing": False,
        "dataset_num_proc": 1,
        "save_only_model": True,   # checkpoints hold the adapter, not the 8B base
    }
    if completion_only:
        wanted_config["completion_only_loss"] = True
    else:
        wanted_config["dataset_text_field"] = "text"

    wanted_config = {k: v for k, v in wanted_config.items() if v is not None}
    config_kwargs, dropped = filter_kwargs(SFTConfig, wanted_config, CONFIG_ALIASES)
    if dropped:
        log.info("SFTConfig in trl %s does not accept %s — skipped",
                 versions.get("trl"), dropped)
    sft_config = SFTConfig(**config_kwargs)

    # TrainingArguments.__post_init__ derives `mixed_precision` from
    # ACCELERATE_MIXED_PRECISION first and only then applies the fp16/bf16 flags
    # (transformers/training_args.py). Pin all three here so a stale environment
    # value cannot select bf16 on a GPU that has no bf16 tensor cores.
    if gpu.get("cuda_available") and not native_bf16_supported():
        sft_config.fp16 = True
        sft_config.bf16 = False
        if hasattr(sft_config, "mixed_precision"):
            sft_config.mixed_precision = "fp16"
        log.info("pinned SFTConfig: fp16=True, bf16=False, mixed_precision=fp16")

    peft_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        bias="none",
        task_type="CAUSAL_LM",
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    if args.dry_run:
        print()
        print("-" * 60)
        print("DRY RUN — datasets and training config built successfully")
        print("-" * 60)
        print(f"  train_dataset columns    {train_ds.column_names}  ({len(train_ds)} rows)")
        print(f"  eval_dataset columns     "
              f"{eval_ds.column_names if eval_ds is not None else 'none'} "
              f"({len(eval_ds) if eval_ds is not None else 0} rows)")
        print(f"  completion-only loss     {completion_only}")
        print(f"  trl SFTConfig fields set {len(config_kwargs)}"
              + (f", skipped {dropped}" if dropped else ""))
        print(f"  checkpoints would go to  {checkpoints_dir}")
        print()
        print("Stopping before the model is loaded (that step needs a CUDA GPU and")
        print("downloads several GB). Drop --dry_run to run the real thing.")
        metadata["dry_run"] = True
        (output_dir / "experiment_metadata.json").write_text(
            json.dumps(metadata, indent=2, default=str), encoding="utf-8")
        print(f"Wrote {output_dir / 'experiment_metadata.json'}")
        return 0

    quantise = not args.no_4bit
    log.info("loading %s %s", args.base_model,
             "in 4-bit NF4 — this downloads several GB on first run" if quantise
             else "WITHOUT quantisation (--no_4bit)")
    try:
        model = load_quantised_model(args.base_model, token, use_gc, quantise=quantise)
    except Exception as exc:
        if "bitsandbytes" in str(exc).lower():
            log.error("bitsandbytes could not load: %s", exc)
            log.error("4-bit quantisation needs a CUDA build: pip install -U bitsandbytes")
            return 1
        raise

    target_modules = resolve_target_modules(model, args.lora_target_modules)
    peft_config.target_modules = target_modules
    metadata["lora_target_modules"] = target_modules
    metadata["model_type"] = getattr(getattr(model, "config", None), "model_type", None)
    log.info("LoRA target modules: %s", ", ".join(target_modules))

    trainer_kwargs: dict[str, Any] = {
        "model": model,
        "args": sft_config,
        "train_dataset": train_ds,
        "eval_dataset": eval_ds,
        "peft_config": peft_config,
    }
    trainer_params = set(inspect.signature(SFTTrainer.__init__).parameters)
    if "processing_class" in trainer_params:
        trainer_kwargs["processing_class"] = tokenizer
    elif "tokenizer" in trainer_params:
        trainer_kwargs["tokenizer"] = tokenizer
    trainer_kwargs = {k: v for k, v in trainer_kwargs.items()
                      if k in trainer_params and v is not None}

    trainer = SFTTrainer(**trainer_kwargs)

    # ── precision guard ──────────────────────────────────────────────────────
    # SFTTrainer.__init__ casts every trainable parameter to bfloat16 when the
    # base model is quantized. On a pre-Ampere GPU that is fatal under fp16 AMP,
    # so undo it here — after construction, before the optimizer is built inside
    # trainer.train(). See enforce_fp16_safe_trainable_dtype() for the full
    # explanation.
    # Gate on the *actual* scaler, not on sft_config.fp16. A GradScaler is created
    # whenever Accelerator.mixed_precision == "fp16", and transformers can reach
    # that state from ACCELERATE_MIXED_PRECISION alone — i.e. with sft_config.fp16
    # still False. Gating on the flag would then skip this entire block while the
    # scaler is live and TRL has already cast the adapters to bf16, which is
    # exactly the reported crash. fp32 adapters are also the right default on any
    # pre-Ampere GPU, so capability is a second trigger.
    _accel = getattr(trainer, "accelerator", None)
    _scaler_live = getattr(_accel, "scaler", None) is not None
    fp16_amp_active = (_scaler_live
                       or bool(getattr(sft_config, "fp16", False))
                       or not native_bf16_supported())

    if fp16_amp_active:
        recast = enforce_fp16_safe_trainable_dtype(trainer.model)
        if recast:
            detail = ", ".join(f"{n:,} params from {d}" for d, n in recast.items())
            log.warning("precision guard: recast %s to float32 — fp16 AMP is active "
                        "and torch's GradScaler has no bfloat16 kernels", detail)
        else:
            log.info("precision guard: all trainable parameters were already float32")
        metadata["precision_guard_recast"] = recast

        # The one-shot cast above can be undone by anything that runs later
        # inside train(); this callback re-asserts it at the last two events
        # that still precede _clip_grad_norm.
        guard_callback = make_precision_guard_callback()
        trainer.add_callback(guard_callback)

        if args.no_grad_scaler:
            # Loss scaling exists to stop *fp16* gradients underflowing to zero.
            # Every trainable parameter here is fp32, so its gradients are fp32
            # (dynamic range ~1e-38) and cannot underflow; fp16 is confined to
            # the forward matmuls by autocast. Disabling the scaler in THIS
            # configuration is therefore numerically safe. It would NOT be safe
            # with fp16 trainable parameters. Autocast and gradient clipping
            # both keep working: an unscaled gradient needs no unscaling.
            import torch as _torch
            trainer.accelerator.scaler = _torch.amp.GradScaler(device="cuda", enabled=False)
            log.warning("--no_grad_scaler: GradScaler disabled (fp32 master weights "
                        "make loss scaling unnecessary here); autocast and gradient "
                        "clipping remain active")
            metadata["grad_scaler_disabled"] = True

    if getattr(sft_config, "bf16", False) and not native_bf16_supported():
        log.error("bf16 is enabled but this GPU has no native bf16 tensor cores; "
                  "training would be emulated and extremely slow. Use fp16.")
        return 1

    metadata["precision"] = print_precision_report(trainer.model, sft_config, gpu, trainer)

    trainable = sum(p.numel() for p in trainer.model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in trainer.model.parameters())
    metadata["trainable_parameters"] = trainable
    metadata["total_parameters"] = total
    print(f"Trainable parameters: {trainable:,} / {total:,} "
          f"({100 * trainable / max(total, 1):.4f}%)")

    # ── train ────────────────────────────────────────────────────────────────
    if fp16_amp_active:
        assert_fp16_grad_safe(trainer.model, "pre-train check")
        print("Precision pre-flight: all trainable parameters are float32 — "
              "GradScaler-safe.")

    print()
    print("Starting training...")
    train_started = time.time()
    try:
        result = trainer.train(resume_from_checkpoint=args.resume_from_checkpoint)
    except torch.cuda.OutOfMemoryError as exc:
        return _report_oom(exc, args)
    except RuntimeError as exc:
        if "out of memory" in str(exc).lower():
            return _report_oom(exc, args)
        raise
    train_seconds = time.time() - train_started

    # ── save ─────────────────────────────────────────────────────────────────
    output_dir.mkdir(parents=True, exist_ok=True)
    trainer.model.save_pretrained(str(output_dir))   # adapter only
    tokenizer.save_pretrained(str(output_dir))

    metrics: dict[str, Any] = {"train": dict(result.metrics)}
    if eval_ds is not None:
        eval_metrics = trainer.evaluate()
        metrics["eval"] = dict(eval_metrics)
        loss = eval_metrics.get("eval_loss")
        if loss is not None:
            try:
                import math
                metrics["eval"]["perplexity"] = round(math.exp(loss), 4)
            except OverflowError:
                metrics["eval"]["perplexity"] = float("inf")
    metrics["train_runtime_seconds"] = round(train_seconds, 2)
    metrics["total_runtime_seconds"] = round(time.time() - started, 2)
    metrics["log_history"] = trainer.state.log_history

    if torch.cuda.is_available():
        metadata["peak_vram_gb"] = round(torch.cuda.max_memory_allocated() / 1024 ** 3, 2)
        metrics["peak_vram_gb"] = metadata["peak_vram_gb"]

    (output_dir / "metrics.json").write_text(
        json.dumps(metrics, indent=2, default=str), encoding="utf-8")
    (output_dir / "training_args.json").write_text(
        json.dumps(sft_config.to_dict(), indent=2, default=str), encoding="utf-8")
    (output_dir / "experiment_metadata.json").write_text(
        json.dumps(metadata, indent=2, default=str), encoding="utf-8")

    minutes, seconds = divmod(int(train_seconds), 60)
    hours, minutes = divmod(minutes, 60)
    print()
    print("=" * 60)
    print("Training completed successfully.")
    print("=" * 60)
    print(f"Output:              {output_dir}")
    print(f"Adapter:             {output_dir / 'adapter_model.safetensors'}")
    print(f"Training samples:    {len(train_examples)}")
    print(f"Validation samples:  {len(eval_examples)}")
    print(f"Training time:       {hours:d}h {minutes:02d}m {seconds:02d}s")
    if "eval" in metrics:
        print(f"Final eval loss:     {metrics['eval'].get('eval_loss')}")
        print(f"Final perplexity:    {metrics['eval'].get('perplexity')}")
    if "peak_vram_gb" in metadata:
        print(f"Peak VRAM:           {metadata['peak_vram_gb']} GB")
    print(f"Metrics:             {output_dir / 'metrics.json'}")
    print(f"Metadata:            {output_dir / 'experiment_metadata.json'}")
    print("=" * 60)
    return 0


def _report_oom(exc: BaseException, args) -> int:
    log.error("CUDA out of memory: %s", exc)
    print()
    print("=" * 60)
    print("CUDA OUT OF MEMORY")
    print("=" * 60)
    print("Reduce memory pressure by changing these, in order of impact:")
    print(f"  1. --max_seq_length            (now {args.max_seq_length}) -> try "
          f"{max(128, args.max_seq_length // 2)}")
    print(f"  2. --batch_size                (now {args.batch_size}) -> 1, and raise")
    print(f"     --gradient_accumulation_steps (now {args.gradient_accumulation_steps}) "
          "to keep the effective batch size")
    print("  3. keep gradient checkpointing on (do not pass --no_gradient_checkpointing)")
    print(f"  4. --lora_target_modules attention   (now '{args.lora_target_modules}') "
          "— drops the MLP projections")
    print(f"  5. --lora_r                    (now {args.lora_r}) -> 8")
    print("  6. use a smaller base model, e.g. microsoft/Phi-3-mini-4k-instruct "
          "or mistralai/Mistral-7B-v0.3")
    print()
    print("On Colab also: Runtime > Restart session to clear a fragmented allocator,")
    print("and set PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True before launching.")
    print("=" * 60)
    return 1


if __name__ == "__main__":
    sys.exit(train())
