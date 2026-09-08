const { getPrediction } = require("./src/services/mlService");

async function runVerification() {
  const vulnSnippet = "const query = 'SELECT * FROM accounts WHERE user_id = ' + req.body.id;";
  let passedCount = 0;

  console.log("===============================================================================");
  console.log("E2E NODE BACKEND RESILIENCE TEST: Real mlService.js against Live HF ZeroGPU");
  console.log("===============================================================================\n");

  // TEST 1: Normal Authenticated Call (Real Live ZeroGPU)
  console.log("👉 Running TEST 1: Normal Authenticated CodeBERT Space Call...");
  try {
    const res1 = await getPrediction(vulnSnippet, "codebert");
    console.log("Test 1 Result:", JSON.stringify(res1, null, 2));
    if (res1.engine !== "codebert-zerogpu") {
      throw new Error(`Expected engine 'codebert-zerogpu', got '${res1.engine}'`);
    }
    if (res1.fallback !== false) {
      throw new Error(`Expected fallback false, got ${res1.fallback}`);
    }
    if (res1.codebert_available !== true) {
      throw new Error(`Expected codebert_available true, got ${res1.codebert_available}`);
    }
    if (res1.is_vulnerable !== true) {
      throw new Error(`Expected is_vulnerable true for SQL injection snippet`);
    }
    console.log("✅ TEST 1 PASSED: CodeBERT ZeroGPU successfully classified snippet on live Space.\n");
    passedCount++;
  } catch (err) {
    console.error("❌ TEST 1 FAILED:", err);
  }

  // TEST 2: Quota Exceeded / ZeroGPU Error Failure Path
  console.log("👉 Running TEST 2: Failure Path A - Quota Exceeded / Error Simulation...");
  try {
    // Calling with token: "" forces an anonymous call to the ZeroGPU Space,
    // which triggers the real 'event: error\ndata: null' ZeroGPU limit.
    const res2 = await getPrediction(vulnSnippet, "codebert", { token: "" });
    console.log("Test 2 Result:", JSON.stringify(res2, null, 2));
    if (res2.engine !== "groq-fallback") {
      throw new Error(`Expected engine 'groq-fallback', got '${res2.engine}'`);
    }
    if (res2.fallback !== true) {
      throw new Error(`Expected fallback true, got ${res2.fallback}`);
    }
    if (res2.codebert_available !== false) {
      throw new Error(`Expected codebert_available false, got ${res2.codebert_available}`);
    }
    if (!res2.fallback_reason || !res2.fallback_reason.includes("quota")) {
      throw new Error(`Expected fallback_reason to mention quota/unavailable: ${res2.fallback_reason}`);
    }
    console.log("✅ TEST 2 PASSED: Quota error detected from live SSE stream; automatically routed to fallback.\n");
    passedCount++;
  } catch (err) {
    console.error("❌ TEST 2 FAILED:", err);
  }

  // TEST 3: Cold-Start Delay / Timeout Failure Path
  console.log("👉 Running TEST 3: Failure Path B - Cold-Start Timeout Simulation...");
  try {
    // Setting timeoutMs: 1 simulates container taking longer than the allowed timeout window
    const res3 = await getPrediction(vulnSnippet, "codebert", { timeoutMs: 1 });
    console.log("Test 3 Result:", JSON.stringify(res3, null, 2));
    if (res3.engine !== "groq-fallback") {
      throw new Error(`Expected engine 'groq-fallback', got '${res3.engine}'`);
    }
    if (res3.fallback !== true) {
      throw new Error(`Expected fallback true, got ${res3.fallback}`);
    }
    if (res3.codebert_available !== false) {
      throw new Error(`Expected codebert_available false, got ${res3.codebert_available}`);
    }
    if (!res3.fallback_reason || !res3.fallback_reason.toLowerCase().includes("timed out")) {
      throw new Error(`Expected fallback_reason to explicitly specify timeout: ${res3.fallback_reason}`);
    }
    console.log("✅ TEST 3 PASSED: Cold-start timeout detected; differentiated from quota and routed to fallback.\n");
    passedCount++;
  } catch (err) {
    console.error("❌ TEST 3 FAILED:", err);
  }

  // TEST 4: Direct Groq Mode
  console.log("👉 Running TEST 4: Direct Groq Mode...");
  try {
    const res4 = await getPrediction(vulnSnippet, "groq");
    console.log("Test 4 Result:", JSON.stringify(res4, null, 2));
    if (res4.engine !== "groq") {
      throw new Error(`Expected engine 'groq', got '${res4.engine}'`);
    }
    if (res4.fallback !== false) {
      throw new Error(`Expected fallback false for direct mode`);
    }
    console.log("✅ TEST 4 PASSED: Direct Groq mode operational.\n");
    passedCount++;
  } catch (err) {
    console.error("❌ TEST 4 FAILED:", err);
  }

  console.log(`===============================================================================`);
  console.log(`SUMMARY: ${passedCount}/4 TESTS PASSED!`);
  console.log(`===============================================================================`);

  if (passedCount !== 4) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
