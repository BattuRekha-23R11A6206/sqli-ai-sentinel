const fs = require("fs");
const path = require("path");

// Read HF token from environment or local cache (for seamless local development)
const getHfToken = () => {
  if (process.env.HF_TOKEN && process.env.HF_TOKEN.trim()) {
    return process.env.HF_TOKEN.trim();
  }
  try {
    const tokenPath = path.join(process.env.USERPROFILE || process.env.HOME || "", ".cache", "huggingface", "token");
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, "utf8").trim();
    }
  } catch {
    // Ignore cache read errors
  }
  return "";
};

const GROQ_SYSTEM_PROMPT =
  "You are a senior application security engineer reviewing JavaScript code for SQL injection. " +
  "Classify the provided snippet as either vulnerable (label=1) or safe (label=0). " +
  "Respond ONLY with strict JSON: {\"label\": 0 or 1, \"confidence\": float 0 to 1, \"reasoning\": \"short explanation <= 30 words\"}.";

/**
 * Call the remote Gradio 5 ZeroGPU Space via its SSE streaming protocol.
 * Inspects both HTTP status codes and the SSE stream for completion or errors.
 */
const callGradioSpace = async (code, options = {}) => {
  const spaceUrl = options.spaceUrl || process.env.HF_SPACE_URL || "https://batturekha-sqli-sentinel-codebert.hf.space";
  const token = options.token !== undefined ? options.token : getHfToken();
  const timeoutMs = options.timeoutMs || Number(process.env.HF_SPACE_TIMEOUT_MS || 150000);

  const callUrl = `${spaceUrl.replace(/\/+$/, "")}/gradio_api/call/predict`;
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // 1. Initiate job via POST
  const postRes = await fetch(callUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ data: [code] }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!postRes.ok) {
    throw new Error(`Gradio POST /predict failed (${postRes.status} ${postRes.statusText})`);
  }

  const postData = await postRes.json();
  const eventId = postData?.event_id;
  if (!eventId) {
    throw new Error(`Gradio POST returned invalid payload (missing event_id): ${JSON.stringify(postData)}`);
  }

  // 2. Stream event result via GET SSE
  const getUrl = `${callUrl}/${eventId}`;
  const getRes = await fetch(getUrl, {
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!getRes.ok) {
    throw new Error(`Gradio GET stream failed (${getRes.status} ${getRes.statusText})`);
  }

  const streamText = await getRes.text();
  let eventType = null;
  let eventData = null;

  for (const line of streamText.split("\n")) {
    if (line.startsWith("event:")) {
      eventType = line.replace("event:", "").trim();
    } else if (line.startsWith("data:")) {
      const raw = line.replace("data:", "").trim();
      try {
        eventData = JSON.parse(raw);
      } catch {
        eventData = raw;
      }
    }
  }

  if (eventType === "error") {
    // ZeroGPU quota exhausted, container runtime error, or supervisor termination
    throw new Error(`ZeroGPU execution error / runs quota limit reached (event: error, data: ${JSON.stringify(eventData)})`);
  }

  if (eventType === "complete" && Array.isArray(eventData) && eventData[0]) {
    return eventData[0];
  }

  throw new Error(`Unexpected Gradio response format (event: ${eventType}, data: ${JSON.stringify(eventData)})`);
};

/**
 * Call Groq API directly using Llama 3.3 70B for fast, robust LLM-based SQLi detection.
 */
const callGroq = async (code, options = {}) => {
  const apiKey = options.groqApiKey || process.env.GROQ_API_KEY || "";
  const model = options.groqModel || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  if (!apiKey) {
    // If no Groq API key is configured, check if a local ML service is running as a fallback
    if (process.env.ML_SERVICE_URL) {
      try {
        const localRes = await fetch(`${process.env.ML_SERVICE_URL.replace(/\/+$/, "")}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, mode: "groq" }),
          signal: AbortSignal.timeout(10000)
        });
        if (localRes.ok) {
          return await localRes.json();
        }
      } catch {
        // Local service unavailable
      }
    }

    console.warn("[mlService] GROQ_API_KEY not configured; providing heuristic safety fallback analysis.");
    const isVulnerable = /req\.(body|query|params)/.test(code) && /(select|insert|update|delete|where)/i.test(code);
    return {
      label: isVulnerable ? 1 : 0,
      is_vulnerable: isVulnerable,
      confidence: 0.90,
      vulnerability_probability: isVulnerable ? 0.90 : 0.10,
      safe_probability: isVulnerable ? 0.10 : 0.90,
      reasoning: isVulnerable
        ? "Dynamic user input concatenated into database query (analyzed via heuristic fallback)."
        : "No unparameterized SQL concatenation identified (analyzed via heuristic fallback)."
    };
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: GROQ_SYSTEM_PROMPT },
        { role: "user", content: code.slice(0, 8000) }
      ]
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API returned error ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  const rawContent = json?.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    const start = rawContent.indexOf("{");
    const end = rawContent.lastIndexOf("}");
    if (start !== -1 && end > start) {
      parsed = JSON.parse(rawContent.slice(start, end + 1));
    } else {
      throw new Error(`Groq returned invalid JSON: ${rawContent}`);
    }
  }

  const label = Number(parsed.label) === 1 ? 1 : 0;
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5)));
  const isVulnerable = label === 1;

  return {
    label,
    is_vulnerable: isVulnerable,
    confidence: Number(confidence.toFixed(6)),
    vulnerability_probability: Number((isVulnerable ? confidence : 1 - confidence).toFixed(6)),
    safe_probability: Number((isVulnerable ? 1 - confidence : confidence).toFixed(6)),
    reasoning: parsed.reasoning || ""
  };
};

/**
 * Main prediction entrypoint.
 *
 * Implements resilient two-tier architecture:
 * 1. CodeBERT Mode: Primary target is the Hugging Face ZeroGPU Space.
 *    - Cold starts are accommodated by a 150s+ timeout window.
 *    - If quota is exceeded, container fails, or cold start exceeds timeout,
 *      it catches the error and automatically falls back to Groq LLM without breaking the scan.
 * 2. LLM / Groq Mode: Targets Groq Llama 3.3 directly.
 */
const getPrediction = async (code, mode = "codebert", options = {}) => {
  const isCodeBert = (mode || "").toLowerCase() === "codebert";
  const timestamp = new Date().toISOString();

  if (isCodeBert) {
    try {
      const pred = await callGradioSpace(code, options);
      return {
        ...pred,
        model: "codebert",
        engine: "codebert-zerogpu",
        codebert_available: true,
        fallback: false,
        timestamp
      };
    } catch (err) {
      const isTimeout =
        err.name === "TimeoutError" ||
        err.name === "AbortError" ||
        (err.message && err.message.toLowerCase().includes("timeout"));

      const fallbackReason = isTimeout
        ? "CodeBERT ZeroGPU container cold-start timed out (>150s)"
        : `CodeBERT ZeroGPU unavailable / quota exhausted (${err.message})`;

      console.warn(`[mlService] ZeroGPU primary failed: ${err.message}. Gracefully falling back to Groq LLM...`);

      const fallbackPred = await callGroq(code, options);
      return {
        ...fallbackPred,
        model: "groq-fallback",
        engine: "groq-fallback",
        codebert_available: false,
        fallback: true,
        fallback_reason: fallbackReason,
        reasoning: fallbackPred.reasoning
          ? `[Fallback] ${fallbackPred.reasoning}`
          : "ZeroGPU unavailable; analyzed via Groq LLM.",
        timestamp
      };
    }
  }

  // Direct Groq / LLM mode
  const directPred = await callGroq(code, options);
  return {
    ...directPred,
    model: "groq",
    engine: "groq",
    codebert_available: true,
    fallback: false,
    timestamp
  };
};

module.exports = {
  getPrediction,
  callGradioSpace,
  callGroq
};
