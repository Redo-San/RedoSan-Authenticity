const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("path");
const fs = require("fs");

const PORT = 9875;
const BASE = `http://localhost:${PORT}`;
const PNG_BUF = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "testimg.png"),
);

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

describe("E2E — Metadata Download Formats", () => {
  it("should navigate to metadata page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "metadata");
    await page.waitForTimeout(1000);
    assert.equal(
      errors.filter(
        (e) =>
          !e.includes("404") &&
          !e.includes("Failed to load") &&
          !e.includes("valid digest"),
      ).length,
      0,
    );
    await ctx.close();
  });

  it("should have file input and read button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "metadata");
    await page.waitForTimeout(1000);
    assert.ok(await page.evaluate(() => !!document.getElementById("md-file")));
    assert.ok(await page.evaluate(() => !!document.getElementById("md-btn")));
    await ctx.close();
  });

  it("should read metadata from PNG and show download button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "metadata");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#md-file", [
      { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("md-btn").click());
    await page.waitForSelector("#md-result", {
      state: "visible",
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    const dlHtml = await page.evaluate(() => {
      const dl = document.getElementById("md-download");
      return dl ? dl.innerHTML : "";
    });
    assert.ok(
      dlHtml.includes("Download"),
      "Download button should appear after reading metadata: " + dlHtml,
    );
    await ctx.close();
  });

  it("should open download modal and close it after format selection", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "metadata");
    await page.waitForTimeout(1000);

    await page.setInputFiles("#md-file", [
      { name: "testimg.png", mimeType: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("md-btn").click());
    await page.waitForSelector("#md-result", {
      state: "visible",
      timeout: 30000,
    });
    await page.waitForTimeout(500);

    // Click the download button in md-download
    await page.evaluate(() => {
      const btn = document.querySelector("#md-download .btn");
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);

    const modalOpen = await page.evaluate(() => {
      const modal = document.getElementById("dl-modal");
      return modal && modal.classList.contains("open");
    });
    assert.ok(modalOpen, "Download modal should be open");

    // Click JSON format option
    await page.evaluate(() => downloadResult("json"));
    await page.waitForTimeout(500);

    const modalStillOpen = await page.evaluate(() => {
      const modal = document.getElementById("dl-modal");
      return modal && modal.classList.contains("open");
    });
    assert.ok(!modalStillOpen, "Modal should close after format selection");

    // Check for critical errors
    const fatal = errors.filter(
      (e) =>
        !e.includes("404") &&
        !e.includes("Failed to load") &&
        !e.includes("valid digest") &&
        !e.includes("frame-ancestors"),
    );
    assert.equal(
      fatal.length,
      0,
      "No fatal errors during download: " + fatal.join(", "),
    );
    await ctx.close();
  });
});
