# Sinhala-fine-tuned Whisper

End-to-end pipeline for transcribing Sinhala interview audio in this project.

> **What this gives you today (no GPU required):**
> An immediate upgrade for Sinhala — `whisper-large-v3` instead of `base`,
> plus VAD + denoising + Sinhala text normalization. A finetune slot is
> reserved; drop a checkpoint in and it takes over automatically.
>
> **What you need a GPU for:**
> The LoRA fine-tune itself (Common Voice + FLEURS, ~1–3 hours on Colab T4).

---

## 1. How the runtime picks a model

```
Sinhala request → registry.pick_sinhala_model()
                      │
                      ├── WHISPER_SI_MODEL env var?      → use it
                      ├── WHISPER_FT_DIR exists?         → use the fine-tuned checkpoint
                      └── else                           → use openai/whisper-large-v3
```

The chosen model is reported back to the BFF and the UI shows a badge
("**Fine-tuned · Sinhala Whisper**" or "Whisper baseline · large-v3").

---

## 2. Quick test (no fine-tune yet)

```bash
cd ml-service
pip install -r requirements.txt
python -c "from whisper_si import transcribe; \
print(transcribe('temp.mp3', language='si').to_dict())"
```

You should see `backend: 'hf-base'`, `finetuned: false`, and the post-processed
Sinhala text.

---

## 3. Fine-tune your own checkpoint

### 3.1 GPU box (Colab T4 / Kaggle / workstation)

```bash
# 1. install training deps
pip install -r requirements.txt -r requirements-train.txt

# 2. prepare data — Common Voice + FLEURS Sinhala
export HF_TOKEN=...
python -m whisper_si.training.prepare_dataset \
  --out ./data/whisper-si \
  --sources cv fleurs \
  --max-seconds 30

# 3. LoRA fine-tune on Whisper-small
python -m whisper_si.training.train_lora \
  --data ./data/whisper-si \
  --base openai/whisper-small \
  --out  ./models/whisper-si-finetuned \
  --epochs 5 --batch 8 --lr 1e-4
```

When the script finishes you'll have:
- `./models/whisper-si-finetuned/`         — merged checkpoint (ready to serve)
- `./models/whisper-si-finetuned/adapter/` — LoRA adapter only (~15 MB)

### 3.2 Deploy the fine-tuned model

Copy `./models/whisper-si-finetuned/` to the ML host. The runtime auto-detects
it — no env var, no code change.

If you want to override explicitly:
```bash
export WHISPER_FT_DIR=/abs/path/to/whisper-si-finetuned
# or point at a HuggingFace id you've pushed:
export WHISPER_SI_MODEL=your-hf-user/whisper-si-finetuned
```

Restart the ML service. The first transcription call loads the model
(~10 s on CPU, ~2 s on GPU); subsequent calls are warm.

---

## 4. Measure the improvement

The whole point of fine-tuning is provable WER reduction. The eval harness
runs any list of models against the same held-out split.

```bash
python -m whisper_si.training.evaluate \
  --data ./data/whisper-si \
  --split test \
  --max-samples 300 \
  --models \
      openai/whisper-base \
      openai/whisper-large-v3 \
      ./models/whisper-si-finetuned \
  --report ./eval-report.csv
```

You get a CSV like this — drop straight into your thesis chapter:

| model                                | samples | WER   | CER   | seconds | rtf   |
| ------------------------------------ | ------- | ----- | ----- | ------- | ----- |
| openai/whisper-base                  | 300     | 0.642 | 0.341 |  88.4   | 0.295 |
| openai/whisper-large-v3              | 300     | 0.292 | 0.139 | 412.1   | 1.374 |
| ./models/whisper-si-finetuned        | 300     | 0.178 | 0.082 | 405.7   | 1.352 |

(Numbers shown are illustrative; report real ones in your thesis.)

---

## 5. What the post-processor fixes

`postprocess.clean_sinhala()` is **conservative** — it never invents tokens,
only normalises:

| Issue                                          | Fix                                |
| ---------------------------------------------- | ---------------------------------- |
| Mixed NFC / NFD codepoints                     | `unicodedata.normalize('NFC')`     |
| Whisper's silent-input word-loop hallucination | Collapse 3+ exact-word repetitions |
| Stray ZWJ / ZWNJ between non-Sinhala chars     | Strip them                         |
| `text ,word` / `text,word`                     | Standard `text, word`              |
| `෴` dandaa spacing                             | Standard spacing                   |
| Double whitespace                              | Single space                       |

---

## 6. Files

```
whisper_si/
├── __init__.py
├── config.py                # env-driven knobs
├── preprocess.py            # resample → trim → VAD → denoise → normalize
├── postprocess.py           # Sinhala text cleanup
├── registry.py              # picks the right model
├── transcriber.py           # public transcribe() — drop-in for the Flask route
├── training/
│   ├── prepare_dataset.py   # Common Voice + FLEURS → HF disk dataset
│   ├── train_lora.py        # LoRA fine-tune Whisper-small
│   └── evaluate.py          # WER / CER harness, CSV out
└── README.md                # ← you are here
```

---

## 7. Troubleshooting

**ImportError: transformers** during Sinhala request →
You skipped `pip install -r requirements.txt`. The service auto-falls back
to `openai-whisper large-v3`, just slower.

**CUDA out of memory** during training →
Drop `--batch 8 → --batch 4`, raise `--grad-accum 2 → 4`. Or switch
`--base openai/whisper-small → openai/whisper-tiny`.

**Fine-tuned model loads but WER is worse** →
Training data was too small or too noisy. Re-run `prepare_dataset.py` with
`--max-seconds 20` (Whisper context window) and verify Common Voice
validation passed.

**Live transcript is empty in the UI** →
Check `GET /api/v1/audio/whisper/info` — if `info` is null, the ML service
isn't reachable from the BFF. Check `ML_SERVICE_URL`.
