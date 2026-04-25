const Scan = require("../models/Scan");
const mongoose = require("mongoose");

const isDbUnavailableError = (error) => {
  const message = `${error?.name || ""} ${error?.message || ""}`.toLowerCase();
  return (
    message.includes("server selection") ||
    message.includes("timed out") ||
    message.includes("topology") ||
    message.includes("handshake") ||
    message.includes("econn") ||
    message.includes("connection")
  );
};

const normalizeScanRecord = (scan) => {
  const vulnerabilities = Array.isArray(scan.vulnerabilities)
    ? scan.vulnerabilities.map((item) => {
        const fallbackLine = item.lineNumber || item.vulnerableLine || 0;
        const details = item.vulnerabilityDetails || {};
        return {
          ...item,
          lineNumber: fallbackLine,
          functionName: item.functionName || item.parentFunctionName || "anonymous",
          vulnerabilityDetails: {
            lineNumber: details.lineNumber || fallbackLine,
            vulnerableCode: details.vulnerableCode || "",
            snippet: details.snippet || item.code || "",
            snippetStartLine: details.snippetStartLine || item.snippetStartLine || item.functionStartLine || 0,
            snippetEndLine: details.snippetEndLine || item.snippetEndLine || item.functionEndLine || 0
          }
        };
      })
    : [];

  return {
    ...scan,
    vulnerabilities
  };
};

const getHistory = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn("History request served with empty data: MongoDB not connected.");
      return res.status(200).json([]);
    }

    const scans = await Scan.find().sort({ scanDate: -1 }).limit(50).lean();
    const normalized = scans.map(normalizeScanRecord);
    return res.status(200).json(normalized);
  } catch (error) {
    if (isDbUnavailableError(error)) {
      console.warn("History request fallback to empty array due to DB connectivity issue:", error.message);
      return res.status(200).json([]);
    }

    return next(new Error(`Failed to fetch scan history: ${error.message}`));
  }
};

const deleteHistoryItem = async (req, res, next) => {
  try {
    const deleted = await Scan.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "History item not found." });
    }

    return res.status(200).json({ message: "History item deleted successfully." });
  } catch (error) {
    return next(new Error(`Failed to delete history item: ${error.message}`));
  }
};

const getStats = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json({ totalScans: 0, totalVulnerabilities: 0 });
    }

    const stats = await Scan.aggregate([
      {
        $group: {
          _id: null,
          totalScans: { $sum: 1 },
          totalVulnerabilities: { $sum: "$vulnerableCount" }
        }
      }
    ]);

    const payload = stats[0] || { totalScans: 0, totalVulnerabilities: 0 };
    return res.status(200).json({
      totalScans: payload.totalScans,
      totalVulnerabilities: payload.totalVulnerabilities
    });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return res.status(200).json({ totalScans: 0, totalVulnerabilities: 0 });
    }

    return next(new Error(`Failed to fetch stats: ${error.message}`));
  }
};

module.exports = {
  getHistory,
  deleteHistoryItem,
  getStats
};
