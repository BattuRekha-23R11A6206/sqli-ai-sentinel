const axios = require("axios");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getPrediction = async (code) => {
  const baseUrl = process.env.ML_SERVICE_URL;
  const timeoutMs = Number(process.env.ML_SERVICE_TIMEOUT_MS || 10000);
  if (!baseUrl) {
    throw new Error("ML_SERVICE_URL is not configured.");
  }

  const endpoint = `${baseUrl}/predict`;
  const maxRetries = 3;

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await axios.post(
        endpoint,
        { code },
        {
          timeout: timeoutMs,
          headers: { "Content-Type": "application/json" }
        }
      );

      return response.data;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await sleep(1000);
      }
    }
  }

  throw new Error(
    `ML service failed after ${maxRetries} retries: ${lastError?.message || "Unknown error"}`
  );
};

module.exports = {
  getPrediction
};
