# SQLi Sentinel

Full-stack SAST tool for detecting SQL Injection in JavaScript using CodeBERT.

## Structure

- `frontend/` - React UI
- `backend/` - Node/Express API + MongoDB
- `ml-service/` - Python FastAPI + fine-tuned CodeBERT

## Setup

### Backend

```bash
cd backend
npm install
```

Create `.env`:
```env
PORT=5000
MONGODB_URI=your_atlas_uri
ML_SERVICE_URL=http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
```

Create `.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

### ML Service

```bash
cd ml-service
pip install -r requirements.txt
```

## Running

Three terminals:

```bash
cd ml-service && python main.py
cd backend && npm start
cd frontend && npm start
```

## API

- `POST /api/scan/file` - Upload .js file
- `POST /api/scan/code` - Paste code
- `GET /api/scan/:id` - Get result
- `GET /api/history` - List scans
- `GET /api/history/stats` - Stats
- `DELETE /api/history/:id` - Delete scan
