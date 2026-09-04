import React from "react";

const LoadingSpinner = ({ mode = "codebert", message }) => {
  const engineName = ["llm", "groq"].includes(String(mode).toLowerCase())
    ? "LLM"
    : "CodeBERT";
  const loadingMessage = message || `Analyzing code with ${engineName}...`;

  return (
    <div className="loading-wrap">
      <div className="spinner" />
      <p>{loadingMessage}</p>
    </div>
  );
};

export default LoadingSpinner;
