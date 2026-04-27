from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import requests
import os
from typing import Dict, Any


class PredictRequest(BaseModel):
    code: str = Field(..., min_length=1)


app = FastAPI(title="SQLi Sentinel ML Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://sqli-ai-sentinel.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hugging Face Inference API Configuration
HF_API_URL = "https://api-inference.huggingface.co/models/BattuRekha/sqli-codebert-sentinel"
HF_API_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN")  # Optional: for higher rate limits
api_ready = True


@app.on_event("startup")
def startup_event() -> None:
    global api_ready
    print("ML Service startup complete. Using Hugging Face Inference API")


@app.get("/")
def read_root():
    return FileResponse("index.html")


@app.get("/health")
def health_check():
    return {
        "status": "ok" if api_ready else "degraded",
        "api_ready": api_ready,
        "model_endpoint": HF_API_URL,
        "inference_type": "huggingface_api"
    }


def call_huggingface_api(code: str) -> Dict[str, Any]:
    """Call Hugging Face Inference API for SQL injection detection"""
    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"} if HF_API_TOKEN else {}
    
    payload = {
        "inputs": code,
        "parameters": {
            "return_all_scores": True,
            "function_to_apply": "softmax"
        }
    }
    
    try:
        response = requests.post(HF_API_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        
        # Extract scores from the API response
        if isinstance(result, list) and len(result) > 0 and isinstance(result[0], list):
            scores = result[0]
            # Find vulnerable and safe scores
            vulnerable_score = next((item['score'] for item in scores if item['label'] == 'LABEL_1'), 0.0)
            safe_score = next((item['score'] for item in scores if item['label'] == 'LABEL_0'), 0.0)
            
            is_vulnerable = vulnerable_score > safe_score
            confidence = max(vulnerable_score, safe_score)
            
            return {
                "label": 1 if is_vulnerable else 0,
                "is_vulnerable": is_vulnerable,
                "confidence": round(float(confidence), 6),
                "vulnerability_probability": round(float(vulnerable_score), 6),
                "safe_probability": round(float(safe_score), 6)
            }
        else:
            raise ValueError("Unexpected API response format")
            
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"API request failed: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"Prediction failed: {str(e)}")


@app.post("/predict")
def predict_vulnerability(payload: PredictRequest):
    if not api_ready:
        raise HTTPException(status_code=503, detail="API is not ready.")

    try:
        return call_huggingface_api(payload.code)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
