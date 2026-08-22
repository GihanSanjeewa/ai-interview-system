"""Entry point for QLoRA fine-tuning — delegates to `training/train_qlora.py`.

The implementation lives in `training/train_qlora.py`, alongside
`training/prepare_dataset.py` and `training/evaluate_model.py`. This shim keeps
`python train_qlora.py ...` working from the `ml-service/` directory so existing
notes, notebooks and docs do not break. These two are the same program:

    python train_qlora.py --dry_run
    python training/train_qlora.py --dry_run

Run `python train_qlora.py --help` for the full argument list.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_IMPL = Path(__file__).resolve().parent / "training" / "train_qlora.py"

# Loaded by path under a distinct module name: this file is also called
# train_qlora, so a plain import would resolve back to itself.
_spec = importlib.util.spec_from_file_location("interview_train_qlora", _IMPL)
if _spec is None or _spec.loader is None:  # pragma: no cover
    raise ImportError(f"cannot load the QLoRA implementation from {_IMPL}")
_impl = importlib.util.module_from_spec(_spec)
sys.modules["interview_train_qlora"] = _impl
_spec.loader.exec_module(_impl)

train = _impl.train

if __name__ == "__main__":
    sys.exit(train())
