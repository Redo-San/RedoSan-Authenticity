var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var { chromium } = require("playwright");
var { ensureServer, openPage, closePage } = require("../mpa_helpers");

var PAGE_ID = "iris-biometric";
var browser;

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

describe("Iris Storage — API coverage", function () {

  it("should save template and return id", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var id = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        return await storage.save({
          id: "save-1", label: "Save Test", eyeSide: "left",
          leftCode: new Uint8Array([10, 20, 30]),
          leftMask: new Uint8Array([40, 50, 60]),
        });
      });
      assert.strictEqual(id, "save-1");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should save template with right eye and optional fields", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        var id = await storage.save({
          id: "save-right", label: "Right Eye", eyeSide: "right",
          leftCode: new Uint8Array([1]),
          leftMask: new Uint8Array([2]),
          rightCode: new Uint8Array([3]),
          rightMask: new Uint8Array([4]),
          quality: { score: 90 },
          did: "did:example:123",
        });
        var loaded = await storage.load(id);
        return {
          id: id,
          eyeSide: loaded.eyeSide,
          hasRight: loaded.rightCode instanceof Uint8Array,
          rightLen: loaded.rightCode.length,
          qualityScore: loaded.quality.score,
          did: loaded.did,
        };
      });
      assert.strictEqual(result.id, "save-right");
      assert.strictEqual(result.eyeSide, "right");
      assert.ok(result.hasRight);
      assert.strictEqual(result.rightLen, 1);
      assert.strictEqual(result.qualityScore, 90);
      assert.strictEqual(result.did, "did:example:123");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should save with default eyeSide when not left/right", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var eyeSide = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        await storage.save({
          id: "save-default-eye", label: "Default",
          leftCode: new Uint8Array([1]),
          leftMask: new Uint8Array([2]),
          eyeSide: "both",
        });
        var loaded = await storage.load("save-default-eye");
        return loaded.eyeSide;
      });
      assert.strictEqual(eyeSide, "unknown");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should throw when saving null template", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var threw = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        try {
          await storage.save(null);
          return false;
        } catch (e) {
          return e.message.includes("Template must have an id");
        }
      });
      assert.ok(threw);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should throw when saving template without id", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var threw = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        try {
          await storage.save({ leftCode: new Uint8Array([1]) });
          return false;
        } catch (e) {
          return e.message.includes("Template must have an id");
        }
      });
      assert.ok(threw);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should throw when saving template without leftCode", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var threw = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        try {
          await storage.save({ id: "no-code" });
          return false;
        } catch (e) {
          return e.message.includes("must include left eye IrisCode");
        }
      });
      assert.ok(threw);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should load existing template", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        await storage.save({
          id: "load-1", label: "Load Me", eyeSide: "left",
          leftCode: new Uint8Array([1, 2, 3]),
          leftMask: new Uint8Array([4, 5, 6]),
        });
        var loaded = await storage.load("load-1");
        return {
          id: loaded.id,
          label: loaded.label,
          leftLen: loaded.leftCode.length,
          leftIsUA: loaded.leftCode instanceof Uint8Array,
        };
      });
      assert.strictEqual(result.id, "load-1");
      assert.strictEqual(result.label, "Load Me");
      assert.strictEqual(result.leftLen, 3);
      assert.ok(result.leftIsUA);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should load non-existent template returns null", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        return await storage.load("nonexistent");
      });
      assert.ok(result === null || result === undefined);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should list stored templates", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        await storage.save({ id: "l1", label: "A", leftCode: new Uint8Array([1]), leftMask: new Uint8Array([2]) });
        await storage.save({ id: "l2", label: "B", leftCode: new Uint8Array([3]), leftMask: new Uint8Array([4]) });
        return await storage.list();
      });
      assert.strictEqual(result.length, 2);
      assert.ok(result.some(function (r) { return r.id === "l1"; }));
      assert.ok(result.some(function (r) { return r.id === "l2"; }));
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should list returns empty array when no templates", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        return await storage.list();
      });
      assert.strictEqual(result.length, 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should delete template by id", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        await storage.save({ id: "del-1", label: "Delete Me", leftCode: new Uint8Array([1]), leftMask: new Uint8Array([2]) });
        await storage.delete("del-1");
        var list = await storage.list();
        return list.length;
      });
      assert.strictEqual(result, 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should count stored templates", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        await storage.save({ id: "c1", label: "C1", leftCode: new Uint8Array([1]), leftMask: new Uint8Array([2]) });
        await storage.save({ id: "c2", label: "C2", leftCode: new Uint8Array([3]), leftMask: new Uint8Array([4]) });
        await storage.save({ id: "c3", label: "C3", leftCode: new Uint8Array([5]), leftMask: new Uint8Array([6]) });
        return await storage.count();
      });
      assert.strictEqual(result, 3);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should count returns 0 when empty", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        return await storage.count();
      });
      assert.strictEqual(result, 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should clear all templates", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.save({ id: "clr1", label: "X", leftCode: new Uint8Array([1]), leftMask: new Uint8Array([2]) });
        await storage.save({ id: "clr2", label: "Y", leftCode: new Uint8Array([3]), leftMask: new Uint8Array([4]) });
        await storage.clear();
        return await storage.count();
      });
      assert.strictEqual(result, 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should export all records", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        await storage.save({ id: "exp1", label: "E1", leftCode: new Uint8Array([1]), leftMask: new Uint8Array([2]) });
        await storage.save({ id: "exp2", label: "E2", leftCode: new Uint8Array([3]), leftMask: new Uint8Array([4]) });
        return await storage.exportAllRecords();
      });
      assert.strictEqual(result.length, 2);
      assert.ok(result[0].id);
      assert.ok(result[1].id);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should export all records returns empty array when empty", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        return await storage.exportAllRecords();
      });
      assert.strictEqual(result.length, 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should import records with valid data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        var count = await storage.importRecords([
          { id: "imp1", label: "I1", leftCode: [1, 2], leftMask: [3, 4], enrolledAt: Date.now() },
          { id: "imp2", label: "I2", leftCode: [5, 6], leftMask: [7, 8], enrolledAt: Date.now() },
        ]);
        return count;
      });
      assert.strictEqual(result, 2);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should import records with null entries (skipped)", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        var count = await storage.importRecords([
          null,
          { id: null },
          { id: undefined },
          { id: "valid", label: "ok", leftCode: [1], leftMask: [2] },
        ]);
        var list = await storage.list();
        return { imported: count, stored: list.length };
      });
      assert.strictEqual(result.imported, 4);
      assert.strictEqual(result.stored, 1);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should import records with enc field (legacy normalization)", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        var count = await storage.importRecords([
          { id: "enc-1", enc: { alg: "AES-GCM" }, leftCode: [1, 2], leftMask: [3, 4] },
        ]);
        return count;
      });
      assert.strictEqual(result, 1);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should throw when importing non-array", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var threw = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        try {
          await storage.importRecords("not-an-array");
          return false;
        } catch (e) {
          return e.message.includes("records must be an array");
        }
      });
      assert.ok(threw);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should export template as JSON", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var parsed = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        await storage.save({
          id: "json-1", label: "JSON", eyeSide: "right",
          leftCode: new Uint8Array([10, 20]),
          leftMask: new Uint8Array([30, 40]),
        });
        var json = await storage.exportTemplate("json-1");
        return JSON.parse(json);
      });
      assert.strictEqual(parsed.format, "redosan-iris-v1");
      assert.strictEqual(parsed.template.id, "json-1");
      assert.ok(parsed.exportedAt);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should export template for non-existent id returns null", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        return await storage.exportTemplate("nonexistent");
      });
      assert.ok(result === null || result === undefined);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should import template from valid JSON", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var id = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        var json = JSON.stringify({
          format: "redosan-iris-v1",
          exportedAt: Date.now(),
          template: {
            id: "imported-1", label: "Imported", eyeSide: "left",
            leftCode: Array.from(new Uint8Array([1, 2, 3])),
            leftMask: Array.from(new Uint8Array([4, 5, 6])),
          },
        });
        return await storage.importTemplate(json);
      });
      assert.strictEqual(id, "imported-1");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should throw when importing invalid format JSON", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var threw = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        try {
          await storage.importTemplate(JSON.stringify({ format: "bad" }));
          return false;
        } catch (e) {
          return e.message.includes("Invalid iris template format");
        }
      });
      assert.ok(threw);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should throw when importing null JSON", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var threw = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        try {
          await storage.importTemplate(null);
          return false;
        } catch (e) {
          return true;
        }
      });
      assert.ok(threw);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should full export/import roundtrip preserves data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await page.evaluate(function () { localStorage.setItem("iris_consent", "1"); });
      await page.reload();
      await page.waitForLoadState("networkidle");

      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        await storage.clear();
        await storage.save({
          id: "rt-1", label: "Roundtrip", eyeSide: "left",
          leftCode: new Uint8Array([10, 20, 30]),
          leftMask: new Uint8Array([40, 50, 60]),
        });
        var exported = await storage.exportAllRecords();
        await storage.clear();
        var imported = await storage.importRecords(exported);
        var list = await storage.list();
        return { exported: exported.length, imported: imported, stored: list.length };
      });
      assert.strictEqual(result.exported, 1);
      assert.strictEqual(result.imported, 1);
      assert.strictEqual(result.stored, 1);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should setVaultKey and hasVaultKey work correctly", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(function () {
        var storage = new window.IrisStorage();
        var before = storage.hasVaultKey();
        storage.setVaultKey({ dummy: true });
        var after = storage.hasVaultKey();
        storage.setVaultKey(null);
        var afterNull = storage.hasVaultKey();
        return { before: before, after: after, afterNull: afterNull };
      });
      assert.strictEqual(result.before, false);
      assert.strictEqual(result.after, true);
      assert.strictEqual(result.afterNull, false);
    } finally {
      await closePage(ctx, page);
    }
  });
});
