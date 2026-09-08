import React, { useRef } from "react";

const VulnCard = ({ item }) => {
  const crimeLineRef = useRef(null);
  const confidencePercent = Math.round((item.confidence || 0) * 100);
  const displayName = item.functionName === "anonymous"
    ? (item.parentFunctionName || "globalScope")
    : item.functionName;
  const details = item.vulnerabilityDetails || {};
  const lineNumber = details.lineNumber || item.lineNumber;
  const snippetStartLine = details.snippetStartLine || item.snippetStartLine || Math.max(1, lineNumber - 2);
  const snippet = details.snippet || item.code || "";
  const vulnerableCode = details.vulnerableCode || "";
  const codeLines = snippet.split(/\r?\n/);

  const handleCardClick = () => {
    if (crimeLineRef.current) {
      crimeLineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const renderEngineBadge = () => {
    if (item.fallback || item.engine === "groq-fallback") {
      return (
        <span
          className="badge"
          style={{
            marginRight: "6px",
            fontSize: "0.72rem",
            background: "rgba(234, 179, 8, 0.15)",
            color: "#facc15",
            border: "1px solid rgba(234, 179, 8, 0.3)"
          }}
          title={item.fallback_reason || "CodeBERT ZeroGPU unavailable; automatically fell back to Groq"}
        >
          ⚡ Groq Fallback
        </span>
      );
    }
    if (item.engine === "codebert-zerogpu" || item.model === "codebert") {
      return (
        <span
          className="badge"
          style={{
            marginRight: "6px",
            fontSize: "0.72rem",
            background: "rgba(59, 130, 246, 0.15)",
            color: "#60a5fa",
            border: "1px solid rgba(59, 130, 246, 0.3)"
          }}
          title="Analyzed using fine-tuned CodeBERT on Hugging Face ZeroGPU"
        >
          🛡️ CodeBERT (ZeroGPU)
        </span>
      );
    }
    return (
      <span
        className="badge"
        style={{
          marginRight: "6px",
          fontSize: "0.72rem",
          background: "rgba(168, 85, 247, 0.15)",
          color: "#c084fc",
          border: "1px solid rgba(168, 85, 247, 0.3)"
        }}
        title="Analyzed using Groq LLM"
      >
        🧠 Groq LLM
      </span>
    );
  };

  return (
    <article
      className={`vuln-card clickable ${item.isVulnerable ? "vulnerable" : "safe"}`}
      onClick={handleCardClick}
    >
      <div className="vuln-head">
        <h4>{displayName}</h4>
        <div>
          {renderEngineBadge()}
          <span className={`badge ${item.isVulnerable ? "danger" : "success"}`}>
            {item.isVulnerable ? "SQL Injection Detected" : "Safe"}
          </span>
        </div>
      </div>
      <p className="meta">Line {lineNumber} in source file</p>

      <div className="confidence-wrap">
        <div className="confidence-meta">
          <span>Confidence</span>
          <strong>{confidencePercent}%</strong>
        </div>
        <div className="confidence-bar">
          <span style={{ width: `${confidencePercent}%` }} />
        </div>
      </div>

      <div className="code-with-lines">
        {codeLines.map((line, index) => {
          const absoluteLine = snippetStartLine + index;
          const isTarget = absoluteLine === lineNumber;
          return (
            <div
              key={`${absoluteLine}-${index}`}
              className={`code-line ${isTarget ? "highlight-vulnerable crime-line" : ""}`}
              ref={isTarget ? crimeLineRef : null}
            >
              <span className="line-number">{absoluteLine}</span>
              <code>{line || " "}</code>
            </div>
          );
        })}
      </div>

      {vulnerableCode ? <p className="meta">Vulnerable code: {vulnerableCode.trim()}</p> : null}

      {item.reasoning ? (
        <p className="meta" style={{ marginTop: "8px", color: "#818cf8", fontWeight: "500" }}>
          💡 <strong>AI Analysis:</strong> {item.reasoning}
        </p>
      ) : null}

      {item.suggestion ? <p className="meta">Fix: {item.suggestion}</p> : null}
    </article>
  );
};

export default VulnCard;
