const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// ── Polyfill minimal DOM for browser globals ──
global.window = global;
global.document = {
  createElement: (t) => {
    if (t === "canvas") {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => {},
          getImageData: () => ({
            data: new Uint8ClampedArray(640 * 480 * 4),
            width: 640,
            height: 480,
          }),
        }),
      };
    }
    return null;
  },
};
global.HTMLCanvasElement = function () {};
global.HTMLVideoElement = function () {};
global.HTMLImageElement = function () {};
global.ImageData = class ImageData {
  constructor(d, w, h) {
    this.data = d;
    this.width = w;
    this.height = h;
  }
};
global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++)
      arr[i] = Math.floor(Math.random() * 256);
    return arr;
  },
  digest: (algo, data) => {
    const hash = new Uint8Array(32);
    for (let i = 0; i < hash.length; i++)
      hash[i] = Math.floor(Math.random() * 256);
    return Promise.resolve(hash.buffer);
  },
};

// ── Load all Iris Standards modules ──
const irisDir = path.join(__dirname, "..", "..", "Iris_Biometric");
const irisFiles = [
  "iris_standards.js",
  "iris_quality_full.js",
  "iris_template_protection.js",
  "iris_performance.js",
];

for (const file of irisFiles) {
  const src = fs.readFileSync(path.join(irisDir, file), "utf8");
  vm.runInThisContext(src, { filename: file });
}

// ── Load all Face Standards modules ──
const faceDir = path.join(__dirname, "..", "..", "Face_Biometric");
const faceFiles = ["face_standards.js", "face_performance.js"];

for (const file of faceFiles) {
  const src = fs.readFileSync(path.join(faceDir, file), "utf8");
  vm.runInThisContext(src, { filename: file });
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS: Iris Standards (ISO/IEC 19794-6)
// ═══════════════════════════════════════════════════════════════════════════

describe("IrisStandards", () => {
  it("should create a valid Kind 2 record", () => {
    const imageData = new ImageData(
      new Uint8ClampedArray(640 * 480 * 4),
      640,
      480,
    );
    const record = IrisStandards.createRecord({
      image: imageData,
      imageKind: 2,
      eyeSide: "right",
      qualityScore: 85,
    });

    assert.equal(record.imageKind, 2);
    assert.equal(record.width, 640);
    assert.equal(record.height, 480);
    assert.equal(record.eyeSide, "right");
    assert.equal(record.qualityScore, 85);
    assert.equal(record.qualityLevel.label, "Very High");
  });

  it("should validate a correct record", () => {
    const record = {
      imageKind: 2,
      width: 640,
      height: 480,
      pixelDepth: 8,
      eyeSide: "right",
      qualityScore: 85,
    };
    const validation = IrisStandards.validateRecord(record);
    assert.equal(validation.valid, true);
    assert.equal(validation.errors.length, 0);
  });

  it("should reject invalid imageKind", () => {
    const record = {
      imageKind: 5,
      width: 640,
      height: 480,
      pixelDepth: 8,
      eyeSide: "right",
      qualityScore: 85,
    };
    const validation = IrisStandards.validateRecord(record);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors[0].includes("imageKind"));
  });

  it("should create a valid template", () => {
    const code = new Uint8Array(256);
    const mask = new Uint8Array(256).fill(1);
    const template = IrisStandards.createTemplate(code, mask);

    assert.equal(template.format, "ISO/IEC 19794-6 IrisCode");
    assert.equal(template.codeLength, 256);
    assert.equal(template.code.length, 256);
    assert.equal(template.mask.length, 256);
  });

  it("should validate a correct template", () => {
    const code = new Uint8Array(256);
    const mask = new Uint8Array(256).fill(1);
    const template = IrisStandards.createTemplate(code, mask);
    const validation = IrisStandards.validateTemplate(template);
    assert.equal(validation.valid, true);
  });

  it("should serialize and deserialize correctly", () => {
    const imageData = new ImageData(
      new Uint8ClampedArray(100 * 100 * 4),
      100,
      100,
    );
    const record = IrisStandards.createRecord({
      image: imageData,
      imageKind: 2,
      eyeSide: "left",
      qualityScore: 70,
    });

    const serialized = IrisStandards.serialize(record);
    assert.ok(serialized instanceof Uint8Array);
    assert.ok(serialized.length > IrisStandards.CBEFF.BDB_HEADER_SIZE);

    const deserialized = IrisStandards.deserialize(serialized);
    assert.equal(deserialized.imageKind, 2);
    assert.equal(deserialized.eyeSide, "left");
    assert.equal(deserialized.qualityScore, 70);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TESTS: Iris Quality Full (ISO/IEC 29794-6)
// ═══════════════════════════════════════════════════════════════════════════

describe("IrisQualityFull", () => {
  it("should compute focus quality", () => {
    const imageData = new Uint8ClampedArray(100 * 100);
    // Create a sharp edge
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 50; x++) imageData[y * 100 + x] = 0;
      for (let x = 50; x < 100; x++) imageData[y * 100 + x] = 255;
    }

    const focus = IrisQualityFull.focusQuality(imageData, 100, 100);
    assert.ok(focus > 0);
    assert.ok(focus <= 100);
  });

  it("should compute usable area from mask", () => {
    const mask = new Uint8Array(100).fill(0);
    mask[0] = 1;
    mask[1] = 1;
    mask[2] = 1;

    const area = IrisQualityFull.usableArea(mask);
    assert.equal(area, 3);
  });

  it("should compute pupil-iris ratio", () => {
    const ratio = IrisQualityFull.pupilIrisRatio(40, 120);
    assert.ok(Math.abs(ratio - 0.333) < 0.01);
  });

  it("should compute gaze angle", () => {
    const pupil = { x: 330, y: 240 };
    const iris = { x: 320, y: 240 };
    const gaze = IrisQualityFull.gazeAngle(pupil, iris, 120);
    assert.ok(gaze > 0);
    assert.ok(gaze < 30);
  });

  it("should compute composite quality", () => {
    const imageData = new Uint8ClampedArray(640 * 480).fill(128);
    const mask = new Uint8Array(640 * 480).fill(1);

    const quality = IrisQualityFull.computeCompositeQuality({
      imageData: imageData,
      width: 640,
      height: 480,
      mask: mask,
      pupil: { x: 320, y: 240, radius: 40 },
      iris: { x: 320, y: 240, radius: 120 },
    });

    assert.ok(quality.score >= 0);
    assert.ok(quality.score <= 100);
    assert.ok(typeof quality.level === "string");
    assert.ok(typeof quality.passed === "boolean");
    assert.ok(quality.details.includes("ISO/IEC 29794-6"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TESTS: Iris Template Protection (ISO/IEC 24745)
// ═══════════════════════════════════════════════════════════════════════════

describe("IrisTemplateProtection", () => {
  it("should generate projection matrix", () => {
    const matrix = IrisTemplateProtection.generateProjectionMatrix(256, 64);
    assert.ok(matrix instanceof Float64Array);
    assert.equal(matrix.length, 64 * 256);
  });

  it("should apply biohashing", () => {
    const code = new Uint8Array(256);
    for (let i = 0; i < 256; i++) code[i] = i % 2;

    const matrix = IrisTemplateProtection.generateProjectionMatrix(256, 64);
    const result = IrisTemplateProtection.biohash(code, matrix, 64);

    assert.ok(result.hashed instanceof Uint8Array);
    assert.equal(result.hashed.length, 64);
    assert.ok(typeof result.score === "number");
  });

  it("should verify matching biohashes", () => {
    const code1 = new Uint8Array(64).fill(1);
    const code2 = new Uint8Array(64).fill(1);

    const verification = IrisTemplateProtection.verifyBiohash(code1, code2);
    assert.equal(verification.match, true);
    assert.equal(verification.similarity, 1);
  });

  it("should reject non-matching biohashes", () => {
    const code1 = new Uint8Array(64).fill(1);
    const code2 = new Uint8Array(64).fill(0);

    const verification = IrisTemplateProtection.verifyBiohash(code1, code2);
    assert.equal(verification.match, false);
    assert.equal(verification.similarity, 0);
  });

  it("should create transformation function", () => {
    const key = new Uint8Array(32);
    const salt = new Uint8Array(16);

    const transformFn = IrisTemplateProtection.createTransformation(key, salt);
    assert.equal(typeof transformFn, "function");

    const code = new Uint8Array(256);
    const transformed = transformFn(code);
    assert.ok(transformed instanceof Uint8Array);
    assert.equal(transformed.length, 256);
  });

  it("should create cancelable biometric", async () => {
    const code = new Uint8Array(256);
    for (let i = 0; i < 256; i++) code[i] = i % 2;

    const userKey = new Uint8Array(32);
    const result = await IrisTemplateProtection.createCancelable(
      code,
      userKey,
      1,
    );

    assert.ok(result.template instanceof Uint8Array);
    assert.equal(result.template.length, 256);
    assert.ok(typeof result.keyHash === "string");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TESTS: Iris Performance (ISO/IEC 19795)
// ═══════════════════════════════════════════════════════════════════════════

describe("IrisPerformance", () => {
  it("should calculate FAR", () => {
    const far = IrisPerformance.calculateFAR(5, 1000);
    assert.equal(far, 0.005);
  });

  it("should calculate FRR", () => {
    const frr = IrisPerformance.calculateFRR(2, 100);
    assert.equal(frr, 0.02);
  });

  it("should calculate EER", () => {
    const rocData = [
      { threshold: 0.1, far: 0.01, frr: 0.1 },
      { threshold: 0.3, far: 0.005, frr: 0.005 },
      { threshold: 0.5, far: 0.1, frr: 0.01 },
    ];
    const eer = IrisPerformance.calculateEER(rocData);
    assert.ok(Math.abs(eer.eer - 0.005) < 0.001);
  });

  it("should generate ROC curve", () => {
    const genuine = [0.8, 0.85, 0.9, 0.75, 0.88];
    const impostor = [0.2, 0.15, 0.3, 0.1, 0.25];

    const roc = IrisPerformance.generateROC(genuine, impostor, 50);
    assert.ok(roc.length > 0);
    assert.ok(Object.prototype.hasOwnProperty.call(roc[0], "threshold"));
    assert.ok(Object.prototype.hasOwnProperty.call(roc[0], "far"));
    assert.ok(Object.prototype.hasOwnProperty.call(roc[0], "frr"));
    assert.ok(Object.prototype.hasOwnProperty.call(roc[0], "tpr"));
  });

  it("should calculate Wilson confidence interval", () => {
    const ci = IrisPerformance.wilsonCI(50, 100);
    assert.ok(ci.lower >= 0);
    assert.ok(ci.upper <= 1);
    assert.ok(ci.estimate === 0.5);
    assert.ok(ci.lower < ci.estimate);
    assert.ok(ci.upper > ci.estimate);
  });

  it("should evaluate system performance", () => {
    const genuine = Array.from(
      { length: 200 },
      () => 0.7 + Math.random() * 0.3,
    );
    const impostor = Array.from({ length: 2000 }, () => Math.random() * 0.4);

    const report = IrisPerformance.evaluate({
      genuineScores: genuine,
      impostorScores: impostor,
      systemName: "Test System",
    });

    assert.ok(report.systemName === "Test System");
    assert.ok(report.sampleSize.genuine === 200);
    assert.ok(report.sampleSize.impostor === 2000);
    assert.ok(typeof report.metrics.far === "number");
    assert.ok(typeof report.metrics.frr === "number");
    assert.ok(typeof report.metrics.eer === "number");
    assert.ok(typeof report.metrics.accuracy === "number");
    assert.ok(report.curves.roc.length > 0);
    assert.ok(report.curves.det.length > 0);
    assert.ok(typeof report.summary === "string");
    assert.ok(report.summary.includes("ISO/IEC 19795"));
  });

  it("should perform paired t-test", () => {
    const scores1 = [0.8, 0.85, 0.9, 0.88, 0.92];
    const scores2 = [0.75, 0.82, 0.87, 0.85, 0.9];

    const tTest = IrisPerformance.pairedTTest(scores1, scores2);
    assert.ok(typeof tTest.tStatistic === "number");
    assert.ok(typeof tTest.pValue === "number");
    assert.ok(typeof tTest.significant === "boolean");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TESTS: Face Standards (ISO/IEC 19794-5)
// ═══════════════════════════════════════════════════════════════════════════

describe("FaceStandards", () => {
  it("should create a valid face record", () => {
    const imageData = new ImageData(
      new Uint8ClampedArray(320 * 480 * 4),
      320,
      480,
    );
    const record = FaceStandards.createRecord({
      image: imageData,
      gender: "male",
      estimatedAge: 30,
      pose: 0,
      qualityScore: 90,
    });

    assert.equal(record.width, 320);
    assert.equal(record.height, 480);
    assert.equal(record.gender, "male");
    assert.equal(record.estimatedAge, 30);
    assert.equal(record.pose, 0);
    assert.equal(record.qualityScore, 90);
    assert.equal(record.qualityLevel.label, "Very High");
  });

  it("should validate a correct face record", () => {
    const record = {
      width: 320,
      height: 480,
      pixelDepth: 8,
      gender: "female",
      pose: 0,
      qualityScore: 85,
    };
    const validation = FaceStandards.validateRecord(record);
    assert.equal(validation.valid, true);
    assert.equal(validation.errors.length, 0);
  });

  it("should reject small images", () => {
    const record = {
      width: 50,
      height: 60,
      pixelDepth: 8,
      gender: "male",
      pose: 0,
      qualityScore: 85,
    };
    const validation = FaceStandards.validateRecord(record);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors[0].includes("below minimum"));
  });

  it("should create a valid face template", () => {
    const embedding = new Float32Array(512);
    for (let i = 0; i < 512; i++) embedding[i] = Math.random();

    const template = FaceStandards.createTemplate(embedding);
    assert.equal(template.format, "ISO/IEC 19794-5 FaceEmbedding");
    assert.equal(template.embeddingLength, 512);
  });

  it("should serialize and deserialize face record", () => {
    const imageData = new ImageData(
      new Uint8ClampedArray(320 * 480 * 4),
      320,
      480,
    );
    const record = FaceStandards.createRecord({
      image: imageData,
      gender: "male",
      pose: 0,
      qualityScore: 80,
    });

    const serialized = FaceStandards.serialize(record);
    assert.ok(serialized instanceof Uint8Array);

    const deserialized = FaceStandards.deserialize(serialized);
    assert.equal(deserialized.width, 320);
    assert.equal(deserialized.gender, "male");
    assert.equal(deserialized.qualityScore, 80);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TESTS: Face Performance (ISO/IEC 19795)
// ═══════════════════════════════════════════════════════════════════════════

describe("FacePerformance", () => {
  it("should calculate FDR", () => {
    const fdr = FacePerformance.calculateFDR(99, 100);
    assert.equal(fdr, 0.99);
  });

  it("should analyze demographic bias", () => {
    const result = FacePerformance.analyzeBias({
      demographicGroups: [
        { group: "male", scores: [0.85, 0.9, 0.88, 0.92] },
        { group: "female", scores: [0.82, 0.87, 0.85, 0.89] },
      ],
    });

    assert.equal(result.biasDetected, false);
    assert.ok(result.groups.male);
    assert.ok(result.groups.female);
    assert.ok(result.maxGap < 0.05);
  });

  it("should detect bias when gap is large", () => {
    const result = FacePerformance.analyzeBias({
      demographicGroups: [
        { group: "group1", scores: [0.95, 0.96, 0.97] },
        { group: "group2", scores: [0.7, 0.72, 0.68] },
      ],
    });

    assert.equal(result.biasDetected, true);
    assert.ok(result.maxGap > 0.05);
  });

  it("should analyze pose performance", () => {
    const result = FacePerformance.analyzePose({
      poseData: [
        {
          pose: "frontal",
          genuineScores: [0.9, 0.92, 0.95, 0.88, 0.91],
          impostorScores: [0.1, 0.12, 0.15, 0.08, 0.11],
        },
        {
          pose: "left",
          genuineScores: [0.6, 0.65, 0.7, 0.55, 0.62],
          impostorScores: [0.4, 0.45, 0.5, 0.38, 0.42],
        },
      ],
    });

    assert.ok(result.bestPose === "frontal");
    assert.ok(result.results.frontal.eer <= result.results.left.eer);
  });

  it("should evaluate comprehensive performance", () => {
    const genuine = Array.from(
      { length: 200 },
      () => 0.7 + Math.random() * 0.3,
    );
    const impostor = Array.from({ length: 2000 }, () => Math.random() * 0.4);

    const report = FacePerformance.evaluate({
      genuineScores: genuine,
      impostorScores: impostor,
      demographicGroups: [
        { group: "male", scores: genuine.slice(0, 100) },
        { group: "female", scores: genuine.slice(100, 200) },
      ],
      detectionRate: 0.99,
      systemName: "Face Test System",
    });

    assert.ok(report.systemName === "Face Test System");
    assert.ok(Math.abs(report.metrics.detectionRate - 0.99) < 1e-9);
    assert.ok(report.biasAnalysis !== null);
    assert.ok(report.summary.includes("ISO/IEC 19795"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TESTS: Integration
// ═══════════════════════════════════════════════════════════════════════════

describe("Integration", () => {
  it("should work end-to-end for iris", () => {
    // 1. Create record
    const imageData = new ImageData(
      new Uint8ClampedArray(640 * 480 * 4),
      640,
      480,
    );
    const record = IrisStandards.createRecord({
      image: imageData,
      imageKind: 2,
      eyeSide: "right",
      qualityScore: 85,
    });

    // 2. Validate record
    const validation = IrisStandards.validateRecord(record);
    assert.equal(validation.valid, true);

    // 3. Assess quality
    const quality = IrisQualityFull.computeCompositeQuality({
      imageData: new Uint8ClampedArray(640 * 480).fill(128),
      width: 640,
      height: 480,
      mask: new Uint8Array(640 * 480).fill(1),
      pupil: { x: 320, y: 240, radius: 40 },
      iris: { x: 320, y: 240, radius: 120 },
    });

    // 4. Create template
    const code = new Uint8Array(256);
    const mask = new Uint8Array(256).fill(1);
    const template = IrisStandards.createTemplate(code, mask);

    // 5. Protect template
    const matrix = IrisTemplateProtection.generateProjectionMatrix(256, 64);
    const biohash = IrisTemplateProtection.biohash(code, matrix, 64);

    // 6. Evaluate performance
    const genuine = Array.from(
      { length: 100 },
      () => 0.7 + Math.random() * 0.3,
    );
    const impostor = Array.from({ length: 1000 }, () => Math.random() * 0.4);
    const perf = IrisPerformance.evaluate({
      genuineScores: genuine,
      impostorScores: impostor,
    });

    assert.ok(validation.valid);
    assert.ok(quality.score >= 0);
    assert.ok(template.codeLength === 256);
    assert.ok(biohash.hashed.length === 64);
    assert.ok(perf.metrics.accuracy > 0);
  });

  it("should work end-to-end for face", () => {
    // 1. Create record
    const imageData = new ImageData(
      new Uint8ClampedArray(320 * 480 * 4),
      320,
      480,
    );
    const record = FaceStandards.createRecord({
      image: imageData,
      gender: "male",
      estimatedAge: 30,
      pose: 0,
      qualityScore: 90,
    });

    // 2. Validate record
    const validation = FaceStandards.validateRecord(record);
    assert.equal(validation.valid, true);

    // 3. Create template
    const embedding = new Float32Array(512);
    for (let i = 0; i < 512; i++) embedding[i] = Math.random();
    const template = FaceStandards.createTemplate(embedding);

    // 4. Evaluate performance
    const genuine = Array.from(
      { length: 100 },
      () => 0.7 + Math.random() * 0.3,
    );
    const impostor = Array.from({ length: 1000 }, () => Math.random() * 0.4);
    const perf = FacePerformance.evaluate({
      genuineScores: genuine,
      impostorScores: impostor,
      detectionRate: 0.99,
    });

    assert.ok(validation.valid);
    assert.ok(template.embeddingLength === 512);
    assert.ok(perf.metrics.accuracy > 0);
    assert.ok(Math.abs(perf.metrics.detectionRate - 0.99) < 1e-9);
  });
});
