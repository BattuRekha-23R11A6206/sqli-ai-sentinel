import React, { useState } from "react";
import FileUpload from "../components/FileUpload";
import ScanResults from "../components/ScanResults";
import LoadingSpinner from "../components/LoadingSpinner";
import { scanCodeApi, scanFileApi } from "../services/api";

const Scanner = () => {
  const [activeTab, setActiveTab] = useState("file");
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

        const data = await scanFileApi(selectedFile);
        setScanResult(data);
        return;
      }

      if (!codeInput.trim()) {
        throw new Error("Please paste JavaScript code before scanning.");
      }

      const data = await scanCodeApi(codeInput);
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

          <button className="btn primary full" onClick={handleScan} disabled={loading}>
            {loading ? "Scanning..." : "Run Scan"}
          </button>

          {error ? <p className="error-text">{error}</p> : null}
        </div>

        <div className="scanner-panel right">
          {loading ? <LoadingSpinner /> : <ScanResults result={scanResult} />}
        </div>
      </section>
    </main>
  );
};

export default Scanner;
