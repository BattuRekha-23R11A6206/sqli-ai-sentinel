import json
import os
from typing import Dict

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

BASE_DIR = os.path.dirname(__file__)


def validate_model_directory(path: str) -> None:
    """Validate that path points to an existing fine-tuned sequence classification model.

    Checks:
    - Directory exists
    - config.json exists and is valid JSON
    - At least one supported non-empty weight file exists (model.safetensors or pytorch_model.bin)
    - Configuration represents a sequence classification model
    - The expected 2 labels for binary SQLi detection (safe=0, vulnerable=1) are present
    """
    if not path or not isinstance(path, str):
        raise ValueError("Model path must be a non-empty string.")

    if not os.path.isdir(path):
        raise FileNotFoundError(f"Model directory does not exist: {path}")

    config_file = os.path.join(path, "config.json")
    if not os.path.isfile(config_file):
        raise FileNotFoundError(f"Missing config.json in model directory: {path}")

    # Check for weight files
    weight_files = [
        os.path.join(path, "model.safetensors"),
        os.path.join(path, "pytorch_model.bin")
    ]
    has_weights = any(os.path.isfile(wf) and os.path.getsize(wf) > 0 for wf in weight_files)
    if not has_weights:
        raise FileNotFoundError(
            f"No valid weight file (model.safetensors or pytorch_model.bin) found in: {path}"
        )

    # Validate config structure
    try:
        with open(config_file, "r", encoding="utf-8") as f:
            config_data = json.load(f)
    except Exception as exc:
        raise ValueError(f"Failed to parse config.json in {path}: {exc}") from exc

    architectures = config_data.get("architectures", [])
    if not architectures or not any("ForSequenceClassification" in str(arch) for arch in architectures):
        raise ValueError(
            f"Model at '{path}' is not a sequence classification model. "
            f"Architectures found: {architectures}"
        )

    id2label = config_data.get("id2label")
    num_labels = config_data.get("num_labels")
    if id2label and isinstance(id2label, dict):
        effective_num_labels = len(id2label)
    elif num_labels is not None:
        try:
            effective_num_labels = int(num_labels)
        except (ValueError, TypeError):
            effective_num_labels = None
    else:
        # Default in Hugging Face Transformers PretrainedConfig for sequence classification
        effective_num_labels = 2

    if effective_num_labels != 2:
        raise ValueError(
            f"Model at '{path}' has {effective_num_labels} labels, but binary SQLi detection requires 2 labels."
        )


def has_model_artifacts(path: str) -> bool:
    """Return True if path points to a valid fine-tuned SQLi sequence classification model."""
    try:
        validate_model_directory(path)
        return True
    except Exception:
        return False


def resolve_model_path() -> str:
    """Resolve the directory path for the fine-tuned SQLi CodeBERT model.

    If MODEL_PATH is explicitly configured, it is validated strictly.
    If MODEL_PATH is not set, expected local candidate directories are searched.
    Never falls back to any base or untrained model.
    """
    configured = os.getenv("MODEL_PATH")
    if configured and configured.strip():
        configured_path = configured.strip()
        validate_model_directory(configured_path)
        return os.path.abspath(configured_path)

    candidates = [
        os.path.join(BASE_DIR, "model", "sqli_codebert_model"),
        os.path.join(BASE_DIR, "model"),
        os.path.join(BASE_DIR, "..", "backend", "models", "sqli_model_final"),
        os.path.join(BASE_DIR, "sqli_weightsfromcolab"),
        os.path.join(BASE_DIR, "..", "..", "sqli_weightsfromcolab"),
        os.path.join(BASE_DIR, "..", "sqli_weightsfromcolab"),
    ]

    for candidate in candidates:
        if candidate and os.path.isdir(candidate):
            try:
                validate_model_directory(candidate)
                return os.path.abspath(candidate)
            except Exception:
                continue

    raise FileNotFoundError(
        "Fine-tuned SQLi CodeBERT model not found in any expected location. "
        "Set MODEL_PATH to a valid fine-tuned model directory."
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
        print(f"Loading fine-tuned model from: {MODEL_PATH}")

        try:
            tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
        except Exception:
            tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, use_fast=False, local_files_only=True)

        model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH, local_files_only=True)
        model.eval()

        print("Fine-tuned SQLi CodeBERT Model Loaded Successfully")

    except Exception as e:
        model = None
        tokenizer = None
        MODEL_PATH = None
        raise RuntimeError(f"Failed to load fine-tuned model: {e}") from e


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
