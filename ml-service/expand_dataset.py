"""Automated Dataset Expansion & Merge Script for AI Interview System.

Downloads 20,000+ real software engineering & coding Q&A records from Hugging Face,
standardizes schemas, categorizes domains & difficulty levels, and merges them with
the existing interview dataset into `ml-service/dataset/raw/raw_interview_dataset.json`.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Set

# Base directories
BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "dataset" / "raw"
REPORTS_DIR = BASE_DIR / "reports"
RAW_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

BASE_DATASET_FILE = RAW_DIR / "raw_interview_dataset.json"
BACKUP_DATASET_FILE = RAW_DIR / "raw_interview_dataset_original_2k.json"
EXPANDED_EXPORT_FILE = RAW_DIR / "raw_interview_dataset_expanded_22k.json"
EXPANSION_REPORT_FILE = REPORTS_DIR / "dataset_expansion_report.json"

# Hugging Face Open-Access Dataset Endpoints (No Token Required)
DATASET_SOURCES = [
    {
        "name": "sahil2801/CodeAlpaca-20k",
        "url": "https://huggingface.co/datasets/sahil2801/CodeAlpaca-20k/raw/main/code_alpaca_20k.json",
        "type": "json_list",
        "description": "20,000+ software engineering, algorithmic, and coding Q&A pairs"
    }
]


def classify_domain(question: str, answer: str) -> str:
    """Classify Q&A into one of 7 standardized interview domains."""
    text = (question + " " + answer).lower()

    if any(k in text for k in ["react", "vue", "angular", "next.js", "dom", "html", "css", "tailwind", "frontend", "javascript", "typescript", "ui component"]):
        return "Frontend Development"
    elif any(k in text for k in ["sql", "postgres", "mysql", "mongodb", "database", "query", "index", "table", "schema", "sqlite", "nosql"]):
        return "Database Systems"
    elif any(k in text for k in ["docker", "kubernetes", "aws", "cloud", "linux", "bash", "shell", "deploy", "ci/cd", "container", "devops"]):
        return "DevOps & Cloud"
    elif any(k in text for k in ["microservice", "architecture", "scalability", "load balancer", "cache", "redis", "kafka", "system design", "distributed"]):
        return "System Design"
    elif any(k in text for k in ["tree", "graph", "sort", "search", "binary search", "recursion", "dynamic programming", "stack", "queue", "linked list", "time complexity"]):
        return "Algorithms & Data Structures"
    elif any(k in text for k in ["django", "flask", "fastapi", "node.js", "express", "rest api", "endpoint", "backend", "graphql", "http request"]):
        return "Backend & Web APIs"
    elif any(k in text for k in ["class", "oop", "inheritance", "polymorphism", "clean code", "refactor", "solid principle", "design pattern", "unit test"]):
        return "General Software Engineering"
    else:
        return "General Software Engineering"


def classify_difficulty(question: str, answer: str) -> str:
    """Classify difficulty tier based on question/answer complexity."""
    words = len(question.split())
    ans_words = len(answer.split())
    text = (question + " " + answer).lower()

    if words > 25 or ans_words > 80 or any(k in text for k in ["optimize", "architect", "distributed", "concurrency", "trade-off", "scalability", "dynamic programming"]):
        return "Advanced"
    elif words > 12 or ans_words > 35 or any(k in text for k in ["implement", "algorithm", "database", "difference between", "how would you", "handle"]):
        return "Intermediate"
    else:
        return "Beginner"


def download_json_dataset(source_info: Dict[str, str]) -> List[Dict[str, Any]]:
    """Download dataset from Hugging Face directly."""
    url = source_info["url"]
    name = source_info["name"]
    print(f"[*] Downloading '{name}' from Hugging Face...")

    req = urllib.request.Request(url, headers={"User-Agent": "AI-Interview-Dataset-Ingest/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        content = resp.read().decode("utf-8")
        data = json.loads(content)

    print(f"[OK] Downloaded {len(data):,} raw records from '{name}'.")
    return data


def standardize_code_alpaca_records(raw_items: List[Dict[str, Any]], start_id: int = 1) -> List[Dict[str, Any]]:
    """Convert CodeAlpaca schema into the standard AI Interview System schema."""
    standardized = []
    seen_questions: Set[str] = set()

    for idx, item in enumerate(raw_items):
        instruction = item.get("instruction", "").strip()
        extra_input = item.get("input", "").strip()
        output = item.get("output", "").strip()

        if not instruction or not output:
            continue

        # Combine instruction with input if context exists
        full_question = instruction
        if extra_input and len(extra_input) > 2:
            full_question = f"{instruction}\nInput Context:\n{extra_input}"

        # Clean whitespace
        clean_q = re.sub(r"\s+", " ", full_question).strip()
        clean_a = re.sub(r"\s+", " ", output).strip()

        # Deduplication
        q_norm = clean_q.lower()
        if q_norm in seen_questions:
            continue
        seen_questions.add(q_norm)

        domain = classify_domain(clean_q, clean_a)
        difficulty = classify_difficulty(clean_q, clean_a)
        rec_id = f"HF_EXP_{start_id + len(standardized):05d}"

        standardized.append({
            "id": rec_id,
            "domain": domain,
            "difficulty": difficulty,
            "input_prompt": f"[DOMAIN: {domain}] [DIFFICULTY: {difficulty}] Question:",
            "question": clean_q,
            "answer": clean_a,
            "source": "sahil2801/CodeAlpaca-20k (Hugging Face)",
            "license": "Apache 2.0"
        })

    return standardized


def expand_and_merge_dataset(max_new_records: int = 15000) -> Dict[str, Any]:
    print("=" * 70)
    print("   AI INTERVIEW SYSTEM — DATASET EXPANSION & SCALING ENGINE")
    print("=" * 70)

    # 1. Load existing base dataset
    existing_records = []
    if BASE_DATASET_FILE.exists():
        with open(BASE_DATASET_FILE, "r", encoding="utf-8") as f:
            existing_records = json.load(f)
        print(f"[*] Loaded existing base dataset: {len(existing_records):,} records from {BASE_DATASET_FILE.name}")

        # Create safety backup if not already present
        if not BACKUP_DATASET_FILE.exists():
            with open(BACKUP_DATASET_FILE, "w", encoding="utf-8") as f:
                json.dump(existing_records, f, indent=2)
            print(f"[OK] Backed up original dataset to: {BACKUP_DATASET_FILE.name}")

    # 2. Download external dataset from Hugging Face
    raw_external = download_json_dataset(DATASET_SOURCES[0])

    # 3. Standardize and categorize
    new_standardized = standardize_code_alpaca_records(raw_external, start_id=len(existing_records) + 1)
    if max_new_records and len(new_standardized) > max_new_records:
        new_standardized = new_standardized[:max_new_records]

    print(f"[OK] Standardized & categorized {len(new_standardized):,} new technical Q&A pairs.")

    # 4. Merge and Deduplicate
    seen_qs: Set[str] = set()
    merged_records = []

    # Preserve all original records first
    for rec in existing_records:
        q_norm = rec.get("question", "").strip().lower()
        if q_norm:
            seen_qs.add(q_norm)
            merged_records.append(rec)

    # Append new non-duplicate records
    added_count = 0
    for rec in new_standardized:
        q_norm = rec.get("question", "").strip().lower()
        if q_norm not in seen_qs:
            seen_qs.add(q_norm)
            merged_records.append(rec)
            added_count += 1

    print(f"[OK] Successfully merged! Total unique records: {len(merged_records):,} (Added: {added_count:,})")

    # 5. Compute Detailed Domain & Difficulty Distribution
    domain_counts: Dict[str, int] = {}
    difficulty_counts: Dict[str, int] = {}
    for r in merged_records:
        d = r.get("domain", "General Software Engineering")
        diff = r.get("difficulty", "Intermediate")
        domain_counts[d] = domain_counts.get(d, 0) + 1
        difficulty_counts[diff] = difficulty_counts.get(diff, 0) + 1

    # 6. Save Expanded Dataset to disk
    with open(BASE_DATASET_FILE, "w", encoding="utf-8") as f:
        json.dump(merged_records, f, indent=2)
    print(f"[SAVED] Overwritten primary dataset: {BASE_DATASET_FILE} ({len(merged_records):,} records)")

    with open(EXPANDED_EXPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(merged_records, f, indent=2)
    print(f"[SAVED] Exported standalone snapshot: {EXPANDED_EXPORT_FILE.name}")

    # 7. Generate Expansion Report
    report = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "original_record_count": len(existing_records),
        "new_records_added": added_count,
        "total_expanded_records": len(merged_records),
        "sources": [
            "ali-alkhars/interviews (Hugging Face)",
            "sahil2801/CodeAlpaca-20k (Hugging Face)"
        ],
        "domain_distribution": domain_counts,
        "difficulty_distribution": difficulty_counts,
        "files_updated": [
            str(BASE_DATASET_FILE),
            str(EXPANDED_EXPORT_FILE)
        ]
    }

    with open(EXPANSION_REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"[SAVED] Generated expansion report: {EXPANSION_REPORT_FILE.name}")

    # 8. Print Clean Summary Table
    print("\n" + "=" * 70)
    print("                 EXPANDED DATASET DISTRIBUTION")
    print("=" * 70)
    print(f" {'Domain Category':<35} | {'Count':<10} | {'Percentage':<10}")
    print("-" * 70)
    for dom, cnt in sorted(domain_counts.items(), key=lambda x: x[1], reverse=True):
        pct = (cnt / len(merged_records)) * 100.0
        print(f" {dom:<35} | {cnt:<10,} | {pct:.1f}%")
    print("-" * 70)
    print(" DIFFICULTY TIERS:")
    for diff, cnt in sorted(difficulty_counts.items(), key=lambda x: x[1], reverse=True):
        pct = (cnt / len(merged_records)) * 100.0
        print(f"  * {diff:<15} : {cnt:,} ({pct:.1f}%)")
    print("=" * 70)
    print(f"[OK] Total Training-Ready Technical Q&A Pairs: {len(merged_records):,}")

    return report


if __name__ == "__main__":
    expand_and_merge_dataset(max_new_records=15000)
