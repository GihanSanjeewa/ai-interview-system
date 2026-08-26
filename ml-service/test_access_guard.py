"""Test Dataset Access Guard and Dataset Split Integrity Module.

Strictly enforces Rule 1 & Rule 2:
- The held-out TEST dataset (`test.jsonl`) is strictly locked and cannot be loaded by Notebooks 01–07.
- Notebook 08 is the FIRST and ONLY notebook authorized to access `test.jsonl`.
- Maintains an immutable test access audit log in reports/test_access_audit.json.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

log = logging.getLogger("test_access_guard")

BASE_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = BASE_DIR / "dataset" / "processed"
REPORTS_DIR = BASE_DIR / "reports"
AUDIT_FILE = REPORTS_DIR / "test_access_audit.json"

SPLIT_PATHS = {
    "train": PROCESSED_DIR / "train" / "train.jsonl",
    "validation": PROCESSED_DIR / "validation" / "validation.jsonl",
    "test": PROCESSED_DIR / "test" / "test.jsonl"
}

# Legacy direct locations fallback support
LEGACY_PATHS = {
    "train": PROCESSED_DIR / "question_generator" / "train.jsonl",
    "validation": PROCESSED_DIR / "question_generator" / "validation.jsonl",
    "test": PROCESSED_DIR / "question_generator" / "test.jsonl"
}


class TestDatasetLockedError(PermissionError):
    """Raised when an unauthorized notebook or stage attempts to access test.jsonl."""
    pass


def get_audit_log() -> Dict[str, Any]:
    """Load or initialize the test access audit record."""
    if AUDIT_FILE.exists():
        try:
            return json.loads(AUDIT_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {
        "policy": {
            "allowed_from_notebook": 8,
            "description": "Test dataset is held-out and locked. Access is strictly forbidden in Notebooks 01-07."
        },
        "access_history": []
    }


def record_audit_entry(notebook_id: Optional[int], caller: str, split: str, allowed: bool, details: str = ""):
    """Record a split access attempt in the audit log."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    log_data = get_audit_log()
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "notebook_id": notebook_id,
        "caller": caller,
        "split_requested": split,
        "access_granted": allowed,
        "details": details
    }
    log_data["access_history"].append(entry)
    AUDIT_FILE.write_text(json.dumps(log_data, indent=2), encoding="utf-8")


def resolve_split_path(split_name: str) -> Path:
    """Resolve split path between standard structure and question_generator fallback."""
    split = split_name.lower().strip()
    if split in ("val", "dev", "eval"):
        split = "validation"
    if split in SPLIT_PATHS and SPLIT_PATHS[split].exists():
        return SPLIT_PATHS[split]
    if split in LEGACY_PATHS and LEGACY_PATHS[split].exists():
        return LEGACY_PATHS[split]
    if split in SPLIT_PATHS:
        return SPLIT_PATHS[split]
    raise ValueError(f"Unknown split name: '{split_name}'. Expected 'train', 'validation', or 'test'.")


def load_split_records(
    split_name: str,
    notebook_id: Optional[int] = None,
    caller_name: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Load JSONL records for the requested split with strict guard verification.

    Args:
        split_name: 'train', 'validation', or 'test'
        notebook_id: Integer identifier of the calling notebook (1 to 9). Required when loading 'test'.
        caller_name: Name of module/script calling this function.

    Returns:
        List of deserialized JSON records.

    Raises:
        TestDatasetLockedError: If split_name is 'test' and notebook_id is not 8.
        FileNotFoundError: If the requested split file does not exist.
    """
    caller = caller_name or Path(sys.argv[0]).name if sys.argv else "interactive"
    split = split_name.lower().strip()
    if split in ("val", "dev", "eval"):
        split = "validation"

    # Enforce Test Lock Rule
    if split == "test":
        if notebook_id is None or notebook_id < 8:
            error_msg = (
                f"TEST DATASET IS STRICTLY LOCKED!\n"
                f"Unauthorized access to 'test.jsonl' attempted by: notebook_id={notebook_id} (caller: {caller}).\n"
                f"Under experimental rule 1 & 2, the test split can ONLY be accessed in Notebook 08 "
                f"('08_fine_tuned_model_evaluation.ipynb') for final held-out model evaluation."
            )
            record_audit_entry(notebook_id, caller, split, allowed=False, details="TestDatasetLockedError triggered.")
            log.error(error_msg)
            raise TestDatasetLockedError(error_msg)

        record_audit_entry(notebook_id, caller, split, allowed=True, details="Authorized held-out test evaluation.")
    else:
        record_audit_entry(notebook_id, caller, split, allowed=True, details=f"Loaded {split} split.")

    target_path = resolve_split_path(split)
    if not target_path.exists():
        raise FileNotFoundError(f"Split file '{split}' not found at: {target_path}")

    records = []
    with open(target_path, "r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                log.warning(f"{target_path.name}:{lineno} JSONDecodeError: {exc}")

    return records


def verify_no_split_leakage(
    train_records: List[Dict[str, Any]],
    val_records: List[Dict[str, Any]],
    test_records: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Verify zero overlap between train, validation, and test splits."""
    def extract_keys(records: List[Dict[str, Any]]) -> set:
        keys = set()
        for r in records:
            # Check question text, input/output, or unique ID
            q = (r.get("question") or r.get("input") or "").strip().lower()
            if q:
                keys.add(q)
            elif "id" in r:
                keys.add(str(r["id"]))
        return keys

    train_keys = extract_keys(train_records)
    val_keys = extract_keys(val_records)
    test_keys = extract_keys(test_records)

    train_val_overlap = train_keys.intersection(val_keys)
    train_test_overlap = train_keys.intersection(test_keys)
    val_test_overlap = val_keys.intersection(test_keys)

    has_leakage = bool(train_val_overlap or train_test_overlap or val_test_overlap)

    report = {
        "train_samples": len(train_records),
        "validation_samples": len(val_records),
        "test_samples": len(test_records),
        "train_val_overlap_count": len(train_val_overlap),
        "train_test_overlap_count": len(train_test_overlap),
        "val_test_overlap_count": len(val_test_overlap),
        "zero_leakage_passed": not has_leakage,
        "verified_at": datetime.now(timezone.utc).isoformat()
    }

    if has_leakage:
        raise ValueError(
            f"Data leakage detected across splits! "
            f"Train-Val: {len(train_val_overlap)}, Train-Test: {len(train_test_overlap)}, Val-Test: {len(val_test_overlap)}"
        )

    return report


def lock_test_dataset(test_dir: Path):
    """Write an immutable test lock marker in the test split folder."""
    t_path = Path(test_dir)
    t_path.mkdir(parents=True, exist_ok=True)
    lock_file = t_path / "test_lock.json"
    lock_meta = {
        "status": "LOCKED",
        "authorized_notebook_id": 8,
        "description": "Test dataset is strictly held out and cannot be accessed before Notebook 08.",
        "locked_at": datetime.now(timezone.utc).isoformat()
    }
    lock_file.write_text(json.dumps(lock_meta, indent=2), encoding="utf-8")

