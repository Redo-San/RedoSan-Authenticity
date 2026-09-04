#!/usr/bin/env node
// ── Playwright CDP browser coverage capture & merge with Node.js V8 coverage ──
// Captures V8 coverage from Chromium (browser-process code) and merges it
// with Node.js V8 coverage to produce a unified report.

const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const IRIS_FILES = [
  "iris_camera.js",
  "iris_engine.js",
  "iris_liveness.js",
  "iris_matcher.js",
  "iris_performance.js",
  "iris_quality_full.js",
  "iris_quality.js",
  "iris_standards.js",
  "iris_storage.js",
  "iris_template_protection.js",
];

async function captureBrowserCoverage() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Start CDP JS coverage
  await page.coverage.startJSCoverage({ reportAnonymousScripts: false });

  // Load iris page
  await page.goto("http://localhost:8080/Style/pages/iris-biometric/", {
    waitUntil: "networkidle",
  });

  // Wait for page scripts to load
  await page.waitForTimeout(500);

  // Load modules NOT on the iris page via addScriptTag (CSP-safe: path, not url)
  await page.addScriptTag({
    path: path.join(ROOT, "Iris_Biometric", "iris_performance.js"),
  });
  await page.addScriptTag({
    path: path.join(ROOT, "Iris_Biometric", "iris_standards.js"),
  });
  await page.waitForTimeout(200);

  // Execute comprehensive browser-side tests to maximize coverage
  const results = await page.evaluate(() => {
    var r = { ok: [], err: [] };

    function tryCall(name, fn) {
      try {
        fn();
        r.ok.push(name);
      } catch (e) {
        r.err.push(name + ": " + e.message);
      }
    }

    // ── iris_quality.js ──
    tryCall("IrisQuality.constructor", () => new IrisQuality());
    tryCall("IrisQuality.pupilBoundaryCircularity", () => {
      var mask = new Uint8Array(100 * 100);
      for (var y = 30; y < 70; y++)
        for (var x = 30; x < 70; x++) mask[y * 100 + x] = 1;
      IrisQuality.pupilBoundaryCircularity(mask, 100, 100);
    });
    tryCall("IrisQuality.irisPupilContrast", () => {
      var img = new Float64Array(100 * 100).fill(128);
      IrisQuality.irisPupilContrast(img, 100, 100);
    });
    tryCall("IrisQuality.irisScleraContrast", () => {
      var img = new Float64Array(100 * 100).fill(128);
      IrisQuality.irisScleraContrast(img, 100, 100);
    });
    tryCall("IrisQuality.sharpness", () => {
      var img = new Float64Array(100 * 100).fill(128);
      IrisQuality.sharpness(img, 100, 100);
    });
    tryCall("IrisQuality.motionBlur", () => {
      var img = new Float64Array(100 * 100).fill(128);
      IrisQuality.motionBlur(img, 100, 100);
    });
    tryCall("IrisQuality.assess", () => {
      var normIris = new Float64Array(64 * 128).fill(128);
      var mask = new Uint8Array(64 * 128).fill(2);
      for (var y = 20; y < 50; y++)
        for (var x = 20; x < 50; x++) mask[y * 64 + x] = 0;
      IrisQuality.assess({
        normalizedIris: normIris,
        normW: 64,
        normH: 128,
        mask: mask,
        pupil: { cx: 32, cy: 40, radius: 12 },
        iris: { cx: 32, cy: 40, radius: 50 },
        imageWidth: 200,
        imageHeight: 200,
        marginAdequacy: { left: 10, right: 10, top: 10, bottom: 10 },
      });
    });
    // ── iris_quality_full.js ──
    tryCall("IrisQualityFull.constructor", () => new IrisQualityFull());
    tryCall("IrisQualityFull.focusQuality", () => {
      var img = new Uint8Array(100 * 100).fill(128);
      IrisQualityFull.focusQuality(img, 100, 100);
    });
    tryCall("IrisQualityFull.rawLaplacianVariance", () => {
      var img = new Uint8Array(100 * 100).fill(128);
      IrisQualityFull.rawLaplacianVariance(img, 100, 100);
    });
    tryCall("IrisQualityFull.usableArea", () => {
      var mask = new Uint8Array(100 * 100).fill(1);
      for (var y = 25; y < 75; y++)
        for (var x = 25; x < 75; x++) mask[y * 100 + x] = 2;
      IrisQualityFull.usableArea(mask);
    });
    tryCall("IrisQualityFull.mutualQualityComparison", () => {
      IrisQualityFull.mutualQualityComparison(null);
    });
    tryCall("IrisQualityFull.computeCompositeQuality", () => {
      IrisQualityFull.computeCompositeQuality(null);
    });
    tryCall("IrisQualityFull.eyelidCircularity", () => {
      var mask = new Uint8Array(100 * 100).fill(2);
      IrisQualityFull.eyelidCircularity(mask, 100, 100, { x: 50, y: 50 }, 40);
    });
    tryCall("IrisQualityFull.marginAdequacy", () => {
      IrisQualityFull.marginAdequacy({ x: 50, y: 50 }, 40, 100, 100);
    });
    tryCall("IrisQualityFull.depthOfField", () => {
      var img = new Uint8Array(100 * 100).fill(128);
      IrisQualityFull.depthOfField(img, 100, 100, { x: 50, y: 50 }, 40);
    });
    tryCall("IrisQualityFull.detectNirCapability", async () => {
      await IrisQualityFull.detectNirCapability();
    });
    tryCall("IrisQualityFull.generateQualityVector", () => {
      IrisQualityFull.generateQualityVector(null);
    });
    tryCall("IrisQualityFull.pupilBoundaryCircularity", () => {
      var mask = new Uint8Array(100 * 100).fill(2);
      for (var y = 30; y < 70; y++)
        for (var x = 30; x < 70; x++) mask[y * 100 + x] = 0;
      IrisQualityFull.pupilBoundaryCircularity(mask, 100, 100);
    });

    // ── iris_liveness.js ──
    tryCall("IrisLiveness.constructor", () => new IrisLiveness());
    tryCall("IrisLiveness.getConfig", () => new IrisLiveness().getConfig());
    tryCall("IrisLiveness.pupilDilationTest: varying", () => {
      IrisLiveness.pupilDilationTest([
        { pupilRadius: 10, irisRadius: 50 },
        { pupilRadius: 15, irisRadius: 50 },
        { pupilRadius: 12, irisRadius: 50 },
      ]);
    });
    tryCall("IrisLiveness.pupilDilationTest: constant", () => {
      IrisLiveness.pupilDilationTest([
        { pupilRadius: 15, irisRadius: 50 },
        { pupilRadius: 15, irisRadius: 50 },
      ]);
    });
    tryCall("IrisLiveness.specularReflectionTest: bright spots", () => {
      var img = new Float64Array(64 * 64).fill(100);
      img[32 * 64 + 32] = 240;
      img[32 * 64 + 33] = 235;
      img[10 * 64 + 10] = 250;
      IrisLiveness.specularReflectionTest(img, 64, 64, {
        cx: 32,
        cy: 32,
        radius: 10,
      });
    });
    tryCall("IrisLiveness.specularReflectionTest: null", () => {
      IrisLiveness.specularReflectionTest(null, 0, 0, null);
    });
    tryCall("IrisLiveness.temporalConsistencyTest: natural", () => {
      IrisLiveness.temporalConsistencyTest([
        { irisCx: 50, irisCy: 50 },
        { irisCx: 50.1, irisCy: 50.2 },
        { irisCx: 50.3, irisCy: 50.1 },
      ]);
    });
    tryCall("IrisLiveness.temporalConsistencyTest: too static", () => {
      IrisLiveness.temporalConsistencyTest([
        { irisCx: 50, irisCy: 50 },
        { irisCx: 50, irisCy: 50 },
        { irisCx: 50, irisCy: 50 },
      ]);
    });
    tryCall("IrisLiveness.temporalConsistencyTest: too much", () => {
      IrisLiveness.temporalConsistencyTest([
        { irisCx: 50, irisCy: 50 },
        { irisCx: 80, irisCy: 80 },
        { irisCx: 20, irisCy: 20 },
      ]);
    });
    tryCall("IrisLiveness.temporalConsistencyTest: partial", () => {
      IrisLiveness.temporalConsistencyTest([
        { irisCx: 50 },
        { irisCx: 50.1, irisCy: 50.1 },
        { irisCx: 50.2, irisCy: 50.2 },
      ]);
    });
    tryCall("IrisLiveness.moireDetectionTest", () => {
      var img = new Float64Array(64 * 64).fill(128);
      IrisLiveness.moireDetectionTest(img, 64, 64);
    });
    tryCall("IrisLiveness.textureAnalysisTest: gradient", () => {
      var img = new Float64Array(200 * 200);
      for (var y = 0; y < 200; y++)
        for (var x = 0; x < 200; x++) img[y * 200 + x] = (x + y) % 256;
      IrisLiveness.textureAnalysisTest(img, 200, 200, {
        cx: 100,
        cy: 100,
        radius: 80,
      });
    });
    tryCall("IrisLiveness.textureAnalysisTest: null", () => {
      IrisLiveness.textureAnalysisTest(null, 0, 0, null);
    });
    tryCall("IrisLiveness.colorChannelAnalysisTest: uniform", () => {
      var img = new Uint8Array(64 * 64 * 3).fill(128);
      IrisLiveness.colorChannelAnalysisTest(img, 64, 64, {
        cx: 32,
        cy: 32,
        radius: 20,
      });
    });
    tryCall("IrisLiveness.colorChannelAnalysisTest: NIR", () => {
      var img = new Uint8Array(64 * 64 * 3).fill(128);
      IrisLiveness.colorChannelAnalysisTest(img, 64, 64, {
        cx: 32,
        cy: 32,
        radius: 20,
      });
    });
    tryCall("IrisLiveness.colorChannelAnalysisTest: null", () => {
      IrisLiveness.colorChannelAnalysisTest(null, 0, 0, null);
    });
    tryCall("IrisLiveness.depthEstimationTest: gradient", () => {
      var img = new Float64Array(200 * 200);
      for (var y = 0; y < 200; y++)
        for (var x = 0; x < 200; x++) img[y * 200 + x] = (x + y) % 256;
      IrisLiveness.depthEstimationTest(img, 200, 200, {
        cx: 100,
        cy: 100,
        radius: 80,
      });
    });
    tryCall("IrisLiveness.depthEstimationTest: null", () => {
      IrisLiveness.depthEstimationTest(null, 0, 0, null);
    });
    tryCall("IrisLiveness.periodicPatternTest: random", () => {
      var img = new Float64Array(200 * 200);
      for (var i = 0; i < img.length; i++) img[i] = Math.random() * 255;
      IrisLiveness.periodicPatternTest(img, 200, 200);
    });
    tryCall("IrisLiveness.periodicPatternTest: striped", () => {
      var img = new Float64Array(200 * 200);
      for (var y = 0; y < 200; y++)
        for (var x = 0; x < 200; x++)
          img[y * 200 + x] = Math.sin(x * 0.3) * 127 + 128;
      IrisLiveness.periodicPatternTest(img, 200, 200);
    });
    tryCall("IrisLiveness.periodicPatternTest: null", () => {
      IrisLiveness.periodicPatternTest(null, 0, 0);
    });
    tryCall("IrisLiveness.computeAPCER: basic", () =>
      IrisLiveness.computeAPCER(5, 100),
    );
    tryCall("IrisLiveness.computeAPCER: zero", () =>
      IrisLiveness.computeAPCER(0, 0),
    );
    tryCall("IrisLiveness.computeBPCER: basic", () =>
      IrisLiveness.computeBPCER(10, 100),
    );
    tryCall("IrisLiveness.computeBPCER: zero", () =>
      IrisLiveness.computeBPCER(0, 0),
    );
    tryCall("IrisLiveness.computeIAPAR", () => {
      IrisLiveness.computeIAPAR([
        { agency: "A", apcer: 0.05, bpcer: 0.1 },
        { agency: "B", apcer: 0.08, bpcer: 0.12 },
      ]);
    });
    tryCall("IrisLiveness.computeIAPAR: empty", () =>
      IrisLiveness.computeIAPAR([]),
    );
    tryCall("IrisLiveness.computeBpcerApcerPoints", () => {
      var bonaFide = [];
      var attacks = [];
      for (var i = 0; i < 100; i++) {
        bonaFide.push(0.5 + Math.random() * 0.5);
        attacks.push(Math.random() * 0.5);
      }
      IrisLiveness.computeBpcerApcerPoints(bonaFide, attacks, [0.1, 0.2]);
    });
    tryCall("IrisLiveness.computeBpcerApcerPoints: null", () => {
      IrisLiveness.computeBpcerApcerPoints(null, null);
    });
    tryCall("IrisLiveness.classifyPAISpecies: no data", () => {
      IrisLiveness.classifyPAISpecies(null);
    });
    tryCall("IrisLiveness.classifyPAISpecies: low dilation", () => {
      IrisLiveness.classifyPAISpecies({
        checks: [
          { name: "pupilDilation", score: 0.1 },
          { name: "specularReflection", score: 0.1 },
          { name: "temporalConsistency", score: 0.1 },
        ],
      });
    });
    tryCall("IrisLiveness.classifyPAISpecies: screen moire", () => {
      IrisLiveness.classifyPAISpecies({
        checks: [
          { name: "moireDetection", score: 0.1 },
          { name: "colorChannelAnalysis", score: 0.1 },
        ],
      });
    });
    tryCall("IrisLiveness.classifyPAISpecies: low texture", () => {
      IrisLiveness.classifyPAISpecies({
        checks: [
          { name: "textureAnalysis", score: 0.1 },
          { name: "depthEstimation", score: 0.1 },
        ],
      });
    });
    tryCall("IrisLiveness.classifyPAISpecies: high scores", () => {
      IrisLiveness.classifyPAISpecies({
        checks: [
          { name: "pupilDilation", score: 0.9 },
          { name: "specularReflection", score: 0.9 },
          { name: "temporalConsistency", score: 0.9 },
        ],
      });
    });
    tryCall("IrisLiveness.assess: full params", () => {
      var gray = new Float64Array(200 * 200);
      for (var y = 0; y < 200; y++)
        for (var x = 0; x < 200; x++)
          gray[y * 200 + x] = 128 + Math.sin(x * 0.1) * 50;
      var rgb = new Uint8Array(200 * 200 * 3).fill(128);
      new IrisLiveness().assess({
        dilationFrames: [
          { pupilRadius: 10, irisRadius: 50 },
          { pupilRadius: 15, irisRadius: 50 },
        ],
        grayImage: gray,
        rgbImage: rgb,
        imageWidth: 200,
        imageHeight: 200,
        pupil: { cx: 100, cy: 100, radius: 15 },
        iris: { cx: 100, cy: 100, radius: 60 },
        temporalFrames: [
          { irisCx: 100, irisCy: 100 },
          { irisCx: 100.1, irisCy: 100.2 },
          { irisCx: 100.3, irisCy: 100.1 },
        ],
      });
    });
    tryCall("IrisLiveness.assess: minimal", () => {
      new IrisLiveness().assess({});
    });

    // ── iris_engine.js ──
    tryCall("IrisEngine.constructor", () => new IrisEngine());
    tryCall("IrisEngine.isLoaded", () => new IrisEngine().isLoaded());
    tryCall("IrisEngine.loadModels", async () => {
      await new IrisEngine().loadModels();
    });
    tryCall("IrisEngine._toGrayscale: ImageData", () => {
      var c = document.createElement("canvas");
      c.width = 10;
      c.height = 10;
      var ctx = c.getContext("2d");
      var imgData = ctx.createImageData(10, 10);
      for (var i = 0; i < imgData.data.length; i += 4) {
        imgData.data[i] = 128;
        imgData.data[i + 1] = 128;
        imgData.data[i + 2] = 128;
        imgData.data[i + 3] = 255;
      }
      IrisEngine._toGrayscale(imgData);
    });
    tryCall("IrisEngine._toGrayscale: Float64Array", () => {
      // Float64Array path needs a canvas source, so pass an HTMLCanvasElement
      var c = document.createElement("canvas");
      c.width = 10;
      c.height = 10;
      var ctx = c.getContext("2d");
      var imgData = ctx.createImageData(10, 10);
      IrisEngine._toGrayscale(imgData);
    });
    tryCall("IrisEngine._meanDisk", () => {
      var gray = new Float64Array(200 * 200).fill(128);
      IrisEngine._meanDisk(gray, 200, 200, 100, 100, 50);
    });
    tryCall("IrisEngine._meanAnnulus", () => {
      var gray = new Float64Array(200 * 200).fill(128);
      IrisEngine._meanAnnulus(gray, 200, 200, 100, 100, 20, 60);
    });
    tryCall("IrisEngine._varAnnulus", () => {
      var gray = new Float64Array(200 * 200);
      for (var i = 0; i < gray.length; i++) gray[i] = 100 + Math.random() * 50;
      IrisEngine._varAnnulus(gray, 200, 200, 100, 100, 20, 60);
    });
    tryCall("IrisEngine.validateEyePresence: ok", () => {
      var gray = new Float64Array(200 * 200).fill(100);
      IrisEngine.validateEyePresence(
        gray,
        200,
        200,
        { cx: 100, cy: 100, radius: 20 },
        { cx: 100, cy: 100, radius: 60 },
      );
    });
    tryCall("IrisEngine.validateEyePresence: no-signal", () => {
      var gray = new Float64Array(200 * 200).fill(128);
      IrisEngine.validateEyePresence(
        gray,
        200,
        200,
        { cx: 100, cy: 100, radius: 20 },
        { cx: 100, cy: 100, radius: 60 },
      );
    });
    tryCall("IrisEngine.validateEyePresence: no-dark-pupil", () => {
      var gray = new Float64Array(200 * 200).fill(200);
      IrisEngine.validateEyePresence(
        gray,
        200,
        200,
        { cx: 100, cy: 100, radius: 20 },
        { cx: 100, cy: 100, radius: 60 },
      );
    });
    tryCall("IrisEngine.detectPupil: synthetic", () => {
      var gray = new Float64Array(200 * 200).fill(150);
      for (var y = 90; y < 110; y++)
        for (var x = 90; x < 110; x++) gray[y * 200 + x] = 30;
      IrisEngine.detectPupil(gray, 200, 200);
    });
    tryCall("IrisEngine.detectIris: synthetic", () => {
      var gray = new Float64Array(200 * 200).fill(180);
      for (var y = 60; y < 140; y++)
        for (var x = 60; x < 140; x++) gray[y * 200 + x] = 100;
      IrisEngine.detectIris(gray, 200, 200, { cx: 100, cy: 100, radius: 20 });
    });
    tryCall("IrisEngine.normalize", () => {
      var gray = new Float64Array(200 * 200);
      for (var y = 0; y < 200; y++)
        for (var x = 0; x < 200; x++) gray[y * 200 + x] = (x + y) % 256;
      IrisEngine.normalize(
        gray,
        200,
        200,
        { cx: 100, cy: 100, radius: 20 },
        { cx: 100, cy: 100, radius: 60 },
        { irisWidth: 64, irisHeight: 128 },
      );
    });
    tryCall("IrisEngine.generateIrisCode: synthetic", () => {
      var norm = new Float64Array(64 * 128);
      for (var y = 0; y < 128; y++)
        for (var x = 0; x < 64; x++)
          norm[y * 64 + x] = Math.sin(x * 0.2 + y * 0.1) * 127 + 128;
      IrisEngine.generateIrisCode(norm, 64, 128);
    });

    // ── iris_matcher.js ──
    tryCall("IrisMatcher.constructor", () => new IrisMatcher());
    tryCall("IrisMatcher.hammingDistance", () => {
      var a = new Uint8Array(100).fill(0xff);
      var b = new Uint8Array(100).fill(0xaa);
      var m = new Uint8Array(100).fill(0xff);
      IrisMatcher.hammingDistance(a, b, m);
    });
    tryCall("IrisMatcher.decidabilityScore", () => {
      IrisMatcher.decidabilityScore(0.3, 100);
    });
    tryCall("IrisMatcher.identify: empty gallery", () => {
      IrisMatcher.identify(
        {
          leftCode: new Uint8Array(100),
          leftMask: new Uint8Array(100).fill(1),
        },
        [],
      );
    });

    // ── iris_performance.js ──
    tryCall("IrisPerformance.generateROC", () => {
      IrisPerformance.generateROC([0.8, 0.6, 0.4], [0.2, 0.3, 0.5], 100);
    });
    tryCall("IrisPerformance.generateDET", () => {
      IrisPerformance.generateDET([0.8, 0.6, 0.4], [0.2, 0.3, 0.5]);
    });
    tryCall("IrisPerformance.generatePADDET", () => {
      IrisPerformance.generatePADDET([1, 0, 1, 0], [0.9, 0.3, 0.8, 0.2], 100);
    });
    tryCall("IrisPerformance.reportPADMetrics", () => {
      IrisPerformance.reportPADMetrics([1, 0, 1, 0], [0.9, 0.3, 0.8, 0.2]);
    });
    tryCall("IrisPerformance.calculateEER", () => {
      IrisPerformance.calculateEER([
        { threshold: 0.1, far: 0.9, frr: 0.1 },
        { threshold: 0.3, far: 0.5, frr: 0.3 },
        { threshold: 0.5, far: 0.2, frr: 0.5 },
        { threshold: 0.7, far: 0.1, frr: 0.7 },
        { threshold: 0.9, far: 0.05, frr: 0.9 },
      ]);
    });
    tryCall("IrisPerformance.calculateFAR", () =>
      IrisPerformance.calculateFAR(5, 1000),
    );
    tryCall("IrisPerformance.calculateFRR", () =>
      IrisPerformance.calculateFRR(3, 500),
    );
    tryCall("IrisPerformance.calculateAccuracy", () =>
      IrisPerformance.calculateAccuracy(90, 5, 100),
    );
    tryCall("IrisPerformance.fnirAtFpir", () => {
      var genu = [];
      var imp = [];
      for (var i = 0; i < 50; i++) {
        genu.push(0.7 + Math.random() * 0.3);
        imp.push(Math.random() * 0.5);
      }
      IrisPerformance.fnirAtFpir(genu, imp);
    });
    tryCall("IrisPerformance.wilsonCI", () => {
      IrisPerformance.wilsonCI(80, 100, 0.95);
    });
    tryCall("IrisPerformance.computeTimingStats", () => {
      var inst = {
        _acquisitions: [10, 15, 20],
        _enrollments: [25, 30, 35],
        _ftaCount: 1,
        _fterCount: 2,
        _totalAcquisitions: 100,
        _totalEnrollments: 50,
      };
      IrisPerformance.computeTimingStats(inst);
    });
    tryCall("IrisPerformance.recordFTA", () => {
      var inst = { _ftaCount: 0, _totalAcquisitions: 0, _timings: [] };
      IrisPerformance.recordFTA(inst);
    });
    tryCall("IrisPerformance.recordFTER", () => {
      var inst = { _fterCount: 0, _totalEnrollments: 0, _timings: [] };
      IrisPerformance.recordFTER(inst);
    });
    tryCall("IrisPerformance.recordAcquisition", () => {
      var inst = { _totalAcquisitions: 0, _timings: [] };
      IrisPerformance.recordAcquisition(inst, 15);
    });
    tryCall("IrisPerformance.recordEnrollment", () => {
      var inst = { _totalEnrollments: 0, _timings: [] };
      IrisPerformance.recordEnrollment(inst, 25);
    });
    tryCall("IrisPerformance.pairedTTest: different", () => {
      IrisPerformance.pairedTTest(
        [0.8, 0.7, 0.6, 0.5, 0.9],
        [0.4, 0.3, 0.2, 0.5, 0.4],
      );
    });
    tryCall("IrisPerformance.pairedTTest: identical", () => {
      IrisPerformance.pairedTTest([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]);
    });
    tryCall("IrisPerformance.pairedTTest: single", () => {
      IrisPerformance.pairedTTest([0.5], [0.5]);
    });
    tryCall("IrisPerformance.evaluate", () => {
      var genu = [0.8, 0.85, 0.7, 0.9, 0.75];
      var imp = [0.2, 0.3, 0.1, 0.4, 0.25];
      IrisPerformance.evaluate({
        genuineScores: genu,
        impostorScores: imp,
        systemName: "Test",
      });
    });
    tryCall("IrisPerformance.compareSystems", () => {
      IrisPerformance.compareSystems(
        {
          genuineScores: [0.8, 0.7, 0.9],
          impostorScores: [0.2, 0.3, 0.1],
          systemName: "A",
        },
        {
          genuineScores: [0.6, 0.5, 0.7],
          impostorScores: [0.4, 0.5, 0.3],
          systemName: "B",
        },
      );
    });

    // ── iris_standards.js ──
    tryCall("IrisStandards.constructor", () => new IrisStandards());
    tryCall("IrisStandards.captureDeviceInfo", () =>
      IrisStandards.captureDeviceInfo(),
    );
    tryCall("IrisStandards.validateDeviceInfo", () => {
      IrisStandards.validateDeviceInfo({
        manufacturer: "Test",
        model: "M1",
        firmware: "1.0",
      });
    });
    tryCall("IrisStandards.validateDeviceInfo: null", () => {
      IrisStandards.validateDeviceInfo(null);
    });
    tryCall("IrisStandards.validateRecord: valid", () => {
      IrisStandards.validateRecord({
        cbeff: {
          headerSize: 33,
          owner: 1,
          type: 1,
          version: 1,
          birType: 1,
          recordVersion: { major: 1, minor: 0 },
        },
        imageKind: 2,
        width: 100,
        height: 100,
        pixelDepth: 8,
        qualityScore: 70,
        eyeSide: "left",
        irisRadius: 50,
        deviceInfo: { manufacturer: "Test", model: "M1" },
      });
    });
    tryCall("IrisStandards.validateRecord: many warnings", () => {
      IrisStandards.validateRecord({
        cbeff: {
          headerSize: 29,
          owner: 1,
          type: 1,
          version: 1,
          birType: 1,
          recordVersion: { major: 1, minor: 0 },
        },
        imageKind: 2,
        width: 50,
        height: 50,
        pixelDepth: 6,
        qualityScore: 30,
        eyeSide: "unknown",
        irisRadius: 30,
      });
    });
    tryCall("IrisStandards.validateRecord: bad imageKind", () => {
      IrisStandards.validateRecord({ imageKind: 99 });
    });
    tryCall("IrisStandards._classifyDeviceType", () => {
      IrisStandards._classifyDeviceType(null);
      IrisStandards._classifyDeviceType(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      );
      IrisStandards._classifyDeviceType(
        "Mozilla/5.0 (Linux; Android 13; Pixel 7)",
      );
      IrisStandards._classifyDeviceType(
        "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)",
      );
      IrisStandards._classifyDeviceType(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      );
    });
    tryCall("IrisStandards._getQualityLevel", () => {
      IrisStandards._getQualityLevel(10);
      IrisStandards._getQualityLevel(30);
      IrisStandards._getQualityLevel(60);
      IrisStandards._getQualityLevel(90);
    });
    tryCall("IrisStandards._computeSHA256", () => {
      IrisStandards._computeSHA256(new Uint8Array(100));
    });
    tryCall("IrisStandards.createTemplate", () => {
      IrisStandards.createTemplate(
        new Uint8Array(100).fill(0xff),
        new Uint8Array(100).fill(1),
        { eyeSide: "left", quality: 80 },
      );
    });
    tryCall("IrisStandards.serialize", () => {
      var record = {
        cbeff: {
          headerSize: 33,
          owner: 1,
          type: 1,
          version: 1,
          birType: 1,
          recordVersion: { major: 1, minor: 0 },
        },
        imageKind: 2,
        width: 10,
        height: 10,
        pixelDepth: 8,
        qualityScore: 70,
        eyeSide: "left",
        imageData: new Uint8Array(100).fill(0x80),
      };
      IrisStandards.serialize(record);
    });
    tryCall("IrisStandards.deserialize: 33-byte header", () => {
      var record = {
        cbeff: {
          headerSize: 33,
          owner: 1,
          type: 1,
          version: 1,
          birType: 1,
          recordVersion: { major: 1, minor: 0 },
        },
        imageKind: 2,
        width: 10,
        height: 10,
        pixelDepth: 8,
        qualityScore: 70,
        eyeSide: "left",
        imageData: new Uint8Array(100).fill(0x80),
      };
      var data = IrisStandards.serialize(record);
      IrisStandards.deserialize(data);
    });
    tryCall("IrisStandards.deserialize: extended header", () => {
      var record = {
        cbeff: {
          headerSize: 33,
          owner: 1,
          type: 1,
          version: 1,
          birType: 1,
          recordVersion: { major: 1, minor: 0 },
        },
        imageKind: 2,
        width: 10,
        height: 10,
        pixelDepth: 8,
        qualityScore: 70,
        eyeSide: "left",
        imageData: new Uint8Array(100).fill(0x80),
        creationDate: new Date().toISOString(),
        encryptionAlgorithm: 1,
        deviceType: 2,
      };
      var data = IrisStandards.serialize(record);
      IrisStandards.deserialize(data);
    });
    tryCall("IrisStandards.createBIR", () => {
      IrisStandards.createBIR({
        cbeff: {
          headerSize: 33,
          owner: 1,
          type: 1,
          version: 1,
          birType: 1,
          recordVersion: { major: 1, minor: 0 },
        },
        imageKind: 2,
        width: 10,
        height: 10,
        pixelDepth: 8,
        qualityScore: 70,
        eyeSide: "left",
        imageData: new Uint8Array(100).fill(0x80),
      });
    });

    // ── iris_template_protection.js ──
    tryCall(
      "IrisTemplateProtection.constructor",
      () => new IrisTemplateProtection(),
    );
    tryCall("IrisTemplateProtection.generateProjectionMatrix", () => {
      IrisTemplateProtection.generateProjectionMatrix(128, 256);
    });
    tryCall("IrisTemplateProtection.biohash", () => {
      var template = {
        code: new Uint8Array(128).fill(0xff),
        mask: new Uint8Array(128).fill(1),
      };
      var key = new Uint8Array(32).fill(0xaa);
      IrisTemplateProtection.biohash(template, key);
    });
    tryCall("IrisTemplateProtection.verifyBiohash", () => {
      var template = {
        code: new Uint8Array(128).fill(0xff),
        mask: new Uint8Array(128).fill(1),
      };
      var key = new Uint8Array(32).fill(0xaa);
      var hashed = IrisTemplateProtection.biohash(template, key);
      IrisTemplateProtection.verifyBiohash(hashed, key);
    });
    tryCall("IrisTemplateProtection.createTransformation", () => {
      var template = {
        code: new Uint8Array(128).fill(0xff),
        mask: new Uint8Array(128).fill(1),
      };
      IrisTemplateProtection.createTransformation(template, "test-key");
    });
    tryCall("IrisTemplateProtection.transform", () => {
      var template = {
        code: new Uint8Array(128).fill(0xff),
        mask: new Uint8Array(128).fill(1),
      };
      var transf = IrisTemplateProtection.createTransformation(
        template,
        "test-key",
      );
      IrisTemplateProtection.transform(template, transf);
    });
    tryCall("IrisTemplateProtection.commit", async () => {
      var template = new Uint8Array(128).fill(0xff);
      var key = new Uint8Array(32).fill(0xaa);
      await IrisTemplateProtection.commit(template, key);
    });
    tryCall("IrisTemplateProtection.verifyCommitment", async () => {
      var template = new Uint8Array(128).fill(0xff);
      var key = new Uint8Array(32).fill(0xaa);
      var result = await IrisTemplateProtection.commit(template, key);
      await IrisTemplateProtection.verifyCommitment(
        template,
        key,
        result.nonce,
        result.commitment,
      );
    });
    tryCall("IrisTemplateProtection.createCancelable", () => {
      var template = {
        code: new Uint8Array(128).fill(0xff),
        mask: new Uint8Array(128).fill(1),
      };
      IrisTemplateProtection.createCancelable(template, "user-id-1");
    });
    tryCall("IrisTemplateProtection.testUnlinkability", () => {
      var t1 = {
        code: new Uint8Array(128).fill(0xff),
        mask: new Uint8Array(128).fill(1),
      };
      var t2 = {
        code: new Uint8Array(128).fill(0xaa),
        mask: new Uint8Array(128).fill(1),
      };
      IrisTemplateProtection.testUnlinkability(t1, t2, 5);
    });

    // ── iris_storage.js ──
    tryCall("IrisStorage.constructor", () => new IrisStorage());

    return r;
  });

  // Stop coverage capture
  const coverage = await page.coverage.stopJSCoverage();
  await browser.close();

  return { coverage, testResults: results };
}

function mergeCoverage(nodeV8RawDir, browserCoverage) {
  // Read Node.js raw V8 coverage
  const jsonFiles = fs
    .readdirSync(nodeV8RawDir)
    .filter((f) => f.endsWith(".json"));
  const nodeScripts = [];
  for (const jf of jsonFiles) {
    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(nodeV8RawDir, jf), "utf8"),
      );
      const scripts = Array.isArray(data) ? data : data.result || [];
      nodeScripts.push(...scripts);
    } catch {
      /* skip */
    }
  }

  // Build per-file merged coverage
  const merged = new Map();

  function addScripts(scripts, source) {
    for (const script of scripts) {
      const name = path.basename(script.url);
      if (!IRIS_FILES.includes(name)) continue;
      if (!script.functions || script.functions.length === 0) continue;

      if (!merged.has(name)) {
        merged.set(name, {
          node: new Set(),
          browser: new Set(),
          total: new Set(),
        });
      }
      const entry = merged.get(name);

      for (const fn of script.functions) {
        for (const range of fn.ranges) {
          if (range.count > 0) {
            // This range is covered
            for (let b = range.startOffset; b < range.endOffset; b++) {
              entry.total.add(b);
              if (source === "node") entry.node.add(b);
              if (source === "browser") entry.browser.add(b);
            }
          }
        }
      }
    }
  }

  addScripts(nodeScripts, "node");

  // Process browser coverage (CDP format: each entry has functions with ranges)
  for (const entry of browserCoverage) {
    if (!entry.url || !entry.url.includes("Iris_Biometric")) continue;
    const name = path.basename(entry.url);
    if (!IRIS_FILES.includes(name)) continue;

    if (!merged.has(name)) {
      merged.set(name, {
        node: new Set(),
        browser: new Set(),
        total: new Set(),
      });
    }
    const m = merged.get(name);

    for (const fn of entry.functions || []) {
      for (const range of fn.ranges || []) {
        if (range.count > 0) {
          for (let b = range.startOffset; b < range.endOffset; b++) {
            m.total.add(b);
            m.browser.add(b);
          }
        }
      }
    }
  }

  return merged;
}

function printReport(merged) {
  console.log("\n" + "=".repeat(100));
  console.log("MERGED V8 COVERAGE REPORT (Node.js + Browser)");
  console.log("=".repeat(100));
  console.log(
    "File".padEnd(35) +
      "  Node%".padStart(8) +
      "  Browser%".padStart(10) +
      "  Merged%".padStart(10) +
      "  Missing".padStart(10),
  );
  console.log("-".repeat(100));

  let totalNode = 0,
    totalBrowser = 0,
    totalMerged = 0;

  const sorted = [...merged.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [name, data] of sorted) {
    // Total executable bytes = total coverage ranges in merged data
    const totalBytes = 1000; // Approximate - use a reasonable denominator

    // Use range-based calculation from actual data
    const allRanges = data.total.size;
    const nodeOnly = data.node.size;
    const browserOnly = data.browser.size;

    // Merged = union of node + browser covered bytes
    const mergedCovered = new Set([...data.node, ...data.browser]).size;

    // Estimate total ranges from source file size
    const filePath = path.join(ROOT, "Iris_Biometric", name);
    const fileSize = fs.statSync(filePath).size;

    // Better: count total ranges from both sources
    // For now, use file size as denominator for merged coverage
    const nodePct =
      nodeOnly > 0 ? ((nodeOnly / fileSize) * 100).toFixed(1) : "0.0";
    const browserPct =
      browserOnly > 0 ? ((browserOnly / fileSize) * 100).toFixed(1) : "0.0";
    const mergedPct = ((mergedCovered / fileSize) * 100).toFixed(1);

    totalNode += nodeOnly;
    totalBrowser += browserOnly;
    totalMerged += mergedCovered;

    console.log(
      name.padEnd(35) +
        (nodePct + "%").padStart(8) +
        (browserPct + "%").padStart(10) +
        (mergedPct + "%").padStart(10) +
        (fileSize - mergedCovered).toString().padStart(10),
    );
  }

  console.log("-".repeat(100));
  console.log(
    "TOTAL bytes: Node=" +
      totalNode +
      " Browser=" +
      totalBrowser +
      " Merged=" +
      totalMerged,
  );
  console.log("=".repeat(100));
}

async function main() {
  console.log("Capturing browser V8 coverage via Playwright CDP...");
  const { coverage, testResults } = await captureBrowserCoverage();
  console.log(
    "Browser tests: " +
      testResults.ok.length +
      " OK, " +
      testResults.err.length +
      " errors",
  );
  if (testResults.err.length > 0) {
    console.log("Errors:");
    testResults.err.forEach((e) => console.log("  " + e));
  }

  console.log("\nMerging with Node.js V8 coverage...");
  const v8Dir = process.env.NODE_V8_COVERAGE || "coverage/v8tmp";
  const merged = mergeCoverage(v8Dir, coverage);
  printReport(merged);

  // Export merged data
  const outputPath = "coverage/v8-iris-merged.json";
  const exportData = {};
  for (const [name, data] of merged) {
    const nodeCovered = [...data.node];
    const browserCovered = [...data.browser];
    const mergedCovered = [...new Set([...data.node, ...data.browser])];
    exportData[name] = {
      nodeCoveredBytes: nodeCovered.length,
      browserCoveredBytes: browserCovered.length,
      mergedCoveredBytes: mergedCovered.length,
      nodeOnly: nodeCovered.filter((b) => !data.browser.has(b)).length,
      browserOnly: browserCovered.filter((b) => !data.node.has(b)).length,
    };
  }
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  console.log("\nMerged data exported to " + outputPath);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
