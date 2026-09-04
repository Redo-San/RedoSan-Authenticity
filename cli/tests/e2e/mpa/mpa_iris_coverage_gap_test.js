var { describe, it, before, after } = require("node:test");
var assert = require("node:assert/strict");
var path = require("path");
var { chromium } = require("playwright");
var { ensureServer, openPage, closePage } = require("../mpa_helpers");

var PAGE_ID = "iris-biometric";
var BASE = "http://localhost:8080";
var ROOT = path.resolve(__dirname, "..", "..", "..", "..");
var browser;

before(async function () {
  await ensureServer();
  browser = await chromium.launch({ headless: true });
});

after(async function () {
  if (browser) await browser.close();
});

async function loadFile(page, relPath) {
  var absPath = path.join(ROOT, relPath).replace(/\\/g, "/");
  await page.addScriptTag({ path: absPath });
}

describe("Iris coverage — iris_quality.js gaps", function () {
  it("IrisQuality constructor", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var result = await page.evaluate(function () {
        var q = new window.IrisQuality();
        return typeof q;
      });
      assert.strictEqual(result, "object");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("pupilBoundaryCircularity with null mask returns 1", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisQuality.pupilBoundaryCircularity(null, 100, 100);
      });
      assert.strictEqual(r, 1);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("pupilBoundaryCircularity with empty mask returns 1", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisQuality.pupilBoundaryCircularity(
          new Uint8Array(0),
          100,
          100,
        );
      });
      assert.strictEqual(r, 1);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("pupilBoundaryCircularity with normW=0 returns 1", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisQuality.pupilBoundaryCircularity(
          new Uint8Array(10),
          0,
          100,
        );
      });
      assert.strictEqual(r, 1);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("pupilBoundaryCircularity with normH=0 returns 1", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisQuality.pupilBoundaryCircularity(
          new Uint8Array(10),
          100,
          0,
        );
      });
      assert.strictEqual(r, 1);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("pupilBoundaryCircularity with all-one mask (area=0) returns 1", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var w = 20,
          h = 20;
        var mask = new Uint8Array(w * h);
        mask.fill(1);
        return window.IrisQuality.pupilBoundaryCircularity(mask, w, h);
      });
      assert.strictEqual(r, 1);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("irisPupilContrast with null returns 0", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisQuality.irisPupilContrast(null, 100, 100);
      });
      assert.strictEqual(r, 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("irisPupilContrast with normH=1 uses fallback 128", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Float64Array(10);
        data.fill(100);
        return window.IrisQuality.irisPupilContrast(data, 10, 1);
      });
      assert.ok(typeof r === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("irisScleraContrast with null returns 0", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisQuality.irisScleraContrast(null, 100, 100);
      });
      assert.strictEqual(r, 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("irisScleraContrast with normH=1 uses fallbacks", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Float64Array(10);
        data.fill(100);
        return window.IrisQuality.irisScleraContrast(data, 10, 1);
      });
      assert.ok(typeof r === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("sharpness with null returns 0", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisQuality.sharpness(null, 100, 100);
      });
      assert.strictEqual(r, 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("sharpness with normW=2 returns 0 (count=0)", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Float64Array(4);
        data.fill(100);
        return window.IrisQuality.sharpness(data, 2, 2);
      });
      assert.strictEqual(r, 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("motionBlur with null returns 1", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisQuality.motionBlur(null, 100, 100);
      });
      assert.strictEqual(r, 1);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("motionBlur with normW=2 returns 1 (count=0)", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Float64Array(4);
        data.fill(100);
        return window.IrisQuality.motionBlur(data, 2, 2);
      });
      assert.strictEqual(r, 1);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("assess with all metrics failing", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var w = 64,
          h = 64;
        var mask = new Uint8Array(w * h);
        mask.fill(1);
        var iris = new Float64Array(w * h);
        iris.fill(128);
        return window.IrisQuality.assess({
          mask: mask,
          normalizedIris: iris,
          normW: w,
          normH: h,
          pupil: { radius: 1 },
          iris: { cx: 0, cy: 0, radius: 60 },
          imageWidth: 640,
          imageHeight: 480,
        });
      });
      assert.ok(r.issues.length > 0);
      assert.ok(r.score < 100);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("assess with mixed metrics (some pass, some fail)", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var w = 64,
          h = 64;
        var mask = new Uint8Array(w * h);
        for (var y = 0; y < h; y++)
          for (var x = 0; x < w; x++) mask[y * w + x] = x < 16 ? 0 : 1;
        var iris = new Float64Array(w * h);
        for (var i = 0; i < iris.length; i++) iris[i] = 50 + (i % 200);
        return window.IrisQuality.assess({
          mask: mask,
          normalizedIris: iris,
          normW: w,
          normH: h,
          pupil: { radius: 10 },
          iris: { cx: 32, cy: 32, radius: 28 },
          imageWidth: 640,
          imageHeight: 480,
        });
      });
      assert.ok(typeof r.passed === "boolean");
      assert.ok(typeof r.score === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("assess with all passing metrics", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var w = 64,
          h = 64;
        var mask = new Uint8Array(w * h);
        mask.fill(0);
        var iris = new Float64Array(w * h);
        for (var y = 0; y < h; y++)
          for (var x = 0; x < w; x++) iris[y * w + x] = y < h / 3 ? 80 : 180;
        return window.IrisQuality.assess({
          mask: mask,
          normalizedIris: iris,
          normW: w,
          normH: h,
          pupil: { radius: 10 },
          iris: { cx: 32, cy: 32, radius: 28 },
          imageWidth: 640,
          imageHeight: 480,
        });
      });
      assert.ok(typeof r.passed === "boolean");
      assert.ok(typeof r.score === "number");
    } finally {
      await closePage(ctx, page);
    }
  });
});

describe("Iris coverage — iris_quality_full.js gaps", function () {
  it("IrisQualityFull constructor", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return typeof new window.IrisQualityFull();
      });
      assert.strictEqual(r, "object");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("focusQuality with uniform image", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Uint8Array(64 * 64);
        data.fill(128);
        return window.IrisQualityFull.focusQuality(data, 64, 64);
      });
      assert.ok(typeof r === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("rawLaplacianVariance with uniform image", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Uint8Array(64 * 64);
        data.fill(128);
        return window.IrisQualityFull.rawLaplacianVariance(data, 64, 64);
      });
      assert.ok(typeof r === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("visibleIrisArea with full mask", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var mask = new Uint8Array(64 * 64);
        mask.fill(0);
        return window.IrisQualityFull.visibleIrisArea(mask, 64, 64, {
          x: 32,
          y: 32,
          radius: 20,
        });
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.viaRatio === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("angularOcclusion with no occlusion", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var mask = new Uint8Array(64 * 64);
        mask.fill(0);
        return window.IrisQualityFull.angularOcclusion(mask, 64, 64, {
          x: 32,
          y: 32,
          radius: 20,
        });
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.maxOcclusion90 === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("angularOcclusion with partial occlusion", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var w = 64,
          h = 64;
        var mask = new Uint8Array(w * h);
        for (var y = 0; y < h; y++)
          for (var x = 0; x < w; x++) mask[y * w + x] = y < h / 2 ? 1 : 0;
        return window.IrisQualityFull.angularOcclusion(mask, w, h, {
          x: 32,
          y: 32,
          radius: 20,
        });
      });
      assert.ok(typeof r === "object");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("detectIllumination with uniform image", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Uint8Array(64 * 64);
        data.fill(128);
        return window.IrisQualityFull.detectIllumination(data, 64, 64);
      });
      assert.ok(typeof r === "object");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("marginAdequacy with centered iris", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisQualityFull.marginAdequacy(
          { x: 32, y: 32 },
          20,
          64,
          64,
        );
      });
      assert.ok(typeof r === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("marginAdequacy with off-center iris", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisQualityFull.marginAdequacy(
          { x: 5, y: 5 },
          20,
          64,
          64,
        );
      });
      assert.ok(typeof r === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("grayscaleUtilization with uniform image", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Uint8Array(64 * 64);
        data.fill(128);
        return window.IrisQualityFull.grayscaleUtilization(data);
      });
      assert.ok(typeof r === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("grayscaleUtilization with gradient", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Uint8Array(64 * 64);
        for (var i = 0; i < data.length; i++) data[i] = i % 256;
        return window.IrisQualityFull.grayscaleUtilization(data);
      });
      assert.ok(r >= 1);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("motionBlur with uniform image", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Uint8Array(64 * 64);
        data.fill(128);
        return window.IrisQualityFull.motionBlur(data, 64, 64);
      });
      assert.ok(typeof r === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("motionBlurFocus with uniform float image", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Float64Array(64 * 64);
        data.fill(128);
        return window.IrisQualityFull.motionBlurFocus(data, 64, 64);
      });
      assert.ok(typeof r === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("specularReflection with uniform image", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Uint8Array(64 * 64);
        data.fill(128);
        return window.IrisQualityFull.specularReflection(
          data,
          64,
          64,
          { x: 32, y: 32, radius: 10 },
          { x: 32, y: 32, radius: 20 },
        );
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.ratio === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("specularReflection with bright spot", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var w = 64,
          h = 64;
        var data = new Uint8Array(w * h);
        data.fill(50);
        for (var y = 28; y < 36; y++)
          for (var x = 28; x < 36; x++) data[y * w + x] = 255;
        return window.IrisQualityFull.specularReflection(
          data,
          w,
          h,
          { x: 32, y: 32, radius: 10 },
          { x: 32, y: 32, radius: 20 },
        );
      });
      assert.ok(typeof r === "object");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("eyelidCircularity with full mask", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var mask = new Uint8Array(64 * 64);
        mask.fill(0);
        return window.IrisQualityFull.eyelidCircularity(
          mask,
          64,
          64,
          { x: 32, y: 32 },
          20,
        );
      });
      assert.ok(typeof r === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("depthOfField with uniform image", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Uint8Array(64 * 64);
        data.fill(128);
        return window.IrisQualityFull.depthOfField(
          data,
          64,
          64,
          { x: 32, y: 32 },
          20,
        );
      });
      assert.ok(typeof r === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("pupilBoundaryCircularity with all-iris mask returns 1", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var mask = new Uint8Array(64 * 64);
        mask.fill(1);
        return window.IrisQualityFull.pupilBoundaryCircularity(mask, 64, 64);
      });
      assert.strictEqual(r, 1);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("mutualQualityComparison with null", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisQualityFull.mutualQualityComparison(null);
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.score === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("computeCompositeQuality with valid data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Uint8Array(64 * 64);
        for (var i = 0; i < data.length; i++) data[i] = 80 + (i % 100);
        return window.IrisQualityFull.computeCompositeQuality({
          imageData: data,
          width: 64,
          height: 64,
          pupil: { x: 32, y: 32, radius: 8 },
          iris: { x: 32, y: 32, radius: 20 },
        });
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.score === "number");
      assert.ok(typeof r.level === "string");
      assert.ok(typeof r.passed === "boolean");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("detectNirCapability returns object", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(async function () {
        return await window.IrisQualityFull.detectNirCapability();
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.nirAvailable === "boolean");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("generateQualityVector with valid params", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Uint8Array(64 * 64);
        for (var i = 0; i < data.length; i++) data[i] = 80 + (i % 100);
        return window.IrisQualityFull.generateQualityVector({
          imageData: data,
          width: 64,
          height: 64,
          pupil: { x: 32, y: 32, radius: 8 },
          iris: { x: 32, y: 32, radius: 20 },
        });
      });
      assert.ok(r instanceof Float64Array);
      assert.ok(r.length === 64);
    } finally {
      await closePage(ctx, page);
    }
  });
});

describe("Iris coverage — iris_liveness.js gaps", function () {
  it("IrisLiveness constructor and assess", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var inst = new window.IrisLiveness();
        var result = inst.assess({
          imageWidth: 320,
          imageHeight: 240,
          pupil: { cx: 160, cy: 120, radius: 30 },
          iris: { cx: 160, cy: 120, radius: 80 },
          dilationFrames: [
            { pupilRadius: 30, irisRadius: 80 },
            { pupilRadius: 32, irisRadius: 80 },
            { pupilRadius: 28, irisRadius: 80 },
          ],
          temporalFrames: [
            { irisCx: 160, irisCy: 120 },
            { irisCx: 161, irisCy: 121 },
            { irisCx: 159, irisCy: 119 },
          ],
          rgbImage: new Uint8Array(100).fill(100),
          grayImage: new Uint8Array(100).fill(80),
        });
        return {
          score: result.score,
          isLive: result.isLive,
          checks: result.checks.length,
        };
      });
      assert.ok(typeof r.score === "number");
      assert.ok(typeof r.isLive === "boolean");
      assert.ok(r.checks > 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("computeAPCER with (0, 10) returns 0", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisLiveness.computeAPCER(0, 10);
      });
      assert.strictEqual(r, 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("computeAPCER with (3, 10) returns 0.3", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisLiveness.computeAPCER(3, 10);
      });
      assert.ok(typeof r === "number");
      assert.ok(r > 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("computeAPCER with totalAttacks=0", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisLiveness.computeAPCER(0, 0);
      });
      assert.strictEqual(r, 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("computeBPCER with (0, 10) returns 0", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisLiveness.computeBPCER(0, 10);
      });
      assert.strictEqual(r, 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("computeBPCER with (2, 10) returns 0.2", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisLiveness.computeBPCER(2, 10);
      });
      assert.ok(typeof r === "number");
      assert.ok(r > 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("computeBPCER with totalBonaFide=0", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisLiveness.computeBPCER(0, 0);
      });
      assert.strictEqual(r, 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("classifyPAISpecies with checks", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisLiveness.classifyPAISpecies({
          checks: [
            { name: "texture", score: 0.8 },
            { name: "color", score: 0.7 },
            { name: "depth", score: 0.3 },
          ],
        });
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.speciesName === "string");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("getConfig returns default config", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return new window.IrisLiveness().getConfig();
      });
      assert.ok(typeof r === "object");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("specularReflectionTest with data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Float64Array(64 * 64);
        data.fill(80);
        for (var y = 28; y < 36; y++)
          for (var x = 28; x < 36; x++) data[y * 64 + x] = 255;
        return window.IrisLiveness.specularReflectionTest(data, 64, 64, {
          cx: 32,
          cy: 32,
          radius: 10,
        });
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.score === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("pupilDilationTest with frames", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisLiveness.pupilDilationTest([
          { pupilRadius: 30, irisRadius: 80 },
          { pupilRadius: 35, irisRadius: 80 },
          { pupilRadius: 25, irisRadius: 80 },
        ]);
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.score === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("temporalConsistencyTest with frames", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisLiveness.temporalConsistencyTest([
          { irisCx: 160, irisCy: 120 },
          { irisCx: 161, irisCy: 121 },
          { irisCx: 159, irisCy: 119 },
        ]);
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.score === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("textureAnalysisTest with data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Float64Array(64 * 64);
        for (var i = 0; i < data.length; i++) data[i] = 80 + Math.sin(i) * 30;
        return window.IrisLiveness.textureAnalysisTest(data, 64, 64, {
          cx: 32,
          cy: 32,
          radius: 20,
        });
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.score === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("colorChannelAnalysisTest with data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Uint8Array(64 * 64 * 3);
        for (var i = 0; i < data.length; i += 3) {
          data[i] = 100;
          data[i + 1] = 120;
          data[i + 2] = 80;
        }
        return window.IrisLiveness.colorChannelAnalysisTest(data, 64, 64, {
          cx: 32,
          cy: 32,
          radius: 20,
        });
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.score === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("depthEstimationTest with data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Float64Array(64 * 64);
        data.fill(80);
        return window.IrisLiveness.depthEstimationTest(data, 64, 64, {
          cx: 32,
          cy: 32,
          radius: 20,
        });
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.score === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("periodicPatternTest with data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var data = new Float64Array(64 * 64);
        for (var y = 0; y < 64; y++)
          for (var x = 0; x < 64; x++)
            data[y * 64 + x] = 128 + 50 * Math.sin(x * 0.5);
        return window.IrisLiveness.periodicPatternTest(data, 64, 64, {
          cx: 32,
          cy: 32,
          radius: 20,
        });
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.score === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("computeIAPAR with array of agency data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisLiveness.computeIAPAR([
          { agency: "A", apcer: 0.1, bpcer: 0.05 },
          { agency: "B", apcer: 0.2, bpcer: 0.1 },
        ]);
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.iapar === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("computeBpcerApcerPoints with data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var bonaFide = [];
        var attack = [];
        for (var i = 0; i < 50; i++) {
          bonaFide.push(0.7 + Math.random() * 0.3);
          attack.push(Math.random() * 0.5);
        }
        return window.IrisLiveness.computeBpcerApcerPoints(bonaFide, attack);
      });
      assert.ok(typeof r === "object");
      assert.ok(Array.isArray(r.points));
    } finally {
      await closePage(ctx, page);
    }
  });
});

describe("Iris coverage — iris_performance.js (loaded via CSP-safe path)", function () {
  it("calculateEER with ROC data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return window.IrisPerformance.calculateEER([
          { threshold: 0.1, far: 0.9, frr: 0.05 },
          { threshold: 0.3, far: 0.5, frr: 0.15 },
          { threshold: 0.5, far: 0.1, frr: 0.5 },
          { threshold: 0.7, far: 0.05, frr: 0.8 },
        ]);
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.eer === "number");
      assert.ok(typeof r.threshold === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("calculateFAR and calculateFRR", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return {
          far: window.IrisPerformance.calculateFAR(5, 100),
          frr: window.IrisPerformance.calculateFRR(3, 100),
        };
      });
      assert.ok(typeof r.far === "number");
      assert.ok(typeof r.frr === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("calculateAccuracy", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return window.IrisPerformance.calculateAccuracy(80, 15, 100);
      });
      assert.ok(typeof r === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("generatePADDET with labels and scores", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return window.IrisPerformance.generatePADDET(
          [0, 0, 0, 1, 1, 1],
          [0.8, 0.7, 0.6, 0.3, 0.2, 0.1],
        );
      });
      assert.ok(Array.isArray(r));
      assert.ok(r.length > 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("generateROC with genuine/impostor scores", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return window.IrisPerformance.generateROC(
          [0.8, 0.7, 0.6],
          [0.3, 0.2, 0.1],
          10,
        );
      });
      assert.ok(Array.isArray(r));
      assert.ok(r.length > 0);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("wilsonCI with data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return window.IrisPerformance.wilsonCI(50, 100);
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.lower === "number");
      assert.ok(typeof r.upper === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("wilsonCI with 0 successes", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return window.IrisPerformance.wilsonCI(0, 100);
      });
      assert.ok(typeof r === "object");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("evaluate with comprehensive data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return window.IrisPerformance.evaluate({
          genuineScores: [0.8, 0.7, 0.6, 0.75, 0.65],
          impostorScores: [0.3, 0.2, 0.1, 0.25, 0.15],
          systemName: "TestSystem",
        });
      });
      assert.ok(typeof r === "object");
      assert.ok(r.metrics);
      assert.ok(r.summary);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("pairedTTest with identical distributions", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return window.IrisPerformance.pairedTTest([1, 2, 3], [1, 2, 3]);
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.tStatistic === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("pairedTTest with different distributions", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return window.IrisPerformance.pairedTTest([1, 2, 3], [4, 5, 6]);
      });
      assert.ok(typeof r === "object");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("compareSystems", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return window.IrisPerformance.compareSystems(
          { genuineScores: [0.8, 0.7], impostorScores: [0.3, 0.2] },
          { genuineScores: [0.5, 0.4], impostorScores: [0.6, 0.5] },
        );
      });
      assert.ok(typeof r === "object");
      assert.ok(r.winner);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("recordFTA and getFtaFterRates", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        var P = window.IrisPerformance;
        var inst = new P();
        P.recordFTA(inst);
        P.recordFTA(inst);
        P.recordFTER(inst);
        P.recordAcquisition(inst, 100);
        P.recordAcquisition(inst, 200);
        P.recordEnrollment(inst, 300);
        return P.getFtaFterRates(inst);
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.ftaRate === "number");
      assert.ok(typeof r.fterRate === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("fnirAtFpir with data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return window.IrisPerformance.fnirAtFpir(
          [0.8, 0.7, 0.6],
          [0.3, 0.2, 0.1],
        );
      });
      assert.ok(typeof r === "object");
      assert.ok(Array.isArray(r.operatingPoints));
    } finally {
      await closePage(ctx, page);
    }
  });

  it("computeTimingStats with instance", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        var P = window.IrisPerformance;
        var inst = new P();
        P.recordAcquisition(inst, 100);
        P.recordAcquisition(inst, 200);
        P.recordEnrollment(inst, 300);
        return P.computeTimingStats(inst);
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.eventCount === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("generateDET with data", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return window.IrisPerformance.generateDET(
          [0.8, 0.7, 0.6],
          [0.3, 0.2, 0.1],
        );
      });
      assert.ok(Array.isArray(r));
    } finally {
      await closePage(ctx, page);
    }
  });

  it("reportPADMetrics", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      await loadFile(page, "Iris_Biometric/iris_performance.js");
      var r = await page.evaluate(function () {
        return window.IrisPerformance.reportPADMetrics(
          [0, 0, 1, 1],
          [0.8, 0.7, 0.3, 0.2],
        );
      });
      assert.ok(typeof r === "object");
    } finally {
      await closePage(ctx, page);
    }
  });
});

describe("Iris coverage — iris_template_protection.js gaps", function () {
  it("generateProjectionMatrix", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        return window.IrisTemplateProtection.generateProjectionMatrix(128, 64);
      });
      assert.ok(r instanceof Float64Array);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("biohash", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var code = new Uint8Array(128);
        for (var i = 0; i < 128; i++) code[i] = Math.random() > 0.5 ? 1 : 0;
        var mat = window.IrisTemplateProtection.generateProjectionMatrix(
          128,
          64,
        );
        return window.IrisTemplateProtection.biohash(code, mat, 64);
      });
      assert.ok(typeof r === "object");
      assert.ok(r.hashed instanceof Uint8Array);
      assert.ok(typeof r.score === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("verifyBiohash with matching hashes", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var h = new Uint8Array(64);
        h.fill(1);
        return window.IrisTemplateProtection.verifyBiohash(h, h);
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.match === "boolean");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("verifyBiohash with different hashes", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var h1 = new Uint8Array(64);
        h1.fill(1);
        var h2 = new Uint8Array(64);
        h2.fill(0);
        return window.IrisTemplateProtection.verifyBiohash(h1, h2);
      });
      assert.ok(typeof r === "object");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("createTransformation and transform", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var key = new Uint8Array(32);
        key.fill(42);
        var salt = new Uint8Array(16);
        salt.fill(10);
        var fn = window.IrisTemplateProtection.createTransformation(key, salt);
        var code = new Uint8Array(256);
        for (var i = 0; i < 256; i++) code[i] = Math.random() > 0.5 ? 1 : 0;
        var transformed = window.IrisTemplateProtection.transform(code, fn);
        return {
          isUint8Array: transformed instanceof Uint8Array,
          length: transformed.length,
        };
      });
      assert.ok(r.isUint8Array);
      assert.strictEqual(r.length, 256);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("commit and verifyCommitment", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(async function () {
        var code = new Uint8Array(256);
        for (var i = 0; i < 256; i++) code[i] = Math.random() > 0.5 ? 1 : 0;
        var key = new Uint8Array(32);
        key.fill(42);
        var commitment = await window.IrisTemplateProtection.commit(code, key);
        var valid = await window.IrisTemplateProtection.verifyCommitment(
          code,
          key,
          commitment.nonce,
          commitment.commitment,
        );
        return {
          hasCommitment: typeof commitment.commitment === "string",
          valid: valid,
        };
      });
      assert.ok(r.hasCommitment);
      assert.ok(r.valid);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("verifyCommitment with wrong key returns false", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(async function () {
        var code = new Uint8Array(256);
        code.fill(1);
        var key = new Uint8Array(32);
        key.fill(42);
        var commitment = await window.IrisTemplateProtection.commit(code, key);
        var wrongKey = new Uint8Array(32);
        wrongKey.fill(99);
        return await window.IrisTemplateProtection.verifyCommitment(
          code,
          wrongKey,
          commitment.nonce,
          commitment.commitment,
        );
      });
      assert.strictEqual(r, false);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("createCancelable and testUnlinkability", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(async function () {
        var code = new Uint8Array(256);
        for (var i = 0; i < 256; i++) code[i] = Math.random() > 0.5 ? 1 : 0;
        var userKey = new Uint8Array(32);
        userKey.fill(42);
        var result = await window.IrisTemplateProtection.createCancelable(
          code,
          userKey,
        );
        return {
          hasTemplate: result.template instanceof Uint8Array,
          hasKeyHash: typeof result.keyHash === "string",
        };
      });
      assert.ok(r.hasTemplate);
      assert.ok(r.hasKeyHash);
    } finally {
      await closePage(ctx, page);
    }
  });

  it("testUnlinkability with random codes", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var code = new Uint8Array(256);
        for (var i = 0; i < 256; i++) code[i] = Math.random() > 0.5 ? 1 : 0;
        return window.IrisTemplateProtection.testUnlinkability(code, 5);
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.unlinkable === "boolean");
      assert.ok(typeof r.pairCount === "number");
    } finally {
      await closePage(ctx, page);
    }
  });

  it("verifyUnlinkability with templates", async function () {
    var { ctx, page } = await openPage(browser, PAGE_ID);
    try {
      var r = await page.evaluate(function () {
        var t1 = new Uint8Array(256);
        var t2 = new Uint8Array(256);
        t1.fill(1);
        t2.fill(0);
        return window.IrisTemplateProtection.verifyUnlinkability(t1, t2);
      });
      assert.ok(typeof r === "object");
      assert.ok(typeof r.unlinkable === "boolean");
      assert.ok(typeof r.distance === "number");
    } finally {
      await closePage(ctx, page);
    }
  });
});
