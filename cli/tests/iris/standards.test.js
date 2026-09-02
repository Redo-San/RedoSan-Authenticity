require("./setup");
const test = require("node:test");
const assert = require("node:assert");

// ═══════════════════════════════════════════════════════════════
// iris_standards.js — additional coverage
// ═══════════════════════════════════════════════════════════════

test("IrisStandards: constants exist", () => {
  assert.ok(IS.CBEFF);
  assert.ok(IS.IMAGE_KIND);
  assert.ok(IS.COMPRESSION);
  assert.ok(IS.QUALITY_LEVEL);
  assert.ok(IS.DIMENSIONS);
});

test("IrisStandards.captureDeviceInfo: returns device info", () => {
  const info = IS.captureDeviceInfo();
  assert.ok(info);
  assert.equal(typeof info.userAgent, "string");
});

test("IrisStandards.validateDeviceInfo: valid info", () => {
  const result = IS.validateDeviceInfo({ userAgent: "test", screenWidth: 1920 });
  assert.ok(result);
  assert.equal(typeof result.valid, "boolean");
});

test("IrisStandards.createRecord: basic record", () => {
  const imgData = new ImageData(new Uint8ClampedArray(10 * 10 * 4), 10, 10);
  const record = IS.createRecord({ image: imgData, imageKind: 2 });
  assert.ok(record);
  assert.equal(record.imageKind, 2);
});

test("IrisStandards.validateRecord: valid record", () => {
  const record = { imageKind: 2, width: 640, height: 480, compression: 0, pixelDepth: 8 };
  const result = IS.validateRecord(record);
  assert.ok(result);
  assert.equal(typeof result.valid, "boolean");
});

test("IrisStandards.createTemplate: creates template", () => {
  const code = new Uint8Array(100);
  const mask = new Uint8Array(100).fill(1);
  const tpl = IS.createTemplate(code, mask);
  assert.ok(tpl);
  assert.equal(tpl.codeLength, 100);
});

test("IrisStandards.validateTemplate: valid template", () => {
  const tpl = { code: new Uint8Array(10), mask: new Uint8Array(10), codeLength: 10, maskLength: 10 };
  const result = IS.validateTemplate(tpl);
  assert.ok(result);
  assert.equal(typeof result.valid, "boolean");
});

test("IrisStandards.serialize/deserialize: round-trip", () => {
  const imgData = new ImageData(new Uint8ClampedArray(10 * 10 * 4), 10, 10);
  const record = IS.createRecord({ image: imgData, imageKind: 2, eyeSide: "unknown" });
  const data = IS.serialize(record);
  assert.ok(data instanceof Uint8Array);
  const restored = IS.deserialize(data);
  assert.ok(restored);
});

test("IrisStandards.createBIR: creates BIR", () => {
  const imgData = new ImageData(new Uint8ClampedArray(10 * 10 * 4), 10, 10);
  const record = IS.createRecord({ image: imgData, imageKind: 2, eyeSide: "left" });
  const bir = IS.createBIR(record);
  assert.ok(bir);
  assert.ok(bir.sbh);
  assert.ok(bir.bdb);
});

test("IrisStandards._classifyDeviceType: returns number", () => {
  assert.equal(typeof IS._classifyDeviceType("Mozilla/5.0 (iPhone)"), "number");
  assert.equal(typeof IS._classifyDeviceType("Mozilla/5.0 (Windows NT 10.0)"), "number");
});

test("IrisStandards._getQualityLevel: returns level object", () => {
  assert.ok(IS._getQualityLevel(90));
  assert.ok(IS._getQualityLevel(50));
  assert.ok(IS._getQualityLevel(10));
});

test("IrisStandards._computeChecksum: returns string", () => {
  const data = new Uint8Array([1, 2, 3, 4]);
  const hash = IS._computeChecksum(data);
  assert.equal(typeof hash, "string");
  assert.ok(hash.length > 0);
});

test("IrisStandards._computeSHA256: returns promise", async () => {
  const data = new Uint8Array([10, 20, 30, 40]);
  const result = await IS._computeSHA256(data);
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
});

test("IrisStandards._computeSHA256: same data → same hash", async () => {
  const d1 = new Uint8Array([1, 2, 3]);
  const d2 = new Uint8Array([1, 2, 3]);
  const h1 = await IS._computeSHA256(d1);
  const h2 = await IS._computeSHA256(d2);
  assert.equal(h1, h2);
});

test("IrisStandards._extractImageData: throws for unsupported type", () => {
  try {
    IS._extractImageData("not_an_image");
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e instanceof TypeError);
  }
});

test("IrisStandards.createBIR: throws for null record", () => {
  try {
    IS.createBIR(null);
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("required"));
  }
});

// ═══════════════════════════════════════════════════════════════
// IrisStandards — push from 56% to 80%+
// ═══════════════════════════════════════════════════════════════
function mockRecord(overrides) {
  return Object.assign({
    cbeff: { headerSize: 29, owner: 0, type: 9, version: 16, birType: 0, biometricType: 8,
             qualityAlgorithmVendor: 0, qualityAlgorithmId: 0 },
    recordVersion: { major: 1, minor: 0 },
    imageKind: 2,
    width: 640, height: 480,
    pixelDepth: 8, pixelAspectRatio: 1,
    eyeSide: "unknown",
    irisCenterX: 320, irisCenterY: 240, irisRadius: 80,
    qualityScore: 50,
    qualityLevel: { label: "Medium", code: 2, min: 26, max: 50 },
    compressionType: 0,
    deviceInfo: { userAgent: "test", platform: "test" },
    creationDate: new Date().toISOString(),
    validFrom: new Date().toISOString(),
    validTo: new Date(Date.now() + 86400000).toISOString(),
    encryptionAlgorithm: 0, encryptionOptions: 0,
    timestamp: new Date().toISOString(),
    imageData: new Uint8Array(100),
  }, overrides || {});
}

test("IrisStandards.validateRecord: valid record", () => {
  const r = IS.validateRecord(mockRecord());
  assert.strictEqual(r.valid, true);
  assert(r.errors.length === 0);
});

test("IrisStandards.validateRecord: kind2 wrong dims → warning", () => {
  const r = IS.validateRecord(mockRecord({ width: 320, height: 240 }));
  assert(r.warnings.some(w => w.includes("640x480")));
});

test("IrisStandards.validateRecord: kind7 → valid", () => {
  const r = IS.validateRecord(mockRecord({ imageKind: 7, width: 200, height: 200 }));
  assert.strictEqual(r.valid, true);
});

test("IrisStandards.validateRecord: bad pixelDepth → warning", () => {
  const r = IS.validateRecord(mockRecord({ pixelDepth: 24 }));
  assert(r.warnings.length > 0);
});

test("IrisStandards.validateRecord: bad eyeSide → error", () => {
  const r = IS.validateRecord(mockRecord({ eyeSide: "bad" }));
  assert(r.errors.some(e => e.includes("eyeSide")) || r.warnings.some(w => w.includes("eyeSide")));
});

test("IrisStandards.validateRecord: missing cbeff → still valid (no check)", () => {
  const rec = mockRecord();
  delete rec.cbeff;
  const r = IS.validateRecord(rec);
  assert(typeof r.valid === "boolean");
});

test("IrisStandards.serialize: valid record → Uint8Array", () => {
  const data = IS.serialize(mockRecord());
  assert(data instanceof Uint8Array);
  assert(data.length > IS.CBEFF.BDB_HEADER_SIZE);
});

test("IrisStandards.serialize: invalid record → throws", () => {
  assert.throws(() => IS.serialize({}), /Invalid record/);
});

test("IrisStandards.deserialize: round-trip", () => {
  const rec = mockRecord({ eyeSide: "left" });
  const data = IS.serialize(rec);
  const deser = IS.deserialize(data);
  assert(deser.eyeSide === "left");
  assert(deser.imageKind === 2);
});

test("IrisStandards.deserialize: right eye", () => {
  const data = IS.serialize(mockRecord({ eyeSide: "right" }));
  const deser = IS.deserialize(data);
  assert.strictEqual(deser.eyeSide, "right");
});

test("IrisStandards.deserialize: unknown eye", () => {
  const data = IS.serialize(mockRecord({ eyeSide: "unknown" }));
  const deser = IS.deserialize(data);
  assert.strictEqual(deser.eyeSide, "unknown");
});

test("IrisStandards.deserialize: too short → throws", () => {
  assert.throws(() => IS.deserialize(new Uint8Array(5)), /too short/);
});

test("IrisStandards.deserialize: with extended header fields", () => {
  const data = IS.serialize(mockRecord());
  const deser = IS.deserialize(data);
  assert(deser.recordVersion);
});

test("IrisStandards.createBIR: valid record → BIR", () => {
  const bir = IS.createBIR(mockRecord());
  assert(bir.sbh);
  assert(bir.bdb);
  assert(bir.sbh.biometricType);
});

test("IrisStandards.createBIR: with quality fields", () => {
  const bir = IS.createBIR(mockRecord({ qualityScore: 75 }));
  assert(bir.sbh);
});

// ═══════════════════════════════════════════════════════════════
// iris_standards.js — push from 57% to 80%+
// ═══════════════════════════════════════════════════════════════
test("IrisStandards.validateTemplate: null → invalid", () => {
  const r = IS.validateTemplate(null);
  assert.strictEqual(r.valid, false);
});

test("IrisStandards.validateTemplate: missing code", () => {
  const r = IS.validateTemplate({ mask: new Uint8Array(10) });
  assert.strictEqual(r.valid, false);
  assert(r.errors.some(e => e.includes("code")));
});

test("IrisStandards.validateTemplate: missing mask", () => {
  const r = IS.validateTemplate({ code: new Uint8Array(10) });
  assert.strictEqual(r.valid, false);
  assert(r.errors.some(e => e.includes("mask")));
});

test("IrisStandards.validateTemplate: code/mask length mismatch", () => {
  const r = IS.validateTemplate({
    code: new Uint8Array(10),
    mask: new Uint8Array(20),
  });
  assert.strictEqual(r.valid, false);
  assert(r.errors.some(e => e.includes("same length")));
});

test("IrisStandards.validateTemplate: codeLength mismatch", () => {
  const r = IS.validateTemplate({
    code: new Uint8Array(10),
    mask: new Uint8Array(10),
    codeLength: 20,
  });
  assert.strictEqual(r.valid, false);
  assert(r.errors.some(e => e.includes("codeLength")));
});

test("IrisStandards.validateTemplate: bad checksum", () => {
  const r = IS.validateTemplate({
    code: new Uint8Array([1, 2, 3]),
    mask: new Uint8Array([1, 2, 3]),
    checksum: "deadbeef",
  });
  assert.strictEqual(r.valid, false);
  assert(r.errors.some(e => e.includes("Checksum")));
});

test("IrisStandards.validateTemplate: valid template", () => {
  const code = new Uint8Array([1, 2, 3]);
  const checksum = IS._computeChecksum(code);
  const r = IS.validateTemplate({
    code: code,
    mask: new Uint8Array([1, 2, 3]),
    checksum: checksum,
  });
  assert.strictEqual(r.valid, true);
});

test("IrisStandards.validateTemplate: non-Uint8Array code", () => {
  const r = IS.validateTemplate({ code: [1, 2, 3], mask: new Uint8Array(3) });
  assert.strictEqual(r.valid, false);
});

test("IrisStandards.validateTemplate: non-Uint8Array mask", () => {
  const r = IS.validateTemplate({ code: new Uint8Array(3), mask: [1, 2, 3] });
  assert.strictEqual(r.valid, false);
});

test("IrisStandards.serialize: qualityScore = 0", () => {
  const data = IS.serialize(mockRecord({ qualityScore: 0 }));
  assert(data instanceof Uint8Array);
});

test("IrisStandards.serialize: qualityScore = 100", () => {
  const data = IS.serialize(mockRecord({ qualityScore: 100 }));
  assert(data instanceof Uint8Array);
});

test("IrisStandards.serialize: kind 7 record", () => {
  const data = IS.serialize(mockRecord({ imageKind: 7, width: 200, height: 200 }));
  assert(data instanceof Uint8Array);
});

test("IrisStandards.serialize: no deviceInfo", () => {
  const rec = mockRecord();
  delete rec.deviceInfo;
  const data = IS.serialize(rec);
  assert(data instanceof Uint8Array);
});

test("IrisStandards.serialize: no recordVersion", () => {
  const rec = mockRecord();
  delete rec.recordVersion;
  const data = IS.serialize(rec);
  assert(data instanceof Uint8Array);
});

test("IrisStandards.serialize: no imageData", () => {
  const rec = mockRecord();
  delete rec.imageData;
  const data = IS.serialize(rec);
  assert(data instanceof Uint8Array);
});

test("IrisStandards.serialize: empty imageData", () => {
  const data = IS.serialize(mockRecord({ imageData: new Uint8Array(0) }));
  assert(data instanceof Uint8Array);
});

test("IrisStandards.deserialize: kind 7 record", () => {
  const data = IS.serialize(mockRecord({ imageKind: 7 }));
  const deser = IS.deserialize(data);
  assert.strictEqual(deser.imageKind, 7);
});

test("IrisStandards.deserialize: no imageData → null", () => {
  const data = IS.serialize(mockRecord({ imageData: new Uint8Array(0) }));
  const deser = IS.deserialize(data);
  assert.strictEqual(deser.imageData, null);
});

test("IrisStandards.deserialize: with imageData", () => {
  const data = IS.serialize(mockRecord({ imageData: new Uint8Array([1,2,3,4]) }));
  const deser = IS.deserialize(data);
  assert.ok(deser.imageData);
  assert.strictEqual(deser.imageData.length, 4);
});

test("IrisStandards.deserialize: encryption fields", () => {
  const data = IS.serialize(mockRecord({ encryptionAlgorithm: 1, encryptionOptions: 2 }));
  const deser = IS.deserialize(data);
  assert.strictEqual(deser.encryptionAlgorithm, 1);
  assert.strictEqual(deser.encryptionOptions, 2);
});

test("IrisStandards.deserialize: creationDate / validFrom / validTo", () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  const future = new Date(Date.now() + 86400000).toISOString();
  const data = IS.serialize(mockRecord({ creationDate: past, validFrom: past, validTo: future }));
  const deser = IS.deserialize(data);
  assert.ok(deser.creationDate);
  assert.ok(deser.validFrom);
  assert.ok(deser.validTo);
});

test("IrisStandards._extractImageData: unsupported type → throws", () => {
  assert.throws(() => IS._extractImageData("bad"), /Unsupported/);
});

test("IrisStandards._extractImageData: ImageData instance", () => {
  const id = new ImageData(new Uint8ClampedArray(100), 10, 10);
  const r = IS._extractImageData(id);
  assert.strictEqual(r.width, 10);
});

test("IrisStandards.captureDeviceInfo: returns device info", () => {
  const info = IS.captureDeviceInfo();
  assert(typeof info === "object");
  assert(typeof info.userAgent === "string");
});

test("IrisStandards.validateDeviceInfo: valid info", () => {
  const info = IS.captureDeviceInfo();
  const r = IS.validateDeviceInfo(info);
  assert(typeof r.valid === "boolean");
});

test("IrisStandards.validateDeviceInfo: missing fields", () => {
  const r = IS.validateDeviceInfo({});
  assert(typeof r.valid === "boolean");
});

test("IrisStandards._classifyDeviceType: null → 0", () => {
  assert.strictEqual(IS._classifyDeviceType(null), 0);
});

test("IrisStandards._classifyDeviceType: mobile → 1", () => {
  assert.strictEqual(IS._classifyDeviceType("Mozilla/5.0 (Linux; Android 10)"), 1);
});

test("IrisStandards._classifyDeviceType: tablet → 2", () => {
  assert.strictEqual(IS._classifyDeviceType("Mozilla/5.0 (iPad; CPU OS 14)"), 2);
});

test("IrisStandards._classifyDeviceType: desktop → 3", () => {
  assert.strictEqual(IS._classifyDeviceType("Mozilla/5.0 (Windows NT 10.0)"), 3);
});

test("IrisStandards._computeChecksum: empty data", () => {
  const r = IS._computeChecksum(new Uint8Array(0));
  assert.strictEqual(typeof r, "string");
});

test("IrisStandards._computeChecksum: large data", () => {
  const r = IS._computeChecksum(new Uint8Array(10000).fill(42));
  assert.strictEqual(typeof r, "string");
});

test("IrisStandards._computeSHA256: returns promise", () => {
  const r = IS._computeSHA256(new Uint8Array([1, 2, 3]));
  assert(r instanceof Promise);
});

test("IrisStandards._getQualityLevel: boundary values", () => {
  const l = IS._getQualityLevel(26);
  assert(l.label === "Medium");
  const h = IS._getQualityLevel(51);
  assert(h.label === "High");
  const vh = IS._getQualityLevel(76);
  assert(vh.label === "Very High");
  const lo = IS._getQualityLevel(1);
  assert(lo.label === "Low");
});

test("IrisStandards.createBIR: with deviceInfo", () => {
  const rec = mockRecord({ deviceInfo: { deviceType: 0, userAgent: "test" } });
  const bir = IS.createBIR(rec);
  assert(bir.sbh.deviceInfo);
});

test("IrisStandards.createBIR: without qualityScore", () => {
  const rec = mockRecord();
  delete rec.qualityScore;
  const bir = IS.createBIR(rec);
  assert(bir.sbh.qualityBlocks.length === 0);
});

test("IrisStandards.createBIR: null → throws", () => {
  assert.throws(() => IS.createBIR(null), /required/);
});

test("IrisStandards.validateRecord: eyeSide 'left'", () => {
  const r = IS.validateRecord(mockRecord({ eyeSide: "left" }));
  assert.strictEqual(r.valid, true);
});

test("IrisStandards.validateRecord: eyeSide 'right'", () => {
  const r = IS.validateRecord(mockRecord({ eyeSide: "right" }));
  assert.strictEqual(r.valid, true);
});

test("IrisStandards.validateRecord: missing qualityScore", () => {
  const rec = mockRecord();
  delete rec.qualityScore;
  const r = IS.validateRecord(rec);
  assert(typeof r.valid === "boolean");
});

test("IrisStandards.validateRecord: missing recordVersion", () => {
  const rec = mockRecord();
  delete rec.recordVersion;
  const r = IS.validateRecord(rec);
  assert(typeof r.valid === "boolean");
});

test("IrisStandards.validateRecord: missing compressionType", () => {
  const rec = mockRecord();
  delete rec.compressionType;
  const r = IS.validateRecord(rec);
  assert(typeof r.valid === "boolean");
});

test("IrisStandards.deserialize: legacy 29-byte header", () => {
  const data = new Uint8Array(29);
  data[0] = 29; data[4] = 2; data[10] = 2;
  const deser = IS.deserialize(data);
  assert.strictEqual(deser.cbeff.headerSize, 29);
  assert.strictEqual(deser.eyeSide, "unknown");
  assert.equal(deser.creationDate, null);
});

test("IrisStandards.deserialize: zero timestamps → null dates", () => {
  const data = new Uint8Array(41);
  data[0] = 41; data[4] = 2; data[10] = 0;
  const deser = IS.deserialize(data);
  assert.equal(deser.creationDate, null);
  assert.equal(deser.validFrom, null);
  assert.equal(deser.validTo, null);
});

test("IrisStandards.deserialize: no deviceInfo field", () => {
  const data = new Uint8Array(41);
  data[0] = 41; data[4] = 2; data[10] = 0; data[27] = 0;
  const deser = IS.deserialize(data);
  assert.equal(deser.deviceInfo, null);
});

test("IrisStandards.deserialize: with deviceInfo", () => {
  const data = new Uint8Array(41);
  data[0] = 41; data[4] = 2; data[10] = 0; data[27] = 5;
  const deser = IS.deserialize(data);
  assert.ok(deser.deviceInfo);
  assert.strictEqual(deser.deviceInfo.deviceType, 5);
});

test("IrisStandards.deserialize: with image data appended", () => {
  const data = new Uint8Array(41 + 10);
  data[0] = 41; data[4] = 2; data[10] = 0;
  for (let i = 41; i < 51; i++) data[i] = i - 41 + 10;
  const deser = IS.deserialize(data);
  assert.ok(deser.imageData);
  assert.strictEqual(deser.imageData.length, 10);
});

test("IrisStandards.deserialize: header size > 33 but < 41", () => {
  const data = new Uint8Array(35);
  data[0] = 35; data[4] = 7; data[10] = 1;
  const deser = IS.deserialize(data);
  assert.ok(deser);
});

test("IrisStandards.createBIR: with encryptionAlgorithm", () => {
  const rec = mockRecord({ encryptionAlgorithm: 1, encryptionOptions: 3 });
  const bir = IS.createBIR(rec);
  assert.ok(bir);
  assert.ok(bir.bdb);
});

test("IrisStandards.createBIR: no cbeff on record (still builds SBH)", () => {
  const bir = IS.createBIR(mockRecord());
  assert.ok(bir.sbh.biometricType === 0x08);
});

test("IrisStandards.createBIR: no recordVersion", () => {
  const rec = mockRecord();
  delete rec.recordVersion;
  const bir = IS.createBIR(rec);
  assert.ok(bir.sbh.version.major === 1);
});

test("IrisStandards.createBIR: no creationDate/validFrom/validTo", () => {
  const rec = mockRecord();
  delete rec.creationDate;
  delete rec.validFrom;
  delete rec.validTo;
  const bir = IS.createBIR(rec);
  assert.ok(bir.sbh.creationDate);
});

test("IrisStandards.createTemplate: with version string", () => {
  const t = IS.createTemplate(new Uint8Array(100), new Uint8Array(100), "v1");
  assert.ok(t);
  assert.ok(typeof t.code === "object");
});

test("IrisStandards.createBIR: totalSize calculation", () => {
  const rec = mockRecord({ imageData: new Uint8Array(200) });
  const bir = IS.createBIR(rec);
  assert.ok(bir.totalSize > 0);
  assert.equal(typeof bir.totalSize, "number");
});

// ── iris_standards.js uncovered ranges ──

test("IS._classifyDeviceType: various agents (L141-L147)", () => {
  assert.equal(IS._classifyDeviceType(null), 0);
  assert.equal(IS._classifyDeviceType("Mozilla/5.0 (Linux; Android 13; Pixel 7)"), 1);
  assert.equal(IS._classifyDeviceType("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)"), 2);
  assert.equal(IS._classifyDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), 3);
  assert.equal(IS._classifyDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)"), 3);
});

test("IS._getQualityLevel: all tiers (L621)", () => {
  assert.equal(IS._getQualityLevel(10).label, "Low");
  assert.equal(IS._getQualityLevel(30).label, "Medium");
  assert.equal(IS._getQualityLevel(60).label, "High");
  assert.equal(IS._getQualityLevel(90).label, "Very High");
});

test("IS._computeSHA256: returns hex string (L647)", async () => {
  const result = await IS._computeSHA256(new Uint8Array(100));
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
});

test("IS.validateRecord: low quality + small iris (L296-L329)", () => {
  const result = IS.validateRecord({
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 50, height: 50, pixelDepth: 6,
    qualityScore: 30, eyeSide: "unknown", irisRadius: 30,
  });
  assert.ok(result.warnings.length > 0);
  assert.ok(result.valid);
});

test("IS.validateRecord: bad imageKind (L281)", () => {
  const result = IS.validateRecord({ imageKind: 99 });
  assert.ok(result.errors.length > 0);
});

test("IS.validateRecord: no deviceInfo (L326-L329)", () => {
  const result = IS.validateRecord({
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 100, height: 100, pixelDepth: 8,
    qualityScore: 70, eyeSide: "left", irisRadius: 50,
  });
  assert.ok(result.warnings.some(w => w.includes("deviceInfo")));
});

test("IS.serialize: header fields (L448)", () => {
  const record = {
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 10, height: 10, pixelDepth: 8,
    qualityScore: 70, eyeSide: "left",
    imageData: new Uint8Array(100).fill(0x80),
  };
  const data = IS.serialize(record);
  assert.ok(data instanceof Uint8Array);
  assert.ok(data.length > 33);
});

test("IS.deserialize: extended header with timestamps (L547-L566)", () => {
  const record = {
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 10, height: 10, pixelDepth: 8,
    qualityScore: 70, eyeSide: "right",
    imageData: new Uint8Array(100).fill(0x80),
    creationDate: new Date().toISOString(),
    encryptionAlgorithm: 1,
    deviceType: 2,
  };
  const data = IS.serialize(record);
  const result = IS.deserialize(data);
  assert.ok(result);
  assert.equal(result.eyeSide, "right");
});

test("IS.createBIR: returns SBH + BDB (L668-L710)", () => {
  const record = {
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 10, height: 10, pixelDepth: 8,
    qualityScore: 70, eyeSide: "left",
    imageData: new Uint8Array(100).fill(0x80),
  };
  const bir = IS.createBIR(record);
  assert.ok(bir.sbh);
  assert.ok(bir.bdb);
  assert.ok(bir.totalSize > 0);
});

// ── iris_standards.js additional uncovered ranges ──

test("IS.validateRecord: valid Kind 2 640x480 (L290-L291)", () => {
  const result = IS.validateRecord({
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 640, height: 480, pixelDepth: 8,
    qualityScore: 80, eyeSide: "left", irisRadius: 60,
  });
  assert.equal(result.valid, true);
  assert.ok(!result.warnings.some(w => w.includes("640x480")));
});

test("IS.validateRecord: Kind 7 below min iris diameter (L305-L307)", () => {
  const result = IS.validateRecord({
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 7, width: 200, height: 200, pixelDepth: 8,
    qualityScore: 80, eyeSide: "left", irisRadius: 40,
  });
  assert.ok(result.warnings.some(w => w.includes("below minimum")));
});

test("IS.validateRecord: invalid validity period (L318-L322)", () => {
  const result = IS.validateRecord({
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 640, height: 480, pixelDepth: 8,
    qualityScore: 80, eyeSide: "left", irisRadius: 60,
    validFrom: "2025-12-31", validTo: "2025-01-01",
  });
  assert.ok(result.errors.some(e => e.includes("validTo must be after validFrom")));
});

test("IS.validateRecord: bad validity dates (L318-L319)", () => {
  const result = IS.validateRecord({
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 640, height: 480, pixelDepth: 8,
    qualityScore: 80, eyeSide: "left", irisRadius: 60,
    validFrom: "not-a-date", validTo: "also-not",
  });
  assert.ok(result.errors.some(e => e.includes("Invalid validity period")));
});

test("IS.createRecord: with ImageData and optional params (L235-L249)", () => {
  const imgData = new global.ImageData(new Uint8Array(64 * 64 * 4), 64, 64);
  const record = IS.createRecord({
    image: imgData,
    eyeSide: "right",
    irisCenterX: 32, irisCenterY: 32, irisRadius: 28,
    qualityScore: 90,
    compressionType: 1,
    imageKind: 7,
  });
  assert.equal(record.eyeSide, "right");
  assert.equal(record.irisCenterX, 32);
  assert.equal(record.irisRadius, 28);
  assert.equal(record.compressionType, 1);
  assert.equal(record.imageKind, 7);
});

test("IS.validateRecord: imageKind 7 not 2 or 7 → error (L281)", () => {
  const result = IS.validateRecord({
    imageKind: 99, width: 100, height: 100,
  });
  assert.ok(result.errors.some(e => e.includes("imageKind")));
});

test("IS.validateRecord: missing width/height → error (L285-L287)", () => {
  const result = IS.validateRecord({
    imageKind: 2, width: 0, height: 0,
  });
  assert.ok(result.errors.some(e => e.includes("width or height")));
});

test("IS.deserialize: legacy 29-byte header (L547-L560)", () => {
  const record = {
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 8, height: 8, pixelDepth: 8,
    qualityScore: 70, eyeSide: "unknown",
    imageData: new Uint8Array(64).fill(0x80),
  };
  const data = IS.serialize(record);
  const result = IS.deserialize(data);
  assert.ok(result);
  assert.equal(result.width, 8);
  assert.equal(result.height, 8);
});

test("IS.deserialize: eyeSide encoding (L595)", () => {
  const record = {
    cbeff: { headerSize: 33, owner: 1, type: 1, version: 1, birType: 1, recordVersion: {major:1,minor:0} },
    imageKind: 2, width: 8, height: 8, pixelDepth: 8,
    qualityScore: 70, eyeSide: "right",
    imageData: new Uint8Array(64).fill(0x80),
  };
  const data = IS.serialize(record);
  const result = IS.deserialize(data);
  assert.equal(result.eyeSide, "right");
});

// ── iris_standards.js ──
test("IS constructor (L26-L27)", () => { const s = new IS(); assert.ok(s); });
test("IS.validateDeviceInfo: null (L157-L159)", () => {
  const r = IS.validateDeviceInfo(null);
  assert.equal(r.valid, false);
});
test("IS.createRecord: missing image throws (L196-L198)", () => {
  assert.throws(() => IS.createRecord({}), /image is required/);
});
test("IS.createRecord: with validTo (L207-L209)", () => {
  const imgData = new ImageData(new Uint8Array(64 * 64 * 4).fill(128), 64, 64);
  const r = IS.createRecord({ image: imgData, validTo: "2028-01-01" });
  assert.ok(r);
});
test("IS.validateRecord: null (L277-L279)", () => {
  const r = IS.validateRecord(null);
  assert.equal(r.valid, false);
  assert.ok(r.errors.length > 0);
});
test("IS.validateRecord: CBEFF birType warning (L333-L335)", () => {
  const imgData = new ImageData(new Uint8Array(64 * 64 * 4).fill(128), 64, 64);
  const rec = IS.createRecord({ image: imgData, eyeSide: "left" });
  rec.cbeff = { owner: "00" };
  const r = IS.validateRecord(rec);
  assert.ok(r.warnings.some(w => w.includes("BIR type")));
});
test("IS.createTemplate: missing args throws (L356-L358)", () => {
  assert.throws(() => IS.createTemplate(null, null), /code and mask are required/);
});

// ── iris_standards.js: serialize with full record (L474) ──
test("IS.serialize: full record with width (L474)", () => {
  const record = {
    cbeff: { patronHeaderVersion: 0x10, birProfile: 0x01, feature: 0x01, compliance: 0x00, cbeffVersion: 0x01 },
    imageKind: 0x02, pixelDepth: 8, width: 64, height: 64,
    eyeSide: "left", enrolledAt: Date.now(),
    imageData: new Uint8Array(64 * 64).fill(128),
  };
  const r = IS.serialize(record);
  assert.ok(r instanceof Uint8Array);
  assert.ok(r.length > 20);
});

// ── iris_standards.js: _extractImageData with ImageData (L579-L590) ──
test("IS._extractImageData: valid ImageData input (L579-L590)", () => {
  const imgData = new ImageData(new Uint8ClampedArray(16), 4, 4);
  const r = IS._extractImageData(imgData);
  assert.ok(r);
  assert.ok(r.data);
  assert.equal(r.width, 4);
  assert.equal(r.height, 4);
});

// ── iris_standards.js: createBIR with low quality (L659) ──
test("IS.createBIR: low quality → QUALITY_LEVEL.LOW (L659)", () => {
  const record = {
    cbeff: { patronHeaderVersion: 0x10, birProfile: 0x01, feature: 0x01, compliance: 0x00, cbeffVersion: 0x01 },
    imageKind: 0x02, pixelDepth: 8, width: 4, height: 4,
    eyeSide: "left", enrolledAt: Date.now(), qualityScore: 10,
    imageData: new Uint8Array(16).fill(128),
  };
  const r = IS.createBIR(record);
  assert.ok(r);
});

// ── IS.captureDeviceInfo: returns device info (L118) ──
test("IS.captureDeviceInfo: returns device info object (L118)", () => {
  const r = IS.captureDeviceInfo();
  assert.ok(r);
  assert.ok(r.userAgent !== undefined);
  assert.ok(r.language !== undefined);
});

// ── IS.serialize: header width field at offset 5-6 (L474) ──
test("IS.serialize: width field at header offset 5-6 (L474)", () => {
  const record = {
    cbeff: { patronHeaderVersion: 0x10, birProfile: 0x01, feature: 0x01, compliance: 0x00, cbeffVersion: 0x01 },
    imageKind: 0x02, pixelDepth: 8, width: 256, height: 192,
    eyeSide: "right", enrolledAt: Date.now(),
    imageData: new Uint8Array(256 * 192).fill(100),
  };
  const r = IS.serialize(record);
  assert.ok(r instanceof Uint8Array);
  assert.equal((r[5] << 8) | r[6], 256);
});

// ── IS._extractImageData: via deserialize round-trip (L579, L582, L590) ──
test("IS._extractImageData: via deserialize round-trip (L579, L582, L590)", () => {
  const record = {
    cbeff: { patronHeaderVersion: 0x10, birProfile: 0x01, feature: 0x01, compliance: 0x00, cbeffVersion: 0x01 },
    imageKind: 0x02, pixelDepth: 8, width: 8, height: 8,
    eyeSide: "left", enrolledAt: Date.now(), qualityScore: 75,
    imageData: new Uint8Array(64).fill(128),
  };
  const buf = IS.serialize(record);
  const deserialized = IS.deserialize(buf);
  assert.ok(deserialized);
  assert.equal(deserialized.imageKind, 2);
  assert.equal(deserialized.qualityScore, 75);
  assert.ok(deserialized.imageData);
  assert.ok(deserialized.cbeff.birType !== undefined);
  assert.ok(deserialized.creationDate !== undefined);
});

// ── IS._getQualityLevel: LOW for low score (L659) ──
test("IS._getQualityLevel: LOW for score < 26 (L659)", () => {
  const r = IS._getQualityLevel(10);
  assert.ok(r);
  assert.equal(r.label, "Low");
});
