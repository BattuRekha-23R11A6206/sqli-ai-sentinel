# Vercel Frontend Update Instructions

## Environment Variables Update

1. Go to: https://vercel.com/batturekha-23r11a6206s-projects/sqli-ai-sentinel/settings/environment-variables
2. Update existing variable:
   - **Variable**: REACT_APP_API_URL
   - **Value**: https://sqli-sentinel-backend.onrender.com
3. Click "Save"
4. Trigger redeploy (automatic or manual)

## Full Stack Connection
Once backend is deployed, the full flow will be:
Frontend (Vercel) → Backend (Render) → ML Service (Render) → Hugging Face API
