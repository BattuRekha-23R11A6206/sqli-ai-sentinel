const fs = require("fs/promises");
const path = require("path");
const Scan = require("../models/Scan");
const { extractFunctions } = require("../services/astParser");
const { getPrediction } = require("../services/mlService");

const analyzeFunctions = async (functions) => {
  const results = [];
  const seen = new Set();

  for (const fn of functions) {
    const prediction = await getPrediction(fn.code);
    const mappedLine = fn.absoluteVulnerableLine || fn.startLine;
    const normalizedName = fn.name === "anonymous"
      ? (fn.parentFunctionName || `globalScope@${fn.startLine}`)
      : fn.name;
    const dedupeKey = `${normalizedName}:${fn.startLine}:${fn.endLine}`;

    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    results.push({
      functionName: normalizedName,
      parentFunctionName: fn.parentFunctionName || null,
      lineNumber: mappedLine,
      functionStartLine: fn.startLine,
      functionEndLine: fn.endLine,
      vulnerableLine: fn.relativeVulnerableLine || 1,
      snippetStartLine: fn.snippetStartLine || fn.startLine,
      snippetEndLine: fn.snippetEndLine || fn.endLine,
      confidence: Number(prediction.confidence || 0),
      isVulnerable: Boolean(prediction.is_vulnerable),
      code: fn.codeSnippet || fn.code,
      vulnerabilityDetails: {
        lineNumber: mappedLine,
        vulnerableCode: fn.vulnerableCode || "",
        snippet: fn.codeSnippet || fn.code,
        snippetStartLine: fn.snippetStartLine || fn.startLine,
        snippetEndLine: fn.snippetEndLine || fn.endLine
      },
      suggestion: Boolean(prediction.is_vulnerable)
        ? "Use parameterized queries/prepared statements and never concatenate user input into SQL strings."
        : null
    });
  }

  return results;
};

const persistScan = async ({ filename, fileSize, totalFunctions, vulnerabilities, scanDuration }) => {
  const vulnerableCount = vulnerabilities.filter((item) => item.isVulnerable).length;

  const scan = await Scan.create({
    filename,
    fileSize,
    totalFunctions,
    vulnerableCount,
    vulnerabilities,
    scanDuration,
    status: vulnerableCount > 0 ? "vulnerable" : "clean"
  });

  return scan;
};

const scanFile = async (req, res, next) => {
  let uploadedPath;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    uploadedPath = req.file.path;
    const startTime = Date.now();
    const sourceCode = await fs.readFile(uploadedPath, "utf-8");
    const functions = extractFunctions(sourceCode);
    const vulnerabilities = await analyzeFunctions(functions);
    const scanDuration = Date.now() - startTime;

    const scan = await persistScan({
      filename: req.file.originalname,
      fileSize: req.file.size,
      totalFunctions: functions.length,
      vulnerabilities,
      scanDuration
    });

    return res.status(200).json(scan);
  } catch (error) {
    return next(new Error(`File scan failed: ${error.message}`));
  } finally {
    if (uploadedPath) {
      try {
        await fs.unlink(uploadedPath);
      } catch (cleanupError) {
        console.warn("Failed to delete uploaded file:", cleanupError.message);
      }
    }
  }
};

const scanCode = async (req, res, next) => {
  try {
    const { code, filename } = req.body;

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return res.status(400).json({ message: "Code is required for scanning." });
    }

    const startTime = Date.now();
    const functions = extractFunctions(code);
    const vulnerabilities = await analyzeFunctions(functions);
    const scanDuration = Date.now() - startTime;

    const scan = await persistScan({
      filename: filename || "pasted-code.js",
      fileSize: Buffer.byteLength(code, "utf-8"),
      totalFunctions: functions.length,
      vulnerabilities,
      scanDuration
    });

    return res.status(200).json(scan);
  } catch (error) {
    return next(new Error(`Code scan failed: ${error.message}`));
  }
};

const getScanById = async (req, res, next) => {
  try {
    const scan = await Scan.findById(req.params.id);
    if (!scan) {
      return res.status(404).json({ message: "Scan result not found." });
    }

    return res.status(200).json(scan);
  } catch (error) {
    return next(new Error(`Failed to fetch scan: ${error.message}`));
  }
};

module.exports = {
  scanFile,
  scanCode,
  getScanById
};
