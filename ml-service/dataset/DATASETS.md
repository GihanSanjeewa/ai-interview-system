# Public Datasets for the AI Interview System

Every dataset below is **real, public, and downloadable** — no synthetic generation.
Organised by the component of the architecture it trains (see
`AI_Interview_Assistant_Research_Plan.md` §4).

The licence column matters for the thesis: anything CC-BY-SA needs attribution,
anything NC cannot back a commercial deployment claim.

---

## Quick start

```bash
cd ml-service
pip install -r requirements-train.txt      # includes datasets>=2.20
pip install -U huggingface_hub kaggle
huggingface-cli login                      # needed for Common Voice and other gated sets

python dataset/download_datasets.py --list
python dataset/download_datasets.py --group core     # -> dataset/raw/<name>/
```

Groups: `core` (start here), `qa`, `code`, `speech`. `--only <hf_id>` fetches one.
Everything lands in `dataset/raw/` as HF `save_to_disk` folders, ready for
`training/prepare_dataset.py`.

---

## A. Question Generator Agent — interview Q&A text (QLoRA SFT)

Target: `models/interview_llm/`. Convert each into the 16-category JSON schema in
`dataset/processed/interview_dataset_sample.json`.

| Dataset | Rows | Licence | Link |
|---|---|---|---|
| **ali-alkhars/interviews** — SWE interview Q&A scraped from Java/React/Vue/Angular/backend repos + Kaggle | 2,292 | check page | https://huggingface.co/datasets/ali-alkhars/interviews |
| **common-pile/stackexchange** — full SE dumps (Dec 2024), incl. stackoverflow / dba / softwareengineering / security / devops | very large | CC-BY-SA 4.0 | https://huggingface.co/datasets/common-pile/stackexchange |
| **HuggingFaceH4/stack-exchange-preferences** — questions + ranked answers, good for scoring/DPO | ~19.7 GB | CC-BY-SA 4.0 | https://huggingface.co/datasets/HuggingFaceH4/stack-exchange-preferences |
| **lvwerra/stack-exchange-paired** — chosen/rejected answer pairs (preference training for the evaluator) | ~7M pairs | CC-BY-SA 4.0 | https://huggingface.co/datasets/lvwerra/stack-exchange-paired |
| **community-datasets/so_stacksample** — 10% Stack Overflow sample, easy to handle | ~1.2M Q | CC-BY-SA 3.0 | https://huggingface.co/datasets/community-datasets/so_stacksample |
| **habedi/stack-exchange-dataset** — cs.tsv / ds.tsv / p.tsv (CS Theory, Data Science, Programmers) | 3 TSVs | check page | https://huggingface.co/datasets/habedi/stack-exchange-dataset |
| **Aiman1234/Interview-questions** | small | check page | https://huggingface.co/datasets/Aiman1234/Interview-questions |
| **andmev/interview-question-with-context** | small | check page | https://huggingface.co/datasets/andmev/interview-question-with-context |

Filter Stack Exchange down to your 16 domains by tag:
`sql, indexing, oop, design-patterns, microservices, docker, kubernetes, rest,
concurrency, algorithm, data-structures, security, unit-testing, system-design`.
Keep only accepted answers with score >= 5 — that becomes your `expected_answer` gold.

> **Built.** The Question Generator corpus is now produced end to end by
> `dataset/prepare_question_generator.py` from `ali-alkhars/interviews` +
> `common-pile/stackexchange` (site-scoped). The 16 domains are enumerated in
> `dataset/interview_domains.py`; the full method, filtering statistics and the
> training command live in **[QUESTION_GENERATOR_DATASET.md](QUESTION_GENERATOR_DATASET.md)**.
> Note that the common-pile dump carries no tags and no scores, so the tag/score
> recipe above is replaced there by keyword-based domain scoring and structural
> answer extraction — see §2 and §6 of that document.

```python
from datasets import load_dataset
ds = load_dataset("ali-alkhars/interviews", split="train")
so = load_dataset("community-datasets/so_stacksample", split="train")
```

> **Attribution requirement:** Stack Exchange content is CC-BY-SA. Cite it in the
> dataset chapter and keep the post IDs in your raw files.

---

## B. Answer Evaluation Agent — scoring / grading supervision

Target: `models/evaluator_model/`. These give you *human-scored* answer pairs,
which is what makes the technical_score / communication_score heads defensible
instead of LLM-guessed.

| Dataset | What it gives you | Link |
|---|---|---|
| **SemEval-2013 Task 7 (SciEntsBank + Beetle)** — 135 questions / 4,969 graded student answers, 5-way labels (correct, partially_correct_incomplete, contradictory, irrelevant, non_domain) | the exact label space for `missing_points` | Paper: https://aclanthology.org/S13-2045/ · Data: https://github.com/ml-lab/SemEval-2013-Task7 |
| **Mohler & Mihalcea short-answer grading** — 2,273 CS *data-structures* answers graded 0–5 by two instructors. Closest public analogue to your task. | regression target for `technical_score` | https://web.eecs.umich.edu/~mihalcea/downloads.html#ShortAnswerGrading |
| **sentence-transformers/stsb** — semantic similarity; calibrates your `bge-large-en-v1.5` + FAISS threshold | embedding calibration | https://huggingface.co/datasets/sentence-transformers/stsb |
| **lvwerra/stack-exchange-paired** (also in §A) | better-vs-worse answer ranking | https://huggingface.co/datasets/lvwerra/stack-exchange-paired |

Lead with **Mohler** in the thesis — same domain (data structures), human
double-graded, and standard RMSE / Pearson baselines are already published to
compare against.

---

## C. Coding Evaluation Agent — code, tests, Pass@k

Target: `models/coding_model/` and `code_evaluator.py`. All of these ship with
executable test cases, so they feed your Pass@k metric directly.

| Dataset | Size | Licence | Link |
|---|---|---|---|
| **openai/openai_humaneval** — 164 problems + unit tests, the Pass@k standard | 164 | MIT | https://huggingface.co/datasets/openai/openai_humaneval |
| **google-research-datasets/mbpp** — 974 (full) / 427 (sanitized) Python tasks with `test_list` | 974 | CC-BY-4.0 | https://huggingface.co/datasets/google-research-datasets/mbpp |
| **codeparrot/apps** — 10,000 LeetCode/AtCoder/Codeforces problems with difficulty tiers | 10k | MIT | https://huggingface.co/datasets/codeparrot/apps |
| **deepmind/code_contests** — 13,328 train / 117 val / 165 test, multi-language solutions + generated tests | 13.6k | Apache-2.0 | https://huggingface.co/datasets/deepmind/code_contests |
| **bigcode/bigcodebench** — harder, real library calls; Complete + Instruct splits | 1,140 | Apache-2.0 | https://huggingface.co/datasets/bigcode/bigcodebench |
| **newfacade/LeetCodeDataset** — Python LeetCode, built for LLM train + eval | ~2.6k | check page | https://huggingface.co/datasets/newfacade/LeetCodeDataset |
| **Alishohadaee/leetcode-problems-dataset** — problems + metadata (topic tags, acceptance rate) | ~3k | check page | https://huggingface.co/datasets/Alishohadaee/leetcode-problems-dataset |
| **kaysss/leetcode-problem-set** — titleSlug, topicTags, difficulty | ~3k | check page | https://huggingface.co/datasets/kaysss/leetcode-problem-set |
| **Nan-Do/leetcode_contests** — 4.78M accepted submissions across 19 languages | 2,406 problems | check page | https://huggingface.co/datasets/Nan-Do/leetcode_contests |
| **cassanof/leetcode-solutions** | — | check page | https://huggingface.co/datasets/cassanof/leetcode-solutions |
| **floatai/HumanEval-XL** — HumanEval across many programming + natural languages | multi | check page | https://huggingface.co/datasets/floatai/HumanEval-XL |

APPS difficulty labels (`introductory` / `interview` / `competition`) map straight
onto your `difficulty_level` field — use them for the **Difficulty Alignment
Accuracy** metric in §4.7.

Your plan targets Python, Java, JS, TS and PHP. `deepmind/code_contests` and
`Nan-Do/leetcode_contests` are the only two here with real multi-language
solutions — the rest are Python-heavy.

---

## D. Coding Evaluation Agent — OWASP / security dimension

| Dataset | Size | Notes | Link |
|---|---|---|---|
| **google/code_x_glue_cc_defect_detection** (Devign) — 27,318 labelled C functions from QEMU + FFmpeg, binary vulnerable/safe | 27k | C-UDA licence | https://huggingface.co/datasets/google/code_x_glue_cc_defect_detection |
| **DiverseVul** — 330,492 functions, 18,945 vulnerable, 150 CWEs, 797 projects; ~60% label accuracy (best of the public sets) | 330k | Google Drive link on the repo | https://github.com/wagner-group/diversevul |
| **CVEfixes** — CVE-linked fix commits, multi-language, built by script | large | https://github.com/secureIT-project/CVEfixes |
| **NIST Juliet Test Suite (SARD)** — synthetic but CWE-labelled; C/C++, Java, C# | ~100k | https://samate.nist.gov/SARD/test-suites |
| **OWASP Benchmark** — Java, ground-truth labelled, for scoring your static analyser | 2,740 | https://github.com/OWASP-Benchmark/BenchmarkJava |

Fine-tune CodeBERT on **DiverseVul**; report **Static Analysis Precision** against
**OWASP Benchmark**, which publishes true/false-positive ground truth so your
number is comparable to existing literature.

---

## E. Speech Engine — Sinhala + English ASR

Your `whisper_si/training/prepare_dataset.py` already targets the first two.

| Dataset | Hours | Licence | Link |
|---|---|---|---|
| **OpenSLR SLR52 — Large Sinhala ASR** — 224 h, 478 speakers, ~185k utterances. *The* Sinhala corpus. | 224 h | CC-BY-SA 4.0 | https://www.openslr.org/52/ |
| **mozilla-foundation/common_voice_17_0** (`si`) — requires HF login + accepting terms | small | CC0 | https://huggingface.co/datasets/mozilla-foundation/common_voice_17_0 |
| **google/fleurs** (`si_lk`) — ~12 h, clean read speech | ~12 h | CC-BY-4.0 | https://huggingface.co/datasets/google/fleurs |
| **openslr/librispeech_asr** — English baseline / WER control | 1,000 h | CC-BY-4.0 | https://huggingface.co/datasets/openslr/librispeech_asr |
| **OpenSLR index** — related South Asian TTS/ASR corpora (SLR63, SLR66, …) | varies | CC-BY-SA | https://www.openslr.org/resources.php |

SLR52 direct download (split into ten zip parts):

```bash
mkdir -p dataset/raw/slr52 && cd dataset/raw/slr52
for i in 0 1 2 3 4 5 6 7 8 9; do
  wget -c "https://www.openslr.org/resources/52/asr_sinhala_${i}.zip"
done
wget -c https://www.openslr.org/resources/52/si_lk.lexicon.txt
wget -c https://www.openslr.org/resources/52/utt_spk_text.tsv
```

Add SLR52 as a third `--sources slr52` branch in
`whisper_si/training/prepare_dataset.py` — it is roughly 18× the size of Common
Voice Sinhala and will dominate the WER improvement in your results chapter.

---

## F. Audio confidence / delivery scoring

⚠️ **`ml-service/classifier.py` currently trains a RandomForest on 1,500
`np.random` synthetic samples.** That will not survive a viva. Replace it with:

| Dataset | Size | Licence | Link |
|---|---|---|---|
| **RAVDESS** — 7,356 files, 24 actors, 8 emotions × 2 intensity levels, validated by 247 raters | 7,356 | CC-BY-NC-SA 4.0 (**non-commercial**) | https://zenodo.org/records/1188976 |
| **CREMA-D** — 7,442 clips, 91 actors, 6 emotions, 2,443 raters | 7,442 | Open Database Licence | https://github.com/CheyneyComputerScience/CREMA-D |
| **Standard test splits** for CREMA-D / RAVDESS / IEMOCAP / MELD / emoDB — use these so your numbers are comparable | — | — | https://zenodo.org/records/10229583 |
| **MSP-Podcast** — natural (non-acted) emotional speech, closest to real interview delivery | large | academic request | https://ecs.utdallas.edu/research/researchlabs/msp-lab/MSP-Podcast.html |

Map emotion labels onto your Beginner/Intermediate/Advanced confidence axis via
arousal/valence, or more simply retrain the classifier as `confident vs hesitant`
using RAVDESS intensity (`normal` vs `strong`) — defensible and easy to justify.

### Interview-specific behavioural data (request forms required)

| Dataset | What | Access |
|---|---|---|
| **MIT Interview Dataset** (Naim et al.) — 138 mock-interview videos, 69 MIT undergrads, expert ratings for excitement / friendliness / engagement / overall hireability | the only real *interview-performance* ground truth | Paper: https://arxiv.org/abs/1504.03425 — email the authors for the data |
| **ChaLearn First Impressions V2** — 10,000 clips, Big-Five traits + an "invite to interview" annotation; largest public video-personality set | apparent-personality baselines | https://chalearnlap.cvc.uab.cat/dataset/24/description/ |

---

## G. Career Recommendation Agent — resume / skill / role data

| Dataset | Notes | Link |
|---|---|---|
| **Resume Entities for NER** (dataturks) — the classic annotated CV set | https://www.kaggle.com/datasets/dataturks/resume-entities-for-ner |
| **Resume NER Training Dataset** — 5,960 samples; SKILL / DESIGNATION / EDUCATION / EXPERIENCE entities | https://www.kaggle.com/datasets/yashpwrr/resume-ner-training-dataset |
| **NER Annotated CVs** — 5,029 CVs annotated with IT skills | https://www.kaggle.com/datasets/mehyarmlaweh/ner-annotated-cvs |
| **Resume and job_description** — paired, for match scoring | https://www.kaggle.com/datasets/pranavvenugo/resume-and-job-description |
| **Jobs and Job Description** — job title → description | https://www.kaggle.com/datasets/kshitizregmi/jobs-and-job-description |
| **Job Descriptions with NER Annotations** | https://www.kaggle.com/datasets/khaliladimassi/cleaned-job-description |
| **ESCO** — official EU skills/occupations taxonomy, 13k+ skills mapped to roles | https://esco.ec.europa.eu/en/use-esco/download |
| **O*NET** — US occupation/skill database, free bulk download | https://www.onetcenter.org/database.html |

ESCO / O*NET are what turn "skill gap analysis" from hand-waving into a citable
mapping — §4.5.5's "industry benchmarks" needs one of them behind it.

---

## Recommended minimum set for the thesis

If you only pull five, pull these:

1. `common-pile/stackexchange`, filtered to your 16 tags — question-generator corpus
2. **Mohler short-answer grading** — the evaluator's human-graded ground truth
3. `codeparrot/apps` + `openai/openai_humaneval` — coding eval and Pass@k
4. **DiverseVul** — the OWASP / security dimension
5. **OpenSLR SLR52** — Sinhala Whisper fine-tune

That covers five of your six research contributions with real, citable, licensed data.

---

## Licence summary for the thesis

| Licence | Datasets | Obligation |
|---|---|---|
| CC-BY-SA | Stack Exchange family, OpenSLR SLR52 | attribute + share-alike any derived dataset |
| CC-BY-NC | RAVDESS | **research only** — no commercial deployment claim |
| MIT / Apache | HumanEval, APPS, CodeContests, BigCodeBench, OWASP Benchmark | attribute |
| CC0 | Common Voice | none |
| C-UDA | Devign / CodeXGLUE | computational use only |
| Request form | MIT Interview, ChaLearn FI-V2, MSP-Podcast | signed agreement |
