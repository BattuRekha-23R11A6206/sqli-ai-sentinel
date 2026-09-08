import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  timeout: 160000,
  headers: {
    "Content-Type": "application/json"
  }
});

export const scanFileApi = async (file, mode = "codebert") => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);

  const response = await api.post("/scan/file", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return response.data;
};

export const scanCodeApi = async (code, filename = "pasted-code.js", mode = "codebert") => {
  const response = await api.post("/scan/code", { code, filename, mode });
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
