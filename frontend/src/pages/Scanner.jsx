import React, { useState } from "react";
import FileUpload from "../components/FileUpload";
import ScanResults from "../components/ScanResults";
import LoadingSpinner from "../components/LoadingSpinner";
import { scanCodeApi, scanFileApi } from "../services/api";

const Scanner = () => {
  const [activeTab, setActiveTab] = useState("file");
  const [mode, setMode] = useState("codebert"); // "codebert" or "llm"
  const [selectedFile, setSelectedFile] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelect = (file, fileError) => {
    setError(fileError || "");
    setSelectedFile(file);
  };

  const handleScan = async () => {
    setError("");
    setLoading(true);
    setScanResult(null);

    try {
      if (activeTab === "file") {
        if (!selectedFile) {
          throw new Error("Please choose a .js file before scanning.");
        }

        const data = await scanFileApi(selectedFile, mode);
        setScanResult(data);
        return;
      }

      if (!codeInput.trim()) {
        throw new Error("Please paste JavaScript code before scanning.");
      }

      const data = await scanCodeApi(codeInput, "pasted-code.js", mode);
      setScanResult(data);
    } catch (scanError) {
      setError(scanError?.response?.data?.message || scanError.message || "Scan failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page scanner-page container">
      <section className="scanner-layout">
        <div className="scanner-panel left">
          <div className="tab-group">
            <button
              className={activeTab === "file" ? "tab active" : "tab"}
              onClick={() => setActiveTab("file")}
            >
              Upload File
            </button>
            <button
              className={activeTab === "code" ? "tab active" : "tab"}
              onClick={() => setActiveTab("code")}
            >
              Paste Code
            </button>
          </div>

          <div style={{ margin: "14px 0", padding: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "0.9rem" }}>
              🔍 Detection Engine:
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className={`btn ${mode === "codebert" ? "primary" : "secondary"}`}
                style={{ flex: 1, padding: "8px", fontSize: "0.85rem" }}
                onClick={() => setMode("codebert")}
              >
                🤖 CodeBERT Mode
              </button>
              <button
                type="button"
                className={`btn ${mode === "llm" ? "primary" : "secondary"}`}
                style={{ flex: 1, padding: "8px", fontSize: "0.85rem" }}
                onClick={() => setMode("llm")}
              >
                🧠 LLM Mode (Groq)
              </button>
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: "0.75rem", opacity: 0.75 }}>
              {mode === "codebert"
                ? "Fast local CodeBERT transformer model for code classification."
                : "Deep LLM reasoning (Llama 3.3 70B via Groq) to prevent overfitting."}
            </p>
          </div>

          {activeTab === "file" ? (
            <FileUpload onFileSelect={handleFileSelect} selectedFile={selectedFile} />
          ) : (
            <textarea
              className="code-input"
              placeholder="Paste your JavaScript source code here..."
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value)}
            />
          )}

          <button className="btn primary full" onClick={handleScan} disabled={loading} style={{ marginTop: "12px" }}>
            {loading ? "Scanning..." : `Run Scan (${mode === "codebert" ? "CodeBERT" : "LLM"})`}
          </button>

          {error ? <p className="error-text">{error}</p> : null}
        </div>

        <div className="scanner-panel right">
          {loading ? (
            <LoadingSpinner
              mode={mode}
              message={`Analyzing code with ${mode === "llm" ? "LLM" : "CodeBERT"}...`}
            />
          ) : <ScanResults result={scanResult} />}
        </div>
      </section>
    </main>
  );
};

export default Scanner;
