import React from "react";
import VulnCard from "./VulnCard";

const ScanResults = ({ result }) => {
  if (!result) {
    return (
      <div className="empty-state">
        <div className="empty-illustration">{`</>`}</div>
        <h3>Upload a JavaScript file to scan for vulnerabilities</h3>
      </div>
    );
  }

  const vulnerableItems = result.vulnerabilities.filter((item) => item.isVulnerable);

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.filename || "scan-report"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="results-wrap">
      <div className="results-summary">
        <h3>
          Found {result.vulnerableCount} vulnerabilities in {result.totalFunctions} functions
        </h3>
        <button className="btn secondary" onClick={handleDownload}>
          Download Report
        </button>
      </div>

      <div className="result-metrics">
        <span>File: {result.filename}</span>
        <span>Scanned: {result.totalFunctions}</span>
        <span>Duration: {result.scanDuration} ms</span>
      </div>

      {vulnerableItems.length === 0 ? (
        <div className="success-banner">No vulnerabilities detected - code looks safe!</div>
      ) : (
        vulnerableItems.map((item, index) => <VulnCard key={`${item.functionName}-${index}`} item={item} />)
      )}
    </section>
  );
};

export default ScanResults;
