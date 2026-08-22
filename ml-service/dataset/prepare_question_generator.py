"""Build the Question Generator QLoRA/SFT dataset from the raw downloads.

Sources (already fetched by `download_datasets.py`, nothing is re-downloaded):

    * ali-alkhars/interviews   -> dataset/raw/ali-alkhars__interviews  (2,292 rows)
    * common-pile/stackexchange -> HuggingFace hub cache, site-scoped; the shard
      list lives in dataset/raw/common-pile__stackexchange/snapshot.json

Pipeline:

    load -> filter -> clean -> normalise -> domain map -> difficulty
         -> expected answer -> dedup -> balance -> split -> validate -> write

Usage:
    python dataset/prepare_question_generator.py
    python dataset/prepare_question_generator.py --max-per-domain 1200 --seed 42
    python dataset/prepare_question_generator.py --validate-only

Output (JSONL, one record per line) lands in
`dataset/processed/question_generator/`. Raw data is never copied.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import logging
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable, Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent))

from interview_domains import (  # noqa: E402
    DIFFICULTIES,
    DOMAIN_NAMES,
    PRIOR_WEIGHT,
    PROMPT_PRIOR_WEIGHT,
    classify_difficulty,
    classify_domain,
    prompt_priors,
    site_priors,
)

log = logging.getLogger("prepare_question_generator")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

DATASET_DIR = Path(__file__).resolve().parent
RAW = DATASET_DIR / "raw"
PROCESSED = DATASET_DIR / "processed" / "question_generator"

INTERVIEWS_DIR = RAW / "ali-alkhars__interviews"
SE_MANIFEST = RAW / "common-pile__stackexchange" / "snapshot.json"

SOURCE_INTERVIEWS = "ali-alkhars/interviews"
SOURCE_STACKEXCHANGE = "common-pile/stackexchange"

INSTRUCTION = "Generate a technical interview question."

# ── Quality thresholds ───────────────────────────────────────────────────────
MIN_QUESTION_CHARS = 15
MAX_QUESTION_CHARS = 220
MIN_QUESTION_WORDS = 3
MIN_ANSWER_CHARS = 400        # a Stack Exchange comment caps out at 600 chars;
MAX_ANSWER_CHARS = 1200       # anything shorter than this is treated as a comment
MAX_BODY_CHARS = 6000         # question bodies longer than this are code dumps

# Titles that are somebody's personal debugging session rather than a question a
# candidate could be asked in an interview.
NON_INTERVIEW_MARKERS = [
    "my code", "my project", "my app", "my script", "my server", "my program",
    "doesn't work", "does not work", "not working", "won't work", "wont work",
    "help me", "please help", "[closed]", "[duplicate]", "[on hold]",
    "is this a bug", "am i doing", "what am i doing wrong", "any ideas",
    "cannot find", "can't find", "can not find", "unable to install",
    "error:", "exception:", "stack trace", "traceback", "segfault",
    "recommend a book", "recommend a tool", "which book", "career advice",
    "should i quit", "is it worth learning", "hiring", "salary", "interview at",
    "off topic", "meta", "downvote", "close vote", "reputation",
    # First person / situational phrasing: an interview question is impersonal.
    " my ", " our ", " we ", " us ", "i'm ", "i am ", "i've ", "i have ",
    "anyone", "someone", "somebody", "didn't", "doesn't", "won't", "isn't",
    "in my", "for me", "our company", "my team", " went ",
]

# A leading interrogative or imperative — an interview question almost always
# opens with one of these.
INTERROGATIVE_OPENERS = (
    "what", "why", "how", "when", "where", "which", "who", "is ", "are ", "can ",
    "could ", "should ", "do ", "does ", "did ", "will ", "would ", "explain",
    "describe", "compare", "define", "name ", "list ", "give ",
)

STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "of",
    "to", "in", "on", "for", "with", "and", "or", "but", "if", "it", "its",
    "this", "that", "these", "those", "as", "at", "by", "from", "into", "about",
    "do", "does", "did", "can", "could", "should", "would", "will", "shall",
    "i", "you", "we", "they", "he", "she", "my", "your", "our", "their", "me",
    "what", "why", "how", "when", "where", "which", "who", "there", "here",
    "any", "some", "not", "no", "so", "than", "then", "s", "t",
}

# ── Text cleaning ────────────────────────────────────────────────────────────
_FENCE_RE = re.compile(r"```.*?```", re.S)
_HTML_TAG_RE = re.compile(r"<[^>]{1,200}>")
_HTML_ENTITY = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
    "&apos;": "'", "&nbsp;": " ", "&hellip;": "...", "&mdash;": "-", "&ndash;": "-",
}
_MD_LINK_RE = re.compile(r"\[([^\]]{1,200})\]\((?:[^)]{1,500})\)")
_BARE_URL_RE = re.compile(r"https?://\S+")
_MD_EMPHASIS_RE = re.compile(r"(\*\*|__|\*|_|`)")
_MD_HEADING_RE = re.compile(r"^#{1,6}\s*", re.M)
_MD_QUOTE_RE = re.compile(r"^\s*>\s?", re.M)
_WS_RE = re.compile(r"[ \t ]+")
_NL_RE = re.compile(r"\n{3,}")


def clean_text(text: str, *, drop_code: bool = True) -> str:
    """HTML/Markdown cleanup + whitespace normalisation.

    Deliberately conservative: it strips markup and boilerplate but never
    rewrites words, so the original technical meaning and terminology survive.
    """
    if not text:
        return ""
    out = text
    if drop_code:
        out = _FENCE_RE.sub(" ", out)
    out = _MD_LINK_RE.sub(r"\1", out)
    out = _BARE_URL_RE.sub("", out)
    out = _HTML_TAG_RE.sub(" ", out)
    for entity, char in _HTML_ENTITY.items():
        out = out.replace(entity, char)
    out = _MD_HEADING_RE.sub("", out)
    out = _MD_QUOTE_RE.sub("", out)
    out = _MD_EMPHASIS_RE.sub("", out)
    out = out.replace("\r\n", "\n").replace("\r", "\n")
    out = _WS_RE.sub(" ", out)
    out = _NL_RE.sub("\n\n", out)
    return "\n".join(line.strip() for line in out.split("\n")).strip()


def normalise_question(text: str) -> str:
    """Single-line, whitespace-normalised question text."""
    return _WS_RE.sub(" ", clean_text(text).replace("\n", " ")).strip()


def _tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9+#]+", text.lower()) if t not in STOPWORDS]


def exact_key(question: str) -> str:
    """Key for exact-duplicate detection (case/punctuation/whitespace blind)."""
    return hashlib.sha1(" ".join(_tokens(question)).encode("utf-8")).hexdigest()


def fuzzy_key(question: str) -> str:
    """Key for near-duplicate detection: bag of content words, order blind."""
    return hashlib.sha1(" ".join(sorted(set(_tokens(question)))).encode("utf-8")).hexdigest()


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


# ── Filters ──────────────────────────────────────────────────────────────────
def question_reject_reason(question: str) -> str | None:
    """None when the string is usable as an interview question."""
    q = question.strip()
    if not q:
        return "empty"
    low = q.lower()
    if len(q) < MIN_QUESTION_CHARS:
        return "too_short"
    if len(q) > MAX_QUESTION_CHARS:
        return "too_long"
    if len(q.split()) < MIN_QUESTION_WORDS:
        return "too_few_words"
    if not low.startswith(INTERROGATIVE_OPENERS):
        return "not_a_question"
    if any(marker in low for marker in NON_INTERVIEW_MARKERS):
        return "non_interview_content"
    letters = sum(c.isalpha() for c in q)
    if letters < 0.5 * len(q):
        return "corrupted"           # mostly punctuation / code / non-text
    if not q.isascii() and sum(c.isascii() for c in q) < 0.8 * len(q):
        return "corrupted"
    return None


_CODE_LINE_PREFIX = ("import ", "from ", "using ", "#include", "def ", "class ",
                     "public ", "private ", "protected ", "function ", "var ",
                     "const ", "let ", "return ", "if (", "for (", "while (",
                     "<", "$ ", "> ", "SELECT ", "INSERT ", "UPDATE ")


def is_prose(text: str) -> bool:
    """False for answers that are mostly a code dump rather than an explanation.

    An expected_answer has to read as an explanation a candidate could give out
    loud; a pasted source file does not.
    """
    if not text:
        return False
    lines = [ln for ln in text.split("\n") if ln.strip()]
    if not lines:
        return False
    codey = sum(1 for ln in lines
                if ln.startswith((" ", "\t"))
                or ln.rstrip().endswith((";", "{", "}", "):"))
                or ln.lstrip().startswith(_CODE_LINE_PREFIX))
    if codey / len(lines) > 0.4:
        return False
    letters = sum(c.isalpha() or c.isspace() for c in text)
    return letters / len(text) >= 0.75


def condense_answer(text: str) -> str:
    """Trim a Stack Exchange answer to a concise expected answer.

    Cuts at a sentence boundary — the wording stays exactly as the author wrote
    it, so nothing is invented.
    """
    cleaned = clean_text(text)
    if len(cleaned) <= MAX_ANSWER_CHARS:
        return cleaned
    window = cleaned[:MAX_ANSWER_CHARS]
    cut = max(window.rfind(". "), window.rfind("! "), window.rfind("?\n"), window.rfind(".\n"))
    if cut < MAX_ANSWER_CHARS // 2:
        cut = window.rfind(" ")
    return window[: cut + 1].strip()


# ── Source loaders ───────────────────────────────────────────────────────────
def load_interviews(path: Path = INTERVIEWS_DIR) -> list[dict]:
    """ali-alkhars/interviews: `input` is the user prompt, `response` the question."""
    from datasets import load_from_disk

    if not path.exists():
        raise FileNotFoundError(
            f"{path} missing — run: python dataset/download_datasets.py --only ali-alkhars/interviews")
    ds = load_from_disk(str(path))
    rows = ds["train"] if hasattr(ds, "keys") else ds
    out = []
    for i, row in enumerate(rows):
        out.append({
            "raw_id": f"interviews-{i:05d}",
            "site": None,
            "prompt": row.get("input") or "",
            "title": row.get("response") or "",
            "body": "",
            "answer": "",
            "url": "https://huggingface.co/datasets/ali-alkhars/interviews",
            "license": "see dataset card",
            "source": SOURCE_INTERVIEWS,
        })
    return out


def _split_se_document(text: str) -> tuple[str, str, str]:
    """(title, question_body, best_answer) out of one common-pile SE document.

    Layout per the dataset card: line 1 is the question title, then the question
    body, then its comments, then the answers ordered by votes (accepted first),
    each block separated by a blank line. Comments and answers are not labelled,
    so the answer is recovered as the longest block after the question — Stack
    Exchange caps comments at 600 characters, which makes length a reliable
    separator once MIN_ANSWER_CHARS is high enough.
    """
    blocks = [b.strip() for b in text.split("\n\n") if b.strip()]
    if not blocks:
        return "", "", ""
    head = blocks[0]
    title, _, body = head.partition("\n")

    best = ""
    for block in blocks[1:]:
        if block.endswith("?"):
            continue                       # a follow-up question, not an answer
        if len(block) < MIN_ANSWER_CHARS or len(block) <= len(best):
            continue
        if not is_prose(block):
            continue                       # a pasted source file, not an answer
        best = block
    return title.strip(), body.strip(), best


def load_stackexchange(manifest: Path = SE_MANIFEST,
                       limit_per_shard: int | None = None) -> Iterator[dict]:
    """Stream the site-scoped common-pile shards straight from the hub cache."""
    if not manifest.exists():
        raise FileNotFoundError(
            f"{manifest} missing — run: python dataset/download_datasets.py "
            "--only common-pile/stackexchange")
    meta = json.loads(manifest.read_text(encoding="utf-8"))
    for site, shards in meta["sites"].items():
        for shard in shards:
            log.info("reading %s", Path(shard).parent.parent.name + "/" + Path(shard).name)
            with gzip.open(shard, "rt", encoding="utf-8") as fh:
                for n, line in enumerate(fh):
                    if limit_per_shard is not None and n >= limit_per_shard:
                        break
                    try:
                        doc = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    title, body, answer = _split_se_document(doc.get("text") or "")
                    md = doc.get("metadata") or {}
                    yield {
                        "raw_id": f"se-{site.split('.')[0]}-{doc.get('id')}",
                        "site": md.get("site", site),
                        "prompt": "",
                        "title": title,
                        "body": body,
                        "answer": answer,
                        "url": md.get("url", ""),
                        "license": md.get("license", "CC BY-SA"),
                        "source": SOURCE_STACKEXCHANGE,
                    }


# ── Record building ──────────────────────────────────────────────────────────
def build_record(raw: dict, stats: Counter) -> dict | None:
    """Clean + classify one raw row into the project's interview schema."""
    tag = "interviews" if raw["source"] == SOURCE_INTERVIEWS else "stackexchange"

    question = normalise_question(raw["title"])
    reason = question_reject_reason(question)
    if reason:
        stats[f"drop.{tag}.{reason}"] += 1
        return None

    body = clean_text(raw.get("body") or "")[:MAX_BODY_CHARS]
    if raw.get("body") and len(raw["body"]) > MAX_BODY_CHARS * 4:
        stats[f"drop.{tag}.body_oversized"] += 1
        return None

    if raw["site"]:
        priors, prior_weight = site_priors(raw["site"]), PRIOR_WEIGHT
    else:
        priors, prior_weight = prompt_priors(raw["prompt"]), PROMPT_PRIOR_WEIGHT
    domain, score = classify_domain(f"{question}\n{body}", priors, prior_weight)
    if domain is None:
        stats[f"drop.{tag}.off_domain"] += 1
        return None

    difficulty = classify_difficulty(question, body)

    expected_answer = condense_answer(raw.get("answer") or "")
    if expected_answer and (len(expected_answer) < MIN_ANSWER_CHARS // 2
                            or not is_prose(expected_answer)):
        expected_answer = ""
    answer_source = "stackexchange_top_answer" if expected_answer else "none"
    if not expected_answer:
        stats[f"kept.{tag}.without_expected_answer"] += 1

    if not question.endswith("?"):
        question = question.rstrip(".!") + "?"

    return {
        "id": raw["raw_id"],
        "question": question,
        "domain": domain,
        "difficulty": difficulty,
        "expected_answer": expected_answer,
        "expected_answer_source": answer_source,
        "source": raw["source"],
        "source_url": raw["url"],
        "license": raw["license"],
        "domain_score": round(score, 1),
        "instruction": INSTRUCTION,
        "input": f"Domain: {domain}\nDifficulty: {difficulty}",
        "output": question,
    }


# ── Dedup / balance / split ──────────────────────────────────────────────────
def deduplicate(records: Iterable[dict], stats: Counter) -> list[dict]:
    """Exact then near-duplicate removal. Deterministic: first record wins."""
    seen_exact: set[str] = set()
    seen_fuzzy: set[str] = set()
    out: list[dict] = []
    for rec in records:
        ek = exact_key(rec["question"])
        if ek in seen_exact:
            stats["dedup_exact"] += 1
            continue
        fk = fuzzy_key(rec["question"])
        if fk in seen_fuzzy:
            stats["dedup_near"] += 1
            continue
        seen_exact.add(ek)
        seen_fuzzy.add(fk)
        rec["_exact_key"] = ek
        rec["_fuzzy_key"] = fk
        out.append(rec)
    return out


def _quality(rec: dict) -> tuple:
    """Deterministic ranking used when a domain has to be capped."""
    return (rec["domain_score"], len(rec["expected_answer"]), rec["id"])


def balance(records: list[dict], max_per_domain: int, se_ratio: float,
            stats: Counter) -> list[dict]:
    """Cap Stack Exchange per domain, and cap it overall against the interviews set.

    Nothing is duplicated to fill a domain up — under-represented domains simply
    stay small, and the shortfall is reported.
    """
    interviews = [r for r in records if r["source"] == SOURCE_INTERVIEWS]
    se = [r for r in records if r["source"] == SOURCE_STACKEXCHANGE]

    by_domain: dict[str, list[dict]] = defaultdict(list)
    for rec in se:
        by_domain[rec["domain"]].append(rec)

    kept_se: list[dict] = []
    for domain in DOMAIN_NAMES:
        bucket = sorted(by_domain.get(domain, []), key=_quality, reverse=True)
        if len(bucket) > max_per_domain:
            stats[f"cap_domain_{domain}"] += len(bucket) - max_per_domain
        kept_se.extend(bucket[:max_per_domain])

    budget = int(len(interviews) * se_ratio)
    if len(kept_se) > budget:
        # Round-robin across domains so trimming to the global budget does not
        # wipe out the smaller domains.
        per_domain: dict[str, list[dict]] = defaultdict(list)
        for rec in sorted(kept_se, key=_quality, reverse=True):
            per_domain[rec["domain"]].append(rec)
        trimmed: list[dict] = []
        idx = 0
        while len(trimmed) < budget:
            added = False
            for domain in DOMAIN_NAMES:
                bucket = per_domain[domain]
                if idx < len(bucket) and len(trimmed) < budget:
                    trimmed.append(bucket[idx])
                    added = True
            if not added:
                break
            idx += 1
        stats["cap_se_global"] += len(kept_se) - len(trimmed)
        kept_se = trimmed

    return sorted(interviews + kept_se, key=lambda r: r["id"])


def split_records(records: list[dict], seed: int,
                  ratios: tuple[float, float, float]) -> dict[str, list[dict]]:
    """Stratified, seeded 80/10/10 split over (domain, difficulty, source)."""
    strata: dict[tuple, list[dict]] = defaultdict(list)
    for rec in records:
        strata[(rec["domain"], rec["difficulty"], rec["source"])].append(rec)

    out: dict[str, list[dict]] = {"train": [], "validation": [], "test": []}
    rng = random.Random(seed)
    for key in sorted(strata):
        bucket = sorted(strata[key], key=lambda r: r["id"])
        rng.shuffle(bucket)
        n = len(bucket)
        n_train = int(n * ratios[0])
        n_val = int(n * (ratios[0] + ratios[1])) - n_train
        # Tiny strata: keep at least one row in train before giving any away.
        if n >= 3 and n_train == 0:
            n_train = 1
        out["train"].extend(bucket[:n_train])
        out["validation"].extend(bucket[n_train:n_train + n_val])
        out["test"].extend(bucket[n_train + n_val:])
    for split in out:
        out[split].sort(key=lambda r: r["id"])
    return out


# ── Validation ───────────────────────────────────────────────────────────────
def validate_splits(splits: dict[str, list[dict]], *, leak_threshold: float = 0.9
                    ) -> tuple[list[str], list[str], dict]:
    """Return (errors, warnings, report). A non-empty `errors` fails the run."""
    errors: list[str] = []
    warnings: list[str] = []
    required = ["question", "domain", "difficulty", "expected_answer",
                "source", "instruction", "input", "output"]

    all_records = [r for rs in splits.values() for r in rs]
    if not all_records:
        errors.append("dataset is empty")

    missing_fields = Counter()
    empty_questions = 0
    bad_domain = Counter()
    bad_difficulty = Counter()
    short = long = 0
    for rec in all_records:
        for field in required:
            if field not in rec:
                missing_fields[field] += 1
        if not (rec.get("question") or "").strip():
            empty_questions += 1
        if rec.get("domain") not in DOMAIN_NAMES:
            bad_domain[rec.get("domain")] += 1
        if rec.get("difficulty") not in DIFFICULTIES:
            bad_difficulty[rec.get("difficulty")] += 1
        qlen = len(rec.get("question") or "")
        short += qlen < MIN_QUESTION_CHARS
        long += qlen > MAX_QUESTION_CHARS

    if missing_fields:
        errors.append(f"records missing required fields: {dict(missing_fields)}")
    if empty_questions:
        errors.append(f"{empty_questions} empty questions")
    if bad_domain:
        errors.append(f"invalid domains: {dict(bad_domain)}")
    if bad_difficulty:
        errors.append(f"invalid difficulty values: {dict(bad_difficulty)}")
    if short or long:
        errors.append(f"{short} too-short and {long} too-long questions")

    # Duplicates, globally and across splits.
    keys = Counter(exact_key(r["question"]) for r in all_records)
    dupes = sum(v - 1 for v in keys.values() if v > 1)
    if dupes:
        errors.append(f"{dupes} exact duplicate questions remain")

    leakage: dict[str, int] = {}
    token_sets = {sp: [(r["id"], set(_tokens(r["question"]))) for r in rs]
                  for sp, rs in splits.items()}
    for a, b in (("train", "validation"), ("train", "test"), ("validation", "test")):
        overlap = 0
        index: dict[str, list[int]] = defaultdict(list)
        for i, (_, toks) in enumerate(token_sets[a]):
            for tok in toks:
                index[tok].append(i)
        for _, toks in token_sets[b]:
            candidates = Counter(i for tok in toks for i in index.get(tok, ()))
            for i, shared in candidates.items():
                if shared < 3:
                    continue
                if jaccard(token_sets[a][i][1], toks) >= leak_threshold:
                    overlap += 1
                    break
        leakage[f"{a}->{b}"] = overlap
        if overlap:
            errors.append(f"{overlap} leaked questions between {a} and {b}")

    covered = {r["domain"] for r in all_records}
    if len(covered) < len(DOMAIN_NAMES):
        warnings.append(f"domains with no records: {sorted(set(DOMAIN_NAMES) - covered)}")
    for split, rs in splits.items():
        missing_diff = set(DIFFICULTIES) - {r["difficulty"] for r in rs}
        if missing_diff:
            warnings.append(f"{split} is missing difficulty levels: {sorted(missing_diff)}")

    report = {
        "records": len(all_records),
        "domains_covered": f"{len(covered)}/{len(DOMAIN_NAMES)}",
        "exact_duplicates": dupes,
        "leakage": leakage,
        "empty_questions": empty_questions,
        "too_short": short,
        "too_long": long,
    }
    return errors, warnings, report


def build_statistics(splits: dict[str, list[dict]]) -> dict:
    all_records = [r for rs in splits.values() for r in rs]
    def counts(key: str) -> dict:
        c = Counter(r[key] for r in all_records)
        return {k: c.get(k, 0) for k in (DOMAIN_NAMES if key == "domain"
                                         else DIFFICULTIES if key == "difficulty"
                                         else sorted(c))}
    return {
        "total": len(all_records),
        "source": counts("source"),
        "domain": counts("domain"),
        "difficulty": counts("difficulty"),
        "split": {sp: len(rs) for sp, rs in splits.items()},
        "with_expected_answer": sum(1 for r in all_records if r["expected_answer"]),
        "domain_by_split": {sp: dict(Counter(r["domain"] for r in rs))
                            for sp, rs in splits.items()},
        "difficulty_by_split": {sp: dict(Counter(r["difficulty"] for r in rs))
                                for sp, rs in splits.items()},
        "source_by_split": {sp: dict(Counter(r["source"] for r in rs))
                            for sp, rs in splits.items()},
        "question_chars": {
            "min": min((len(r["question"]) for r in all_records), default=0),
            "mean": round(sum(len(r["question"]) for r in all_records) / max(len(all_records), 1), 1),
            "max": max((len(r["question"]) for r in all_records), default=0),
        },
    }


# ── IO ───────────────────────────────────────────────────────────────────────
def write_jsonl(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for rec in records:
            public = {k: v for k, v in rec.items() if not k.startswith("_")}
            fh.write(json.dumps(public, ensure_ascii=False) + "\n")


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def load_processed(out_dir: Path = PROCESSED) -> dict[str, list[dict]]:
    return {sp: read_jsonl(out_dir / f"{sp}.jsonl")
            for sp in ("train", "validation", "test")}


# ── Orchestration ────────────────────────────────────────────────────────────
def run(out_dir: Path = PROCESSED, *, seed: int = 42, max_per_domain: int = 1200,
        se_ratio: float = 6.0, limit_per_shard: int | None = None,
        ratios: tuple[float, float, float] = (0.8, 0.1, 0.1)) -> dict:
    """Execute the whole pipeline and write the splits. Returns the stats dict."""
    stats: Counter = Counter()

    log.info("loading %s", SOURCE_INTERVIEWS)
    raw_interviews = load_interviews()
    stats["raw_interviews"] = len(raw_interviews)

    records: list[dict] = []
    for raw in raw_interviews:
        rec = build_record(raw, stats)
        if rec:
            records.append(rec)
    stats["kept_interviews"] = len(records)
    log.info("interviews: %d raw -> %d kept", stats["raw_interviews"], stats["kept_interviews"])

    log.info("streaming %s (site-scoped)", SOURCE_STACKEXCHANGE)
    se_kept = 0
    for raw in load_stackexchange(limit_per_shard=limit_per_shard):
        stats["raw_stackexchange"] += 1
        rec = build_record(raw, stats)
        if rec:
            records.append(rec)
            se_kept += 1
        if stats["raw_stackexchange"] % 250_000 == 0:
            log.info("  scanned %d SE documents, kept %d",
                     stats["raw_stackexchange"], se_kept)
    stats["kept_stackexchange"] = se_kept
    log.info("stackexchange: %d raw -> %d kept", stats["raw_stackexchange"], se_kept)

    before = len(records)
    records = deduplicate(records, stats)
    log.info("dedup: %d -> %d (%d exact, %d near)", before, len(records),
             stats["dedup_exact"], stats["dedup_near"])

    before = len(records)
    records = balance(records, max_per_domain, se_ratio, stats)
    log.info("balance: %d -> %d", before, len(records))

    splits = split_records(records, seed, ratios)
    log.info("split: train=%d validation=%d test=%d",
             len(splits["train"]), len(splits["validation"]), len(splits["test"]))

    errors, warnings, report = validate_splits(splits)
    for w in warnings:
        log.warning("validation warning: %s", w)
    if errors:
        for e in errors:
            log.error("validation error: %s", e)
        raise SystemExit("question generator dataset FAILED validation — nothing written")

    out_dir.mkdir(parents=True, exist_ok=True)
    for split, rs in splits.items():
        write_jsonl(out_dir / f"{split}.jsonl", rs)

    statistics = build_statistics(splits)
    statistics["filtering"] = dict(sorted(stats.items()))
    statistics["validation"] = report
    statistics["config"] = {
        "seed": seed, "max_per_domain": max_per_domain, "se_ratio": se_ratio,
        "ratios": list(ratios), "limit_per_shard": limit_per_shard,
    }
    (out_dir / "statistics.json").write_text(
        json.dumps(statistics, indent=2, ensure_ascii=False), encoding="utf-8")
    log.info("wrote %s", out_dir)
    return statistics


def print_report(statistics: dict) -> None:
    print("\nSource:")
    for k, v in statistics["source"].items():
        print(f"  {k}: {v}")
    print("\nDomains:")
    for k, v in statistics["domain"].items():
        print(f"  {k}: {v}")
    print("\nDifficulty:")
    for k, v in statistics["difficulty"].items():
        print(f"  {k}: {v}")
    print("\nSplit:")
    for k, v in statistics["split"].items():
        print(f"  {k.capitalize()}: {v}")
    print(f"\nTotal: {statistics['total']}  "
          f"(with expected_answer: {statistics['with_expected_answer']})")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=PROCESSED)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--max-per-domain", type=int, default=1200,
                    help="cap on Stack Exchange records per domain")
    ap.add_argument("--se-ratio", type=float, default=6.0,
                    help="max Stack Exchange records per ali-alkhars/interviews record")
    ap.add_argument("--limit-per-shard", type=int, default=None,
                    help="read only the first N documents of each shard (smoke test)")
    ap.add_argument("--validate-only", action="store_true",
                    help="re-validate the already written splits and exit")
    args = ap.parse_args()

    if args.validate_only:
        splits = load_processed(args.out)
        errors, warnings, report = validate_splits(splits)
        print(json.dumps(report, indent=2))
        for w in warnings:
            log.warning("%s", w)
        if errors:
            for e in errors:
                log.error("%s", e)
            raise SystemExit(1)
        log.info("QUESTION GENERATOR DATASET: READY FOR TRAINING")
        return

    statistics = run(args.out, seed=args.seed, max_per_domain=args.max_per_domain,
                     se_ratio=args.se_ratio, limit_per_shard=args.limit_per_shard)
    print_report(statistics)


if __name__ == "__main__":
    main()
