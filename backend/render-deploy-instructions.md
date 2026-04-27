# Backend Deployment Instructions

## Render Web Service Setup

1. Go to Render Dashboard → "New +" → "Web Service"
2. Select: sqli-ai-sentinel repo
3. Configure:
   - **Name**: sqli-sentinel-backend
   - **Root Directory**: backend
   - **Runtime**: Node
   - **Build Command**: npm install
   - **Start Command**: npm start
   - **Instance Type**: Free

4. **Environment Variables** (CRITICAL):
   ```
   ML_SERVICE_URL=https://sqli-ai-sentinel-ml.onrender.com
   MONGODB_URI=mongodb+srv://batturekha513_db_user:Rekha93900@cluster0.ttm5f2n.mongodb.net/sqli_sentinel?retryWrites=true&w=majority
   PORT=5000
   ```

5. Click "Deploy Web Service"
