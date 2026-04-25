import React, { useState } from "react";

const ScanHistory = ({ scans = [] }) => {
  const [expandedRow, setExpandedRow] = useState(null);

  const renderSnippetLines = (item) => {
    const details = item.vulnerabilityDetails || {};
    const snippet = details.snippet || item.code || "";
    const snippetStart = Number(details.snippetStartLine || item.snippetStartLine || item.functionStartLine || item.lineNumber || 1);
    const vulnerableLine = Number(details.lineNumber || item.lineNumber || 0);

    const lines = snippet.split("\n");
    return (
      <div className="code-with-lines">
        {lines.map((line, index) => {
          const absoluteLine = snippetStart + index;
          const isVulnLine = vulnerableLine > 0 && absoluteLine === vulnerableLine;
          return (
            <div key={`${absoluteLine}-${index}`} className={`code-line ${isVulnLine ? "highlight-vulnerable crime-line" : ""}`}>
              <span className="line-number">{absoluteLine}</span>
              <code>{line || " "}</code>
            </div>
          );
        })}
      </div>
    );
  };

  if (!scans.length) {
    return (
      <div className="empty-state compact">
        <div className="empty-illustration">[]</div>
        <h3>No scans found yet. Start scanning to see your history!</h3>
      </div>
    );
  }

  return (
    <div className="history-table-wrap">
      <table className="history-table">
        <thead>
          <tr>
            <th>Filename</th>
            <th>Date</th>
            <th>Functions</th>
            <th>Vulnerabilities</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((scan) => {
            const isExpanded = expandedRow === scan._id;
            return (
              <React.Fragment key={scan._id}>
                <tr onClick={() => setExpandedRow(isExpanded ? null : scan._id)}>
                  <td>{scan.filename}</td>
                  <td>{new Date(scan.scanDate).toLocaleString()}</td>
                  <td>{scan.totalFunctions}</td>
                  <td>{scan.vulnerableCount}</td>
                  <td>
                    <span className={`badge ${scan.status === "vulnerable" ? "danger" : "success"}`}>
                      {scan.status}
                    </span>
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="expanded-row">
                    <td colSpan={5}>
                      <div className="expanded-content">
                        {(Array.isArray(scan.vulnerabilities) ? scan.vulnerabilities : []).map((item, idx) => (
                          <div key={`${item.functionName}-${idx}`} className="history-item">
                            <strong>{item.functionName === "anonymous" ? (item.parentFunctionName || "globalScope") : item.functionName}</strong> (Line {item.vulnerabilityDetails?.lineNumber || item.lineNumber || "-"}) - {Math.round((item.confidence || 0) * 100)}%
                            {renderSnippetLines(item)}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ScanHistory;
