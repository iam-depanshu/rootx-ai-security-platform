"""
RootX Fine-Tuning Script
=========================
Fine-tunes an open-source LLM on cybersecurity data using LoRA (QLoRA).
Designed to run on AMD MI300X GPU via AMD Developer Cloud.

Usage:
    python finetune.py --model meta-llama/Llama-3.1-8B-Instruct --epochs 3
    python finetune.py --model mistralai/Mistral-7B-Instruct-v0.3 --epochs 5
    python finetune.py --model codellama/CodeLlama-13b-Instruct-hf --epochs 3

Requirements:
    pip install torch transformers peft trl datasets bitsandbytes accelerate
"""

import argparse
import json
import os
from pathlib import Path

# ─── Parse Arguments ───
parser = argparse.ArgumentParser(description="RootX LLM Fine-Tuning")
parser.add_argument("--model", type=str, default="meta-llama/Llama-3.1-8B-Instruct",
                    help="Base model to fine-tune")
parser.add_argument("--train_file", type=str, default="../output/train.jsonl",
                    help="Training data file")
parser.add_argument("--val_file", type=str, default="../output/val.jsonl",
                    help="Validation data file")
parser.add_argument("--output_dir", type=str, default="../output/rootx-security-llm",
                    help="Output directory for the fine-tuned model")
parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
parser.add_argument("--batch_size", type=int, default=4, help="Per-device batch size")
parser.add_argument("--lr", type=float, default=2e-4, help="Learning rate")
parser.add_argument("--max_seq_length", type=int, default=4096, help="Maximum sequence length")
parser.add_argument("--lora_r", type=int, default=16, help="LoRA rank")
parser.add_argument("--lora_alpha", type=int, default=32, help="LoRA alpha")
parser.add_argument("--use_4bit", action="store_true", default=True, help="Use 4-bit quantization (QLoRA)")
parser.add_argument("--dry_run", action="store_true", help="Check setup without training")
args = parser.parse_args()

print("=" * 60)
print("  ROOTX FINE-TUNING PIPELINE")
print("=" * 60)
print(f"  Model:      {args.model}")
print(f"  Train data: {args.train_file}")
print(f"  Epochs:     {args.epochs}")
print(f"  Batch size: {args.batch_size}")
print(f"  LoRA rank:  {args.lora_r}")
print(f"  4-bit:      {args.use_4bit}")
print(f"  Output:     {args.output_dir}")
print("=" * 60)

# ─── Check Training Data ───
train_path = Path(args.train_file)
val_path = Path(args.val_file)

if not train_path.exists():
    print(f"\n[ERROR] Training data not found: {train_path}")
    print("   Run this first: node ../scripts/merge_dataset.js")
    exit(1)

# Count entries
train_count = sum(1 for _ in open(train_path))
val_count = sum(1 for _ in open(val_path)) if val_path.exists() else 0
print(f"\n[INFO] Training samples: {train_count}")
print(f"[INFO] Validation samples: {val_count}")

if args.dry_run:
    print("\n[SUCCESS] Dry run complete. Everything looks good!")
    print("   Remove --dry_run to start training.")
    exit(0)

# ─── Import ML Libraries ───
print("\n[INFO] Loading libraries...")
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer, SFTConfig

# ─── Check GPU ───
if torch.cuda.is_available():
    gpu_name = torch.cuda.get_device_name(0)
    gpu_mem = torch.cuda.get_device_properties(0).total_mem / 1e9
    print(f"[GPU] GPU: {gpu_name} ({gpu_mem:.1f} GB)")
elif hasattr(torch, "hip") and torch.hip.is_available():
    # AMD ROCm
    gpu_name = torch.cuda.get_device_name(0)
    gpu_mem = torch.cuda.get_device_properties(0).total_mem / 1e9
    print(f"[GPU] AMD GPU: {gpu_name} ({gpu_mem:.1f} GB)")
else:
    print("[WARNING] No GPU detected. Training will be very slow on CPU.")
    print("   Use AMD Developer Cloud for GPU access.")

# ─── Load Dataset ───
print("\n[INFO] Loading dataset...")
dataset = load_dataset("json", data_files={
    "train": str(train_path),
    "validation": str(val_path) if val_path.exists() else str(train_path),
})
print(f"   Train: {len(dataset['train'])} samples")
print(f"   Val:   {len(dataset['validation'])} samples")

# ─── Quantization Config (QLoRA) ───
bnb_config = None
if args.use_4bit:
    print("\n[INFO] Setting up 4-bit quantization (QLoRA)...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

# ─── Load Model & Tokenizer ───
print(f"\n[INFO] Loading model: {args.model}")
print("   (This may take a few minutes for large models...)")

tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

model = AutoModelForCausalLM.from_pretrained(
    args.model,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
    torch_dtype=torch.bfloat16,
)

if args.use_4bit:
    model = prepare_model_for_kbit_training(model)

# ─── LoRA Config ───
print("\n[INFO] Applying LoRA adapters...")
lora_config = LoraConfig(
    r=args.lora_r,
    lora_alpha=args.lora_alpha,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, lora_config)
trainable, total = model.get_nb_trainable_parameters()
print(f"   Trainable params: {trainable:,} / {total:,} ({100 * trainable / total:.2f}%)")

# ─── Format Function ───
def format_chat(example):
    """Convert chat messages to the model's chat template."""
    messages = example.get("messages", [])
    if not messages:
        return {"text": ""}
    try:
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
        return {"text": text}
    except Exception:
        # Fallback: manual formatting
        parts = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            parts.append(f"<|{role}|>\n{content}")
        return {"text": "\n".join(parts)}

# Apply formatting
print("\n[INFO] Formatting dataset...")
dataset = dataset.map(format_chat, remove_columns=dataset["train"].column_names)

# ─── Training Config ───
print("\n[INFO] Starting fine-tuning...")
print(f"   This will take approximately {args.epochs * train_count / args.batch_size / 60:.0f} minutes")

training_args = SFTConfig(
    output_dir=args.output_dir,
    num_train_epochs=args.epochs,
    per_device_train_batch_size=args.batch_size,
    per_device_eval_batch_size=args.batch_size,
    gradient_accumulation_steps=4,
    learning_rate=args.lr,
    weight_decay=0.01,
    warmup_ratio=0.03,
    lr_scheduler_type="cosine",
    logging_steps=10,
    eval_strategy="steps",
    eval_steps=50,
    save_strategy="steps",
    save_steps=100,
    save_total_limit=3,
    max_seq_length=args.max_seq_length,
    dataset_text_field="text",
    bf16=True,
    optim="paged_adamw_32bit",
    report_to="none",
    seed=42,
)

# ─── Trainer ───
trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    processing_class=tokenizer,
)

# ─── Train! ───
trainer.train()

# ─── Save ───
print(f"\n[INFO] Saving model to {args.output_dir}...")
trainer.save_model(args.output_dir)
tokenizer.save_pretrained(args.output_dir)

# Save a config file for vLLM deployment
config = {
    "model_name": "rootx-security-llm",
    "base_model": args.model,
    "fine_tuned_on": "RootX Cybersecurity Dataset",
    "training_samples": train_count,
    "epochs": args.epochs,
    "lora_r": args.lora_r,
    "description": "RootX Security LLM — Unrestricted cybersecurity AI agent",
}
with open(os.path.join(args.output_dir, "rootx_config.json"), "w") as f:
    json.dump(config, f, indent=2)

print("\n" + "=" * 60)
print("  [SUCCESS] FINE-TUNING COMPLETE!")
print("=" * 60)
print(f"\n  Model saved to: {args.output_dir}")
print(f"\n  To deploy with vLLM:")
print(f"    vllm serve {args.output_dir} --host 0.0.0.0 --port 8000")
print(f"\n  Then set in backend/.env:")
print(f"    LLM_API_URL=http://localhost:8000/v1")
print(f"    LLM_MODEL=rootx-security-llm")
print("=" * 60)
