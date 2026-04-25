import React, { useEffect, useState } from "react";
import ScanHistory from "../components/ScanHistory";
import { getHistoryApi, getStatsApi } from "../services/api";

const History = () => {
  const [scans, setScans] = useState([]);
  const [stats, setStats] = useState({ totalScans: 0, totalVulnerabilities: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");
        setNotice("");

        const [historyResult, statsResult] = await Promise.allSettled([getHistoryApi(), getStatsApi()]);

        const historyData =
          historyResult.status === "fulfilled" && Array.isArray(historyResult.value)
            ? historyResult.value
            : [];

        const statsData =
          statsResult.status === "fulfilled" && statsResult.value
            ? statsResult.value
            : { totalScans: 0, totalVulnerabilities: 0 };

        setScans(historyData);
        setStats(statsData);

        if (historyResult.status === "rejected" || statsResult.status === "rejected") {
          setNotice("History is temporarily unavailable. Showing cached/default view.");
        }
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load history.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <main className="page history-page container">
      <section className="history-head">
        <h1>Scan History</h1>
        <div className="stats-inline">
          <span>Total scans: {stats.totalScans}</span>
          <span>Total vulnerabilities: {stats.totalVulnerabilities}</span>
        </div>
      </section>

      {loading ? <div className="card">Loading history...</div> : null}
      {notice ? <div className="card">{notice}</div> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {!loading && !error ? <ScanHistory scans={scans} /> : null}
    </main>
  );
};

export default History;
