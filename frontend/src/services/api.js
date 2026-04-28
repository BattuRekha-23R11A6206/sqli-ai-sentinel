import axios from "axios";

const rawApiUrl = process.env.REACT_APP_API_URL || "";
const API_URL = rawApiUrl.replace(/\/+$/, "").replace(/\/api$/, "");

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json"
  }
});

export const scanFileApi = async (file) => {
  const code = await file.text();
  const response = await api.post("/predict", { code });
  return response.data;
};

export const scanCodeApi = async (code, filename = "pasted-code.js") => {
  const response = await api.post("/predict", { code });
  return response.data;
};

export const getScanByIdApi = async (id) => {
  const response = await api.get(`/scan/${id}`);
  return response.data;
};

export const getHistoryApi = async () => {
  const response = await api.get("/history");
  return response.data;
};

export const deleteHistoryApi = async (id) => {
  const response = await api.delete(`/history/${id}`);
  return response.data;
};

export const getStatsApi = async () => {
  const response = await api.get("/history/stats");
  return response.data;
};
