const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("node:path");
const fs = require("node:fs");

const PORT = 9900;
const BASE = `http://localhost:${PORT}`;
const PNG_BUF = fs.readFileSync(path.resolve(__dirname, "..", "fixtures", "testimg.png"));

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

describe("E2E — C2PA Provenance", () => {
  it("should navigate to C2PA page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "c2pa");
    await page.waitForTimeout(1000);
    assert.equal(errors.filter((e) => !e.includes("404") && !e.includes("Failed to load")).length, 0);
    await ctx.close();
  });

  it("should have read tab with file input and read button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "c2pa");
    await page.waitForTimeout(1000);
    const hasFile = await page.evaluate(() => !!document.getElementById("c2pa-read-file"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("c2pa-read-btn"));
    assert.ok(hasFile, "Read file input exists");
    assert.ok(hasBtn, "Read button exists");
    await ctx.close();
  });

  it("should read a PNG and show C2PA result (or empty state)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "c2pa");
    await page.waitForTimeout(1000);

    // Upload a PNG
    await page.setInputFiles("#c2pa-read-file", [{ name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);

    // Click read button
    await page.evaluate(() => document.getElementById("c2pa-read-btn").click());

    // Wait for result (output populated or result div visible)
    await page.waitForFunction(
      () => {
        const output = document.getElementById("c2pa-read-output");
        const result = document.getElementById("c2pa-read-result");
        return (output && output.innerHTML.length > 0) || (result && result.style.display !== "none");
      },
      { timeout: 60000 },
    );
    await page.waitForTimeout(1000);

    const outputHtml = await page.evaluate(() => {
      const el = document.getElementById("c2pa-read-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(outputHtml.length > 0, "Read output should contain result");
    // Should say something about no C2PA data or show the parsed result
    assert.ok(
      outputHtml.includes("C2PA") || outputHtml.includes("No") || outputHtml.includes("not"),
      `Should reference C2PA status: ${outputHtml.substring(0, 100)}`,
    );

    await ctx.close();
  });

  it("should have write tab with form fields", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "c2pa");
    await page.waitForTimeout(1000);

    // Switch to write tab
    await page.evaluate(() => switchC2paTab("write"));
    await page.waitForTimeout(300);

    const hasCreate = await page.evaluate(() => !!document.getElementById("c2pa-write-create"));
    const hasFile = await page.evaluate(() => !!document.getElementById("c2pa-write-file"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("c2pa-write-btn"));
    assert.ok(hasCreate, "Create checkbox exists");
    assert.ok(hasFile, "Write file input exists");
    assert.ok(hasBtn, "Write button exists");
    await ctx.close();
  });

  it("should have verify tab with file input and verify button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "c2pa");
    await page.waitForTimeout(1000);

    await page.evaluate(() => switchC2paTab("verify"));
    await page.waitForTimeout(300);

    const hasFile = await page.evaluate(() => !!document.getElementById("c2pa-verify-file"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("c2pa-verify-btn"));
    assert.ok(hasFile, "Verify file input exists");
    assert.ok(hasBtn, "Verify button exists");
    await ctx.close();
  });

  it("should sign an image (write) then read back C2PA provenance data", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "c2pa");
    await page.waitForTimeout(1000);

    // Switch to write tab
    await page.evaluate(() => switchC2paTab("write"));
    await page.waitForTimeout(300);

    // Check "Digitally Created" checkbox
    await page.evaluate(() => {
      const cb = document.getElementById("c2pa-write-create");
      if (cb) {
        cb.checked = true;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);

    // Fill in title and author
    await page.fill("#c2pa-field-create-title", "E2E Test Image");
    await page.fill("#c2pa-field-create-author", "E2E Tester");

    // Upload PNG image
    await page.setInputFiles("#c2pa-write-file", [{ name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);

    // Click sign button
    await page.evaluate(() => document.getElementById("c2pa-write-btn").click());

    // Wait for write result (C2PA uses CDN WASM, may take time)
    await page.waitForSelector("#c2pa-write-result", { state: "visible", timeout: 60000 });
    await page.waitForTimeout(2000);

    const writeOutput = await page.evaluate(() => {
      const el = document.getElementById("c2pa-write-output");
      return el ? el.innerHTML : "";
    });

    // Check for signed URL
    const signedUrl = await page.evaluate(() => window._c2paSignedUrl || "");
    if (!signedUrl) {
      // If signing failed (e.g. CDN unavailable), log the error and skip
    }
    assert.ok(signedUrl.length > 0, `Signed image URL should be available. Output: ${writeOutput.substring(0, 200)}`);

    // Fetch the signed image blob
    const signedInfo = await page.evaluate(async () => {
      const url = window._c2paSignedUrl;
      if (!url) return null;
      const resp = await fetch(url);
      const blob = await resp.blob();
      return {
        buf: Array.from(new Uint8Array(await blob.arrayBuffer())),
        type: blob.type || "image/png",
      };
    });
    assert.ok(signedInfo, "Signed image blob should be available");
    const signedBuf = Buffer.from(signedInfo.buf);
    const signedType = signedInfo.type;
    const signedExt = signedType === "image/jpeg" ? "jpg" : "png";

    // Switch to read tab
    await page.evaluate(() => switchC2paTab("read"));
    await page.waitForTimeout(300);

    // Upload signed image
    await page.setInputFiles("#c2pa-read-file", [
      { name: `signed.${signedExt}`, mimeType: signedType, buffer: signedBuf },
    ]);
    await page.waitForTimeout(500);

    // Click read button
    await page.evaluate(() => document.getElementById("c2pa-read-btn").click());

    // Wait for read result
    await page.waitForSelector("#c2pa-read-result", { state: "visible", timeout: 60000 });
    await page.waitForTimeout(2000);

    const readOutput = await page.evaluate(() => {
      const el = document.getElementById("c2pa-read-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(readOutput.length > 0, "Read output should contain C2PA data");
    assert.ok(
      readOutput.includes("E2E Test Image") || readOutput.includes("Active Manifest"),
      `Should show C2PA provenance. Output: ${readOutput.substring(0, 200)}`,
    );
    assert.ok(
      readOutput.includes("Actions") || readOutput.includes("Signature"),
      "Should include Actions/Signature section",
    );

    // No fatal errors
    const fatal = errors.filter((e) => !e.includes("frame-ancestors") && !e.includes("404"));
    assert.equal(fatal.length, 0, `No fatal console errors: ${fatal.join(", ")}`);

    await ctx.close();
  });

  it("should verify a C2PA-signed image", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "c2pa");
    await page.waitForTimeout(1000);

    // First, sign an image to get a signed file
    await page.evaluate(() => switchC2paTab("write"));
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const cb = document.getElementById("c2pa-write-create");
      if (cb) {
        cb.checked = true;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.fill("#c2pa-field-create-title", "Verify Test");
    await page.fill("#c2pa-field-create-author", "Verifier");
    await page.setInputFiles("#c2pa-write-file", [{ name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF }]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("c2pa-write-btn").click());
    await page.waitForSelector("#c2pa-write-result", { state: "visible", timeout: 60000 });
    await page.waitForTimeout(2000);

    const signedInfo = await page.evaluate(async () => {
      const url = window._c2paSignedUrl;
      if (!url) return null;
      const resp = await fetch(url);
      const blob = await resp.blob();
      return {
        buf: Array.from(new Uint8Array(await blob.arrayBuffer())),
        type: blob.type || "image/png",
      };
    });
    assert.ok(signedInfo, "Signed blob for verify test");
    const signedBuf = Buffer.from(signedInfo.buf);
    const signedType = signedInfo.type;
    const signedExt = signedType === "image/jpeg" ? "jpg" : "png";

    // Switch to verify tab
    await page.evaluate(() => switchC2paTab("verify"));
    await page.waitForTimeout(300);

    await page.setInputFiles("#c2pa-verify-file", [
      { name: `signed.${signedExt}`, mimeType: signedType, buffer: signedBuf },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getElementById("c2pa-verify-btn").click());
    await page.waitForSelector("#c2pa-verify-result", { state: "visible", timeout: 60000 });
    await page.waitForTimeout(2000);

    const verifyOutput = await page.evaluate(() => {
      const el = document.getElementById("c2pa-verify-output");
      return el ? el.innerHTML : "";
    });
    assert.ok(verifyOutput.length > 0, "Verify output should contain result");
    assert.ok(
      verifyOutput.includes("C2PA") ||
        verifyOutput.includes("Manifest") ||
        verifyOutput.includes("valid") ||
        verifyOutput.includes("signature"),
      `Should show verification result: ${verifyOutput.substring(0, 200)}`,
    );

    await ctx.close();
  });
});
