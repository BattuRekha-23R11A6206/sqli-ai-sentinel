const mongoose = require("mongoose");

const vulnerabilitySchema = new mongoose.Schema(
  {
    functionName: { type: String, required: true },
    parentFunctionName: { type: String, default: null },
    lineNumber: { type: Number, required: true },
    functionStartLine: { type: Number, default: 0 },
    functionEndLine: { type: Number, default: 0 },
    vulnerableLine: { type: Number, default: 1 },
    snippetStartLine: { type: Number, default: 0 },
    snippetEndLine: { type: Number, default: 0 },
    confidence: { type: Number, required: true },
    isVulnerable: { type: Boolean, required: true },
    code: { type: String, required: true },
    vulnerabilityDetails: {
      lineNumber: { type: Number, default: 0 },
      vulnerableCode: { type: String, default: "" },
      snippet: { type: String, default: "" },
      snippetStartLine: { type: Number, default: 0 },
      snippetEndLine: { type: Number, default: 0 }
    },
    suggestion: { type: String, default: null }
  },
  { _id: false }
);

const scanSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  fileSize: { type: Number, required: true, default: 0 },
  totalFunctions: { type: Number, required: true, default: 0 },
  vulnerableCount: { type: Number, required: true, default: 0 },
  vulnerabilities: { type: [vulnerabilitySchema], default: [] },
  scanDuration: { type: Number, required: true, default: 0 },
  scanDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["clean", "vulnerable"],
    required: true,
    default: "clean"
  }
});

module.exports = mongoose.model("Scan", scanSchema);
