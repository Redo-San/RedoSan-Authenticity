const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");

const PORT = 9904;
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
  return page.evaluate((pid) => {
    const a = document.querySelector(`#sidebar a[data-page="${pid}"]`);
    if (a) a.click();
  }, id);
}

describe("E2E — Converter & Removal Tools", () => {
  it("should navigate to converter page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "converter");
    await page.waitForTimeout(1000);
    assert.equal(errors.filter((e) => !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest")).length, 0);
    const heading = await page.evaluate(() => {
      const h = document.querySelector("#page-converter h2");
      return h ? h.textContent : "";
    });
    assert.ok(heading.length > 0, "Converter heading should exist");
    await ctx.close();
  });

  it("should have converter file input and button", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "converter");
    await page.waitForTimeout(1000);
    const hasFile = await page.evaluate(() => !!document.getElementById("conv-file"));
    const hasBtn = await page.evaluate(() => !!document.getElementById("conv-btn"));
    assert.ok(hasFile, "Converter file input exists");
    assert.ok(hasBtn, "Converter button exists");
    await ctx.close();
  });

  it("should navigate to removal tools page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "removal-tools");
    await page.waitForTimeout(1000);
    assert.equal(errors.filter((e) => !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest")).length, 0);
    const heading = await page.evaluate(() => {
      const h = document.querySelector("#page-removal-tools h2");
      return h ? h.textContent : "";
    });
    assert.ok(heading.length > 0, "Removal tools heading should exist");
    await ctx.close();
  });

  it("should have removal tools form elements", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "removal-tools");
    await page.waitForTimeout(1000);
    const hasFile = await page.evaluate(() => !!document.querySelector('#page-removal-tools input[type="file"]'));
    const hasBtn = await page.evaluate(() => !!document.querySelector("#page-removal-tools button"));
    assert.ok(hasFile, "Removal tools file input exists");
    assert.ok(hasBtn, "Removal tools button exists");
    await ctx.close();
  });

  it("should detect file type after uploading to converter", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "converter");
    await page.waitForTimeout(500);
    const fileInput = await page.$("#conv-file");
    assert.ok(fileInput, "Converter file input found");
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49,
      0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0x60, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x96, 0x75, 0x3b, 0x00, 0x00,
      0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    await fileInput.setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
    await page.waitForTimeout(500);
    assert.equal(errors.filter((e) => !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest")).length, 0);
    const typeText = await page.evaluate(() => {
      const el = document.getElementById("conv-file-type");
      return el ? el.textContent : "";
    });
    assert.ok(typeText.includes("Image"), `Detected type should contain "Image", got: ${typeText}`);
    const nameText = await page.evaluate(() => {
      const el = document.getElementById("conv-file-name");
      return el ? el.textContent : "";
    });
    assert.ok(nameText.includes("test.png"), `File name should be shown, got: ${nameText}`);
    const optsVisible = await page.evaluate(() => {
      const el = document.getElementById("conv-options");
      return el ? el.style.display : "";
    });
    assert.equal(optsVisible, "block", "Format options should be visible after file selection");
    await ctx.close();
  });

  it("should have service worker support (PWA)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const swSupported = await page.evaluate(() => "serviceWorker" in navigator);
    assert.ok(swSupported, "Service Worker API should be available in the browser");
    const registrations = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return [];
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.map((r) => ({ scope: r.scope, active: !!r.active }));
    });
    await ctx.close();
  });

  it("should convert PNG to JPEG and produce download", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await navTo(page, "converter");
    await page.waitForTimeout(500);

    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x00, 0x00, 0x02, 0x08, 0x02, 0x00, 0x00, 0x00, 0xfd, 0xd4, 0x9a, 0x73, 0x00, 0x00, 0x00, 0x0c, 0x49,
      0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0x60, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x96, 0x75, 0x3b, 0x00, 0x00,
      0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    await page.setInputFiles("#conv-file", [{ name: "test.png", mimeType: "image/png", buffer: png }]);
    await page.waitForTimeout(500);
    assert.equal(errors.filter((e) => !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest")).length, 0);

    // Click JPEG format button in the options grid
    await page.evaluate(() => {
      const btns = document.querySelectorAll("#conv-format-grid .tab-btn");
      for (const b of btns) {
        if (b.textContent.toLowerCase().includes("jpeg")) {
          b.click();
          break;
        }
      }
    });
    await page.waitForTimeout(200);

    // Click convert
    await page.evaluate(() => document.getElementById("conv-btn").click());
    await page.waitForFunction(
      () => {
        const dl = document.getElementById("conv-download");
        return dl && dl.querySelector("a") !== null;
      },
      { timeout: 15000 },
    );
    await page.waitForTimeout(500);

    const hasDownload = await page.evaluate(() => {
      const dl = document.getElementById("conv-download");
      return dl && dl.querySelector("a.btn") !== null;
    });
    assert.ok(hasDownload, "Conversion download button should exist");

    // Verify download button shows expected filename
    const dlText = await page.evaluate(() => {
      const dl = document.getElementById("conv-download");
      const a = dl ? dl.querySelector("a") : null;
      return a ? a.textContent : "";
    });
    assert.ok(
      dlText.includes(".jpg") || dlText.includes(".jpeg"),
      "Filename should have jpg extension. Got: " + dlText,
    );

    const fatal = errors.filter((e) => !e.includes("404") && !e.includes("Failed to load") && !e.includes("valid digest"));
    assert.equal(fatal.length, 0, "No fatal errors: " + fatal.join(", "));
    await ctx.close();
  });
});
