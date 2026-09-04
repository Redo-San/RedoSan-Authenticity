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

describe("Iris Storage — _rehydrate paths", function () {
  it("should rehydrate null record returns null", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        return await storage._rehydrate(null);
      });
      assert.strictEqual(result, null);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should rehydrate undefined record returns null", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        return await storage._rehydrate(undefined);
      });
      assert.strictEqual(result, null);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should rehydrate legacy plaintext record with both eyes", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var record = {
          id: "legacy-both",
          label: "Both",
          enrolledAt: Date.now(),
          leftCode: [1, 2, 3],
          leftMask: [4, 5, 6],
          rightCode: [7, 8],
          rightMask: [9, 10],
          eyeSide: "right",
          quality: { score: 85 },
        };
        var r = await storage._rehydrate(record);
        return {
          leftIsUA: r.leftCode instanceof Uint8Array,
          rightIsUA: r.rightCode instanceof Uint8Array,
          leftLen: r.leftCode.length,
          rightLen: r.rightCode.length,
          eyeSide: r.eyeSide,
          qualityScore: r.quality.score,
        };
      });
      assert.ok(result.leftIsUA, "leftCode should be Uint8Array");
      assert.ok(result.rightIsUA, "rightCode should be Uint8Array");
      assert.strictEqual(result.leftLen, 3);
      assert.strictEqual(result.rightLen, 2);
      assert.strictEqual(result.eyeSide, "right");
      assert.strictEqual(result.qualityScore, 85);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should rehydrate legacy record with left eye only", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var record = {
          id: "legacy-left",
          label: "Left",
          enrolledAt: Date.now(),
          leftCode: [10, 20],
          leftMask: [30, 40],
          eyeSide: "left",
        };
        var r = await storage._rehydrate(record);
        return {
          leftIsUA: r.leftCode instanceof Uint8Array,
          hasRight: !!r.rightCode,
          eyeSide: r.eyeSide,
        };
      });
      assert.ok(result.leftIsUA, "leftCode should be Uint8Array");
      assert.strictEqual(result.hasRight, false);
      assert.strictEqual(result.eyeSide, "left");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should rehydrate legacy record missing rightCode/rightMask", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var record = {
          id: "no-right",
          leftCode: [1],
          leftMask: [2],
          eyeSide: "left",
        };
        var r = await storage._rehydrate(record);
        return { hasRight: !!r.rightCode, eyeSide: r.eyeSide };
      });
      assert.strictEqual(result.hasRight, false);
      assert.strictEqual(result.eyeSide, "left");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should rehydrate record with invalid eyeSide normalizes to unknown", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var record = {
          id: "bad-eye",
          leftCode: [1],
          leftMask: [2],
          eyeSide: "invalid",
        };
        var r = await storage._rehydrate(record);
        return r.eyeSide;
      });
      assert.strictEqual(result, "unknown");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should rehydrate record with undefined eyeSide normalizes to unknown", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var record = { id: "undef-eye", leftCode: [1], leftMask: [2] };
        var r = await storage._rehydrate(record);
        return r.eyeSide;
      });
      assert.strictEqual(result, "unknown");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should rehydrate record with empty string eyeSide normalizes to unknown", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var record = {
          id: "empty-eye",
          leftCode: [1],
          leftMask: [2],
          eyeSide: "",
        };
        var r = await storage._rehydrate(record);
        return r.eyeSide;
      });
      assert.strictEqual(result, "unknown");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("should rehydrate legacy record with quality field", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(async function () {
        var storage = new window.IrisStorage();
        var record = {
          id: "with-quality",
          leftCode: [1],
          leftMask: [2],
          quality: { irisContrast: 0.8, pupilContrast: 0.6 },
        };
        var r = await storage._rehydrate(record);
        return {
          hasQuality: !!r.quality,
          irisContrast: r.quality.irisContrast,
        };
      });
      assert.ok(result.hasQuality);
      assert.strictEqual(result.irisContrast, 0.8);
    } finally {
      await closePage(ctx, page);
    }
  });
});
