import os
import json
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import predict as predictor

# Load environment variables from .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
groq_ready = bool(GROQ_API_KEY)


class PredictRequest(BaseModel):
    code: str = Field(..., min_length=1)
    mode: str = Field(default="codebert")  # "codebert" or "llm" / "groq"


app = FastAPI(title="SQLi Sentinel ML Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_ready = False

GROQ_SYSTEM_PROMPT = (
    "You are a senior application security engineer reviewing JavaScript code for SQL injection. "
    "Classify the provided snippet as either vulnerable (label=1) or safe (label=0). "
    "Consider string concatenation/interpolation into queries, dynamic table/column names from user input, "
    "and missing parameterization. Do not penalize parameterized queries, ORMs with safe bindings, or "
    "constants used inside queries. Respond ONLY with a strict JSON object matching this schema:\n"
    '{"label": 0 or 1, "confidence": float between 0 and 1, "reasoning": "short explanation <= 30 words"}.\n'
    "No prose, no markdown, no code fences."
)


def call_groq_api(code: str) -> dict:
    """Call Groq API (Llama-3.3-70b) for LLM-based SQLi detection."""
    if not groq_ready:
        raise RuntimeError("GROQ_API_KEY is not configured on the ML service.")

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": GROQ_MODEL,
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": GROQ_SYSTEM_PROMPT},
            {"role": "user", "content": code[:8000]}
        ]
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"Groq request failed: {exc}") from exc

    data = response.json()
    try:
        message_content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Groq response missing content: {data}") from exc

    try:
        parsed = json.loads(message_content)
    except json.JSONDecodeError:
        start = message_content.find("{")
        end = message_content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise RuntimeError(f"Groq returned non-JSON: {message_content[:200]}")
        parsed = json.loads(message_content[start:end + 1])

    label = int(parsed.get("label", 0))
    label = 1 if label == 1 else 0
    try:
        confidence = float(parsed.get("confidence", 0.5))
    except (TypeError, ValueError):
        confidence = 0.5
    confidence = max(0.0, min(1.0, confidence))

    is_vulnerable = (label == 1)
    vuln_prob = confidence if is_vulnerable else (1.0 - confidence)
    safe_prob = 1.0 - vuln_prob

    return {
        "label": label,
        "is_vulnerable": is_vulnerable,
        "confidence": round(confidence, 6),
        "vulnerability_probability": round(vuln_prob, 6),
        "safe_probability": round(safe_prob, 6),
        "model": f"groq-{GROQ_MODEL}",
        "reasoning": str(parsed.get("reasoning", ""))[:300]
    }


@app.on_event("startup")
def startup_event() -> None:
    global model_ready
    try:
        predictor.load_model()
        model_ready = True
        print("ML Service startup complete. Fine-tuned CodeBERT Loaded Successfully.")
        print(f"Groq LLM mode status: {'Ready (' + GROQ_MODEL + ')' if groq_ready else 'Disabled (no key)'}")
    except Exception as exc:
        model_ready = False
        print(f"Fine-tuned SQLi CodeBERT model not found; CodeBERT mode disabled. Reason: {exc}")
        if not groq_ready:
            raise RuntimeError(f"Failed to load fine-tuned model and Groq not available: {exc}") from exc


@app.get("/")
def read_root():
    return FileResponse("index.html")


@app.get("/health")
def health_check():
    return {
        "status": "ok" if (model_ready or groq_ready) else "degraded",
        "codebert_loaded": model_ready,
        "groq_ready": groq_ready,
        "groq_model": GROQ_MODEL,
        "available_modes": ["codebert", "llm"] if (model_ready and groq_ready) else (["codebert"] if model_ready else ["llm"])
    }


@app.post("/predict")
def predict_vulnerability(payload: PredictRequest):
    req_mode = (payload.mode or "codebert").lower().strip()

    # Route to Groq / LLM
    if req_mode in ["groq", "llm"]:
        if not groq_ready:
            raise HTTPException(status_code=503, detail="Groq LLM is not configured.")
        try:
            return call_groq_api(payload.code)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"LLM Prediction failed: {exc}") from exc

    # Default route: CodeBERT
    if not model_ready:
        raise HTTPException(status_code=503, detail="CodeBERT model is not loaded.")

    try:
        result = predictor.predict(payload.code)
        result["model"] = "codebert"
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"CodeBERT Prediction failed: {exc}") from exc


@app.post("/predict-groq")
def predict_vulnerability_groq(payload: PredictRequest):
    return predict_vulnerability(PredictRequest(code=payload.code, mode="groq"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
