"""Download the public datasets used to train this interview system.

See DATASETS.md for the full catalogue, licences and rationale.

Usage:
    python dataset/download_datasets.py --list
    python dataset/download_datasets.py --group core
    python dataset/download_datasets.py --group code --group speech
    python dataset/download_datasets.py --only openai/openai_humaneval
    python dataset/download_datasets.py --only common-pile/stackexchange

Kaggle sets and the request-form sets (MIT Interview, ChaLearn, MSP-Podcast,
DiverseVul, Mohler) are not fetchable here — DATASETS.md lists their links.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path

log = logging.getLogger("download_datasets")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

RAW = Path(__file__).parent / "raw"

# common-pile/stackexchange is a 103 GB, 33.4 M-document dump of every Stack
# Exchange site. Pulling it whole is neither affordable nor useful here, so the
# fetch is scoped to the sites that actually carry interview-grade content for
# the 16 domains in interview_domains.py. Everything else is skipped.
SE_SITES = [
    "softwareengineering.stackexchange.com",  # OOP, design patterns, architecture, REST
    "codereview.stackexchange.com",           # OOP, testing, language idioms
    "cs.stackexchange.com",                   # algorithms, data structures, concurrency
    "cstheory.stackexchange.com",             # algorithms, complexity
    "dba.stackexchange.com",                  # SQL, indexing, query optimisation
    "devops.stackexchange.com",               # docker, kubernetes, microservices, CI/CD
    "security.stackexchange.com",             # security
    "sqa.stackexchange.com",                  # unit / integration testing
]

# (hf_id, config, split, group, note). config/split None => load everything.
CATALOGUE = [
    # --- A. question generator -------------------------------------------
    ("ali-alkhars/interviews",              None, None, "core",  "2.3k SWE interview Q&A"),
    ("community-datasets/so_stacksample",   None, None, "qa",    "10% Stack Overflow sample"),
    ("habedi/stack-exchange-dataset",       None, None, "qa",    "CS / DS / Programmers SE"),
    ("lvwerra/stack-exchange-paired",       None, "train", "qa", "chosen/rejected answer pairs (big)"),
    ("common-pile/stackexchange",           None, None, "qa",    "SE dumps, scoped to SE_SITES"),

    # --- B. answer evaluation --------------------------------------------
    ("sentence-transformers/stsb",          None, None, "core",  "embedding calibration"),

    # --- C. coding evaluation --------------------------------------------
    ("openai/openai_humaneval",             None, None, "core",  "164 problems + tests"),
    ("google-research-datasets/mbpp",       "full", None, "core", "974 Python tasks + tests"),
    ("codeparrot/apps",                     None, None, "core",  "10k problems, difficulty tiers"),
    ("deepmind/code_contests",              None, None, "code",  "13.6k, multi-language solutions"),
    ("bigcode/bigcodebench",                None, None, "code",  "1140 real-library tasks"),
    ("newfacade/LeetCodeDataset",           None, None, "code",  "Python LeetCode"),
    ("Alishohadaee/leetcode-problems-dataset", None, None, "code", "problems + metadata"),

    # --- D. security ------------------------------------------------------
    ("google/code_x_glue_cc_defect_detection", None, None, "core", "Devign, 27k labelled C functions"),

    # --- E. speech --------------------------------------------------------
    ("google/fleurs",                       "si_lk", None, "speech", "Sinhala read speech ~12h"),
    ("mozilla-foundation/common_voice_17_0", "si",   None, "speech", "needs HF login + terms accepted"),
]

GROUPS = sorted({row[3] for row in CATALOGUE})


def download_stackexchange(token: str | None) -> bool:
    """Fetch only the SE_SITES shards of common-pile/stackexchange.

    The shards stay in the HuggingFace hub cache (they are already several GB and
    copying them into dataset/raw/ would double the footprint). We drop a small
    manifest under dataset/raw/ so the preprocessing scripts can resolve them.
    """
    from huggingface_hub import snapshot_download

    target = RAW / "common-pile__stackexchange"
    patterns = [f"{site}/documents/*" for site in SE_SITES]

    log.info("fetch %-45s %d sites (site-scoped, resumable)", "common-pile/stackexchange", len(SE_SITES))
    try:
        snapshot = snapshot_download(
            "common-pile/stackexchange",
            repo_type="dataset",
            allow_patterns=patterns,
            token=token,
        )
    except Exception as exc:
        log.error("FAIL  %-45s %s", "common-pile/stackexchange", exc)
        return False

    target.mkdir(parents=True, exist_ok=True)
    present = {site: sorted(str(f) for f in (Path(snapshot) / site / "documents").glob("*.gz"))
               for site in SE_SITES if (Path(snapshot) / site / "documents").is_dir()}
    (target / "snapshot.json").write_text(
        json.dumps({"snapshot_path": snapshot, "sites": present}, indent=2), encoding="utf-8")
    log.info("saved %-45s manifest -> %s (%d sites, %d shards)",
             "common-pile/stackexchange", target / "snapshot.json",
             len(present), sum(len(v) for v in present.values()))
    return True


def download(hf_id: str, config: str | None, split: str | None, note: str, token: str | None) -> bool:
    if hf_id == "common-pile/stackexchange":
        return download_stackexchange(token)

    from datasets import load_dataset

    target = RAW / hf_id.replace("/", "__")
    if target.exists() and any(target.iterdir()):
        log.info("skip  %-45s already in %s", hf_id, target)
        return True

    log.info("fetch %-45s %s", hf_id, note)
    try:
        ds = load_dataset(hf_id, config, split=split, token=token)
    except Exception as exc:  # gated sets, missing deps, network
        log.error("FAIL  %-45s %s", hf_id, exc)
        return False

    target.mkdir(parents=True, exist_ok=True)
    ds.save_to_disk(str(target))
    log.info("saved %-45s -> %s", hf_id, target)
    return True


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--group", action="append", choices=GROUPS,
                    help="dataset group to fetch; repeatable (default: core)")
    ap.add_argument("--only", action="append", help="fetch a single HF dataset id; repeatable")
    ap.add_argument("--list", action="store_true", help="print the catalogue and exit")
    ap.add_argument("--hf-token", default=os.environ.get("HF_TOKEN"))
    args = ap.parse_args()

    if args.list:
        for hf_id, config, split, group, note in CATALOGUE:
            print(f"[{group:6}] {hf_id:45} {config or '':8} {note}")
        return

    if args.only:
        rows = [r for r in CATALOGUE if r[0] in args.only]
        missing = set(args.only) - {r[0] for r in rows}
        for m in missing:
            log.warning("not in catalogue: %s", m)
    else:
        wanted = set(args.group or ["core"])
        rows = [r for r in CATALOGUE if r[3] in wanted]

    RAW.mkdir(parents=True, exist_ok=True)
    ok = sum(download(hf_id, config, split, note, args.hf_token)
             for hf_id, config, split, _group, note in rows)
    log.info("done: %d/%d datasets available under %s", ok, len(rows), RAW)


if __name__ == "__main__":
    main()
