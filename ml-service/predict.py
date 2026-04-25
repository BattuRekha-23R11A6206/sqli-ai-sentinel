import os
from typing import Dict

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

BASE_DIR = os.path.dirname(__file__)


def has_model_artifacts(path: str) -> bool:
    if not path or not os.path.isdir(path):
        return False

    config_file = os.path.join(path, "config.json")
    weight_files = [
        os.path.join(path, "pytorch_model.bin"),
        os.path.join(path, "model.safetensors")
    ]

    has_config = os.path.isfile(config_file)
    has_weights = any(os.path.isfile(weight_file) for weight_file in weight_files)
    return has_config and has_weights


def resolve_model_path() -> str:
    # check env first, then fall back to common locations
    configured = os.getenv("MODEL_PATH")
    candidates = [
        configured,
        os.path.join(BASE_DIR, "model", "sqli_codebert_model"),
        os.path.join(BASE_DIR, "model"),
        os.path.join(BASE_DIR, "..", "backend", "models", "sqli_model_final")
    ]

    for path in candidates:
        if has_model_artifacts(path):
            return os.path.abspath(path)

    searched = [path for path in candidates if path]
    raise FileNotFoundError(
        "No valid model directory found. Set MODEL_PATH or place the model in one of: "
        + ", ".join(searched)
    )

model = None
tokenizer = None
MODEL_PATH = None


def load_model() -> None:
    global model, tokenizer, MODEL_PATH

    if model is not None and tokenizer is not None:
        return

    try:
        MODEL_PATH = resolve_model_path()
        print(f"Loading model from: {MODEL_PATH}")

        try:
            tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
        except Exception:
            tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, use_fast=False)

        model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
        model.eval()

        print("Model Loaded Successfully")

    except Exception as e:
        raise RuntimeError(f"Failed to load model: {e}") from e


def predict(code_snippet: str) -> Dict[str, float]:
    if model is None or tokenizer is None:
        raise RuntimeError("Model is not loaded. Call load_model() first.")

    if not isinstance(code_snippet, str) or not code_snippet.strip():
        raise ValueError("Code snippet must be a non-empty string.")

    try:
        inputs = tokenizer(
            code_snippet,
            truncation=True,
            padding=True,
            max_length=256,
            return_tensors="pt"
        )

        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
        
        probabilities = torch.softmax(logits, dim=-1)
        
        vuln_probability = probabilities[0][1].item()
        safe_probability = probabilities[0][0].item()
        
        is_vulnerable = vuln_probability > 0.5
        confidence = max(vuln_probability, safe_probability)
        
        return {
            "label": 1 if is_vulnerable else 0,
            "is_vulnerable": is_vulnerable,
            "confidence": round(float(confidence), 6),
            "vulnerability_probability": round(float(vuln_probability), 6),
            "safe_probability": round(float(safe_probability), 6)
        }

    except Exception as e:
        raise RuntimeError(f"Prediction failed: {e}") from e
