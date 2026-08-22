# Question Generator Dataset

The training corpus for **Agent 02 — Question Generation** (research plan §5,
Agent 02). Everything here is produced by two scripts and one taxonomy module;
no records are hand written and no statistic in this file was typed by hand —
they all come from `processed/question_generator/statistics.json`.

```text
download_datasets.py                 raw data, fetched once
        │
        ▼
interview_domains.py                 the 16 domains, difficulty rules
        │
        ▼
prepare_question_generator.py        filter → clean → map → dedup → split
        │
        ▼
processed/question_generator/*.jsonl training-ready
        │
        ▼
train_qlora.py                       QLoRA / SFT  (NOT started automatically)
```

---

## 1. Datasets used

| Dataset | Rows pulled in | Why |
|---|---|---|
| **ali-alkhars/interviews** | 2,292 | Real software-engineering interview questions scraped from Java / React / Vue / Angular / backend question banks. Short, impersonal, already phrased the way an interviewer speaks — this is the *style* target for the generator. Its weakness is that it carries **no answers**. |
| **common-pile/stackexchange** | 397,632 documents (site-scoped, see §2) | Openly licensed (CC-BY-SA) Stack Exchange dump, December 2024. Supplies breadth across all 16 domains and, critically, the **answers** that become `expected_answer`. |

Both were already downloaded. `dataset/raw/ali-alkhars__interviews` is an HF
`save_to_disk` folder; the Stack Exchange shards stay in the HuggingFace hub
cache and are referenced by
`dataset/raw/common-pile__stackexchange/snapshot.json` — they are **not** copied
into the repo, so the 660 MB of shards exist exactly once on disk.

Licence obligation: Stack Exchange content is CC-BY-SA. Every processed record
keeps `source_url` and `license` so the attribution requirement is satisfiable.

---

## 2. Stack Exchange filtering

The full dump is 33.4 M documents / 103.7 GB across 350+ sites. Training on it
whole is neither affordable nor useful, so filtering happens at three levels.

### 2.1 Site scoping (before download)

`download_datasets.py` defines `SE_SITES` and passes it to `snapshot_download`
as an allow-list, so only these eight sites are ever fetched:

| Site | Domains it feeds |
|---|---|
| softwareengineering.stackexchange.com | OOP, Design Patterns, System Design, Microservices, REST APIs, Programming Languages |
| codereview.stackexchange.com | OOP, Programming Languages, Design Patterns, Unit Testing |
| cs.stackexchange.com | Algorithms, Data Structures, Concurrency |
| cstheory.stackexchange.com | Algorithms, Data Structures |
| dba.stackexchange.com | SQL, Database Optimization |
| devops.stackexchange.com | Docker, Kubernetes, Microservices, System Design |
| security.stackexchange.com | Security |
| sqa.stackexchange.com | Unit Testing |

`stackoverflow.com` (27 GB on its own) is deliberately excluded — the eight
sites above already cover all 16 domains, and Stack Overflow is dominated by
"my code throws X" posts that fail the interview-quality filter anyway.

### 2.2 Interview-quality filtering (per document)

`common-pile/stackexchange` has no tags and no scores — each document is a
single blob: title on line 1, then the question body, then comments, then
answers ordered by votes. So the filters work on the title and body text:

| Filter | Rule | Dropped |
|---|---|---|
| `not_a_question` | The title must open with an interrogative (`what`, `why`, `how`, `is`, `explain`, `describe`, …). Ending in `?` is not enough — `"Deadlock in REDO thread, 1 replica went OK?"` ends in `?` but is a bug report. | 266,168 |
| `off_domain` | Keyword score against the 16 domains must reach `MIN_DOMAIN_SCORE = 3.0`. | 71,742 |
| `non_interview_content` | Personal / situational phrasing (`my `, `our `, `we `, `anyone`, `doesn't`, `[closed]`, `stack trace`, `salary`, …). | 12,046 |
| `too_few_words` | Fewer than 3 words. | 3,346 |
| `corrupted` | Under 50 % letters, or heavily non-ASCII. | 170 |
| `too_short` | Under 15 characters. | 14 |

**397,632 scanned → 44,146 kept (11.1 %).**

### 2.3 Balancing (after filtering)

44,146 Stack Exchange records against 1,215 interview records would let one
source swamp the other, so two caps apply (both reported in
`statistics.json → filtering`):

* `--max-per-domain 1200` — no domain contributes more than 1,200 Stack Exchange
  records. SQL alone would otherwise contribute 18,648.
* `--se-ratio 6.0` — Stack Exchange is capped at 6× the interviews count. The
  final trim is round-robin across domains so small domains are not wiped out.

Nothing is duplicated to fill a thin domain. Under-represented domains stay
small and the shortfall shows up in the per-domain counts.

---

## 3. Cleaning

`clean_text()` is deliberately conservative — it strips markup, never rewrites
words, so the original technical meaning and terminology survive:

* fenced code blocks removed
* Markdown links reduced to their text, bare URLs removed
* HTML tags stripped, HTML entities decoded
* Markdown headings, block quotes and emphasis markers removed
* CRLF normalised, runs of spaces/tabs collapsed, 3+ blank lines collapsed to 2
* every line trimmed

---

## 4. Domain mapping

The 16 domains live in `interview_domains.py`, which is the single source of
truth. Their provenance:

* **1–14** are the Stack Exchange filter tags already written down in
  `DATASETS.md` §A (`sql, indexing, oop, design-patterns, microservices, docker,
  kubernetes, rest, concurrency, algorithm, data-structures, security,
  unit-testing, system-design`).
* **15–16** are the two remaining dataset categories from
  `AI_Interview_Assistant_Research_Plan.md` §6.1 — *Frontend* (React, Angular,
  state management) and *Programming* (Java, Python, PHP, JavaScript).

`DATASETS.md` referred to "the 16-category JSON schema" but never enumerated the
list; `interview_domains.py` is that enumeration.

Mapping is a deterministic weighted keyword score over title + body:

```
score(domain) = 3.0 × (strong terms present) + 1.0 × (weak terms present) + prior
```

The prior is a small bonus for the domains a source is biased towards — the
Stack Exchange site (`dba.stackexchange.com` → SQL, Database Optimization, prior
weight 1.0) or, for ali-alkhars, the source prompt, which literally names the
topic ("I need Vue interview questions" → Frontend Development, prior weight
3.0). The prior never overrides keywords: a Kubernetes question asked on
`dba.stackexchange.com` still lands in Kubernetes. Ties break on the fixed
`DOMAIN_NAMES` order, so the mapping is reproducible.

---

## 5. Difficulty assignment

Deterministic — no sampling, no model call. Difficulty is the sum of two axes:

**Question form** — what the candidate is asked to *do* (Bloom-style):

| Level | Form | Example openers |
|---|---|---|
| 1 | recall / definition | `what is`, `define`, `difference between`, `describe` |
| 2 | apply / implement / troubleshoot | `how do i`, `implement`, `configure`, `best way to` |
| 3 | analyse / design / optimise | `design`, `architect`, `trade-off`, `pros and cons`, `optimi`, `why does` |

**Concept depth** — how advanced the subject is:

| Level | Vocabulary | Examples |
|---|---|---|
| 1 | introductory | variable, loop, array, primary key, JSON, unit test |
| 2 | everyday professional | anything not in the other two lists |
| 3 | senior | CAP theorem, MVCC, sharding, lock-free, garbage collection, virtual DOM, CSRF |

`score = form + depth`, nudged by `+0.5` per extra senior term in the question
(max +1.0), `+0.5` when the body carries ≥3 senior terms, another `+0.5` at ≥6,
and `+0.5` for questions over 120 characters. Then:

```
score <= 3.0   Beginner
score >= 5.0   Advanced
otherwise      Intermediate
```

This is exactly the brief: basic definitions → Beginner, practical
implementation / troubleshooting → Intermediate, architecture / optimisation /
trade-offs / complex algorithms → Advanced.

---

## 6. `expected_answer`

`common-pile/stackexchange` flattens a whole thread into one text field with no
labels, so the answer is recovered structurally: split on blank lines, discard
the first block (title + question body), then take the **longest remaining
block** subject to three conditions —

1. at least `MIN_ANSWER_CHARS = 400` characters (a Stack Exchange comment is
   capped at 600, so length separates answers from comments),
2. it does not end in `?` (that would be a follow-up question),
3. `is_prose()` — under 40 % code-looking lines and at least 75 %
   letters/whitespace, so pasted source files are rejected.

The chosen block is then cleaned and cut at a sentence boundary at
`MAX_ANSWER_CHARS = 1200`. The wording is the original author's throughout —
nothing is generated, paraphrased or invented.

**ali-alkhars/interviews carries no answers at all**, so those records get
`expected_answer: ""` and `expected_answer_source: "none"`. They are kept rather
than dropped because the Question Generator's training target is the *question*;
`expected_answer` is auxiliary metadata used by the Answer Evaluation agent.
The validator treats an empty `expected_answer` as acceptable only when
`expected_answer_source == "none"`, and reports the count.

**5,975 of 8,330 records (71.7 %) carry an expected answer.**

---

## 7. Deduplication and leakage

Deduplication runs **before** the split, so leakage is structurally impossible;
the validator then re-checks it independently.

| Stage | Key | Removed |
|---|---|---|
| Exact | SHA-1 of stopword-stripped, lowercased, punctuation-free tokens | 136 |
| Near | SHA-1 of the *sorted set* of those tokens (word-order blind) | 20 |

The validator additionally does a token-Jaccard sweep at threshold 0.9 across
every split pair using an inverted index. Result: **0 leaked questions** for
train→validation, train→test and validation→test.

---

## 8. Train / validation / test split

80 / 10 / 10, stratified over `(domain, difficulty, source)`, shuffled with
`random.Random(42)`. Every stratum is sorted by `id` before shuffling, so the
split is byte-for-byte reproducible. Change `--seed` to get a different one.

---

## 9. Record schema

One JSON object per line:

```json
{
  "id": "se-dba-184353",
  "question": "Would a date clustered index speed up queries with date ranges?",
  "domain": "Database Optimization",
  "difficulty": "Intermediate",
  "expected_answer": "A clustered index determines the physical order of ...",
  "expected_answer_source": "stackexchange_top_answer",
  "source": "common-pile/stackexchange",
  "source_url": "https://dba.stackexchange.com/questions/184353",
  "license": "Creative Commons - Attribution Share-Alike - ...",
  "domain_score": 7.0,
  "instruction": "Generate a technical interview question.",
  "input": "Domain: Database Optimization\nDifficulty: Intermediate",
  "output": "Would a date clustered index speed up queries with date ranges?"
}
```

The four fields the brief requires — `question`, `domain`, `difficulty`,
`expected_answer` — are the core. `instruction` / `input` / `output` are the
same record rendered for instruction tuning, kept in the *same* file so the
dataset is not stored twice. `train_qlora.py` renders them as:

```text
### Instruction:
Generate a technical interview question.

### Input:
Domain: SQL
Difficulty: Intermediate

### Response:
Explain the difference between INNER JOIN and LEFT JOIN.
```

---

## 10. Final statistics

Generated 2026-08-22 with `--seed 42 --max-per-domain 1200 --se-ratio 6.0`.

**Total: 8,330 records** (11.4 MB across three JSONL files)

| Source | Records |
|---|---|
| ali-alkhars/interviews | 1,190 |
| common-pile/stackexchange | 7,140 |

| Domain | Records | | Domain | Records |
|---|---|---|---|---|
| SQL | 478 | | Concurrency | 424 |
| Database Optimization | 465 | | Algorithms | 467 |
| OOP | 571 | | Data Structures | 466 |
| Design Patterns | 471 | | Security | 468 |
| Microservices | 531 | | Unit Testing | 475 |
| Docker | 473 | | System Design | 364 |
| Kubernetes | 366 | | Frontend Development | 1,073 |
| REST APIs | 466 | | Programming Languages | 772 |

| Difficulty | Total | Train | Validation | Test |
|---|---|---|---|---|
| Beginner | 2,847 | 2,265 | 282 | 300 |
| Intermediate | 3,655 | 2,912 | 361 | 382 |
| Advanced | 1,828 | 1,448 | 182 | 198 |

| Split | Records | Share |
|---|---|---|
| Train | 6,625 | 79.5 % |
| Validation | 825 | 9.9 % |
| Test | 880 | 10.6 % |

Question length: 15 / 65.3 / 208 characters (min / mean / max).

---

## 11. Reproducing

Raw data is already on disk; neither step re-downloads anything that exists.

```powershell
cd ml-service

# 1. (only if dataset/raw/ is empty) fetch the two sources
python dataset/download_datasets.py --only ali-alkhars/interviews
python dataset/download_datasets.py --only common-pile/stackexchange

# 2. build the training-ready dataset (~3 minutes, single pass over 397k docs)
python dataset/prepare_question_generator.py

# 3. re-run the quality gate on its own at any time
python dataset/prepare_question_generator.py --validate-only
```

The notebook `notebooks/question_generator_data_preprocessing.ipynb` imports
these same functions and shows the analysis step by step — it does not
reimplement the preprocessing.

---

## 12. Quality gate

`validate_splits()` runs automatically at the end of every build and **aborts
before writing** if any of these fail:

* JSON/JSONL parses, and every required field is present
* no empty questions
* no invalid `domain` (must be one of the 16)
* no invalid `difficulty` (must be Beginner / Intermediate / Advanced)
* no exact duplicate questions anywhere in the dataset
* no train↔validation, train↔test or validation↔test leakage at Jaccard ≥ 0.9
* no question shorter than 15 or longer than 220 characters

Missing domains and missing difficulty levels inside a split are reported as
warnings rather than errors, so a thin domain does not silently pass unnoticed
but also does not block a build.

Current status: **all checks pass, 16/16 domains covered, 0 duplicates,
0 leakage.**

---

## 13. Starting QLoRA / SFT training

Training is **not** started by the preprocessing pipeline. When the GPU box is
ready:

```powershell
cd ml-service
pip install -r requirements.txt -r requirements-train.txt
pip install trl bitsandbytes

# sanity check: loads the splits, prints a formatted prompt, stops
python train_qlora.py --dry_run

# the real run
python train_qlora.py --base_model "meta-llama/Meta-Llama-3-8B" --dataset dataset/processed/question_generator --output_dir ./models/interview_llm/qlora_question_generator
```

Defaults: 3 epochs, batch 4 × grad-accum 4, lr 2e-4, max sequence 512, LoRA
r=16 / α=32 on `q_proj, k_proj, v_proj, o_proj`, 4-bit NF4 double quantisation.
