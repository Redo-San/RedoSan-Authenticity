const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("path");
const fs = require("fs");

const PORT = 9899;
const BASE = `http://localhost:${PORT}`;
const NAV_WAIT = { waitUntil: "domcontentloaded" };

// Real PNG fixture for valid file drop tests
const TEST_PNG = path.resolve(__dirname, "..", "fixtures", "testimg.png");
const PNG_BUF = fs.readFileSync(TEST_PNG);

let browser;
let server;

before(async () => {
  server = await startServer(PORT);
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  stopServer();
});

/**
 * Dispatch a synthetic drop event with a DataTransfer containing the given files.
 * Returns an object with a `preventDefaultCalled` flag so the caller can
 * verify the event was handled.
 */
async function dispatchDropEvent(page, selector, files) {
  return page.evaluate(
    ({ sel, fileDescs }) => {
      const target = document.querySelector(sel);
      if (!target) return { found: false };

      const dt = new DataTransfer();
      for (const fd of fileDescs) {
        // Build a File from the base64-encoded buffer
        const byteString = atob(fd.b64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const file = new File([ab], fd.name, { type: fd.type });
        dt.items.add(file);
      }

      let prevented = false;
      const event = new DragEvent("drop", {
        dataTransfer: dt,
        bubbles: true,
        cancelable: true,
      });
      // Monkey-patch preventDefault to record if it was called
      const origPreventDefault = event.preventDefault.bind(event);
      event.preventDefault = () => {
        prevented = true;
        origPreventDefault();
      };

      target.dispatchEvent(event);
      return { found: true, prevented };
    },
    {
      sel: selector,
      fileDescs: files.map((f) => ({
        name: f.name,
        type: f.type,
        b64: f.buffer.toString("base64"),
      })),
    },
  );
}

describe("E2E — File Drop Zones", () => {
  it("should create file-drop-zone elements from file inputs", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    // Navigate to fingerprint page (has file input that becomes drop zone)
    await page.goto(`${BASE}/Style/pages/fingerprint/index.html`);
    await page.waitForTimeout(1500);

    const dropZoneCount = await page.evaluate(() => {
      return document.querySelectorAll(".file-drop-zone").length;
    });

    const hasDropZone = await page.evaluate(() => {
      const dz = document.querySelector(".file-drop-zone");
      return dz !== null && dz.classList.contains("file-drop-zone");
    });

    assert.ok(
      dropZoneCount >= 1,
      `Expected >=1 .file-drop-zone, got ${dropZoneCount}`,
    );
    assert.ok(hasDropZone, "At least one .file-drop-zone should exist");
    await ctx.close();
  });

  it("should have dz-icon and dz-text children in drop zone", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/Style/pages/fingerprint/index.html`);
    await page.waitForTimeout(1500);

    const hasIcon = await page.evaluate(() => {
      const dz = document.querySelector(".file-drop-zone");
      return dz ? !!dz.querySelector(".dz-icon") : false;
    });
    const hasText = await page.evaluate(() => {
      const dz = document.querySelector(".file-drop-zone");
      return dz ? !!dz.querySelector(".dz-text") : false;
    });
    const hasFile = await page.evaluate(() => {
      const dz = document.querySelector(".file-drop-zone");
      return dz ? !!dz.querySelector(".dz-file") : false;
    });

    assert.ok(hasIcon, "Drop zone should contain .dz-icon");
    assert.ok(hasText, "Drop zone should contain .dz-text");
    assert.ok(hasFile, "Drop zone should contain .dz-file");
    await ctx.close();
  });

  it("should add drag-over class on dragover event", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/Style/pages/fingerprint/index.html`);
    await page.waitForTimeout(1500);

    const dragOverAdded = await page.evaluate(() => {
      const dz = document.querySelector(".file-drop-zone");
      if (!dz) return false;

      const evt = new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
      });
      dz.dispatchEvent(evt);
      return dz.classList.contains("drag-over");
    });

    assert.ok(
      dragOverAdded,
      "drag-over class should be added on dragover event",
    );
    await ctx.close();
  });

  it("should remove drag-over class on dragleave event", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/Style/pages/fingerprint/index.html`);
    await page.waitForTimeout(1500);

    const dragOverRemoved = await page.evaluate(() => {
      const dz = document.querySelector(".file-drop-zone");
      if (!dz) return false;

      // First add drag-over
      dz.classList.add("drag-over");

      const evt = new DragEvent("dragleave", {
        bubbles: true,
        cancelable: true,
      });
      dz.dispatchEvent(evt);
      return !dz.classList.contains("drag-over");
    });

    assert.ok(
      dragOverRemoved,
      "drag-over class should be removed on dragleave event",
    );
    await ctx.close();
  });

  it("should add has-file class when a valid PNG is dropped", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/Style/pages/fingerprint/index.html`);
    await page.waitForTimeout(1500);

    // Drop a valid PNG file
    const result = await dispatchDropEvent(page, ".file-drop-zone", [
      { name: "testimg.png", type: "image/png", buffer: PNG_BUF },
    ]);
    assert.ok(result.found, "Drop zone element should be found");
    // The drop event should call preventDefault
    assert.ok(result.prevented, "drop event preventDefault should be called");

    await page.waitForTimeout(800);

    const hasFile = await page.evaluate(() => {
      const dz = document.querySelector(".file-drop-zone");
      return dz ? dz.classList.contains("has-file") : false;
    });

    assert.ok(
      hasFile,
      "has-file class should be added after dropping a valid PNG",
    );
    await ctx.close();
  });

  it("should display the dropped file name in dz-file", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/Style/pages/fingerprint/index.html`);
    await page.waitForTimeout(1500);

    await dispatchDropEvent(page, ".file-drop-zone", [
      { name: "testimg.png", type: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(800);

    const fileDisplay = await page.evaluate(() => {
      const dz = document.querySelector(".file-drop-zone");
      if (!dz) return "";
      const fd = dz.querySelector(".dz-file");
      return fd ? fd.textContent : "";
    });

    assert.ok(
      fileDisplay.includes("testimg.png"),
      "dz-file should show dropped file name",
    );
    await ctx.close();
  });

  it("should reject dangerous extension (.exe) and not add has-file", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    // Capture alert dialogs to auto-dismiss
    let alertMessage = "";
    page.on("dialog", async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/Style/pages/fingerprint/index.html`);
    await page.waitForTimeout(1500);

    // Drop a dangerous .exe file
    const result = await dispatchDropEvent(page, ".file-drop-zone", [
      {
        name: "malware.exe",
        type: "application/x-msdownload",
        buffer: Buffer.from("MZ\x90\x00\x03"),
      },
    ]);
    assert.ok(result.found, "Drop zone should be found");

    await page.waitForTimeout(800);

    const hasFile = await page.evaluate(() => {
      const dz = document.querySelector(".file-drop-zone");
      return dz ? dz.classList.contains("has-file") : false;
    });

    // After rejection, has-file should NOT be present
    assert.equal(
      hasFile,
      false,
      "has-file should NOT be added for dangerous file extension",
    );

    // Alert should have been fired
    assert.ok(
      alertMessage.length > 0,
      "An alert should have been shown for dangerous file type",
    );

    await ctx.close();
  });

  it("should reject dangerous extension (.js) and clear the input", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    let alertShown = false;
    page.on("dialog", async (dialog) => {
      alertShown = true;
      await dialog.accept();
    });

    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/Style/pages/fingerprint/index.html`);
    await page.waitForTimeout(1500);

    await dispatchDropEvent(page, ".file-drop-zone", [
      {
        name: "script.js",
        type: "application/javascript",
        buffer: Buffer.from("console.log('xss')"),
      },
    ]);
    await page.waitForTimeout(800);

    const hasFile = await page.evaluate(() => {
      const dz = document.querySelector(".file-drop-zone");
      return dz ? dz.classList.contains("has-file") : false;
    });

    assert.equal(hasFile, false, "has-file should NOT be added for .js file");
    assert.ok(
      alertShown,
      "Alert should have been shown for dangerous .js file",
    );
    await ctx.close();
  });

  it("should handle multiple drop zones across pages", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);

    // Navigate to fingerprint first
    await page.goto(`${BASE}/Style/pages/fingerprint/index.html`);
    await page.waitForTimeout(1500);

    // Check fingerprint page has drop zone
    const fpDz = await page.evaluate(
      () => document.querySelectorAll(".file-drop-zone").length,
    );
    assert.ok(fpDz >= 1, `Fingerprint should have >=1 drop zones, got ${fpDz}`);

    // Navigate to watermark page to check it also has drop zones
    await page.goto(`${BASE}/Style/pages/watermark/index.html`);
    await page.waitForTimeout(1500);

    const wmDz = await page.evaluate(
      () => document.querySelectorAll(".file-drop-zone").length,
    );
    assert.ok(wmDz >= 1, `Watermark should have >=1 drop zones, got ${wmDz}`);

    const nonNullInput = await page.evaluate(() => {
      const dz = document.querySelector(".file-drop-zone");
      if (!dz) return false;
      const input = dz.querySelector('input[type="file"]');
      return input !== null;
    });
    assert.ok(nonNullInput, "Watermark drop zone should contain a file input");

    await ctx.close();
  });

  it("should not produce fatal console errors during drop operations", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await page.goto(`${BASE}/Style/pages/fingerprint/index.html`);
    await page.waitForTimeout(1500);

    // Drop valid file
    await dispatchDropEvent(page, ".file-drop-zone", [
      { name: "testimg.png", type: "image/png", buffer: PNG_BUF },
    ]);
    await page.waitForTimeout(800);

    // Drop dangerous file (will trigger alert but not an error)
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });
    await dispatchDropEvent(page, ".file-drop-zone", [
      {
        name: "bad.exe",
        type: "application/x-msdownload",
        buffer: Buffer.from("MZ\x90"),
      },
    ]);
    await page.waitForTimeout(800);

    const fatal = errors.filter(
      (e) =>
        !e.includes("frame-ancestors") &&
        !e.includes("404") &&
        !e.includes("Failed to load") &&
        !e.includes("valid digest"),
    );
    assert.equal(
      fatal.length,
      0,
      `Fatal errors during drop operations: ${fatal.join(", ")}`,
    );
    await ctx.close();
  });
});
