"""Complete Training Script to Upgrade Model 1 (Question Generator Transformer).

Trains a high-capacity Transformer (18.5M params) on the expanded 17,289 dataset
with Cosine Annealing Learning Rate scheduling and Domain-Conditioned prompting.
"""
from __future__ import annotations

import json
import math
import os
import random
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

import torch
import torch.nn as nn
import torch.optim as optim
import torch.optim.lr_scheduler as lr_scheduler
from torch.utils.data import DataLoader, Dataset

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from transformer_scratch import CompactTransformerLM, CustomBPETokenizer


class QuestionTextDataset(Dataset):
    def __init__(self, texts: List[str], tokenizer: CustomBPETokenizer, max_len: int = 128):
        self.tokenizer = tokenizer
        self.max_len = max_len
        self.samples = []
        for t in texts:
            ids = tokenizer.encode(t)
            if len(ids) > 6:
                self.samples.append(ids[:max_len])

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        ids = self.samples[idx]
        return torch.tensor(ids, dtype=torch.long)


def collate_fn(batch: List[torch.Tensor], pad_id: int = 0) -> Tuple[torch.Tensor, torch.Tensor]:
    max_l = max(len(x) for x in batch)
    padded = [torch.cat([x, torch.full((max_l - len(x),), pad_id, dtype=torch.long)]) for x in batch]
    stacked = torch.stack(padded)
    # Inputs: stacked[:, :-1], Targets: stacked[:, 1:]
    return stacked[:, :-1], stacked[:, 1:]


def train_upgraded_model(epochs: int = 5, batch_size: int = 32, lr: float = 5e-4):
    print("\n" + "=" * 75)
    print("   AI INTERVIEW SYSTEM — UPGRADED MODEL 1 TRANSFORMER TRAINING")
    print("=" * 75)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[*] Compute Device: {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")

    # 1. Load Expanded Dataset
    dataset_file = BASE_DIR / "dataset" / "raw" / "raw_interview_dataset.json"
    if not dataset_file.exists():
        print("[*] Running dataset expansion to ensure 17,000+ samples...")
        from expand_dataset import expand_and_merge_dataset
        expand_and_merge_dataset()

    with open(dataset_file, "r", encoding="utf-8") as f:
        records = json.load(f)

    print(f"[*] Training on {len(records):,} Technical Q&A records.")

    # 2. Format Training Text with Domain/Difficulty Conditioning
    training_texts = []
    for r in records:
        dom = r.get("domain", "General Software Engineering")
        diff = r.get("difficulty", "Intermediate")
        q = r.get("question", "").strip()
        if q:
            training_texts.append(f"[DOMAIN: {dom}] [DIFFICULTY: {diff}] Question: {q}")

    # 3. Train / Load Tokenizer
    tok_dir = BASE_DIR / "tokenizer"
    tok_dir.mkdir(parents=True, exist_ok=True)
    tokenizer = CustomBPETokenizer(vocab_size=4096)
    tokenizer.train_from_texts(training_texts)
    tokenizer.save(tok_dir)
    vocab_size = len(tokenizer.token2id)
    print(f"[OK] Tokenizer built with vocabulary size: {vocab_size:,}")

    # 4. Instantiate Upgraded High-Capacity Transformer
    # Standard Profile: d_model=512, n_heads=8, n_layers=6, hidden_dim=1024
    model = CompactTransformerLM(
        vocab_size=vocab_size,
        d_model=512,
        n_heads=8,
        n_layers=6,
        hidden_dim=1024,
        max_seq_len=256,
        dropout=0.1
    )
    model.to(device)
    param_count = sum(p.numel() for p in model.parameters())
    print(f"[OK] Model 1 Architecture Initialized: {param_count:,} parameters ({param_count/1e6:.1f}M)")

    # 5. Setup Dataset & DataLoader
    random.shuffle(training_texts)
    split_idx = int(len(training_texts) * 0.90)
    train_data = QuestionTextDataset(training_texts[:split_idx], tokenizer)
    val_data = QuestionTextDataset(training_texts[split_idx:], tokenizer)

    train_loader = DataLoader(
        train_data,
        batch_size=batch_size,
        shuffle=True,
        collate_fn=lambda b: collate_fn(b, pad_id=tokenizer.pad_id)
    )
    val_loader = DataLoader(
        val_data,
        batch_size=batch_size,
        shuffle=False,
        collate_fn=lambda b: collate_fn(b, pad_id=tokenizer.pad_id)
    )

    # 6. Optimizer & Learning Rate Scheduler
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    scheduler = lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-5)
    criterion = nn.CrossEntropyLoss(ignore_index=tokenizer.pad_id)

    # 7. Training Loop
    print("\n[*] Starting Training Loop across epochs...")
    best_val_loss = float("inf")

    for ep in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        t0 = time.perf_counter()

        for step, (inputs, targets) in enumerate(train_loader):
            inputs, targets = inputs.to(device), targets.to(device)
            optimizer.zero_grad()

            logits = model(inputs)
            loss = criterion(logits.view(-1, vocab_size), targets.view(-1))

            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            total_loss += loss.item()

        scheduler.step()
        train_loss = total_loss / len(train_loader)

        # Validation
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs, targets = inputs.to(device), targets.to(device)
                logits = model(inputs)
                loss = criterion(logits.view(-1, vocab_size), targets.view(-1))
                val_loss += loss.item()

        val_loss = val_loss / len(val_loader)
        val_ppl = math.exp(min(val_loss, 20))
        elapsed = time.perf_counter() - t0

        print(f"Epoch {ep:02d}/{epochs:02d} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val PPL: {val_ppl:.2f} | Time: {elapsed:.1f}s")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            # Save Checkpoints
            save_dirs = [
                BASE_DIR / "models" / "interview_model",
                BASE_DIR / "models" / "ai-interview-question-generator-v2.0.0"
            ]
            for s_dir in save_dirs:
                s_dir.mkdir(parents=True, exist_ok=True)
                torch.save({
                    "model_state_dict": model.state_dict(),
                    "vocab_size": vocab_size,
                    "d_model": 512,
                    "n_heads": 8,
                    "n_layers": 6,
                    "hidden_dim": 1024,
                    "val_loss": val_loss,
                    "val_perplexity": val_ppl,
                    "epoch": ep
                }, s_dir / "checkpoint.pt")

    print("\n" + "=" * 75)
    print(f"✅ Training Complete! Best Validation Loss: {best_val_loss:.4f} (Perplexity: {math.exp(min(best_val_loss, 20)):.2f})")
    print(f"✅ Upgraded Checkpoints Saved to: models/interview_model/checkpoint.pt")
    print("=" * 75)


if __name__ == "__main__":
    train_upgraded_model(epochs=5, batch_size=32)
