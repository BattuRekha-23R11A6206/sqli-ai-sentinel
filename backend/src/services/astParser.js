const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

const parserOptions = {
  sourceType: "unambiguous",
  errorRecovery: true,
  plugins: [
    "jsx",
    "classProperties",
    "objectRestSpread",
    "optionalChaining",
    "nullishCoalescingOperator",
    "dynamicImport",
    "topLevelAwait"
  ]
};

const SQL_KEYWORDS_PATTERN = /\b(select|insert|update|delete|from|where|union|drop|alter|truncate)\b/i;

const getSourceLines = (sourceCode) => sourceCode.split(/\r?\n/);

const lineHasSqlKeyword = (line) => SQL_KEYWORDS_PATTERN.test(line || "");

const expressionHasInterpolation = (node) => {
  if (!node) {
    return false;
  }

  if (node.type === "TemplateLiteral") {
    return node.expressions.length > 0;
  }

  if (node.type === "BinaryExpression" && node.operator === "+") {
    return true;
  }

  return false;
};

const expressionHasSqlLiteral = (node) => {
  if (!node) {
    return false;
  }

  if (node.type === "StringLiteral") {
    return lineHasSqlKeyword(node.value);
  }

  if (node.type === "TemplateLiteral") {
    return node.quasis.some((quasi) => lineHasSqlKeyword(quasi.value?.cooked || ""));
  }

  if (node.type === "BinaryExpression") {
    return expressionHasSqlLiteral(node.left) || expressionHasSqlLiteral(node.right);
  }

  return false;
};

const isDynamicSqlExpression = (node) => expressionHasSqlLiteral(node) && expressionHasInterpolation(node);

const isDbQueryCall = (node) => {
  const callee = node?.callee;
  if (!callee || callee.type !== "MemberExpression") {
    return false;
  }

  const property = callee.property;
  return property?.type === "Identifier" && property.name === "query";
};

const getNearestNamedParentFunction = (path) => {
  const parentFunctionPath = path.findParent((p) => p.isFunction());
  if (!parentFunctionPath) {
    return null;
  }

  const parentName = getFunctionName(parentFunctionPath);
  return parentName && parentName !== "anonymous" ? parentName : null;
};

const isTopLevelFunctionSlice = (path) => !path.findParent((p) => p.isFunction());

const buildHighlightedSnippet = (sourceLines, targetLine, contextBefore = 2, contextAfter = 2) => {
  const snippetStartLine = Math.max(1, targetLine - contextBefore);
  const snippetEndLine = Math.min(sourceLines.length, targetLine + contextAfter);
  const snippetLines = sourceLines.slice(snippetStartLine - 1, snippetEndLine);

  return {
    snippetStartLine,
    snippetEndLine,
    codeSnippet: snippetLines.join("\n")
  };
};

const pathBelongsToFunction = (path, functionPath) => path.getFunctionParent() === functionPath;

const getResolvedAssignmentNode = (identifierName, callPath, functionPath) => {
  const binding = callPath.scope.getBinding(identifierName);
  if (!binding) {
    return null;
  }

  const candidates = [];

  if (binding.path?.isVariableDeclarator() && pathBelongsToFunction(binding.path, functionPath)) {
    candidates.push(binding.path.node.init);
  }

  for (const violation of binding.constantViolations || []) {
    if (!pathBelongsToFunction(violation, functionPath)) {
      continue;
    }

    if (violation.isAssignmentExpression() && violation.node.left?.type === "Identifier" && violation.node.left.name === identifierName) {
      candidates.push(violation.node.right);
    }
  }

  const validCandidate = candidates.find((candidate) => isDynamicSqlExpression(candidate));
  return validCandidate || null;
};

const findSqlConstructionLine = (functionPath, functionStartLine, sourceLines) => {
  let relativeVulnerableLine = 1;
  let absoluteVulnerableLine = functionStartLine;
  let vulnerableCode = "";
  let found = false;

  const recordLineFromNode = (node, sourceLines) => {
    const line = node?.loc?.start?.line;
    if (line) {
      absoluteVulnerableLine = line;
      relativeVulnerableLine = Math.max(1, line - functionStartLine + 1);
      vulnerableCode = sourceLines[line - 1] || "";
      found = true;
      return true;
    }

    return false;
  };

  functionPath.traverse({
    CallExpression(path) {
      if (!pathBelongsToFunction(path, functionPath) || !isDbQueryCall(path.node)) {
        return;
      }

      const firstArg = path.node.arguments?.[0];
      if (!firstArg) {
        return;
      }

      if (isDynamicSqlExpression(firstArg) && recordLineFromNode(firstArg, sourceLines)) {
        path.stop();
        return;
      }

      if (firstArg.type === "Identifier") {
        const resolvedNode = getResolvedAssignmentNode(firstArg.name, path, functionPath);
        if (resolvedNode && recordLineFromNode(resolvedNode, sourceLines)) {
          path.stop();
        }
      }
    }
  });

  return {
    relativeVulnerableLine,
    absoluteVulnerableLine,
    vulnerableCode,
    found
  };
};

const getFunctionName = (path) => {
  const { node, parent } = path;

  if (node.type === "FunctionDeclaration") {
    return node.id?.name || "anonymous";
  }

  if (node.type === "ObjectMethod") {
    if (node.key?.name) {
      return node.key.name;
    }
    if (node.key?.value) {
      return String(node.key.value);
    }
    return "anonymous";
  }

  if (parent?.type === "VariableDeclarator" && parent.id?.type === "Identifier") {
    return parent.id.name;
  }

  if (parent?.type === "AssignmentExpression") {
    if (parent.left?.type === "Identifier") {
      return parent.left.name;
    }
    if (parent.left?.type === "MemberExpression") {
      return generate(parent.left).code;
    }
  }

  if (parent?.type === "ObjectProperty") {
    if (parent.key?.name) {
      return parent.key.name;
    }
    if (parent.key?.value) {
      return String(parent.key.value);
    }
  }

  return "anonymous";
};

const extractFunctions = (sourceCode) => {
  try {
    const ast = parser.parse(sourceCode, parserOptions);
    const sourceLines = getSourceLines(sourceCode);
    const functions = [];

    const collectFunction = (path) => {
      if (!isTopLevelFunctionSlice(path)) {
        return;
      }

      const startLine = path.node.loc?.start?.line || 0;
      const endLine = path.node.loc?.end?.line || 0;
      const functionName = getFunctionName(path);
      const parentFunctionName = getNearestNamedParentFunction(path);
      const resolvedName = functionName === "anonymous"
        ? (parentFunctionName || `globalScope@${startLine}`)
        : functionName;
      const { relativeVulnerableLine, absoluteVulnerableLine, vulnerableCode, found } = findSqlConstructionLine(path, startLine, sourceLines);
      const { snippetStartLine, snippetEndLine, codeSnippet } = buildHighlightedSnippet(
        sourceLines,
        absoluteVulnerableLine
      );

      functions.push({
        name: resolvedName,
        parentFunctionName,
        startLine,
        endLine,
        relativeVulnerableLine,
        absoluteVulnerableLine,
        vulnerableCode: found ? vulnerableCode : (sourceLines[absoluteVulnerableLine - 1] || ""),
        snippetStartLine,
        snippetEndLine,
        codeSnippet,
        code: generate(path.node).code
      });
    };

    traverse(ast, {
      FunctionDeclaration: collectFunction,
      FunctionExpression: collectFunction,
      ArrowFunctionExpression: collectFunction,
      ObjectMethod: collectFunction
    });

    const deduped = new Map();
    for (const fn of functions) {
      const key = `${fn.name}:${fn.startLine}:${fn.endLine}`;
      if (!deduped.has(key)) {
        deduped.set(key, fn);
      }
    }

    return Array.from(deduped.values());
  } catch (error) {
    throw new Error(`Failed to parse JavaScript source: ${error.message}`);
  }
};

module.exports = {
  extractFunctions
};
