"""Real evaluation harness for the Software Engineering Interview Assistant.

Generates predictions from an actual model (base, or base + QLoRA LoRA adapter),
compares them against the dataset's own reference texts, and computes BLEU,
ROUGE-1/2/L, BERTScore and teacher-forced perplexity from those pairs. Every
number in every output file is produced by the run that wrote it — there are no
stored, sampled, illustrative or placeholder metric values anywhere in this
module. When a metric cannot be computed it is written as `null` together with
the reason.

Usage (run from ml-service/):

    # inspect the evaluation pairs without loading a model
    python training/evaluate_model.py --inspect_dataset

    # base model, held-out test split
    python training/evaluate_model.py \\
        --base_model mistralai/Mistral-7B-v0.3 --split test --max_samples 200

    # fine-tuned model, same split
    python training/evaluate_model.py \\
        --base_model mistralai/Mistral-7B-v0.3 \\
        --adapter_path training/output/interview_llm \\
        --split test --max_samples 200

    # base vs fine-tuned
    python training/evaluate_model.py --compare \\
        training/evaluation_results/base__Mistral-7B-v0.3__test \\
        training/evaluation_results/finetuned__Mistral-7B-v0.3__test


DEVELOPER NOTE — audit of the existing project (2026-08-26)
===========================================================
Findings that this harness is built on. They were read out of the repository,
not assumed; see `training/EVALUATION.md` for the same notes in prose.

Dataset
-------
`dataset/processed/question_generator/` holds `train.jsonl` (6625),
`validation.jsonl` (825) and `test.jsonl` (880) records. A dedicated held-out
test split therefore already exists and is the default here.
`statistics.json` in that directory records the leakage audit performed when the
split was built: `train->validation 0`, `train->test 0`, `validation->test 0`,
`exact_duplicates 0`. `--split` still selects the split explicitly, and the
split that was actually evaluated is stated in every report.

Record schema (all splits identical), as detected by
`train_qlora.detect_schema()` -> `"instruction_io"`:

    id                      "interviews-00012"
    question                the interview question
    domain                  one of 16 SE domains
    difficulty              Beginner | Intermediate | Advanced
    expected_answer         reference answer, EMPTY for many records
    expected_answer_source  provenance of expected_answer
    source / source_url     upstream dataset
    instruction             "Generate a technical interview question."
    input                   "Domain: ...\\nDifficulty: ..."
    output                  the question again (the generation target)

Two supervised tasks, exactly as the training pipeline builds them in
`train_qlora.record_to_examples()`:

    question_generation   prompt = instruction + "\\n" + input   reference = output
    answer                prompt = question                     reference = expected_answer

`--inspect_dataset` on the training script reports 7450 question_generation and
5368 answer examples for `--task both` over the train split; the answer task is
smaller because `expected_answer` is empty for many records and those pairs are
dropped rather than filled in. This harness keeps the two tasks strictly
separate — a generated question is never scored against an expected answer —
and reports them separately as well as combined.

Prompt formatting
-----------------
Reused verbatim from the training script rather than re-implemented, so the
evaluation prompt is byte-identical to the training prompt:
`train_qlora.make_renderer()` (`plain` style produces
`"{SYSTEM_PROMPT}\\n\\nUser:\\n{user}\\n\\nAssistant:\\n"`, `chat` style uses the
tokenizer's own chat template) together with `train_qlora.SYSTEM_PROMPT`,
`detect_schema()` and `record_to_examples()`. Only the *completion* half is
withheld at generation time, which is the sole intended difference.

The one thing not reused is `train_qlora.build_examples()`: it discards the
record's `id`/`domain`/`difficulty`/`source` fields, which this harness needs for
per-sample output and per-category breakdowns. `build_eval_examples()` below
therefore repeats that function's loop — same `detect_schema()`, same
`record_to_examples()`, same `MIN_USER_CHARS`/`MIN_ASSISTANT_CHARS` thresholds,
all imported from the training module — and additionally carries the metadata
through. The training pipeline itself is untouched.

Model / tokenizer
-----------------
`train_qlora.load_quantised_model()` loads the base model 4-bit NF4 (double
quant, fp16 compute) with `attn_implementation="sdpa"`, and only the LoRA adapter
is saved to `--output_dir` (`trainer.model.save_pretrained`, adapter only). This
harness mirrors that load path for evaluation but must diverge in three places,
each of which is a generation requirement rather than a preference:
`use_cache=True`, no `prepare_model_for_kbit_training()`, and left padding for
batched generation. The adapter is loaded with `PeftModel.from_pretrained()` on
top of the base model, never as a standalone model.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import logging
import math
import platform
import random
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence

log = logging.getLogger("evaluate_model")

TRAINING_DIR = Path(__file__).resolve().parent
ML_SERVICE = TRAINING_DIR.parent

DEFAULT_DATASET = ML_SERVICE / "dataset" / "processed" / "question_generator"
DEFAULT_OUTPUT = ML_SERVICE / "training" / "evaluation_results"

# Metrics where a larger value is better. Perplexity is the exception.
HIGHER_IS_BETTER = {
    "bleu_corpus": True,
    "bleu_sentence_mean": True,
    "rouge1": True,
    "rouge2": True,
    "rougeL": True,
    "bertscore_precision": True,
    "bertscore_recall": True,
    "bertscore_f1": True,
    "exact_match": True,
    "perplexity": False,
}

# Fields that must agree before two runs may be compared.
COMPARISON_CRITICAL_FIELDS = [
    ("dataset", "dataset file"),
    ("split", "split"),
    ("task", "task"),
    ("n_evaluated", "number of evaluated samples"),
    ("prompt_style", "prompt style"),
    ("generation.do_sample", "sampling on/off"),
    ("generation.max_new_tokens", "max_new_tokens"),
    ("generation.temperature", "temperature"),
    ("generation.top_p", "top_p"),
    ("seed", "seed"),
]


# ══════════════════════════════════════════════════════════════════════════════
# Bridge to the training module (single source of truth for schema + prompts)
# ══════════════════════════════════════════════════════════════════════════════

def _load_training_module():
    """Import `training/train_qlora.py` without executing any training.

    Loaded by path under a distinct module name because `ml-service/train_qlora.py`
    is a shim with the same basename; a plain `import train_qlora` can resolve to
    either file depending on the working directory.
    """
    existing = sys.modules.get("interview_train_qlora")
    if existing is not None:
        return existing

    impl = TRAINING_DIR / "train_qlora.py"
    if not impl.exists():
        raise SystemExit(
            f"cannot find the training module at {impl}. evaluate_model.py reuses its "
            f"dataset schema detection and prompt formatting, so the two files must "
            f"stay side by side.")
    spec = importlib.util.spec_from_file_location("interview_train_qlora", impl)
    if spec is None or spec.loader is None:  # pragma: no cover - defensive
        raise SystemExit(f"cannot load the training module from {impl}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["interview_train_qlora"] = module
    spec.loader.exec_module(module)
    return module


tq = _load_training_module()


# ══════════════════════════════════════════════════════════════════════════════
# Dataset
# ══════════════════════════════════════════════════════════════════════════════

METADATA_FIELDS = ("domain", "difficulty", "source", "expected_answer_source",
                   "question_type", "topic", "category", "technology")


def resolve_dataset(dataset_arg: str, split: str) -> tuple[Path, str]:
    """Resolve --dataset/--split to one concrete file plus the split's name.

    A directory is searched for the requested split using the training module's
    own `SPLIT_ALIASES`, so `validation.jsonl`/`val.json`/`dev.json` all work. A
    file path is used as given, and the split is then reported as the file's stem
    so the report never silently calls a validation file a test set.
    """
    path = Path(dataset_arg)
    if not path.is_absolute():
        path = (Path.cwd() / path).resolve()

    if path.is_dir():
        if split not in tq.SPLIT_ALIASES:
            raise SystemExit(f"--split must be one of {sorted(tq.SPLIT_ALIASES)}, got {split!r}")
        found = tq._find_split_file(path, split)
        if found is None:
            available = sorted(p.name for p in path.glob("*.json*"))
            raise SystemExit(
                f"no '{split}' split in {path}. Looked for "
                f"{tq.SPLIT_ALIASES[split]} with a .jsonl/.json suffix.\n"
                f"Files present: {available or 'none'}")
        return found, split

    if not path.exists():
        raise SystemExit(
            f"--dataset does not exist: {path}\n"
            f"Pass a directory containing train/validation/test files, or a single "
            f".json / .jsonl file.")
    return path, path.stem


def build_eval_examples(records: Iterable[dict], task: str, label: str
                        ) -> tuple[list[dict], "tq.DatasetReport"]:
    """Expand records into evaluation examples, keeping the record metadata.

    Deliberately mirrors `train_qlora.build_examples()` — same schema detection,
    same pair construction, same minimum-length thresholds, all imported from the
    training module — so that the (prompt, reference) pairs scored here are the
    same pairs the model was trained on. The only addition is that `id`, `domain`,
    `difficulty` and friends survive, which the training path has no use for but
    the per-sample records and per-category breakdowns do.
    """
    report = tq.DatasetReport()
    out: list[dict] = []

    for index, record in enumerate(records):
        report.records += 1
        if not isinstance(record, dict):
            report.bump(report.drops, "not_an_object")
            report.warn(f"{label}[{index}]: record is {type(record).__name__}, not an object")
            continue

        schema = tq.detect_schema(record)
        report.bump(report.schemas, schema)
        if schema == "unknown":
            report.bump(report.drops, "unrecognised_schema")
            report.warn(f"{label}[{index}]: no recognised fields (keys: {sorted(record)[:8]})")
            continue
        if schema == "raw_text":
            # Plain text has no prompt/reference structure, so there is nothing to
            # generate from or score against. Training uses it for LM loss only.
            report.bump(report.drops, "raw_text_not_evaluable")
            continue

        pairs = tq.record_to_examples(record, schema, task)
        if not pairs:
            report.bump(report.drops, f"no_usable_pair_{schema}")
            continue

        metadata = {field: tq._clean(record.get(field))
                    for field in METADATA_FIELDS if record.get(field) not in (None, "")}
        record_id = tq._clean(record.get("id")) or f"{label}-{index:06d}"

        for user, assistant, kind in pairs:
            if len(user) < tq.MIN_USER_CHARS:
                report.bump(report.drops, "user_turn_too_short")
                continue
            if len(assistant) < tq.MIN_ASSISTANT_CHARS:
                report.bump(report.drops, "assistant_turn_too_short")
                continue
            out.append({
                "id": record_id,
                "record_index": index,
                "task": kind,
                "user": user,
                "reference": assistant,
                "schema": schema,
                "metadata": metadata,
            })
            report.bump(report.examples_from_task, kind)

    report.examples += len(out)
    return out, report


def deduplicate(examples: list[dict], report: "tq.DatasetReport") -> list[dict]:
    """Drop identical (task, prompt, reference) triples — first occurrence wins."""
    seen: set[tuple[str, str, str]] = set()
    out = []
    for example in examples:
        key = (example["task"], example["user"], example["reference"])
        if key in seen:
            report.duplicates += 1
            continue
        seen.add(key)
        out.append(example)
    return out


def subsample(examples: list[dict], max_samples: int | None, seed: int) -> list[dict]:
    """Take a reproducible, task-stratified subset.

    Stratified so that `--max_samples 100` on a `both` run does not silently
    evaluate 100 question-generation pairs and zero answer pairs: each task keeps
    its share of the dataset. The seed makes the selection identical across the
    base and fine-tuned runs, which is what makes them comparable at all.
    """
    if not max_samples or max_samples >= len(examples):
        return examples

    by_task: dict[str, list[dict]] = {}
    for example in examples:
        by_task.setdefault(example["task"], []).append(example)

    rng = random.Random(seed)
    quota = {task: max(1, round(max_samples * len(items) / len(examples)))
             for task, items in by_task.items()}
    picked: list[dict] = []
    for task, items in by_task.items():
        shuffled = list(items)
        rng.shuffle(shuffled)
        picked.extend(shuffled[:quota[task]])

    rng.shuffle(picked)
    picked = picked[:max_samples]
    # Stable order for reproducible reports and side-by-side prediction files.
    picked.sort(key=lambda e: (e["task"], e["id"], e["user"][:64]))
    return picked


# ══════════════════════════════════════════════════════════════════════════════
# Model
# ══════════════════════════════════════════════════════════════════════════════

def resolve_device(requested: str) -> str:
    try:
        import torch
    except ImportError as exc:
        raise SystemExit(f"torch is required for evaluation but is not installed ({exc}).\n"
                         f"    pip install -r requirements.txt -r requirements-train.txt")
    if requested == "cuda":
        if not torch.cuda.is_available():
            raise SystemExit("--device cuda was requested but torch reports no CUDA device. "
                             "Use --device cpu (much slower) or run on a GPU machine.")
        return "cuda"
    if requested == "cpu":
        return "cpu"
    return "cuda" if torch.cuda.is_available() else "cpu"


def validate_adapter(adapter_path: str, base_model: str) -> dict[str, Any]:
    """Fail early and specifically on an adapter directory that is not one."""
    path = Path(adapter_path)
    if not path.is_absolute():
        path = (Path.cwd() / path).resolve()
    if not path.exists():
        raise SystemExit(f"--adapter_path does not exist: {path}")
    if not path.is_dir():
        raise SystemExit(f"--adapter_path must be a directory containing adapter_config.json, "
                         f"got a file: {path}")

    config_file = path / "adapter_config.json"
    if not config_file.exists():
        contents = sorted(p.name for p in path.iterdir())[:20]
        raise SystemExit(
            f"{path} is not a PEFT adapter directory: adapter_config.json is missing.\n"
            f"Contents: {contents or 'empty'}\n"
            f"A finished training run writes the adapter to --output_dir; checkpoints "
            f"live under <output_dir>/checkpoints/checkpoint-N.")

    weights = [name for name in ("adapter_model.safetensors", "adapter_model.bin")
               if (path / name).exists()]
    if not weights:
        raise SystemExit(f"{path} has adapter_config.json but no adapter weights "
                         f"(adapter_model.safetensors / adapter_model.bin).")

    try:
        config = json.loads(config_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{config_file} is not valid JSON: {exc}")

    trained_on = config.get("base_model_name_or_path")
    if trained_on and str(trained_on) != str(base_model):
        log.warning("adapter was trained on base model %r but --base_model is %r. "
                    "Loading anyway; the numbers are only meaningful if these are the "
                    "same weights.", trained_on, base_model)

    return {
        "path": str(path),
        "weights_file": weights[0],
        "trained_on_base_model": trained_on,
        "base_model_matches": (not trained_on) or str(trained_on) == str(base_model),
        "lora_r": config.get("r"),
        "lora_alpha": config.get("lora_alpha"),
        "target_modules": sorted(config.get("target_modules") or []) or None,
        "task_type": config.get("task_type"),
    }


def load_tokenizer_for_eval(base_model: str, adapter_path: str | None,
                            explicit: str | None, token: str | None):
    """Load the tokenizer, preferring the one the training run saved.

    `train_qlora.train()` calls `tokenizer.save_pretrained(output_dir)` next to
    the adapter, so that copy is the tokenizer the adapter was trained with —
    including any pad-token or template change. Falls back to the base model.
    """
    from transformers import AutoTokenizer

    source = explicit
    origin = "--tokenizer"
    if source is None and adapter_path:
        candidate = Path(adapter_path)
        if any((candidate / name).exists() for name in
               ("tokenizer.json", "tokenizer_config.json", "tokenizer.model")):
            source = str(candidate)
            origin = "adapter directory"
    if source is None:
        source = base_model
        origin = "base model"

    tokenizer = AutoTokenizer.from_pretrained(source, token=token, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    # Training uses right padding, which is correct for causal-LM loss. Batched
    # *generation* requires left padding, otherwise the pads sit between the
    # prompt and the first generated token and the model continues from padding.
    tokenizer.padding_side = "left"
    return tokenizer, {"source": source, "origin": origin}


def load_model_for_eval(base_model: str, adapter_path: str | None, device: str,
                        load_in_4bit: str, token: str | None) -> tuple[Any, dict]:
    """Load the base model (optionally 4-bit) and apply the LoRA adapter on top."""
    import torch
    import transformers
    from transformers import AutoModelForCausalLM

    quantise = False
    quantisation_note = "none (fp32 on CPU)" if device == "cpu" else "none (fp16)"
    if load_in_4bit == "yes":
        if device != "cuda":
            raise SystemExit("--load_in_4bit yes needs a CUDA device; bitsandbytes 4-bit "
                             "kernels do not run on CPU. Use --load_in_4bit no.")
        quantise = True
    elif load_in_4bit == "auto" and device == "cuda":
        try:
            import bitsandbytes  # noqa: F401
            quantise = True
        except Exception as exc:
            log.warning("bitsandbytes unavailable (%s) — evaluating in fp16 instead of "
                        "4-bit. This differs from the QLoRA training-time quantisation.", exc)

    kwargs: dict[str, Any] = {"token": token}
    if device == "cuda":
        kwargs["device_map"] = {"": 0}
    if quantise:
        from transformers import BitsAndBytesConfig
        kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            # Matches train_qlora.load_quantised_model(): T4 is sm_75, fp16 only.
            bnb_4bit_compute_dtype=torch.float16,
        )
        quantisation_note = "4-bit NF4 (double quant, fp16 compute) — matches training"

    # transformers renamed torch_dtype -> dtype in v5; ask the installed version.
    major = int(str(transformers.__version__).split(".")[0])
    kwargs["dtype" if major >= 5 else "torch_dtype"] = (
        torch.float16 if device == "cuda" else torch.float32)

    try:
        try:
            model = AutoModelForCausalLM.from_pretrained(
                base_model, attn_implementation="sdpa", **kwargs)
        except (ValueError, ImportError, TypeError) as exc:
            log.warning("sdpa attention unavailable (%s); using the default implementation", exc)
            model = AutoModelForCausalLM.from_pretrained(base_model, **kwargs)
    except Exception as exc:
        tq.explain_access_error(base_model, token, exc)
        raise SystemExit(2)

    if device == "cpu":
        model.to("cpu")

    info: dict[str, Any] = {
        "base_model": base_model,
        "quantisation": quantisation_note,
        "loaded_in_4bit": quantise,
        "model_type": getattr(getattr(model, "config", None), "model_type", None),
        "dtype": str(next(model.parameters()).dtype),
    }

    if adapter_path:
        try:
            from peft import PeftModel
        except ImportError as exc:
            raise SystemExit(f"--adapter_path needs peft, which is not installed ({exc}).\n"
                             f"    pip install -r requirements-train.txt")
        try:
            model = PeftModel.from_pretrained(model, adapter_path, is_trainable=False)
        except Exception as exc:
            raise SystemExit(f"could not apply the LoRA adapter at {adapter_path} to "
                             f"{base_model}: {type(exc).__name__}: {exc}")
        info["adapter_path"] = str(adapter_path)
        info["is_finetuned"] = True
    else:
        info["adapter_path"] = None
        info["is_finetuned"] = False

    model.eval()
    # Training disables the KV cache because it is incompatible with gradient
    # checkpointing; generation wants it back.
    model.config.use_cache = True

    total = sum(p.numel() for p in model.parameters())
    info["total_parameters"] = total
    info["parameters_billions"] = round(total / 1e9, 3)
    return model, info


# ══════════════════════════════════════════════════════════════════════════════
# Generation
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_STOP_STRINGS = ["\nUser:", "\n\nUser:", "User:\n", "\nSystem:"]


def truncate_at_stop(text: str, stop_strings: Sequence[str]) -> tuple[str, bool]:
    """Cut the completion at the first stop marker the model ran past."""
    cut = len(text)
    hit = False
    for marker in stop_strings:
        position = text.find(marker)
        if position != -1 and position < cut:
            cut = position
            hit = True
    return text[:cut], hit


def generate_batch(model, tokenizer, prompts: Sequence[str], device: str,
                   generation_kwargs: dict, max_input_tokens: int
                   ) -> tuple[list[str], list[int], int]:
    """Generate completions for one batch. Returns (texts, new_token_counts, truncated)."""
    import torch

    unpadded = tokenizer(list(prompts))["input_ids"]
    truncated = int(sum(1 for ids in unpadded if len(ids) > max_input_tokens))
    encoded = tokenizer(list(prompts), return_tensors="pt", padding=True,
                        truncation=True, max_length=max_input_tokens)
    encoded = {key: value.to(device) for key, value in encoded.items()}
    prompt_length = encoded["input_ids"].shape[1]

    with torch.no_grad():
        output = model.generate(**encoded, **generation_kwargs)

    texts: list[str] = []
    counts: list[int] = []
    for row in range(output.shape[0]):
        new_tokens = output[row][prompt_length:]
        # Trailing pads appear when other rows in the batch generated for longer.
        if tokenizer.pad_token_id is not None:
            keep = (new_tokens != tokenizer.pad_token_id).nonzero()
            length = int(keep[-1].item()) + 1 if keep.numel() else 0
            new_tokens = new_tokens[:length]
        counts.append(int(new_tokens.numel()))
        texts.append(tokenizer.decode(new_tokens, skip_special_tokens=True))
    return texts, counts, truncated


def sequence_nll(model, tokenizer, prompt: str, reference: str, device: str,
                 max_input_tokens: int) -> tuple[float, int]:
    """Teacher-forced negative log-likelihood of `reference` given `prompt`.

    Returns (summed NLL in nats, number of scored tokens). Prompt tokens are
    masked out with -100 so only the reference completion contributes, which is
    what makes the resulting perplexity a measure of the model's fit to the
    reference rather than to its own prompt.
    """
    import torch

    prompt_ids = tokenizer(prompt, add_special_tokens=True)["input_ids"]
    full_ids = tokenizer(prompt + reference, add_special_tokens=True)["input_ids"]
    if len(full_ids) <= len(prompt_ids):
        return 0.0, 0
    if len(full_ids) > max_input_tokens:
        full_ids = full_ids[:max_input_tokens]
        if len(full_ids) <= len(prompt_ids):
            return 0.0, 0

    input_ids = torch.tensor([full_ids], device=device)
    labels = input_ids.clone()
    labels[0, :len(prompt_ids)] = -100

    with torch.no_grad():
        outputs = model(input_ids=input_ids, labels=labels)
    # HF shifts internally (shift_labels = labels[1:]), and every unmasked label
    # survives that shift because the prompt occupies index 0, so the number of
    # positions the reported mean loss averages over is exactly the unmasked count.
    scored = int((labels[0] != -100).sum().item())
    if scored <= 0:
        return 0.0, 0
    # Trainer/HF report the *mean* NLL over scored tokens; rescale to a sum so
    # samples of different lengths aggregate correctly at corpus level.
    return float(outputs.loss.item()) * scored, scored


# ══════════════════════════════════════════════════════════════════════════════
# Aggregation
# ══════════════════════════════════════════════════════════════════════════════

def _mean(values: Sequence[float]) -> float | None:
    clean = [v for v in values if v is not None]
    return round(sum(clean) / len(clean), 6) if clean else None


def aggregate(samples: Sequence[dict], bleu) -> dict[str, Any]:
    """Corpus-level metrics over a set of already-scored samples.

    BLEU is recomputed as a corpus statistic over the subset rather than averaged
    from the per-sample scores, because corpus BLEU pools n-gram counts and is not
    the mean of sentence BLEU. ROUGE and BERTScore are means of per-sample F1,
    which is how both reference implementations aggregate.
    """
    if not samples:
        return {"n": 0}

    predictions = [s["prediction"] for s in samples]
    references = [s["reference"] for s in samples]

    result: dict[str, Any] = {
        "n": len(samples),
        "bleu_corpus": bleu.corpus(predictions, references),
        "bleu_sentence_mean": _mean([s["metrics"].get("bleu") for s in samples]),
        "rouge1": _mean([s["metrics"].get("rouge1") for s in samples]),
        "rouge2": _mean([s["metrics"].get("rouge2") for s in samples]),
        "rougeL": _mean([s["metrics"].get("rougeL") for s in samples]),
        "bertscore_precision": _mean([s["metrics"].get("bertscore_precision") for s in samples]),
        "bertscore_recall": _mean([s["metrics"].get("bertscore_recall") for s in samples]),
        "bertscore_f1": _mean([s["metrics"].get("bertscore_f1") for s in samples]),
        "exact_match": round(sum(1 for s in samples
                                 if s["prediction"].strip() == s["reference"].strip())
                             / len(samples), 6),
        "empty_predictions": sum(1 for s in samples if not s["prediction"].strip()),
        "mean_prediction_chars": round(sum(len(p) for p in predictions) / len(predictions), 1),
        "mean_reference_chars": round(sum(len(r) for r in references) / len(references), 1),
    }
    if result["bleu_corpus"] is not None:
        result["bleu_corpus"] = round(result["bleu_corpus"], 6)

    nll_total = sum(s["metrics"]["nll_sum"] for s in samples
                    if s["metrics"].get("nll_sum") is not None)
    token_total = sum(s["metrics"]["nll_tokens"] for s in samples
                      if s["metrics"].get("nll_tokens"))
    if token_total > 0:
        mean_nll = nll_total / token_total
        result["mean_token_nll"] = round(mean_nll, 6)
        try:
            result["perplexity"] = round(math.exp(mean_nll), 4)
        except OverflowError:
            result["perplexity"] = float("inf")
        result["perplexity_tokens"] = token_total
    else:
        result["mean_token_nll"] = None
        result["perplexity"] = None
        result["perplexity_tokens"] = 0
    return result


def group_by(samples: Sequence[dict], key: Callable[[dict], str | None], bleu
             ) -> dict[str, dict]:
    """Aggregate per group, dropping samples with no value for that field."""
    groups: dict[str, list[dict]] = {}
    for sample in samples:
        value = key(sample)
        if value:
            groups.setdefault(value, []).append(sample)
    return {name: aggregate(items, bleu) for name, items in sorted(groups.items())}


# ══════════════════════════════════════════════════════════════════════════════
# Reporting
# ══════════════════════════════════════════════════════════════════════════════

METRIC_ROWS = [
    ("bleu_corpus", "BLEU (corpus)"),
    ("bleu_sentence_mean", "BLEU (sentence mean)"),
    ("rouge1", "ROUGE-1"),
    ("rouge2", "ROUGE-2"),
    ("rougeL", "ROUGE-L"),
    ("bertscore_precision", "BERTScore Precision"),
    ("bertscore_recall", "BERTScore Recall"),
    ("bertscore_f1", "BERTScore F1"),
    ("exact_match", "Exact match"),
    ("perplexity", "Perplexity (teacher-forced)"),
]


def fmt(value: Any, places: int = 4) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, float):
        return f"{value:.{places}f}"
    return str(value)


def markdown_metric_table(metrics: dict[str, Any]) -> list[str]:
    lines = ["| Metric | Value |", "| --- | --- |"]
    for key, label in METRIC_ROWS:
        if key in metrics:
            lines.append(f"| {label} | {fmt(metrics[key])} |")
    lines.append(f"| Samples | {metrics.get('n', 0)} |")
    return lines


def markdown_group_table(groups: dict[str, dict], title: str) -> list[str]:
    if not groups:
        return []
    lines = [f"### {title}", "",
             "| Group | n | BLEU (corpus) | ROUGE-1 | ROUGE-2 | ROUGE-L | BERTScore F1 | PPL |",
             "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for name, metrics in groups.items():
        lines.append(
            f"| {name} | {metrics.get('n', 0)} | {fmt(metrics.get('bleu_corpus'))} | "
            f"{fmt(metrics.get('rouge1'))} | {fmt(metrics.get('rouge2'))} | "
            f"{fmt(metrics.get('rougeL'))} | {fmt(metrics.get('bertscore_f1'))} | "
            f"{fmt(metrics.get('perplexity'), 2)} |")
    lines.append("")
    return lines


def write_report(path: Path, payload: dict) -> None:
    run = payload["run"]
    model = payload["model"]
    dataset = payload["dataset"]
    generation = payload["generation"]
    backends = payload["metric_backends"]

    lines: list[str] = []
    add = lines.append

    add(f"# Evaluation Report — {run['label']}")
    add("")
    add("Every number in this report was computed by the run described below, from "
        "the model's own generated predictions and the dataset's reference texts. "
        "Metrics that could not be computed are shown as `n/a`, never substituted.")
    add("")
    add("## Evaluation Summary")
    add("")
    add("```")
    add(f"Model:              {'fine-tuned (base + LoRA adapter)' if model['is_finetuned'] else 'base model (no adapter)'}")
    add(f"Base Model:         {model['base_model']}")
    add(f"LoRA Adapter:       {model['adapter_path'] or 'none'}")
    add("")
    add(f"Dataset:            {dataset['file']}")
    add(f"Split:              {dataset['split']}{dataset['split_note']}")
    add(f"Task:               {dataset['task']}")
    add(f"Samples:            {payload['results']['overall']['n']} evaluated"
        f"{'' if not payload['failures'] else f', {len(payload['failures'])} failed'}")
    add("")
    add(f"Device:             {run['device']}{run['device_note']}")
    add(f"Quantisation:       {model['quantisation']}")
    add("")
    for key, label in METRIC_ROWS:
        value = payload["results"]["overall"].get(key)
        add(f"{label + ':':<28}{fmt(value)}")
    add("```")
    add("")

    add("## Run configuration")
    add("")
    add("| Field | Value |")
    add("| --- | --- |")
    add(f"| Evaluated at (UTC) | {run['timestamp_utc']} |")
    add(f"| Seed | {run['seed']} |")
    add(f"| Device | {run['device']} |")
    add(f"| Model parameters | {model['total_parameters']:,} ({model['parameters_billions']} B) |")
    add(f"| Model dtype | {model['dtype']} |")
    add(f"| Quantisation | {model['quantisation']} |")
    add(f"| Prompt style | {payload['prompt']['style']} (system prompt: "
        f"{'yes' if payload['prompt']['system_prompt'] else 'no'}) |")
    add(f"| Tokenizer | {payload['prompt']['tokenizer_source']} ({payload['prompt']['tokenizer_origin']}) |")
    add(f"| Dataset file | `{dataset['file']}` |")
    add(f"| Dataset records read | {dataset['records_read']} |")
    add(f"| Evaluation pairs built | {dataset['pairs_built']} |")
    add(f"| Pairs evaluated | {payload['results']['overall']['n']} |")
    add(f"| Sub-sampling | {dataset['subsample_note']} |")
    add(f"| Generation | {generation['summary']} |")
    add(f"| Stop strings | {generation['stop_strings'] or 'none'} |")
    add(f"| Max input tokens | {generation['max_input_tokens']} |")
    add(f"| Wall clock | {run['runtime_seconds']:.1f} s |")
    if run.get("git_commit"):
        add(f"| Git commit | `{run['git_commit']}` |")
    add("")

    add("### Generation parameters")
    add("")
    add("| Parameter | Value |")
    add("| --- | --- |")
    for key in ("do_sample", "max_new_tokens", "temperature", "top_p", "num_beams",
                "repetition_penalty"):
        if key in generation:
            add(f"| {key} | {generation[key] if generation[key] is not None else 'n/a (not applied)'} |")
    add("")

    add("### Metric implementations")
    add("")
    add("BLEU, ROUGE and BERTScore are only comparable across studies when the "
        "implementation is stated, so the exact backend used is recorded here.")
    add("")
    add("| Metric | Backend | Details |")
    add("| --- | --- | --- |")
    for name, info in backends.items():
        detail = info.get("detail") or ""
        if not info.get("available"):
            detail = f"NOT COMPUTED — {info.get('reason') or 'unavailable'}"
        add(f"| {name} | {info.get('backend')} | {detail} |")
    add("")

    add("## Results")
    add("")
    add("### Overall")
    add("")
    lines.extend(markdown_metric_table(payload["results"]["overall"]))
    add("")

    task_names = {"question_generation": "Question Generation Evaluation",
                  "answer": "Answer Generation Evaluation"}
    for task, metrics in payload["results"]["per_task"].items():
        add(f"### {task_names.get(task, task)}")
        add("")
        lines.extend(markdown_metric_table(metrics))
        add("")

    breakdowns = payload["results"].get("breakdowns") or {}
    if breakdowns:
        add("## Breakdowns")
        add("")
        add("Computed only over fields the dataset actually carries. Groups with few "
            "samples are noisy; the `n` column is there to be read alongside the score.")
        add("")
        titles = {"by_domain": "By domain", "by_difficulty": "By difficulty",
                  "by_source": "By source dataset"}
        for key, groups in breakdowns.items():
            lines.extend(markdown_group_table(groups, titles.get(key, key)))

    add("## Failures and exclusions")
    add("")
    if payload["failures"]:
        add(f"{len(payload['failures'])} example(s) failed and are excluded from every "
            f"metric above — they are not counted as empty predictions or as zeros.")
        add("")
        add("| # | id | stage | error |")
        add("| --- | --- | --- | --- |")
        for failure in payload["failures"][:50]:
            add(f"| {failure['index']} | {failure.get('id', '')} | {failure['stage']} | "
                f"{failure['error'][:160]} |")
        if len(payload["failures"]) > 50:
            add(f"| ... | | | {len(payload['failures']) - 50} more, see metrics.json |")
    else:
        add("None. Every selected example produced a prediction and was scored.")
    add("")
    dropped = dataset.get("records_dropped") or {}
    if dropped:
        add("Records the dataset loader could not turn into an evaluation pair:")
        add("")
        for reason, count in dropped.items():
            add(f"- `{reason}`: {count}")
        add("")

    add("## Reproducibility")
    add("")
    add("```")
    add(f"seed               {run['seed']}")
    add(f"base_model         {model['base_model']}")
    add(f"adapter            {model['adapter_path'] or 'none'}")
    add(f"dataset            {dataset['file']}")
    add(f"split              {dataset['split']}")
    add(f"task               {dataset['task']}")
    add(f"generation         {generation['summary']}")
    add(f"device             {run['device']}")
    add(f"timestamp (UTC)    {run['timestamp_utc']}")
    add("```")
    add("")
    add("Library versions:")
    add("")
    add("| Package | Version |")
    add("| --- | --- |")
    for package, version in run["library_versions"].items():
        add(f"| {package} | {version} |")
    add("")
    add("Re-run this exact evaluation with:")
    add("")
    add("```bash")
    add(run["command"])
    add("```")
    add("")

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def print_console_summary(payload: dict) -> None:
    results = payload["results"]
    line = "=" * 66
    print()
    print(line)
    print("EVALUATION SUMMARY")
    print(line)
    print(f"  Model              {payload['model']['base_model']}")
    print(f"  Adapter            {payload['model']['adapter_path'] or 'none (base model)'}")
    print(f"  Dataset            {payload['dataset']['file']}")
    print(f"  Split              {payload['dataset']['split']}{payload['dataset']['split_note']}")
    print(f"  Task               {payload['dataset']['task']}")
    print(f"  Samples evaluated  {results['overall']['n']}")
    print(f"  Failures           {len(payload['failures'])}")
    print(f"  Device             {payload['run']['device']}")
    print("-" * 66)
    for key, label in METRIC_ROWS:
        print(f"  {label:<30} {fmt(results['overall'].get(key))}")
    print("-" * 66)
    for task, metrics in results["per_task"].items():
        print(f"  {task} (n={metrics['n']})")
        for key, label in METRIC_ROWS:
            if metrics.get(key) is not None:
                print(f"      {label:<28} {fmt(metrics.get(key))}")
    print(line)


# ══════════════════════════════════════════════════════════════════════════════
# Comparison mode
# ══════════════════════════════════════════════════════════════════════════════

def _dotted(payload: dict, path: str) -> Any:
    current: Any = payload
    for part in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def load_run(path_arg: str) -> dict:
    path = Path(path_arg)
    if not path.is_absolute():
        path = (Path.cwd() / path).resolve()
    if path.is_dir():
        path = path / "metrics.json"
    if not path.exists():
        raise SystemExit(f"no evaluation run at {path}. Pass a directory produced by an "
                         f"evaluation run, or the metrics.json inside it.")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{path} is not valid JSON: {exc}")


def comparison_key_fields(payload: dict) -> dict[str, Any]:
    return {
        "dataset": _dotted(payload, "dataset.file"),
        "split": _dotted(payload, "dataset.split"),
        "task": _dotted(payload, "dataset.task"),
        "n_evaluated": _dotted(payload, "results.overall.n"),
        "prompt_style": _dotted(payload, "prompt.style"),
        "generation.do_sample": _dotted(payload, "generation.do_sample"),
        "generation.max_new_tokens": _dotted(payload, "generation.max_new_tokens"),
        "generation.temperature": _dotted(payload, "generation.temperature"),
        "generation.top_p": _dotted(payload, "generation.top_p"),
        "seed": _dotted(payload, "run.seed"),
    }


def compare_runs(baseline_arg: str, candidate_arg: str, output_dir: Path,
                 allow_mismatch: bool) -> int:
    baseline = load_run(baseline_arg)
    candidate = load_run(candidate_arg)

    baseline_fields = comparison_key_fields(baseline)
    candidate_fields = comparison_key_fields(candidate)
    mismatches = [(label, baseline_fields[key], candidate_fields[key])
                  for key, label in COMPARISON_CRITICAL_FIELDS
                  if baseline_fields[key] != candidate_fields[key]]

    if mismatches and not allow_mismatch:
        print("=" * 66)
        print("REFUSING TO COMPARE — the two runs are not directly comparable")
        print("=" * 66)
        for label, left, right in mismatches:
            print(f"  {label:<32} baseline={left!r}  candidate={right!r}")
        print()
        print("Re-run both evaluations with identical settings, or pass --allow_mismatch")
        print("to produce the table anyway (the differences will be printed in it).")
        print("=" * 66)
        return 3

    baseline_finetuned = bool(_dotted(baseline, "model.is_finetuned"))
    candidate_finetuned = bool(_dotted(candidate, "model.is_finetuned"))
    if baseline_finetuned and not candidate_finetuned:
        baseline, candidate = candidate, baseline
        baseline_finetuned, candidate_finetuned = candidate_finetuned, baseline_finetuned
        log.info("swapped the two runs so the base model is the baseline column")

    def deltas(left: dict, right: dict) -> list[dict]:
        rows = []
        for key, label in METRIC_ROWS:
            before, after = left.get(key), right.get(key)
            row: dict[str, Any] = {"metric": key, "label": label,
                                   "baseline": before, "candidate": after,
                                   "delta": None, "relative_percent": None,
                                   "improved": None}
            if isinstance(before, (int, float)) and isinstance(after, (int, float)):
                higher_better = HIGHER_IS_BETTER.get(key, True)
                row["delta"] = round(after - before, 6)
                if before:
                    row["relative_percent"] = round(100.0 * (after - before) / abs(before), 2)
                row["improved"] = (after > before) if higher_better else (after < before)
            rows.append(row)
        return rows

    comparison: dict[str, Any] = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "baseline": {"label": _dotted(baseline, "run.label"),
                     "base_model": _dotted(baseline, "model.base_model"),
                     "adapter": _dotted(baseline, "model.adapter_path"),
                     "is_finetuned": baseline_finetuned},
        "candidate": {"label": _dotted(candidate, "run.label"),
                      "base_model": _dotted(candidate, "model.base_model"),
                      "adapter": _dotted(candidate, "model.adapter_path"),
                      "is_finetuned": candidate_finetuned},
        "configuration_mismatches": [{"field": label, "baseline": left, "candidate": right}
                                     for label, left, right in mismatches],
        "comparable": not mismatches,
        "overall": deltas(_dotted(baseline, "results.overall") or {},
                          _dotted(candidate, "results.overall") or {}),
        "per_task": {},
    }
    baseline_tasks = _dotted(baseline, "results.per_task") or {}
    candidate_tasks = _dotted(candidate, "results.per_task") or {}
    for task in sorted(set(baseline_tasks) & set(candidate_tasks)):
        comparison["per_task"][task] = deltas(baseline_tasks[task], candidate_tasks[task])

    scored = [row for row in comparison["overall"] if row["improved"] is not None]
    improved = [row for row in scored if row["improved"]]
    comparison["summary"] = {
        "metrics_compared": len(scored),
        "metrics_improved": len(improved),
        "metrics_regressed": len(scored) - len(improved),
        "improved_metrics": [row["metric"] for row in improved],
        "regressed_metrics": [row["metric"] for row in scored if not row["improved"]],
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "comparison.json").write_text(
        json.dumps(comparison, indent=2, default=str), encoding="utf-8")

    def table(rows: list[dict]) -> list[str]:
        out = ["| Metric | Base | Fine-tuned | Improvement | Relative |",
               "| --- | ---: | ---: | ---: | ---: |"]
        for row in rows:
            if row["baseline"] is None and row["candidate"] is None:
                continue
            delta = "n/a" if row["delta"] is None else f"{row['delta']:+.4f}"
            relative = ("n/a" if row["relative_percent"] is None
                        else f"{row['relative_percent']:+.2f}%")
            direction = "" if row["improved"] is None else (" ✔" if row["improved"] else " ✘")
            out.append(f"| {row['label']} | {fmt(row['baseline'])} | {fmt(row['candidate'])} "
                       f"| {delta}{direction} | {relative} |")
        return out

    lines = ["# Base vs Fine-tuned Comparison", "",
             f"Generated {comparison['generated_at_utc']} from two completed evaluation runs. "
             f"All values are read from those runs' `metrics.json`; nothing is recomputed "
             f"or estimated here.", "",
             "| | Baseline | Candidate |", "| --- | --- | --- |",
             f"| Run | {comparison['baseline']['label']} | {comparison['candidate']['label']} |",
             f"| Base model | {comparison['baseline']['base_model']} | "
             f"{comparison['candidate']['base_model']} |",
             f"| Adapter | {comparison['baseline']['adapter'] or 'none'} | "
             f"{comparison['candidate']['adapter'] or 'none'} |", ""]

    if mismatches:
        lines += ["> **Warning — these runs are not directly comparable.** The following "
                  "settings differ, so the table below does not isolate the effect of "
                  "fine-tuning:", ""]
        lines += [f"> - {label}: baseline `{left}` vs candidate `{right}`"
                  for label, left, right in mismatches]
        lines.append("")
    if not candidate_finetuned:
        lines += ["> **Note** — neither run used a LoRA adapter, so this compares two base "
                  "model runs rather than base vs fine-tuned.", ""]

    lines += ["## Overall", ""] + table(comparison["overall"]) + [""]
    task_names = {"question_generation": "Question Generation",
                  "answer": "Answer Generation"}
    for task, rows in comparison["per_task"].items():
        lines += [f"## {task_names.get(task, task)}", ""] + table(rows) + [""]

    summary = comparison["summary"]
    lines += ["## Verdict", ""]
    if summary["metrics_compared"] == 0:
        lines.append("No metric was computable in both runs, so no claim can be made.")
    elif summary["metrics_improved"] == summary["metrics_compared"]:
        lines.append(f"The fine-tuned model scores better on all "
                     f"{summary['metrics_compared']} comparable metrics.")
    elif summary["metrics_improved"] == 0:
        lines.append(f"The fine-tuned model does **not** improve on any of the "
                     f"{summary['metrics_compared']} comparable metrics.")
    else:
        lines.append(f"Mixed result: the fine-tuned model improves "
                     f"{summary['metrics_improved']} of {summary['metrics_compared']} "
                     f"comparable metrics and regresses on "
                     f"{summary['metrics_regressed']} "
                     f"({', '.join(summary['regressed_metrics'])}).")
    lines += ["", "This verdict is a direct restatement of the numbers above and carries "
                  "no significance test; with a small `n` the differences may not be "
                  "statistically meaningful.", ""]

    (output_dir / "comparison.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print()
    print("=" * 78)
    print("BASE vs FINE-TUNED")
    print("=" * 78)
    print(f"{'Metric':<30}{'Base':>12}{'Fine-tuned':>14}{'Improvement':>16}")
    print("-" * 78)
    for row in comparison["overall"]:
        if row["baseline"] is None and row["candidate"] is None:
            continue
        delta = "n/a" if row["delta"] is None else f"{row['delta']:+.4f}"
        print(f"{row['label']:<30}{fmt(row['baseline']):>12}{fmt(row['candidate']):>14}"
              f"{delta:>16}")
    print("-" * 78)
    print(f"  improved {summary['metrics_improved']}/{summary['metrics_compared']} metrics")
    if mismatches:
        print("  WARNING: configuration differences make this comparison unreliable "
              "(see comparison.md)")
    print("=" * 78)
    print(f"Wrote {output_dir / 'comparison.json'}")
    print(f"Wrote {output_dir / 'comparison.md'}")
    return 0


# ══════════════════════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════════════════════

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="evaluate_model.py",
        description="Evaluate the interview-assistant LLM (base or QLoRA fine-tuned) "
                    "against the project's reference data.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("DEVELOPER NOTE")[0])

    model = parser.add_argument_group("model")
    model.add_argument("--base_model", type=str, default="mistralai/Mistral-7B-v0.3",
                       help="HuggingFace id or local path of the base model")
    model.add_argument("--adapter_path", type=str, default=None,
                       help="directory holding adapter_config.json + adapter weights; "
                            "omit to evaluate the base model")
    model.add_argument("--tokenizer", type=str, default=None,
                       help="override the tokenizer (default: the adapter's, else the base model's)")
    model.add_argument("--device", type=str, default="auto", choices=["auto", "cuda", "cpu"])
    model.add_argument("--load_in_4bit", type=str, default="auto", choices=["auto", "yes", "no"],
                       help="4-bit NF4 as in QLoRA training; auto = yes on CUDA when "
                            "bitsandbytes is importable")

    data = parser.add_argument_group("dataset")
    data.add_argument("--dataset", type=str, default=str(DEFAULT_DATASET),
                      help="directory with train/validation/test files, or one file")
    data.add_argument("--split", type=str, default="test",
                      choices=sorted(tq.SPLIT_ALIASES),
                      help="which split to evaluate when --dataset is a directory")
    data.add_argument("--task", type=str, default="both",
                      choices=["question_generation", "answer", "both"],
                      help="which supervised task(s) to evaluate; reported separately")
    data.add_argument("--max_samples", type=int, default=None,
                      help="evaluate a reproducible task-stratified subset of this size")

    generation = parser.add_argument_group("generation")
    generation.add_argument("--max_new_tokens", type=int, default=128)
    generation.add_argument("--do_sample", action="store_true",
                            help="sample instead of greedy decoding; off by default so the "
                                 "benchmark is deterministic")
    generation.add_argument("--temperature", type=float, default=0.7,
                            help="only applied with --do_sample")
    generation.add_argument("--top_p", type=float, default=0.9,
                            help="only applied with --do_sample")
    generation.add_argument("--num_beams", type=int, default=1)
    generation.add_argument("--repetition_penalty", type=float, default=1.0)
    generation.add_argument("--batch_size", type=int, default=1,
                            help="prompts per generate() call")
    generation.add_argument("--max_input_tokens", type=int, default=1024)
    generation.add_argument("--stop", action="append", default=None,
                            help="extra stop string, repeatable")
    generation.add_argument("--no_default_stop", action="store_true",
                            help="do not truncate completions at 'User:' markers")
    generation.add_argument("--prompt_style", choices=["auto", "chat", "plain"], default="auto",
                            help="must match the style used in training")
    generation.add_argument("--no_system_prompt", action="store_true",
                            help="must match the training setting")

    metrics = parser.add_argument_group("metrics")
    metrics.add_argument("--no_bertscore", action="store_true",
                         help="skip BERTScore (it downloads a ~1.4 GB encoder on first use)")
    metrics.add_argument("--bertscore_model", type=str, default=None,
                         help="embedding model for BERTScore (default: bert_score's choice for English)")
    metrics.add_argument("--bertscore_layer", type=int, default=None)
    metrics.add_argument("--bertscore_batch_size", type=int, default=16)
    metrics.add_argument("--no_perplexity", action="store_true",
                         help="skip the teacher-forced perplexity forward pass")
    metrics.add_argument("--builtin_metrics_only", action="store_true",
                         help="ignore sacrebleu/rouge_score/bert_score and use the builtin "
                              "implementations (for offline machines)")

    output = parser.add_argument_group("output")
    output.add_argument("--output_dir", type=str, default=str(DEFAULT_OUTPUT))
    output.add_argument("--run_name", type=str, default=None,
                        help="subdirectory name (default: derived from model/adapter/split)")
    output.add_argument("--seed", type=int, default=42)
    output.add_argument("--inspect_dataset", action="store_true",
                        help="show the evaluation pairs and exit without loading a model")
    output.add_argument("--compare", nargs=2, metavar=("RUN_A", "RUN_B"), default=None,
                        help="compare two finished evaluation runs and exit")
    output.add_argument("--allow_mismatch", action="store_true",
                        help="with --compare, produce the table even if the runs differ")
    output.add_argument("--verbose", action="store_true")

    return parser


def default_run_name(args) -> str:
    slug = args.base_model.rstrip("/").split("/")[-1].replace(":", "_")
    prefix = "finetuned" if args.adapter_path else "base"
    return f"{prefix}__{slug}__{args.split}"


def git_commit() -> str | None:
    try:
        result = subprocess.run(["git", "rev-parse", "--short", "HEAD"],
                                cwd=str(ML_SERVICE), capture_output=True, text=True, timeout=10)
        return result.stdout.strip() or None if result.returncode == 0 else None
    except Exception:
        return None


def evaluate(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")

    if args.compare:
        output_dir = Path(args.output_dir)
        if not output_dir.is_absolute():
            output_dir = (Path.cwd() / output_dir).resolve()
        return compare_runs(args.compare[0], args.compare[1],
                            output_dir / "comparison", args.allow_mismatch)

    started = time.time()
    tq.set_seed_everywhere(args.seed)

    # ── dataset ──────────────────────────────────────────────────────────────
    dataset_file, split_name = resolve_dataset(args.dataset, args.split)
    records = tq.read_records(dataset_file)
    if not records:
        raise SystemExit(f"{dataset_file} contains no records.")

    examples, report = build_eval_examples(records, args.task, split_name)
    examples = deduplicate(examples, report)
    if not examples:
        print_dataset_report(report, dataset_file, split_name)
        raise SystemExit(
            f"no evaluable (prompt, reference) pairs were produced from {dataset_file} "
            f"for --task {args.task}.\n"
            f"For --task answer every record needs a non-empty 'expected_answer'; this "
            f"dataset leaves it empty for many records.")

    pairs_built = len(examples)
    selected = subsample(examples, args.max_samples, args.seed)
    subsample_note = (f"all {pairs_built} pairs"
                      if len(selected) == pairs_built
                      else f"{len(selected)} of {pairs_built} pairs, task-stratified, seed {args.seed}")

    print_dataset_report(report, dataset_file, split_name)

    split_note = ""
    if split_name in tq.SPLIT_ALIASES["validation"]:
        split_note = "  (VALIDATION set — a development split, not a held-out test set)"
    elif split_name in tq.SPLIT_ALIASES["train"]:
        split_note = "  (TRAINING set — results are optimistic; not a valid generalisation estimate)"
        log.warning("evaluating on the TRAINING split. These numbers measure memorisation, "
                    "not generalisation, and must be labelled as such.")

    # ── prompt rendering (reuses the training renderer) ───────────────────────
    token = tq.hf_token()
    if args.inspect_dataset:
        return inspect_dataset(args, selected, dataset_file, split_name, split_note, token)

    device = resolve_device(args.device)
    device_note = ""
    if device == "cpu":
        device_note = "  (CPU — generation is orders of magnitude slower than GPU)"
        print()
        print("!" * 66)
        print("WARNING: no CUDA device — generating on CPU.")
        print("A 7B model produces roughly one token per second per sample on a typical")
        print("CPU, so a few hundred samples can take many hours. This is a correctness")
        print("path, not a performance path: use --max_samples for a smoke test and run")
        print("the real evaluation on a GPU. CPU and GPU results are NOT interchangeable")
        print("(different kernels and reduction order change generated text).")
        print("!" * 66)

    adapter_info = validate_adapter(args.adapter_path, args.base_model) if args.adapter_path else None

    tokenizer, tokenizer_info = load_tokenizer_for_eval(
        args.base_model, args.adapter_path, args.tokenizer, token)
    render_prompt, _render_completion, prompt_style = tq.make_renderer(
        tokenizer, args.prompt_style, not args.no_system_prompt)

    print()
    print(f"Loading {args.base_model}"
          + (f" + adapter {args.adapter_path}" if args.adapter_path else " (base model, no adapter)"))
    model, model_info = load_model_for_eval(
        args.base_model, args.adapter_path, device, args.load_in_4bit, token)
    model_info["adapter"] = adapter_info
    if device == "cpu" and model_info["total_parameters"] > 1_000_000_000:
        log.warning("%s has %.1fB parameters and is running on CPU — expect this to be "
                    "extremely slow.", args.base_model, model_info["parameters_billions"])

    # ── generation config ────────────────────────────────────────────────────
    stop_strings = [] if args.no_default_stop else list(DEFAULT_STOP_STRINGS)
    stop_strings += list(args.stop or [])

    generation_kwargs: dict[str, Any] = {
        "max_new_tokens": args.max_new_tokens,
        "do_sample": args.do_sample,
        "num_beams": args.num_beams,
        "repetition_penalty": args.repetition_penalty,
        "pad_token_id": tokenizer.pad_token_id,
        "eos_token_id": tokenizer.eos_token_id,
    }
    if args.do_sample:
        generation_kwargs["temperature"] = args.temperature
        generation_kwargs["top_p"] = args.top_p
    elif args.temperature != 0.7 or args.top_p != 0.9:
        log.warning("--temperature/--top_p are ignored without --do_sample; decoding is "
                    "greedy and they are recorded as null in the report")

    generation_record = {
        "max_new_tokens": args.max_new_tokens,
        "do_sample": args.do_sample,
        "temperature": args.temperature if args.do_sample else None,
        "top_p": args.top_p if args.do_sample else None,
        "num_beams": args.num_beams,
        "repetition_penalty": args.repetition_penalty,
        "batch_size": args.batch_size,
        "max_input_tokens": args.max_input_tokens,
        "stop_strings": stop_strings,
        "summary": (f"{'sampling' if args.do_sample else 'greedy'}, "
                    f"max_new_tokens={args.max_new_tokens}"
                    + (f", temperature={args.temperature}, top_p={args.top_p}"
                       if args.do_sample else "")
                    + (f", num_beams={args.num_beams}" if args.num_beams > 1 else "")),
    }

    # ── generate ─────────────────────────────────────────────────────────────
    print()
    print(f"Generating {len(selected)} completion(s) — {generation_record['summary']}")
    scored: list[dict] = []
    failures: list[dict] = []
    truncated_prompts = 0
    generation_started = time.time()

    for start in range(0, len(selected), args.batch_size):
        batch = selected[start:start + args.batch_size]
        prompts = [render_prompt(example["user"]) for example in batch]
        try:
            texts, counts, truncated = generate_batch(
                model, tokenizer, prompts, device, generation_kwargs, args.max_input_tokens)
            truncated_prompts += truncated
        except Exception as exc:
            # One failed batch must not be silently scored as empty output.
            for offset, example in enumerate(batch):
                failures.append({"index": start + offset, "id": example["id"],
                                 "task": example["task"], "stage": "generation",
                                 "error": f"{type(exc).__name__}: {exc}"})
            log.error("generation failed for batch at index %d (%s: %s) — %d example(s) "
                      "excluded from the metrics", start, type(exc).__name__, exc, len(batch))
            continue

        for offset, (example, text, count) in enumerate(zip(batch, texts, counts)):
            completion, hit_stop = truncate_at_stop(text, stop_strings)
            scored.append({
                "index": start + offset,
                "id": example["id"],
                "task": example["task"],
                "domain": example["metadata"].get("domain"),
                "difficulty": example["metadata"].get("difficulty"),
                "source": example["metadata"].get("source"),
                "prompt": prompts[offset],
                "user_turn": example["user"],
                "reference": example["reference"],
                "prediction": completion.strip(),
                "raw_prediction": text,
                "new_tokens": count,
                "truncated_at_stop": hit_stop,
                "metrics": {},
            })

        done = start + len(batch)
        if done % max(args.batch_size, 10) == 0 or done >= len(selected):
            elapsed = time.time() - generation_started
            rate = done / elapsed if elapsed else 0
            remaining = (len(selected) - done) / rate if rate else 0
            print(f"  {done}/{len(selected)}  ({rate:.2f} samples/s, "
                  f"~{remaining / 60:.1f} min remaining)")

    generation_seconds = time.time() - generation_started
    if not scored:
        raise SystemExit(f"every example failed during generation ({len(failures)} failures). "
                         f"First error: {failures[0]['error'] if failures else 'unknown'}")

    # ── perplexity (teacher forced) ──────────────────────────────────────────
    if not args.no_perplexity:
        print(f"Scoring teacher-forced likelihood for {len(scored)} example(s)")
        for sample in scored:
            try:
                nll, tokens = sequence_nll(model, tokenizer, sample["prompt"],
                                           sample["reference"], device, args.max_input_tokens)
                sample["metrics"]["nll_sum"] = nll
                sample["metrics"]["nll_tokens"] = tokens
            except Exception as exc:
                log.warning("perplexity scoring failed for %s (%s) — recorded as null",
                            sample["id"], exc)
                sample["metrics"]["nll_sum"] = None
                sample["metrics"]["nll_tokens"] = 0
    else:
        for sample in scored:
            sample["metrics"]["nll_sum"] = None
            sample["metrics"]["nll_tokens"] = 0

    # ── metrics ──────────────────────────────────────────────────────────────
    try:
        from metrics_impl import BertScoreMetric, BleuMetric, RougeMetric
    except ImportError:  # imported as a package module rather than run directly
        from training.metrics_impl import BertScoreMetric, BleuMetric, RougeMetric

    prefer_third_party = not args.builtin_metrics_only
    bleu = BleuMetric(prefer_third_party=prefer_third_party)
    rouge = RougeMetric(prefer_third_party=prefer_third_party)
    print(f"BLEU backend:  {bleu.backend_detail}")
    print(f"ROUGE backend: {rouge.backend_detail}")

    for sample in scored:
        try:
            sample["metrics"]["bleu"] = round(bleu.sentence(sample["prediction"],
                                                            sample["reference"]), 6)
            for key, value in rouge.sentence(sample["prediction"], sample["reference"]).items():
                sample["metrics"][key] = round(value, 6)
        except Exception as exc:
            failures.append({"index": sample["index"], "id": sample["id"],
                             "task": sample["task"], "stage": "scoring",
                             "error": f"{type(exc).__name__}: {exc}"})
            sample["_scoring_failed"] = True
            log.error("metric computation failed for %s: %s", sample["id"], exc)

    scored = [s for s in scored if not s.get("_scoring_failed")]

    backends: dict[str, Any] = {"bleu": bleu.describe(), "rouge": rouge.describe()}

    if args.no_bertscore:
        backends["bertscore"] = {"backend": "skipped", "available": False,
                                 "reason": "--no_bertscore was passed", "detail": ""}
    else:
        print("Computing BERTScore (downloads an encoder model on first use)")
        bertscore = BertScoreMetric(
            model_name=args.bertscore_model, layer=args.bertscore_layer,
            batch_size=args.bertscore_batch_size,
            device=device, prefer_third_party=prefer_third_party)
        backends["bertscore"] = bertscore.describe()
        results = bertscore.score([s["prediction"] for s in scored],
                                  [s["reference"] for s in scored])
        backends["bertscore"] = bertscore.describe()
        if results is None:
            log.warning("BERTScore is unavailable — reported as null, not substituted. "
                        "Reason: %s", bertscore.reason)
        else:
            for sample, values in zip(scored, results):
                sample["metrics"]["bertscore_precision"] = round(values["precision"], 6)
                sample["metrics"]["bertscore_recall"] = round(values["recall"], 6)
                sample["metrics"]["bertscore_f1"] = round(values["f1"], 6)

    # ── aggregate ────────────────────────────────────────────────────────────
    results_payload = {
        "overall": aggregate(scored, bleu),
        "per_task": {task: aggregate([s for s in scored if s["task"] == task], bleu)
                     for task in sorted({s["task"] for s in scored})},
        "breakdowns": {},
    }
    for key, field in (("by_domain", "domain"), ("by_difficulty", "difficulty"),
                       ("by_source", "source")):
        groups = group_by(scored, lambda s, f=field: s.get(f), bleu)
        if groups:
            results_payload["breakdowns"][key] = groups
    for task, metrics in results_payload["per_task"].items():
        task_samples = [s for s in scored if s["task"] == task]
        metrics["by_domain"] = group_by(task_samples, lambda s: s.get("domain"), bleu)
        metrics["by_difficulty"] = group_by(task_samples, lambda s: s.get("difficulty"), bleu)

    # ── write everything out ─────────────────────────────────────────────────
    output_root = Path(args.output_dir)
    if not output_root.is_absolute():
        output_root = (Path.cwd() / output_root).resolve()
    run_dir = output_root / (args.run_name or default_run_name(args))
    run_dir.mkdir(parents=True, exist_ok=True)

    payload = {
        "run": {
            "label": args.run_name or default_run_name(args),
            "timestamp_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "seed": args.seed,
            "device": device,
            "device_note": device_note,
            "runtime_seconds": round(time.time() - started, 2),
            "generation_seconds": round(generation_seconds, 2),
            "library_versions": tq.library_versions(),
            "platform": platform.platform(),
            "git_commit": git_commit(),
            "command": "python " + " ".join([str(Path(sys.argv[0]).name)] + sys.argv[1:]),
            "gpu": tq.gpu_info(),
        },
        "model": model_info,
        "prompt": {
            "style": prompt_style,
            "system_prompt": (None if args.no_system_prompt else tq.SYSTEM_PROMPT),
            "tokenizer_source": tokenizer_info["source"],
            "tokenizer_origin": tokenizer_info["origin"],
            "source": "train_qlora.make_renderer() — identical to training",
        },
        "dataset": {
            "argument": args.dataset,
            "file": str(dataset_file),
            "split": split_name,
            "split_note": split_note,
            "task": args.task,
            "records_read": report.records,
            "pairs_built": pairs_built,
            "duplicates_removed": report.duplicates,
            "records_dropped": report.as_dict()["records_dropped"],
            "examples_per_task": report.as_dict()["examples_per_task"],
            "subsample_note": subsample_note,
            "max_samples": args.max_samples,
            "prompts_truncated": truncated_prompts,
        },
        "generation": generation_record,
        "metric_backends": backends,
        "results": results_payload,
        "failures": failures,
    }

    (run_dir / "metrics.json").write_text(
        json.dumps(payload, indent=2, default=str), encoding="utf-8")

    with (run_dir / "predictions.jsonl").open("w", encoding="utf-8") as handle:
        for sample in scored:
            handle.write(json.dumps({
                "id": sample["id"],
                "task": sample["task"],
                "domain": sample["domain"],
                "difficulty": sample["difficulty"],
                "source": sample["source"],
                "prompt": sample["prompt"],
                "reference": sample["reference"],
                "prediction": sample["prediction"],
                "new_tokens": sample["new_tokens"],
                "truncated_at_stop": sample["truncated_at_stop"],
                "metrics": {key: value for key, value in sample["metrics"].items()
                            if key not in ("nll_sum", "nll_tokens")},
            }, ensure_ascii=False) + "\n")

    write_report(run_dir / "evaluation_report.md", payload)

    print_console_summary(payload)
    print(f"Wrote {run_dir / 'metrics.json'}")
    print(f"Wrote {run_dir / 'predictions.jsonl'}")
    print(f"Wrote {run_dir / 'evaluation_report.md'}")
    if failures:
        print(f"NOTE: {len(failures)} example(s) failed and were excluded from every metric.")
    return 0


def print_dataset_report(report, dataset_file: Path, split_name: str) -> None:
    data = report.as_dict()
    print("-" * 66)
    print("EVALUATION DATASET")
    print("-" * 66)
    print(f"  file                       {dataset_file}")
    print(f"  split                      {split_name}")
    print(f"  records read               {data['records_read']}")
    print(f"  evaluation pairs built     {data['examples_built']}")
    print(f"  duplicates removed         {data['duplicate_examples_removed']}")
    print("  schemas detected:")
    for name, count in data["schemas_detected"].items():
        print(f"      {name:26} {count}")
    if data["examples_per_task"]:
        print("  pairs per task:")
        for name, count in data["examples_per_task"].items():
            print(f"      {name:26} {count}")
    if data["records_dropped"]:
        print("  records dropped:")
        for name, count in data["records_dropped"].items():
            print(f"      {name:26} {count}")
    else:
        print("  records dropped:           none")
    print("-" * 66)


def inspect_dataset(args, selected: list[dict], dataset_file: Path, split_name: str,
                    split_note: str, token: str | None) -> int:
    """Show what would be evaluated, without loading the model."""
    try:
        tokenizer = tq.load_tokenizer(args.base_model, token)
        render_prompt, _, style = tq.make_renderer(
            tokenizer, args.prompt_style, not args.no_system_prompt)
    except Exception as exc:
        log.warning("tokenizer unavailable (%s: %s) — rendering in the plain style so the "
                    "pairs can still be inspected", type(exc).__name__, exc)
        header = "" if args.no_system_prompt else f"{tq.SYSTEM_PROMPT}\n\n"
        render_prompt = lambda user: f"{header}User:\n{user}\n\nAssistant:\n"  # noqa: E731
        style = "plain"

    print()
    print(f"File:  {dataset_file}")
    print(f"Split: {split_name}{split_note}")
    print(f"Would evaluate {len(selected)} pair(s) with prompt_style={style}")
    print()
    by_task: dict[str, list[dict]] = {}
    for example in selected:
        by_task.setdefault(example["task"], []).append(example)
    for task, items in by_task.items():
        print("=" * 66)
        print(f"TASK: {task}  ({len(items)} pairs)")
        print("=" * 66)
        for example in items[:2]:
            print("--- PROMPT (fed to the model) ---")
            print(render_prompt(example["user"])[:900])
            print("--- REFERENCE (scored against) ---")
            print(example["reference"][:600])
            print(f"--- metadata: id={example['id']} {example['metadata']}")
            print()
    print("--inspect_dataset: no model was loaded and no metrics were computed.")
    return 0


if __name__ == "__main__":
    sys.exit(evaluate())
