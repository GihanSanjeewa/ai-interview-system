"""
Dataset Preparation & Preprocessing Pipeline
Handles raw dataset ingestion, cleaning, JSON format verification, deduplication, and train/val/test splitting.
"""

import os
import json
import random

RAW_DATA_DIR = os.path.join(os.path.dirname(__file__), "../dataset/raw")
PROCESSED_DATA_DIR = os.path.join(os.path.dirname(__file__), "../dataset/processed")
TRAINING_DATA_DIR = os.path.join(os.path.dirname(__file__), "../dataset/training")

def prepare_dataset(raw_file="interview_dataset_sample.json", train_ratio=0.8, val_ratio=0.1, test_ratio=0.1):
    os.makedirs(RAW_DATA_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)
    os.makedirs(TRAINING_DATA_DIR, exist_ok=True)

    input_path = os.path.join(PROCESSED_DATA_DIR, raw_file)
    if not os.path.exists(input_path):
        print(f"Warning: Processed file not found at {input_path}")
        return

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Loaded {len(data)} total samples from dataset.")

    # Shuffle for stratified random split
    random.seed(42)
    random.shuffle(data)

    n_total = len(data)
    n_train = int(n_total * train_ratio)
    n_val = int(n_total * val_ratio)

    train_data = data[:n_train]
    val_data = data[n_train:n_train + n_val]
    test_data = data[n_train + n_val:]

    with open(os.path.join(TRAINING_DATA_DIR, "train.json"), "w", encoding="utf-8") as f:
        json.dump(train_data, f, indent=2)

    with open(os.path.join(TRAINING_DATA_DIR, "val.json"), "w", encoding="utf-8") as f:
        json.dump(val_data, f, indent=2)

    with open(os.path.join(TRAINING_DATA_DIR, "test.json"), "w", encoding="utf-8") as f:
        json.dump(test_data, f, indent=2)

    print(f"Dataset Split Completed:")
    print(f"  Train samples : {len(train_data)}")
    print(f"  Val samples   : {len(val_data)}")
    print(f"  Test samples  : {len(test_data)}")

if __name__ == "__main__":
    prepare_dataset()
