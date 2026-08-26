# Evaluation Harness — developer note

`training/evaluate_model.py` generates predictions from a real model and scores them
against the dataset's own reference texts. Every number it writes comes from the run
that wrote it. Metrics that cannot be computed are written as `null` with the reason
attached; nothing is substituted, estimated or carried over from a previous run.

This replaces the previous version of the file, which returned a fixed dictionary
(`BLEU 0.428`, `BERTScore 0.892`, …) regardless of the model, the dataset or whether a
model existed at all.

---

## 1. Audit findings this harness is built on

Read out of the repository before anything was written.

### Dataset

`dataset/processed/question_generator/` already contains three splits:

| File | Records |
| --- | ---: |
| `train.jsonl` | 6625 |
| `validation.jsonl` | 825 |
| `test.jsonl` | 880 |

A **dedicated held-out test split therefore already exists**, and it is the default
(`--split test`). `dataset/processed/question_generator/statistics.json` records the
leakage audit performed when the splits were built:

```json
"leakage": { "train->validation": 0, "train->test": 0, "validation->test": 0 },
"exact_duplicates": 0
```

Every report states which split was evaluated. Choosing `--split validation` adds
*"(VALIDATION set — a development split, not a held-out test set)"* to the report, and
`--split train` adds a warning that the numbers measure memorisation rather than
generalisation. A validation file is never silently relabelled a test set.

### Record schema

All splits share one schema, which `train_qlora.detect_schema()` classifies as
`instruction_io`:

| Field | Meaning |
| --- | --- |
| `id` | stable record id, e.g. `interviews-00012` |
| `question` | the interview question |
| `domain` | one of 16 software-engineering domains |
| `difficulty` | `Beginner` / `Intermediate` / `Advanced` |
| `expected_answer` | reference answer — **empty for many records** |
| `expected_answer_source` | where the answer came from |
| `source`, `source_url`, `license` | upstream dataset provenance |
| `instruction` | `"Generate a technical interview question."` |
| `input` | `"Domain: …\nDifficulty: …"` |
| `output` | the question again — the generation target |

### The two tasks

`train_qlora.record_to_examples()` derives two different supervised pairs from one
record. The harness keeps them strictly apart — **a generated question is never scored
against an expected answer** — and reports them separately as well as combined.

| Task | Prompt (user turn) | Reference |
| --- | --- | --- |
| `question_generation` | `instruction` + `"\n"` + `input` | `output` |
| `answer` | `question` | `expected_answer` |

On the test split that yields **880 question-generation pairs and 607 answer pairs**
(1487 total). The answer task is smaller because `expected_answer` is empty for many
records; those pairs are dropped, never filled in with a placeholder.

### Prompt formatting

Reused from the training script rather than re-implemented, so the evaluation prompt is
byte-identical to the training prompt:

- `train_qlora.make_renderer()` — `plain` produces
  `"{SYSTEM_PROMPT}\n\nUser:\n{user}\n\nAssistant:\n"`; `chat` uses the tokenizer's own
  chat template. `--prompt_style auto` picks the same one training would.
- `train_qlora.SYSTEM_PROMPT`, `detect_schema()`, `record_to_examples()`,
  `MIN_USER_CHARS`, `MIN_ASSISTANT_CHARS`, `SPLIT_ALIASES`, `read_records()`.

Only the *completion* half is withheld at generation time. That is the sole intended
difference between the training and evaluation prompt.

The one function not reused is `train_qlora.build_examples()`: it discards each record's
`id` / `domain` / `difficulty` / `source`, which the per-sample output and the
per-category breakdowns need. `build_eval_examples()` repeats that loop with the same
imported helpers and the same thresholds, and additionally carries the metadata through.
**The training pipeline itself is unchanged by the evaluation work.**

### Model loading

`train_qlora.load_quantised_model()` loads the base model in 4-bit NF4 (double quant,
fp16 compute, `attn_implementation="sdpa"`), and training saves **only the LoRA
adapter**. The harness mirrors that load path and then applies the adapter with
`PeftModel.from_pretrained(base_model, adapter_path)` — the adapter is never treated as
a standalone model. Three deliberate differences, each required for generation:

| | Training | Evaluation |
| --- | --- | --- |
| `use_cache` | `False` (incompatible with gradient checkpointing) | `True` |
| `prepare_model_for_kbit_training()` | applied | not applied (no gradients) |
| Tokenizer padding side | `right` (correct for causal-LM loss) | `left` (required for batched generation) |

The tokenizer is taken from the adapter directory when one is present, because
`train_qlora.train()` saves the tokenizer next to the adapter — that copy is the one the
adapter was trained with. `--tokenizer` overrides it.

---

## 2. Metrics

| Metric | Preferred backend | Fallback |
| --- | --- | --- |
| BLEU (corpus + sentence) | `sacrebleu` — BLEU-4, mteval-v13a tokenisation | builtin corpus BLEU-4 / sentence BLEU with Chen & Cherry method-3 smoothing |
| ROUGE-1 / 2 / L | `rouge_score` — F-measure, Porter stemming | builtin n-gram and LCS F1, no stemming |
| BERTScore P/R/F1 | `bert_score` — reference implementation | builtin greedy-cosine over transformer hidden states, **no baseline rescaling** |
| Perplexity | teacher-forced NLL of the reference given the prompt, computed here | — |
| Exact match | computed here | — |

Which backend actually ran is recorded in `metrics.json` and printed in
`evaluation_report.md`, because BLEU/ROUGE/BERTScore numbers are only comparable across
studies when the implementation and its tokenisation are stated. For anything going into
the thesis, install the three preferred backends (they are in `requirements-train.txt`)
and cite the versions the report records.

If `bert_score` cannot be loaded at all, BERTScore is reported as `null` with the
reason. It is never approximated by a lexical metric.

Aggregation follows each metric's own convention: corpus BLEU pools n-gram counts over
the subset (it is *not* the mean of sentence BLEU, and both are reported), ROUGE and
BERTScore are means of per-sample F1, and perplexity is `exp(total NLL / total scored
tokens)`.

### Breakdowns

Only over fields the dataset actually carries: `domain` (16 values), `difficulty` (3),
`source` (2) — per task and overall. The dataset has no technical/behavioural label and
no skills field, so no such breakdown is produced. Group sizes are printed next to every
group score.

---

## 3. Commands

Run from `ml-service/`.

```bash
# see the (prompt, reference) pairs without loading a model
python training/evaluate_model.py --inspect_dataset

# base model on the held-out test split
python training/evaluate_model.py \
    --base_model mistralai/Mistral-7B-v0.3 \
    --dataset dataset/processed/question_generator \
    --split test --max_samples 200

# fine-tuned model, identical settings
python training/evaluate_model.py \
    --base_model mistralai/Mistral-7B-v0.3 \
    --adapter_path training/output/interview_llm \
    --dataset dataset/processed/question_generator \
    --split test --max_samples 200

# base vs fine-tuned
python training/evaluate_model.py --compare \
    training/evaluation_results/base__Mistral-7B-v0.3__test \
    training/evaluation_results/finetuned__Mistral-7B-v0.3__test
```

The two runs must use the same `--dataset`, `--split`, `--task`, `--max_samples`,
`--seed` and generation settings. `--compare` checks all of those and **refuses to
produce a table** when they differ, unless `--allow_mismatch` is passed — in which case
the differences are printed at the top of the comparison so no one reads the table as a
clean fine-tuning effect.

### Output

`training/evaluation_results/<run_name>/`:

| File | Contents |
| --- | --- |
| `metrics.json` | full machine-readable record: config, backends, overall/per-task/per-group metrics, failures |
| `predictions.jsonl` | one line per example — id, task, domain, difficulty, prompt, reference, prediction, per-sample metrics |
| `evaluation_report.md` | human-readable report: summary, run configuration, metric backends, results, breakdowns, failures, reproducibility |

`--compare` writes `comparison.json` and `comparison.md` under
`<output_dir>/comparison/`.

Default `run_name` is `{base|finetuned}__{model}__{split}`, so re-running the same
configuration overwrites in place rather than accumulating directories.

---

## 4. Determinism

Decoding is **greedy by default** (`do_sample=False`), so the primary benchmark is
reproducible. `--temperature` / `--top_p` are applied only with `--do_sample` and are
recorded as `null` otherwise — a report never shows a temperature that did not affect
the run. `--seed` also drives the `--max_samples` subset selection, which is
task-stratified so a small `--max_samples` on a `both` run cannot silently evaluate zero
answer pairs.

Recorded in every run: seed, base model, adapter, dataset file, split, task, generation
parameters, stop strings, device, GPU, dtype, quantisation, prompt style, tokenizer
source, library versions, platform, git commit, timestamp, and the exact command line.

CPU and GPU results are not interchangeable — different kernels and reduction order can
change the generated text. The device used is in every report.

---

## 5. Failures

Per-example failures are recorded (`index`, `id`, `stage`, `error`), excluded from every
metric, and counted in the report. **A failed generation is never scored as an empty
prediction or a zero.** An empty string that the model genuinely produced *is* a valid
prediction and is scored as one; the two are counted separately
(`empty_predictions` vs `failures`).

The harness exits with a clear message, before loading anything expensive, when: the
dataset path does not exist, the requested split is not in the directory, the dataset
yields no usable pairs for the chosen task, `--adapter_path` is missing / is not a
directory / has no `adapter_config.json` / has no adapter weights, `--device cuda` is
requested without CUDA, or `--load_in_4bit yes` is requested on CPU. An adapter whose
`base_model_name_or_path` differs from `--base_model` loads with a warning rather than
silently.
