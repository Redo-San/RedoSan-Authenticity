const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");

const PORT = 9873;
const BASE = `http://localhost:${PORT}`;

let browser, server;

before(async () => {
  server = await startServer(PORT);
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  stopServer();
});

function navTo(page, id) {
  return page.goto(`${BASE}/Style/pages/${id}/index.html`);
}

describe("E2E — DID Sign & Verify", () => {
  it("should navigate to DID page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "did");
    await page.waitForTimeout(1000);
    assert.equal(
      errors.filter(
        (e) =>
          !e.includes("404") &&
          !e.includes("Failed to load") &&
          !e.includes("valid digest"),
      ).length,
      0,
      `Unexpected page errors: ${errors.join(", ")}`,
    );
    await ctx.close();
  });

  it("should have key form elements for sign flow", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "did");
    await page.waitForTimeout(1000);

    const hasFpFile = await page.evaluate(
      () => !!document.getElementById("did-fp-file"),
    );
    const hasAlgoSelect = await page.evaluate(
      () => !!document.getElementById("did-algo-select"),
    );
    const hasGenBtn = await page.evaluate(
      () => !!document.getElementById("did-gen-btn"),
    );
    const hasSignBtn = await page.evaluate(
      () => !!document.getElementById("did-sign-btn"),
    );
    const hasStatusText = await page.evaluate(
      () => !!document.getElementById("did-status-text"),
    );

    assert.ok(hasFpFile, "Fingerprint file input should exist");
    assert.ok(hasAlgoSelect, "Algorithm selector should exist");
    assert.ok(hasGenBtn, "Generate button should exist");
    assert.ok(hasSignBtn, "Sign button should exist");
    assert.ok(hasStatusText, "Status text element should exist");

    await ctx.close();
  });

  it("should generate Ed25519 identity", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "did");
    await page.waitForTimeout(1000);

    // Verify initial state: status says no identity
    const initialStatus = await page.evaluate(() => {
      const el = document.getElementById("did-status-text");
      return el ? el.textContent : "";
    });
    assert.ok(
      initialStatus.length > 0,
      "Status text should have initial content",
    );

    // Upload a fingerprint JSON file
    const fpJson = JSON.stringify({
      file_info: { file_name: "test.png" },
      hashes: { "SHA-256": "abc123def456" },
    });
    await page.setInputFiles("#did-fp-file", [
      { name: "fp.json", mimeType: "application/json", buffer: Buffer.from(fpJson) },
    ]);
    await page.waitForTimeout(500);

    // Select Ed25519
    await page.evaluate(() => {
      const sel = document.getElementById("did-algo-select");
      if (sel) sel.value = "Ed25519";
    });
    await page.waitForTimeout(300);

    // Click generate
    await page.evaluate(() => document.getElementById("did-gen-btn").click());

    // Wait for key generation
    await page.waitForTimeout(3000);

    // Check DID value
    const didValue = await page.evaluate(() => {
      const el = document.getElementById("did-did-value");
      return el ? el.textContent : "";
    });
    assert.ok(
      didValue.length > 0,
      "DID value should be non-empty after generation",
    );
    assert.ok(
      didValue.startsWith("did:key:z"),
      `Ed25519 DID should start with "did:key:z". Got: ${didValue}`,
    );

    // Check key display is visible (block)
    const keyDisplayStyle = await page.evaluate(() => {
      const el = document.getElementById("did-key-display");
      return el ? el.style.display : "";
    });
    assert.equal(
      keyDisplayStyle,
      "block",
      "Key display should be visible after generation",
    );

    // Check result shows success
    const resultHtml = await page.evaluate(() => {
      const el = document.getElementById("did-result");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      resultHtml.includes("✅") || resultHtml.includes("success"),
      `Result should indicate success. Got: ${resultHtml.substring(0, 150)}`,
    );

    await ctx.close();
  });

  it("should sign fingerprint and auto-verify", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "did");
    await page.waitForTimeout(1000);

    // Upload a fingerprint JSON file
    const fpJson = JSON.stringify({
      file_info: { file_name: "test.png" },
      hashes: { "SHA-256": "abc123def456" },
    });
    await page.setInputFiles("#did-fp-file", [
      { name: "fp.json", mimeType: "application/json", buffer: Buffer.from(fpJson) },
    ]);
    await page.waitForTimeout(500);

    // Select Ed25519
    await page.evaluate(() => {
      const sel = document.getElementById("did-algo-select");
      if (sel) sel.value = "Ed25519";
    });
    await page.waitForTimeout(300);

    // Generate identity
    await page.evaluate(() => document.getElementById("did-gen-btn").click());
    await page.waitForTimeout(3000);

    // Confirm generation succeeded
    const didValue = await page.evaluate(() => {
      const el = document.getElementById("did-did-value");
      return el ? el.textContent : "";
    });
    assert.ok(didValue.startsWith("did:key:z"), "DID must be generated before signing");

    // Verify sign button is now visible
    const signBtnVisible = await page.evaluate(() => {
      const el = document.getElementById("did-sign-btn");
      return el ? el.style.display !== "none" : false;
    });
    assert.ok(signBtnVisible, "Sign button should be visible after generation");

    // Click sign
    await page.evaluate(() => document.getElementById("did-sign-btn").click());
    await page.waitForTimeout(2000);

    // Check signature display is visible
    const sigDisplayStyle = await page.evaluate(() => {
      const el = document.getElementById("did-sig-display");
      return el ? el.style.display : "";
    });
    assert.equal(
      sigDisplayStyle,
      "block",
      "Signature display should be visible after signing",
    );

    // Check signature value has content (first 64 chars + "...")
    const sigValue = await page.evaluate(() => {
      const el = document.getElementById("did-sig-value");
      return el ? el.textContent : "";
    });
    assert.ok(sigValue.length > 0, "Signature value should be non-empty");
    assert.ok(sigValue.endsWith("..."), "Signature value should end with '...' (truncated)");

    // Check signed-by DID matches generated DID
    const sigDid = await page.evaluate(() => {
      const el = document.getElementById("did-sig-did");
      return el ? el.textContent : "";
    });
    assert.equal(sigDid, didValue, "Signed-by DID should match the generated DID");

    // Check result contains success + "verified"
    const resultHtml = await page.evaluate(() => {
      const el = document.getElementById("did-result");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      resultHtml.includes("✅") ||
        resultHtml.includes("verified") ||
        resultHtml.includes("signed"),
      `Result should indicate sign+verify success. Got: ${resultHtml.substring(0, 200)}`,
    );

    // Check download container is visible (the code sets style.display = ""
    // which removes the inline display:none; the element becomes visible)
    const dlContainerVisible = await page.evaluate(() => {
      const el = document.getElementById("did-dl-container");
      if (!el) return false;
      const style = el.style.display;
      // After sign+verify, the code sets display to "" (removing inline none),
      // so the computed display becomes block. Check both possibilities.
      return style !== "none";
    });
    assert.ok(
      dlContainerVisible,
      "Download container should be visible after successful sign+verify",
    );

    await ctx.close();
  });
});
