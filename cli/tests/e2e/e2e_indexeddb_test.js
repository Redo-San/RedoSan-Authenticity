const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer, stopServer } = require("./e2e_helpers");
const path = require("path");
const fs = require("fs");

const PORT = 9878;
const BASE = `http://localhost:${PORT}`;
const NAV_WAIT = { waitUntil: "domcontentloaded" };

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
 * Navigate via sidebar to a given page ID
 */
function navTo(page, id) {
  return page.evaluate((pid) => {
    const a = document.querySelector(`#sidebar a[data-page="${pid}"]`);
    if (a) a.click();
  }, id);
}

describe("E2E — IndexedDB Face Registry Persistence", () => {
  it("should navigate to face biometric page without errors", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "face-biometric");
    await page.waitForTimeout(1000);
    const fatal = errors.filter(
      (e) =>
        !e.includes("404") &&
        !e.includes("Failed to load") &&
        !e.includes("valid digest") &&
        !e.includes("frame-ancestors"),
    );
    assert.equal(fatal.length, 0, `Errors: ${fatal.join(", ")}`);
    await ctx.close();
  });

  it("should have FaceRegistry and IDBStore available globally", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "face-biometric");
    await page.waitForTimeout(1000);

    const hasRegistry = await page.evaluate(
      () => typeof window.FaceRegistry === "function",
    );
    const hasStore = await page.evaluate(
      () => typeof window.IDBStore === "function",
    );
    assert.ok(hasRegistry, "FaceRegistry constructor should exist");
    assert.ok(hasStore, "IDBStore constructor should exist");
    await ctx.close();
  });

  it("should add a face entry to IndexedDB and retrieve it", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "face-biometric");
    await page.waitForTimeout(1000);

    const id = await page.evaluate(async () => {
      // Create a synthetic 128-dimension Float32Array descriptor
      const desc = new Float32Array(128);
      for (let i = 0; i < 128; i++) desc[i] = Math.random() * 2 - 1;

      const reg = new window.FaceRegistry();
      const faceId = await reg.addFace("Test Person", desc, {
        source: "e2e-test",
      });
      return faceId;
    });

    assert.ok(typeof id === "number" && id > 0, `Face ID should be positive number, got ${id}`);

    // Verify we can retrieve it
    const stored = await page.evaluate(async (fid) => {
      const reg = new window.FaceRegistry();
      const face = await reg.getFace(fid);
      return face
        ? { label: face.label, hasDescriptor: face.descriptor instanceof Float32Array, descLen: face.descriptor.length }
        : null;
    }, id);

    assert.ok(stored !== null, "Face should be retrievable from IndexedDB");
    assert.equal(stored.label, "Test Person", "Label should match");
    assert.ok(stored.hasDescriptor, "Descriptor should be Float32Array");
    assert.equal(stored.descLen, 128, "Descriptor should have 128 elements");

    await ctx.close();
  });

  it("should persist face across page navigation (same origin)", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "face-biometric");
    await page.waitForTimeout(1000);

    // Add a face
    const id = await page.evaluate(async () => {
      const desc = new Float32Array(128);
      for (let i = 0; i < 128; i++) desc[i] = (i / 128) * 2 - 1;
      const reg = new window.FaceRegistry();
      return await reg.addFace("Persistent Face", desc, { source: "persist-test" });
    });

    // Navigate to another page and back
    await navTo(page, "home");
    await page.waitForTimeout(800);
    await navTo(page, "face-biometric");
    await page.waitForTimeout(1000);

    // Verify the face still exists
    const stored = await page.evaluate(async (fid) => {
      const reg = new window.FaceRegistry();
      const face = await reg.getFace(fid);
      return face ? face.label : null;
    }, id);

    assert.equal(stored, "Persistent Face", "Face should survive navigation");
    await ctx.close();
  });

  it("should list all registered faces from IndexedDB", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "face-biometric");
    await page.waitForTimeout(1000);

    // First clear any existing data
    await page.evaluate(async () => {
      const reg = new window.FaceRegistry();
      await reg.clear();
    });

    // Add multiple faces
    const ids = await page.evaluate(async () => {
      const reg = new window.FaceRegistry();
      const results = [];
      for (let i = 0; i < 3; i++) {
        const desc = new Float32Array(128);
        for (let j = 0; j < 128; j++) desc[j] = Math.random() * 2 - 1;
        const id = await reg.addFace(`Person ${i + 1}`, desc, { idx: i });
        results.push(id);
      }
      return results;
    });

    assert.equal(ids.length, 3, "Should have added 3 faces");

    // List all faces
    const faces = await page.evaluate(async () => {
      const reg = new window.FaceRegistry();
      const all = await reg.getAllFaces();
      return all.map((f) => ({ id: f.id, label: f.label }));
    });

    assert.equal(faces.length, 3, "getAllFaces should return 3 entries");
    const labels = faces.map((f) => f.label).sort();
    assert.deepEqual(labels, ["Person 1", "Person 2", "Person 3"]);

    await ctx.close();
  });

  it("should delete a face from IndexedDB", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "face-biometric");
    await page.waitForTimeout(1000);

    // Clear and add one face
    await page.evaluate(async () => {
      const reg = new window.FaceRegistry();
      await reg.clear();
    });

    const id = await page.evaluate(async () => {
      const desc = new Float32Array(128);
      for (let i = 0; i < 128; i++) desc[i] = 0.5;
      const reg = new window.FaceRegistry();
      return await reg.addFace("Delete Me", desc);
    });

    // Verify it exists
    const before = await page.evaluate(async (fid) => {
      const reg = new window.FaceRegistry();
      const face = await reg.getFace(fid);
      return face !== null;
    }, id);
    assert.ok(before, "Face should exist before deletion");

    // Delete
    const deleted = await page.evaluate(async (fid) => {
      const reg = new window.FaceRegistry();
      return await reg.deleteFace(fid);
    }, id);
    assert.ok(deleted, "deleteFace should return true");

    // Verify it's gone
    const after = await page.evaluate(async (fid) => {
      const reg = new window.FaceRegistry();
      const face = await reg.getFace(fid);
      return face;
    }, id);
    assert.equal(after, null, "Face should be null after deletion");

    // Count should be 0
    const count = await page.evaluate(async () => {
      const reg = new window.FaceRegistry();
      return await reg.getSize();
    });
    assert.equal(count, 0, "Registry size should be 0 after all deletions");

    await ctx.close();
  });

  it("should clear all faces from IndexedDB", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "face-biometric");
    await page.waitForTimeout(1000);

    // Add several faces
    await page.evaluate(async () => {
      const reg = new window.FaceRegistry();
      await reg.clear();
      for (let i = 0; i < 5; i++) {
        const desc = new Float32Array(128);
        for (let j = 0; j < 128; j++) desc[j] = i / 5;
        await reg.addFace(`Face ${i}`, desc);
      }
    });

    const beforeCount = await page.evaluate(async () => {
      const reg = new window.FaceRegistry();
      return await reg.getSize();
    });
    assert.equal(beforeCount, 5, "Should have 5 faces before clear");

    // Clear all
    await page.evaluate(async () => {
      const reg = new window.FaceRegistry();
      await reg.clear();
    });

    const afterCount = await page.evaluate(async () => {
      const reg = new window.FaceRegistry();
      return await reg.getSize();
    });
    assert.equal(afterCount, 0, "Should have 0 faces after clear");

    await ctx.close();
  });

  it("should find faces by label in IndexedDB", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "face-biometric");
    await page.waitForTimeout(1000);

    // Clear and add faces with same label
    await page.evaluate(async () => {
      const reg = new window.FaceRegistry();
      await reg.clear();
      const desc = new Float32Array(128);
      for (let j = 0; j < 128; j++) desc[j] = 0.3;
      await reg.addFace("Duplicate Label", desc);
      await reg.addFace("Duplicate Label", desc);
      await reg.addFace("Unique Label", desc);
    });

    const results = await page.evaluate(async () => {
      const reg = new window.FaceRegistry();
      const byLabel = await reg.findByLabel("Duplicate Label");
      const unique = await reg.findByLabel("Unique Label");
      return {
        duplicateCount: byLabel.length,
        uniqueCount: unique.length,
        uniqueLabel: unique.length > 0 ? unique[0].label : null,
      };
    });

    assert.equal(results.duplicateCount, 2, "Should find 2 faces with 'Duplicate Label'");
    assert.equal(results.uniqueCount, 1, "Should find 1 face with 'Unique Label'");
    assert.equal(results.uniqueLabel, "Unique Label");

    await ctx.close();
  });

  it("should update a face entry in IndexedDB", async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, NAV_WAIT);
    await page.waitForTimeout(2000);
    await navTo(page, "face-biometric");
    await page.waitForTimeout(1000);

    // Clear and add one face
    await page.evaluate(async () => {
      const reg = new window.FaceRegistry();
      await reg.clear();
    });

    const id = await page.evaluate(async () => {
      const desc = new Float32Array(128);
      for (let j = 0; j < 128; j++) desc[j] = 0.1;
      const reg = new window.FaceRegistry();
      return await reg.addFace("Original Name", desc);
    });

    // Update the label
    const updated = await page.evaluate(async (fid) => {
      const reg = new window.FaceRegistry();
      return await reg.updateFace(fid, { label: "Updated Name" });
    }, id);
    assert.ok(updated, "updateFace should return true");

    // Verify
    const face = await page.evaluate(async (fid) => {
      const reg = new window.FaceRegistry();
      const f = await reg.getFace(fid);
      return f ? { label: f.label, did: f.did } : null;
    }, id);
    assert.equal(face.label, "Updated Name", "Label should be updated");

    await ctx.close();
  });
});
