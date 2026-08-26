# AI Interview System — Google Colab Execution & Failure Recovery Guide
## 100% Project-Owned Models (From Scratch Architecture)

This master operational manual provides step-by-step instructions for executing the entire machine learning lifecycle for the **AI Interview System** on Google Colab without external pretrained LLMs.

---

## 1. Architectural Principles

- **Hugging Face**: Used **exclusively** as a dataset source.
- **Pretrained Foundation Models**: **0 (Zero)** — No Qwen, Llama, Mistral, Gemma, GPT, OpenAI, or Ollama.
- **Pretrained Weights**: **0 (Zero)** — All models are initialized strictly with random Gaussian weights.
- **Pretrained Tokenizers**: **0 (Zero)** — Custom BPE Tokenizer is trained exclusively on `train.jsonl`.
- **Checkpoint Resilience**: Complete atomic state preservation on Google Drive (`/content/drive/MyDrive/ai-interview-system/ml-service/checkpoints/`).

```text
Hugging Face (Dataset ONLY)
         ↓
01_dataset_download.ipynb
         ↓
02_dataset_inspection_eda.ipynb
         ↓
03_data_preprocessing.ipynb
         ↓
04_data_validation.ipynb (Test Split Locked)
         ↓
05_multi_model_training.ipynb (Train 4 Own Scratch Models)
   ├─ Candidate 1: Compact Transformer (4L / 256d / 4H / 1024 d_ff)
   ├─ Candidate 2: Scaled Transformer (6L / 384d / 6H / 1536 d_ff)
   ├─ Candidate 3: Deep Transformer (8L / 512d / 8H / 2048 d_ff)
   └─ Candidate 4: Efficient SwiGLU Transformer (4L / 384d / 6H / 1536 d_ff)
         ↓
06_model_comparison_selection.ipynb (Validation-Only Normalized Scoring)
         ↓
07_best_model_fine_tuning.ipynb (Second-Stage Continued Training & Specialization)
         ↓
08_fine_tuned_model_evaluation.ipynb (FIRST Access to test.jsonl + Promotion Gate)
         ↓
09_model_export_and_registration.ipynb (Model Registry & Dynamic Activation)
         ↓
Production Inference (Flask ml-service / AI Interview Assistant)
```

---

## 2. Google Colab Setup & Runtime Selection

### 2.1 Hardware Selection
1. Open Google Colab.
2. In the top menu: **Runtime** $\rightarrow$ **Change runtime type**.
3. Select: **T4 GPU** (or A100/V100 if Colab Pro is available).
4. Verify CUDA is active by running `!nvidia-smi`.

### 2.2 Google Drive Storage Structure
Google Drive is automatically mounted at `/content/drive` by Cell 1 in each notebook:
```text
/content/drive/MyDrive/ai-interview-system/ml-service/
├── dataset/
│   ├── raw/
│   ├── preprocessed/
│   └── processed/
│       ├── train/
│       ├── validation/
│       └── test/ (LOCKED until Notebook 08)
├── tokenizer/
├── checkpoints/
│   ├── candidate_1_scratch_compact_transformer/
│   ├── candidate_2_scratch_scaled_transformer/
│   ├── candidate_3_scratch_deep_transformer/
│   ├── candidate_4_scratch_efficient_transformer/
│   └── specialized_training/
├── models/
│   ├── interview_model/
│   └── model_registry.json
└── reports/
```

---

## 3. Step-by-Step Notebook Execution

### Notebook 01 — Dataset Download (`01_dataset_download.ipynb`)
- **Action**: Run all cells sequentially.
- **Tasks**: Mounts Google Drive, runs hardware diagnostic preflight, downloads raw interview records from Hugging Face, caches data to `dataset/raw/raw_interview_dataset.json`, and creates `reports/dataset_metadata.json`.
- **Validation**: Confirm `raw_interview_dataset.json` exists and 0 models were downloaded.

### Notebook 02 — Dataset Inspection & EDA (`02_dataset_inspection_eda.ipynb`)
- **Action**: Run all cells sequentially.
- **Tasks**: Computes text length statistics (questions, answers), character counts, word counts, and domain distributions.
- **Validation**: Check plots saved in `reports/figures/eda/`.

### Notebook 03 — Data Preprocessing (`03_data_preprocessing.ipynb`)
- **Action**: Run all cells sequentially.
- **Tasks**: Reports missing values, cleans and normalizes whitespace, eliminates exact duplicate questions, and exports `dataset/preprocessed/preprocessed_dataset.json`.
- **Validation**: Verify `preprocessed_dataset.json` is generated.

### Notebook 04 — Data Validation & Test Split Lock (`04_data_validation.ipynb`)
- **Action**: Run all cells sequentially.
- **Tasks**: Deterministically splits dataset into 80% Train, 10% Validation, 10% Test (Seed: 42). Verifies zero leakage ($Train \cap Val = 0, Train \cap Test = 0, Val \cap Test = 0$). **Programmatically locks `test.jsonl`**.
- **Validation**: Confirm `train.jsonl`, `validation.jsonl`, and locked `test.jsonl` are present.

### Notebook 05 — Multi-Candidate Scratch Training (`05_multi_model_training.ipynb`)
- **Action**: Run all cells sequentially.
- **Tasks**:
  1. Trains Custom BPE Tokenizer strictly on `train.jsonl`.
  2. Initializes all 4 own candidate models from random weights.
  3. Trains each model with Google Drive checkpointing.
  4. Automatically resumes from checkpoint if Colab runtime disconnected.
  5. Evaluates candidates strictly on `validation.jsonl` (`test.jsonl` is blocked).
  6. Exports `reports/candidate_training_report.json`.
- **Validation**: Verify all 4 candidate models are trained with parameters, losses, perplexities, and latencies recorded.

### Notebook 06 — Model Comparison & Selection (`06_model_comparison_selection.ipynb`)
- **Action**: Run all cells sequentially.
- **Tasks**: Loads validation metrics, applies inverted normalization for lower-is-better metrics (loss, perplexity, latency, VRAM), computes weighted composite scores, and exports `reports/best_model_selection.json`.
- **Validation**: Verify winning candidate ID is recorded.

### Notebook 07 — Best Own Model Specialization (`07_best_model_fine_tuning.ipynb`)
- **Action**: Run all cells sequentially.
- **Tasks**: Loads winning own architecture checkpoint, executes task-specific continued training & learning rate warmup-decay on `train.jsonl` with `validation.jsonl` monitoring, and exports specialized weights to `models/interview_model/`.
- **Validation**: Confirm `models/interview_model/checkpoint.pt` exists.

### Notebook 08 — Held-Out Test Evaluation & Promotion Gate (`08_fine_tuned_model_evaluation.ipynb`)
- **Action**: Run all cells sequentially.
- **Tasks**: **First authorized access to `test.jsonl`**. Evaluates Base Own Model vs Specialized Own Model side-by-side on held-out test data. Evaluates promotion gate criteria and exports `reports/fine_tuned_model_evaluation.json`.
- **Validation**: Confirm `promotion_status == "approved"`.

### Notebook 09 — Own Model Export & Registry (`09_model_export_and_registration.ipynb`)
- **Action**: Run all cells sequentially.
- **Tasks**: Packages semantic version `ai-interview-question-generator-v1.0.0`, registers model under `question_generator` in `models/model_registry.json`, activates in production, and verifies live offline inference.
- **Validation**: Confirm `registry.get_active_model("question_generator")` points to the new production model.

---

## 4. Colab Failure Recovery & Crash Protocols

### 4.1 Colab Disconnect / Runtime Restart Recovery
If Google Colab disconnects during training:
1. Re-open the notebook.
2. Select **Runtime** $\rightarrow$ **Change runtime type** $\rightarrow$ **T4 GPU**.
3. Run Cell 1 to mount Google Drive (`/content/drive`).
4. Re-run Cell 3 (training). The checkpoint engine automatically scans `checkpoints/candidate_X/`, verifies `checkpoint.pt`, restores optimizer/scheduler states, and continues training from the last saved epoch without starting over.

### 4.2 CUDA Out of Memory (OOM) Recovery
If CUDA OOM occurs:
1. Open `configs/training_config.json` or `configs/finetuning_config.json`.
2. Apply mitigations in this order:
   - Reduce `batch_size` (e.g. from 8 to 4 or 2).
   - Increase `gradient_accumulation_steps` (e.g. from 2 to 4 or 8) to maintain effective batch size.
   - Reduce `max_seq_len` (e.g. from 512 to 384 or 256).
   - Clear PyTorch GPU cache using `torch.cuda.empty_cache()`.
3. Re-run the cell — training resumes seamlessly from the latest saved checkpoint.

### 4.3 Test Lock Protection
If `TestDatasetLockedError` is raised in Notebooks 01–07:
- This is by design. The test dataset is strictly locked until Notebook 08 to prevent test data leakage and ensure scientific validity.
