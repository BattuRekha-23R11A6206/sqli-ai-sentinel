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

  return (
    <article
      className={`vuln-card clickable ${item.isVulnerable ? "vulnerable" : "safe"}`}
      onClick={handleCardClick}
    >
      <div className="vuln-head">
        <h4>{displayName}</h4>
        <span className={`badge ${item.isVulnerable ? "danger" : "success"}`}>
          {item.isVulnerable ? "SQL Injection Detected" : "Safe"}
        </span>
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

      {item.suggestion ? <p className="meta">Fix: {item.suggestion}</p> : null}
    </article>
  );
};

export default VulnCard;
