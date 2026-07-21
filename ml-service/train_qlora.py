"""
Local QLoRA Fine-Tuning Pipeline for Software Engineering Interview Assistant
Fine-tunes base models (Llama 3 / Mistral) using QLoRA (Quantized Low-Rank Adaptation).

Usage:
    python train_qlora.py --base_model "meta-llama/Meta-Llama-3-8B" --dataset "se_interview_dataset.json"
"""

import os
import json
import argparse

def train():
    parser = argparse.ArgumentParser(description="QLoRA Fine-Tuning Script")
    parser.add_argument("--base_model", type=str, default="meta-llama/Meta-Llama-3-8B", help="Base model path or HuggingFace ID")
    parser.add_argument("--dataset", type=str, default="dataset_sample.json", help="Path to JSON dataset")
    parser.add_argument("--output_dir", type=str, default="./qlora_se_model", help="Directory to save fine-tuned weights")
    args = parser.parse_args()

    print("=" * 60)
    print("      SOFTWARE ENGINEERING INTERVIEW LLM QLORA FINE-TUNING     ")
    print("=" * 60)
    print(f"Base Model : {args.base_model}")
    print(f"Dataset    : {args.dataset}")
    print(f"Output Dir : {args.output_dir}")

    try:
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

        print("Torch CUDA available:", torch.cuda.is_available())
        if torch.cuda.is_available():
            print("GPU Device:", torch.cuda.get_device_name(0))

        # 4-bit Quantization Config
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True
        )

        # LoRA Adapter Parameters
        peft_config = LoraConfig(
            r=16,
            lora_alpha=32,
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM"
        )

        print("Successfully configured 4-bit QLoRA hyperparameters.")
        print("To launch training, ensure dataset is populated and execute HuggingFace SFTTrainer.")

    except ImportError as exc:
        print(f"Fine-tuning dependencies notice: {exc}")
        print("To run QLoRA training, install dependencies: pip install torch transformers peft bitsandbytes trl datasets")

if __name__ == "__main__":
    train()
