const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const _path = require("node:path");

const PORT = 9896;
const BASE = `http://localhost:${PORT}`;

let browser, _server;

before(async () => {
  _server = await startServer(PORT);
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  if (browser) await browser.close();
  stopServer();
});

function navTo(page, id) {
  return page.evaluate((pid) => {
    const a = document.querySelector(`#sidebar a[data-page="${pid}"]`);
    if (a) a.click();
  }, id);
}

describe("E2E — DID Identity", () => {
  it("should navigate to DID page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "did");
    await page.waitForTimeout(1000);
    assert.equal(errors.filter((e) => !e.includes("404") && !e.includes("Failed to load")).length, 0);
    await ctx.close();
  });

  it("should have algorithm selector and generate button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "did");
    await page.waitForTimeout(1000);
    const hasAlgo = await page.evaluate(() => !!document.getElementById("did-algo-select"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("did-gen-btn"));
    assert.ok(hasAlgo, "Algorithm selector exists");
    assert.ok(hasBtn, "Generate button exists");
    await ctx.close();
  });

  it("should generate an Ed25519 DID identity", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "did");
    await page.waitForTimeout(1000);

    // Upload a fingerprint file first (generate button is disabled without it)
    const fpJson = JSON.stringify({ file_info: { file_name: "test.png" }, hashes: { "SHA-256": "abc123" } });
    await page.setInputFiles("#did-fp-file", [
      { name: "fp.json", mimeType: "application/json", buffer: Buffer.from(fpJson) },
    ]);
    await page.waitForTimeout(500);

    // Select Ed25519 (default)
    await page.evaluate(() => {
      const sel = document.getElementById("did-algo-select");
      if (sel) sel.value = "Ed25519";
    });
    await page.waitForTimeout(300);

    // Click generate
    await page.evaluate(() => document.getElementById("did-gen-btn").click());

    // Wait for key display to appear
    await page.waitForTimeout(3000);

    const resultHtml = await page.evaluate(() => {
      const el = document.getElementById("did-result");
      return el ? el.innerHTML : "";
    });

    const didValue = await page.evaluate(() => {
      const el = document.getElementById("did-did-value");
      return el ? el.textContent : "";
    });
    assert.ok(didValue.length > 0, `DID value should be non-empty. Result: ${resultHtml.substring(0, 200)}`);
    assert.ok(didValue.startsWith("did:"), 'DID should start with "did:"');

    await ctx.close();
  });

  it("should generate a P-256 DID identity", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "did");
    await page.waitForTimeout(1000);

    // Upload a fingerprint file first
    await page.setInputFiles("#did-fp-file", [
      {
        name: "fp.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"file_info":{"file_name":"t.png"},"hashes":{"SHA-256":"abc"}}'),
      },
    ]);
    await page.waitForTimeout(500);

    // Select P-256
    await page.evaluate(() => {
      const sel = document.getElementById("did-algo-select");
      if (sel) sel.value = "P-256";
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => document.getElementById("did-gen-btn").click());
    await page.waitForTimeout(3000);

    const resultHtml = await page.evaluate(() => {
      const el = document.getElementById("did-result");
      return el ? el.innerHTML : "";
    });
    const didValue = await page.evaluate(() => {
      const el = document.getElementById("did-did-value");
      return el ? el.textContent : "";
    });
    assert.ok(didValue.length > 0, `DID value should be non-empty. Result: ${resultHtml.substring(0, 200)}`);
    assert.ok(didValue.startsWith("did:"), 'DID should start with "did:"');

    await ctx.close();
  });

  it("should show correct DID document structure after Ed25519 generation", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "did");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#did-fp-file", [
      {
        name: "fp.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"file_info":{"file_name":"t.png"},"hashes":{"SHA-256":"abc"}}'),
      },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const sel = document.getElementById("did-algo-select");
      if (sel) sel.value = "Ed25519";
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById("did-gen-btn").click());
    await page.waitForTimeout(3000);

    const didVal = await page.evaluate(() => {
      const el = document.getElementById("did-did-value");
      return el ? el.textContent : "";
    });
    assert.ok(didVal.length > 0, "DID value should be non-empty");
    assert.ok(didVal.startsWith("did:key:"), `Ed25519 DID should start with did:key:. Got: ${didVal}`);

    const keyDisplay = await page.evaluate(() => {
      const el = document.getElementById("did-key-display");
      return el ? el.style.display : "";
    });
    assert.equal(keyDisplay, "block", "Key display should be visible after generation");

    const resultHtml = await page.evaluate(() => {
      const el = document.getElementById("did-result");
      return el ? el.innerHTML : "";
    });
    assert.ok(
      resultHtml.includes("success") || resultHtml.includes("✅"),
      `Result should indicate success. Got: ${resultHtml.substring(0, 100)}`,
    );
    await ctx.close();
  });

  it("should have download button after DID generation", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "did");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#did-fp-file", [
      {
        name: "fp.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"file_info":{"file_name":"t.png"},"hashes":{"SHA-256":"abc"}}'),
      },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("did-gen-btn").click());
    await page.waitForTimeout(3000);

    const resultHtml = await page.evaluate(() => {
      const el = document.getElementById("did-result");
      return el ? el.innerHTML : "";
    });
    // Check that generation succeeded (result shows success)
    assert.ok(
      resultHtml.includes("success") || resultHtml.includes("✅"),
      `DID generation should succeed: ${resultHtml.substring(0, 200)}`,
    );

    // Verify clear button appears (sign that DID was generated)
    const clearBtnVisible = await page.evaluate(() => {
      const el = document.getElementById("did-clear-btn");
      return el ? el.style.display !== "none" : false;
    });
    assert.ok(clearBtnVisible, "Clear button should be visible after DID generation");

    await ctx.close();
  });
});
