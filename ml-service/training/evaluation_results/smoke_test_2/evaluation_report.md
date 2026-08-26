# Evaluation Report — smoke_test_2

Every number in this report was computed by the run described below, from the model's own generated predictions and the dataset's reference texts. Metrics that could not be computed are shown as `n/a`, never substituted.

## Evaluation Summary

```
Model:              base model (no adapter)
Base Model:         hf-internal-testing/tiny-random-LlamaForCausalLM
LoRA Adapter:       none

Dataset:            C:\Users\gihan\Documents\ai-interview-system\ml-service\dataset\processed\question_generator\test.jsonl
Split:              test
Task:               both
Samples:            2 evaluated

Device:             cpu  (CPU — generation is orders of magnitude slower than GPU)
Quantisation:       none (fp32 on CPU)

BLEU (corpus):              0.0000
BLEU (sentence mean):       0.0065
ROUGE-1:                    0.0000
ROUGE-2:                    0.0000
ROUGE-L:                    0.0000
BERTScore Precision:        0.6431
BERTScore Recall:           0.6417
BERTScore F1:               0.6412
Exact match:                0.0000
Perplexity (teacher-forced):32233.2107
```

## Run configuration

| Field | Value |
| --- | --- |
| Evaluated at (UTC) | 2026-08-26T06:13:26+00:00 |
| Seed | 42 |
| Device | cpu |
| Model parameters | 1,032,272 (0.001 B) |
| Model dtype | torch.float32 |
| Quantisation | none (fp32 on CPU) |
| Prompt style | chat (system prompt: yes) |
| Tokenizer | hf-internal-testing/tiny-random-LlamaForCausalLM (base model) |
| Dataset file | `C:\Users\gihan\Documents\ai-interview-system\ml-service\dataset\processed\question_generator\test.jsonl` |
| Dataset records read | 880 |
| Evaluation pairs built | 1487 |
| Pairs evaluated | 2 |
| Sub-sampling | 2 of 1487 pairs, task-stratified, seed 42 |
| Generation | greedy, max_new_tokens=24 |
| Stop strings | ['\nUser:', '\n\nUser:', 'User:\n', '\nSystem:'] |
| Max input tokens | 256 |
| Wall clock | 395.7 s |
| Git commit | `a2c331b` |

### Generation parameters

| Parameter | Value |
| --- | --- |
| do_sample | False |
| max_new_tokens | 24 |
| temperature | n/a (not applied) |
| top_p | n/a (not applied) |
| num_beams | 1 |
| repetition_penalty | 1.0 |

### Metric implementations

BLEU, ROUGE and BERTScore are only comparable across studies when the implementation is stated, so the exact backend used is recorded here.

| Metric | Backend | Details |
| --- | --- | --- |
| bleu | builtin | builtin corpus BLEU-4, 13a-style tokenisation |
| rouge | rouge_score | google-research rouge_score, use_stemmer=True, F-measure |
| bertscore | bert_score | bert_score 0.3.12, model=distilbert-base-uncased, layer=5, rescale_with_baseline=False |

## Results

### Overall

| Metric | Value |
| --- | --- |
| BLEU (corpus) | 0.0000 |
| BLEU (sentence mean) | 0.0065 |
| ROUGE-1 | 0.0000 |
| ROUGE-2 | 0.0000 |
| ROUGE-L | 0.0000 |
| BERTScore Precision | 0.6431 |
| BERTScore Recall | 0.6417 |
| BERTScore F1 | 0.6412 |
| Exact match | 0.0000 |
| Perplexity (teacher-forced) | 32233.2107 |
| Samples | 2 |

### Answer Generation Evaluation

| Metric | Value |
| --- | --- |
| BLEU (corpus) | 0.0000 |
| BLEU (sentence mean) | 0.0000 |
| ROUGE-1 | 0.0000 |
| ROUGE-2 | 0.0000 |
| ROUGE-L | 0.0000 |
| BERTScore Precision | 0.6791 |
| BERTScore Recall | 0.6208 |
| BERTScore F1 | 0.6486 |
| Exact match | 0.0000 |
| Perplexity (teacher-forced) | 32239.1125 |
| Samples | 1 |

### Question Generation Evaluation

| Metric | Value |
| --- | --- |
| BLEU (corpus) | 0.0000 |
| BLEU (sentence mean) | 0.0130 |
| ROUGE-1 | 0.0000 |
| ROUGE-2 | 0.0000 |
| ROUGE-L | 0.0000 |
| BERTScore Precision | 0.6071 |
| BERTScore Recall | 0.6627 |
| BERTScore F1 | 0.6337 |
| Exact match | 0.0000 |
| Perplexity (teacher-forced) | 32167.7082 |
| Samples | 1 |

## Breakdowns

Computed only over fields the dataset actually carries. Groups with few samples are noisy; the `n` column is there to be read alongside the score.

### By domain

| Group | n | BLEU (corpus) | ROUGE-1 | ROUGE-2 | ROUGE-L | BERTScore F1 | PPL |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Data Structures | 1 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.6337 | 32167.71 |
| Frontend Development | 1 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.6486 | 32239.11 |

### By difficulty

| Group | n | BLEU (corpus) | ROUGE-1 | ROUGE-2 | ROUGE-L | BERTScore F1 | PPL |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Beginner | 1 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.6486 | 32239.11 |
| Intermediate | 1 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.6337 | 32167.71 |

### By source dataset

| Group | n | BLEU (corpus) | ROUGE-1 | ROUGE-2 | ROUGE-L | BERTScore F1 | PPL |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| common-pile/stackexchange | 2 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.6412 | 32233.21 |

## Failures and exclusions

None. Every selected example produced a prediction and was scored.

## Reproducibility

```
seed               42
base_model         hf-internal-testing/tiny-random-LlamaForCausalLM
adapter            none
dataset            C:\Users\gihan\Documents\ai-interview-system\ml-service\dataset\processed\question_generator\test.jsonl
split              test
task               both
generation         greedy, max_new_tokens=24
device             cpu
timestamp (UTC)    2026-08-26T06:13:26+00:00
```

Library versions:

| Package | Version |
| --- | --- |
| python | 3.14.5 |
| platform | Windows-11-10.0.26200-SP0 |
| torch | 2.13.0+cpu |
| transformers | 5.15.1 |
| datasets | 5.0.1 |
| peft | 0.20.0 |
| trl | 1.10.0 |
| bitsandbytes | not installed |
| accelerate | 1.14.0 |
| huggingface_hub | 1.28.0 |

Re-run this exact evaluation with:

```bash
python evaluate_model.py --base_model hf-internal-testing/tiny-random-LlamaForCausalLM --split test --max_samples 2 --max_new_tokens 24 --max_input_tokens 256 --bertscore_model distilbert-base-uncased --bertscore_layer 5 --output_dir training/evaluation_results --run_name smoke_test_2
```

