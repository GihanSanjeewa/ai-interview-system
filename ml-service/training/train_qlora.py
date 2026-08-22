"""
Local QLoRA Fine-Tuning Pipeline for Software Engineering Interview Assistant
Fine-tunes open-weights base models (Llama 3 / Mistral / Phi-3) using QLoRA.
"""

import os
import json
import argparse

def train():
    parser = argparse.ArgumentParser(description="QLoRA Fine-Tuning Script")
    parser.add_argument("--base_model", type=str, default="meta-llama/Meta-Llama-3-8B", help="Base model path or HuggingFace ID")
    parser.add_argument("--dataset", type=str, default="../dataset/training/train.json", help="Path to JSON dataset")
    parser.add_argument("--output_dir", type=str, default="../models/interview_llm", help="Directory to save fine-tuned weights")
    parser.add_argument("--epochs", type=int, default=3, help="Training epoch count")
    parser.add_argument("--batch_size", type=int, default=4, help="Batch size per GPU")
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

        # LoRA Adapter Hyperparameters
        peft_config = LoraConfig(
            r=16,
            lora_alpha=32,
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM"
        )

        print("Successfully initialized 4-bit QLoRA configuration.")
        print("To launch training, populate dataset and run HuggingFace TRL SFTTrainer.")

    except ImportError as exc:
        print(f"Dependencies notice: {exc}")
        print("Required packages: pip install torch transformers peft bitsandbytes trl datasets")

if __name__ == "__main__":
    train()
