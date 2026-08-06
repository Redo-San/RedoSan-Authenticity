const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("path");
const fs = require("fs");

const PORT = 9895;
const BASE = `http://localhost:${PORT}`;
const TXT_COVER_BUF = Buffer.from(
  "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum.",
);
const SECRET_BUF = Buffer.from("E2E DOCW ROUNDTRIP");

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
  return page.evaluate((pid) => {
    const a = document.querySelector(`#sidebar a[data-page="${pid}"]`);
    if (a) a.click();
  }, id);
}

describe("E2E — Document Watermark", () => {
  it("should navigate to document watermark page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "document-watermark");
    await page.waitForTimeout(1000);
    assert.equal(errors.filter((e) => !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest")).length, 0);
    await ctx.close();
  });

  it("should have form elements, file inputs, and embed button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "document-watermark");
    await page.waitForTimeout(1000);
    const hasCover = await page.evaluate(() => !!document.getElementById("docw-cover-file"));
    const hasSecret = await page.evaluate(() => !!document.getElementById("docw-secret-file"));
    const hasAlgo = await page.evaluate(() => !!document.getElementById("docw-algo"));
    const hasPw = await page.evaluate(() => !!document.getElementById("docw-password"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("docw-embed-btn"));
    assert.ok(hasCover, "Cover file input exists");
    assert.ok(hasSecret, "Secret file input exists");
    assert.ok(hasAlgo, "Algorithm selector exists");
    assert.ok(hasPw, "Password input exists");
    assert.ok(hasBtn, "Embed button exists");
    await ctx.close();
  });

  it("should embed a ZWC watermark into a TXT file and show result", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "document-watermark");
    await page.waitForTimeout(1000);

    // Upload cover TXT
    await page.setInputFiles("#docw-cover-file", [
      { name: "cover.txt", mimeType: "text/plain", buffer: TXT_COVER_BUF },
    ]);
    await page.waitForTimeout(1500);

    // Upload secret TXT
    await page.setInputFiles("#docw-secret-file", [{ name: "secret.txt", mimeType: "text/plain", buffer: SECRET_BUF }]);
    await page.waitForTimeout(500);

    // Set password
    await page.fill("#docw-password", "test-docw-pw");

    // Click embed
    await page.evaluate(() => document.getElementById("docw-embed-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("docw-embed-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(500);

    // Verify output has certificate text
    const outputVal = await page.evaluate(() => {
      const el = document.getElementById("docw-embed-output");
      return el ? el.value : "";
    });
    assert.ok(outputVal.length > 50, "Output should contain certificate text");
    assert.ok(
      outputVal.includes("E2E DOCW ROUNDTRIP") || outputVal.includes("SHA-256"),
      "Output should show secret or hash. Got: " + outputVal.substring(0, 100),
    );

    // Verify download link exists
    const hasDownload = await page.evaluate(() => {
      const container = document.getElementById("docw-embed-download");
      return container && container.querySelector("a.btn") !== null;
    });
    assert.ok(hasDownload, "Download button should appear after embed");

    await ctx.close();
  });

  it("should show extract tab with file input, algorithm selector, and extract button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "document-watermark");
    await page.waitForTimeout(1000);

    await page.evaluate(() => switchDocwTab("extract"));
    await page.waitForTimeout(300);

    const hasFile = await page.evaluate(() => !!document.getElementById("docw-extract-file"));
    const hasAlgo = await page.evaluate(() => !!document.getElementById("docw-algo-ex"));
    const hasPw = await page.evaluate(() => !!document.getElementById("docw-password-ex"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("docw-extract-btn"));
    assert.ok(hasFile, "Extract file input exists");
    assert.ok(hasAlgo, "Extract algorithm selector exists");
    assert.ok(hasPw, "Extract password input exists");
    assert.ok(hasBtn, "Extract button exists");
    await ctx.close();
  });

  it("should round-trip Homoglyph (algo 2): embed secret into TXT then extract recovers content", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "document-watermark");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#docw-cover-file", [
      { name: "cover.txt", mimeType: "text/plain", buffer: TXT_COVER_BUF },
    ]);
    await page.waitForTimeout(1500);

    await page.setInputFiles("#docw-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("HOM ROUNDTRIP") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const sel = document.getElementById("docw-algo");
      if (sel) {
        sel.value = "2";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.fill("#docw-password", "hom-pw");

    await page.evaluate(() => document.getElementById("docw-embed-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("docw-embed-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(500);

    const outputVal = await page.evaluate(() => {
      const el = document.getElementById("docw-embed-output");
      return el ? el.value : "";
    });
    assert.ok(outputVal.length > 50, "Homoglyph embed output should have certificate text");

    const wmInfo = await page.evaluate(async () => {
      const container = document.getElementById("docw-embed-download");
      const link = container ? container.querySelector("a.btn") : null;
      if (!link) return null;
      const url = link.getAttribute("href");
      if (!url) return null;
      const resp = await fetch(url);
      const blob = await resp.blob();
      return { buf: Array.from(new Uint8Array(await blob.arrayBuffer())), type: blob.type || "text/plain" };
    });
    assert.ok(wmInfo, "Homoglyph watermarked document blob should be available");
    const wmBuf = Buffer.from(wmInfo.buf);
    const ext = wmInfo.type.includes("pdf") ? "pdf" : wmInfo.type.includes("docx") ? "docx" : "txt";

    await page.evaluate(() => switchDocwTab("extract"));
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const sel = document.getElementById("docw-algo-ex");
      if (sel) {
        sel.value = "2";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.fill("#docw-password-ex", "hom-pw");

    await page.setInputFiles("#docw-extract-file", [
      { name: "watermarked." + ext, mimeType: wmInfo.type, buffer: wmBuf },
    ]);
    await page.waitForTimeout(1500);

    await page.evaluate(() => document.getElementById("docw-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("docw-extract-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(500);

    const extractedMsg = await page.evaluate(() => {
      const el = document.getElementById("docw-extracted-msg");
      return el ? el.value : "";
    });
    assert.ok(
      extractedMsg.includes("HOM ROUNDTRIP"),
      "Homoglyph extract should recover secret. Got: " + extractedMsg.substring(0, 200),
    );
    await ctx.close();
  });

  it("should round-trip Whitespace (algo 3): embed secret into TXT then extract recovers content", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "document-watermark");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#docw-cover-file", [
      { name: "cover.txt", mimeType: "text/plain", buffer: TXT_COVER_BUF },
    ]);
    await page.waitForTimeout(1500);

    await page.setInputFiles("#docw-secret-file", [
      { name: "secret.txt", mimeType: "text/plain", buffer: Buffer.from("WS ROUNDTRIP") },
    ]);
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const sel = document.getElementById("docw-algo");
      if (sel) {
        sel.value = "3";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.fill("#docw-password", "ws-pw");

    await page.evaluate(() => document.getElementById("docw-embed-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("docw-embed-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(500);

    const wmInfo = await page.evaluate(async () => {
      const container = document.getElementById("docw-embed-download");
      const link = container ? container.querySelector("a.btn") : null;
      if (!link) return null;
      const url = link.getAttribute("href");
      if (!url) return null;
      const resp = await fetch(url);
      const blob = await resp.blob();
      return { buf: Array.from(new Uint8Array(await blob.arrayBuffer())), type: blob.type || "text/plain" };
    });
    assert.ok(wmInfo, "Whitespace watermarked document blob should be available");
    const wmBuf = Buffer.from(wmInfo.buf);
    const ext = wmInfo.type.includes("pdf") ? "pdf" : wmInfo.type.includes("docx") ? "docx" : "txt";

    await page.evaluate(() => switchDocwTab("extract"));
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const sel = document.getElementById("docw-algo-ex");
      if (sel) {
        sel.value = "3";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    await page.fill("#docw-password-ex", "ws-pw");

    await page.setInputFiles("#docw-extract-file", [
      { name: "watermarked." + ext, mimeType: wmInfo.type, buffer: wmBuf },
    ]);
    await page.waitForTimeout(1500);

    await page.evaluate(() => document.getElementById("docw-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("docw-extract-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(500);

    const extractedMsg = await page.evaluate(() => {
      const el = document.getElementById("docw-extracted-msg");
      return el ? el.value : "";
    });
    assert.ok(
      extractedMsg.includes("WS ROUNDTRIP"),
      "Whitespace extract should recover secret. Got: " + extractedMsg.substring(0, 200),
    );
    await ctx.close();
  });

  it("should round-trip ZWC (algo 1): embed secret into TXT then extract recovers content", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "document-watermark");
    await page.waitForTimeout(1000);

    // Upload cover TXT
    await page.setInputFiles("#docw-cover-file", [
      { name: "cover.txt", mimeType: "text/plain", buffer: TXT_COVER_BUF },
    ]);
    await page.waitForTimeout(1500);

    // Upload secret TXT
    await page.setInputFiles("#docw-secret-file", [{ name: "secret.txt", mimeType: "text/plain", buffer: SECRET_BUF }]);
    await page.waitForTimeout(500);

    // Set password
    await page.fill("#docw-password", "roundtrip-pw");

    // Click embed
    await page.evaluate(() => document.getElementById("docw-embed-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("docw-embed-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(500);

    // Verify embed succeeded
    const outputVal = await page.evaluate(() => {
      const el = document.getElementById("docw-embed-output");
      return el ? el.value : "";
    });
    assert.ok(outputVal.length > 50, "Embed output should have certificate text");

    // Get watermarked blob from download link
    const wmInfo = await page.evaluate(async () => {
      const container = document.getElementById("docw-embed-download");
      const link = container ? container.querySelector("a.btn") : null;
      if (!link) return null;
      const url = link.getAttribute("href");
      if (!url) return null;
      const resp = await fetch(url);
      const blob = await resp.blob();
      return {
        buf: Array.from(new Uint8Array(await blob.arrayBuffer())),
        type: blob.type || "text/plain",
      };
    });
    assert.ok(wmInfo, "Watermarked document blob should be available");
    const wmBuf = Buffer.from(wmInfo.buf);
    const ext = wmInfo.type.includes("pdf") ? "pdf" : wmInfo.type.includes("docx") ? "docx" : "txt";

    // Switch to extract tab
    await page.evaluate(() => switchDocwTab("extract"));
    await page.waitForTimeout(300);

    // Set algorithm to ZWC (1)
    await page.evaluate(() => {
      const sel = document.getElementById("docw-algo-ex");
      if (sel) sel.value = "1";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.waitForTimeout(300);

    // Set password
    await page.fill("#docw-password-ex", "roundtrip-pw");

    // Upload watermarked document
    await page.setInputFiles("#docw-extract-file", [
      { name: "watermarked." + ext, mimeType: wmInfo.type, buffer: wmBuf },
    ]);
    await page.waitForTimeout(1500);

    // Click extract
    await page.evaluate(() => document.getElementById("docw-extract-btn").click());
    await page.waitForFunction(
      () => {
        const r = document.getElementById("docw-extract-result");
        return r && r.style.display !== "none";
      },
      { timeout: 30000 },
    );
    await page.waitForTimeout(500);

    const extractedMsg = await page.evaluate(() => {
      const el = document.getElementById("docw-extracted-msg");
      return el ? el.value : "";
    });
    assert.ok(
      extractedMsg.includes("E2E DOCW ROUNDTRIP"),
      "Extract should recover secret. Got: " + extractedMsg.substring(0, 200),
    );

    await ctx.close();
  });
});
