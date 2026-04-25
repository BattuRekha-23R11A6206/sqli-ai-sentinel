from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import predict as predictor


class PredictRequest(BaseModel):
    code: str = Field(..., min_length=1)


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


@app.on_event("startup")
def startup_event() -> None:
    global model_ready
    try:
        predictor.load_model()
        model_ready = True
        print("ML Service startup complete. Model Loaded Successfully")
    except Exception as exc:
        model_ready = False
        print(f"ML Service startup failed: {exc}")
        raise RuntimeError(f"Failed to load model at startup: {exc}") from exc


@app.get("/")
def read_root():
    return FileResponse("index.html")


@app.get("/health")
def health_check():
    return {
        "status": "ok" if model_ready else "degraded",
        "model_loaded": model_ready,
        "model_path": predictor.MODEL_PATH
    }


@app.post("/predict")
def predict_vulnerability(payload: PredictRequest):
    if not model_ready:
        raise HTTPException(status_code=503, detail="Model is not loaded.")

    try:
        return predictor.predict(payload.code)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
