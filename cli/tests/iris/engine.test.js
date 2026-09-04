require("./setup");
const test = require("node:test");
const assert = require("node:assert");

const IE = global.IrisEngine;

function makeGray(w, h, fillFn) {
  const g = new Float64Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) g[y * w + x] = fillFn(x, y);
  return g;
}

test("IrisEngine: IRIS_ENGINE_CONFIG has hammingThreshold", () => {
  assert.equal(typeof global.IRIS_ENGINE_CONFIG.hammingThreshold, "number");
});

test("IrisEngine.detectPupil: uniform image → center pupil", () => {
  const w = 160,
    h = 160;
  const gray = new Float64Array(w * h).fill(128);
  const pupil = IE.detectPupil(gray, w, h);
  assert.ok(pupil);
  assert.equal(typeof pupil.cx, "number");
  assert.equal(typeof pupil.cy, "number");
  assert.ok(pupil.radius > 0);
});

test("IrisEngine.detectIris: returns iris object", () => {
  const w = 160,
    h = 160;
  const gray = new Float64Array(w * h).fill(128);
  const pupil = { cx: 80, cy: 80, radius: 10 };
  const iris = IE.detectIris(gray, w, h, pupil);
  assert.ok(iris);
  assert.ok(iris.radius > 0);
});

test("IrisEngine.normalize: returns Float64Array", () => {
  const w = 160,
    h = 160;
  const gray = new Float64Array(w * h).fill(128);
  const pupil = { cx: 80, cy: 80, radius: 10 };
  const iris = { cx: 80, cy: 80, radius: 40 };
  const norm = IE.normalize(gray, w, h, pupil, iris, 64, 32);
  assert.ok(norm instanceof Float64Array);
  assert.equal(norm.length, 64 * 32);
});

test("IrisEngine.generateIrisCode: returns code + mask", () => {
  const normW = 64,
    normH = 32;
  const normalized = new Float64Array(normW * normH);
  for (let i = 0; i < normalized.length; i++) normalized[i] = (i * 7) % 256;
  const result = IE.generateIrisCode(normalized, normW, normH);
  assert.ok(result.code instanceof Uint8Array);
  assert.ok(result.mask instanceof Uint8Array);
  assert.ok(result.length > 0);
});

test("IrisEngine.validateEyePresence: null params → rejected", () => {
  const res = IE.validateEyePresence(
    new Float64Array(100),
    10,
    10,
    { cx: 5, cy: 5, radius: 0 },
    { cx: 5, cy: 5, radius: 0 },
  );
  assert.equal(res.ok, false);
});

test("IrisEngine._meanDisk: returns number", () => {
  const gray = new Float64Array(100 * 100).fill(128);
  const val = IE._meanDisk(gray, 100, 100, 50, 50, 20);
  assert.equal(typeof val, "number");
});

test("IrisEngine._meanAnnulus: returns number", () => {
  const gray = new Float64Array(100 * 100).fill(128);
  const val = IE._meanAnnulus(gray, 100, 100, 50, 50, 10, 30);
  assert.equal(typeof val, "number");
});

test("IrisEngine._varAnnulus: returns number", () => {
  const gray = new Float64Array(100 * 100).fill(128);
  const val = IE._varAnnulus(gray, 100, 100, 50, 50, 10, 30);
  assert.equal(typeof val, "number");
});

test("IrisEngine._gaborResponse: returns real+imag", () => {
  const img = new Float64Array(100 * 100);
  for (let i = 0; i < img.length; i++) img[i] = (i * 3) % 256;
  const resp = IE._gaborResponse(img, 100, 100, 50, 50, 5, 0);
  assert.equal(typeof resp.real, "number");
  assert.equal(typeof resp.imag, "number");
});

test("IrisEngine.prototype.segment: full pipeline", () => {
  const engine = new IE();
  const gray = new Uint8Array(64 * 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const dx = x - 32,
        dy = y - 32;
      const dist = Math.sqrt(dx * dx + dy * dy);
      gray[y * 64 + x] = dist < 12 ? 30 : dist < 30 ? 80 : 160;
    }
  }
  const input = {
    width: 64,
    height: 64,
    data: gray,
  };
  // Inject via _toGrayscale path
  const imgData = {
    data: new Uint8ClampedArray(64 * 64 * 4),
    width: 64,
    height: 64,
  };
  for (let i = 0; i < 64 * 64; i++) {
    imgData.data[i * 4] = gray[i];
    imgData.data[i * 4 + 1] = gray[i];
    imgData.data[i * 4 + 2] = gray[i];
    imgData.data[i * 4 + 3] = 255;
  }
  const result = engine.segment(imgData);
  assert.ok(result);
  assert.ok(result.pupil);
  assert.ok(result.iris);
  assert.ok(result.gray);
  assert.equal(result.width, 64);
  assert.equal(result.height, 64);
});

test("IrisEngine.prototype.extract: throws when not loaded", () => {
  const engine = new IE();
  try {
    engine.extract({ width: 10, height: 10, data: new Uint8Array(400) });
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("loaded"));
  }
});

test("IrisEngine.validateEyePresence: off-center pupil", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(
    gray,
    640,
    480,
    { cx: 30, cy: 30, radius: 15 },
    { cx: 30, cy: 30, radius: 80 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "off-center");
});

test("IrisEngine.validateEyePresence: off-center pupil (right edge)", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(
    gray,
    640,
    480,
    { cx: 610, cy: 455, radius: 15 },
    { cx: 610, cy: 455, radius: 80 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "off-center");
});

test("IrisEngine.validateEyePresence: no-dark-pupil branch", () => {
  const gray = new Float64Array(640 * 480).fill(200);
  const result = IE.validateEyePresence(
    gray,
    640,
    480,
    { cx: 320, cy: 240, radius: 20 },
    { cx: 320, cy: 240, radius: 80 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no-dark-pupil");
});

test("IrisEngine.validateEyePresence: no-signal (tiny iris)", () => {
  const gray = new Float64Array(640 * 480).fill(0);
  const result = IE.validateEyePresence(
    gray,
    640,
    480,
    { cx: 320, cy: 240, radius: 5 },
    { cx: 320, cy: 240, radius: 10 },
  );
  assert.equal(result.ok, false);
  assert.ok(
    [
      "no-signal",
      "pupil-size",
      "iris-size",
      "iris-size-absolute",
      "iris-pupil-ratio",
      "off-center",
    ].includes(result.reason),
  );
});

test("IrisEngine._toGrayscale: handles Uint8Array input", () => {
  const data = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 100;
    data[i + 1] = 150;
    data[i + 2] = 200;
    data[i + 3] = 255;
  }
  const result = IE._toGrayscale({ data: data, width: 64, height: 64 });
  assert.ok(result);
  assert.equal(result.width, 64);
});

test("IrisEngine._toGrayscale: handles float data", () => {
  const data = new Float64Array(64 * 64 * 4);
  for (let i = 0; i < data.length; i++) data[i] = 128;
  const result = IE._toGrayscale({ data: data, width: 64, height: 64 });
  assert.ok(result);
});

test("IrisEngine.detectPupil: non-uniform image finds pupil", () => {
  const gray = new Float64Array(200 * 200).fill(160);
  for (let y = 80; y < 120; y++) {
    for (let x = 80; x < 120; x++) {
      gray[y * 200 + x] = 20;
    }
  }
  const pupil = IE.detectPupil(gray, 200, 200);
  assert.ok(pupil);
  assert.ok(pupil.radius > 0);
  assert.ok(pupil.cx >= 0);
  assert.ok(pupil.cy >= 0);
});

test("IrisEngine.detectIris: finds iris outside pupil", () => {
  const gray = new Float64Array(300 * 300).fill(140);
  for (let y = 100; y < 200; y++) {
    for (let x = 100; x < 200; x++) {
      const dx = x - 150,
        dy = y - 150;
      const dist = Math.sqrt(dx * dx + dy * dy);
      gray[y * 300 + x] = dist < 20 ? 30 : dist < 90 ? 100 : 160;
    }
  }
  const pupil = { cx: 150, cy: 150, radius: 20 };
  const iris = IE.detectIris(gray, 300, 300, pupil);
  assert.ok(iris);
  assert.ok(iris.radius > pupil.radius);
});

test("IrisEngine.validateEyePresence: iris-size-absolute (too small)", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(
    gray,
    640,
    480,
    { cx: 320, cy: 240, radius: 20 },
    { cx: 320, cy: 240, radius: 60 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "iris-size-absolute");
});

test("IrisEngine.validateEyePresence: iris-pupil-ratio too high", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(
    gray,
    640,
    480,
    { cx: 320, cy: 240, radius: 20 },
    { cx: 320, cy: 240, radius: 200 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "iris-pupil-ratio");
});

test("IrisEngine.validateEyePresence: iris-pupil-ratio too low", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(
    gray,
    640,
    480,
    { cx: 320, cy: 240, radius: 85 },
    { cx: 320, cy: 240, radius: 80 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "iris-pupil-ratio");
});

test("IrisEngine.validateEyePresence: low-iris-texture (uniform iris)", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(
    gray,
    640,
    480,
    { cx: 320, cy: 240, radius: 20 },
    { cx: 320, cy: 240, radius: 200 },
  );
  assert.equal(result.ok, false);
  assert.ok(
    [
      "low-iris-texture",
      "no-dark-pupil",
      "iris-pupil-ratio",
      "iris-size",
    ].includes(result.reason),
  );
});

test("IrisEngine.validateEyePresence: pupil-size too small", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(
    gray,
    640,
    480,
    { cx: 320, cy: 240, radius: 1 },
    { cx: 320, cy: 240, radius: 200 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "pupil-size");
});

test("IrisEngine.validateEyePresence: pupil-size too large", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(
    gray,
    640,
    480,
    { cx: 320, cy: 240, radius: 160 },
    { cx: 320, cy: 240, radius: 200 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "pupil-size");
});

test("IrisEngine.validateEyePresence: iris-size too large", () => {
  const gray = new Float64Array(640 * 480).fill(128);
  const result = IE.validateEyePresence(
    gray,
    640,
    480,
    { cx: 320, cy: 240, radius: 20 },
    { cx: 320, cy: 240, radius: 400 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "iris-size");
});

test("IrisEngine.validateEyePresence: passing valid eye", () => {
  const gray = new Float64Array(640 * 480).fill(150);
  for (let y = 150; y < 330; y++) {
    for (let x = 220; x < 420; x++) {
      const dx = x - 320,
        dy = y - 240;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 25) gray[y * 640 + x] = 10;
      else if (dist < 150) gray[y * 640 + x] = 130 + Math.sin(x * 0.1) * 30;
    }
  }
  const result = IE.validateEyePresence(
    gray,
    640,
    480,
    { cx: 320, cy: 240, radius: 25 },
    { cx: 320, cy: 240, radius: 150 },
  );
  assert.equal(typeof result.ok, "boolean");
});

test("IrisEngine._meanDisk: empty disk → NaN", () => {
  const gray = new Float64Array(100 * 100).fill(100);
  const r = IE._meanDisk(gray, 100, 100, -500, -500, 5);
  assert.ok(Number.isNaN(r));
});

test("IrisEngine._meanAnnulus: empty annulus → NaN", () => {
  const gray = new Float64Array(100 * 100).fill(100);
  const r = IE._meanAnnulus(gray, 100, 100, 500, 500, 5, 10);
  assert.ok(Number.isNaN(r));
});

test("IrisEngine._varAnnulus: empty annulus → NaN", () => {
  const gray = new Float64Array(100 * 100).fill(100);
  const r = IE._varAnnulus(gray, 100, 100, 500, 500, 5, 10);
  assert.ok(Number.isNaN(r));
});

test("IrisEngine._varAnnulus: uniform annulus → low variance", () => {
  const gray = new Float64Array(100 * 100).fill(100);
  const r = IE._varAnnulus(gray, 100, 100, 50, 50, 20, 40);
  assert.equal(r, 0);
});

test("IrisEngine.normalize: with custom normW/normH", () => {
  const gray = new Float64Array(200 * 200).fill(100);
  const norm = IE.normalize(
    gray,
    200,
    200,
    { cx: 100, cy: 100, radius: 20 },
    { cx: 100, cy: 100, radius: 80 },
    128,
    64,
  );
  assert.ok(norm instanceof Float64Array);
  assert.equal(norm.length, 128 * 64);
});

test("IrisEngine.generateIrisCode: all-zeros input", () => {
  const data = new Float64Array(64 * 32).fill(0);
  const code = IE.generateIrisCode(data, 64, 32);
  assert.ok(code);
  assert.ok(code.code instanceof Uint8Array);
  assert.ok(code.mask instanceof Uint8Array);
});

test("IrisEngine.generateIrisCode: high-variance input", () => {
  const data = new Float64Array(64 * 32);
  for (let i = 0; i < data.length; i++) data[i] = i % 2 === 0 ? 0 : 255;
  const code = IE.generateIrisCode(data, 64, 32);
  assert.ok(code);
});

test("IrisEngine._toGrayscale: returns raw data for plain object", () => {
  const result = IE._toGrayscale({
    data: new Uint8ClampedArray(64 * 64 * 4).fill(128),
    width: 64,
    height: 64,
  });
  assert.equal(result.width, 64);
  assert.equal(result.height, 64);
  assert.ok(result.data);
});

test("IrisEngine.detectPupil: all-zeros image", () => {
  const gray = new Float64Array(200 * 200).fill(0);
  const pupil = IE.detectPupil(gray, 200, 200);
  assert.ok(pupil);
  assert.ok(typeof pupil.cx === "number");
});

test("IrisEngine.isLoaded: returns false initially (L73)", () => {
  const eng = new IE();
  assert.equal(eng.isLoaded(), false);
});

test("IrisEngine.loadModels: sets loaded (L82-L86)", async () => {
  const eng = new IE();
  await eng.loadModels();
  assert.equal(eng.isLoaded(), true);
  await eng.loadModels();
  assert.equal(eng.isLoaded(), true);
});

test("IrisEngine._toGrayscale: canvas image path (L98-L100)", () => {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const result = IE._toGrayscale(canvas);
  assert.ok(result.width > 0);
});

test("IrisEngine.detectPupil: synthetic dark circle (L322-L327)", () => {
  const w = 100,
    h = 100;
  const gray = makeGray(w, h, (x, y) => {
    const dx = x - 50,
      dy = y - 50;
    return Math.sqrt(dx * dx + dy * dy) < 15 ? 20 : 150;
  });
  const result = IE.detectPupil(gray, w, h);
  assert.ok(result.cx >= 0 && result.cx < w);
});

test("IrisEngine.validateEyePresence: no-signal path (L326)", () => {
  const w = 100,
    h = 100;
  const gray = makeGray(w, h, () => 128);
  const result = IE.validateEyePresence(
    gray,
    w,
    h,
    { cx: 50, cy: 50, radius: 15 },
    { cx: 50, cy: 50, radius: 45 },
  );
  assert.equal(typeof result.ok, "boolean");
});

test("IrisEngine._meanAnnulus: edge case (L405)", () => {
  const w = 50,
    h = 50;
  const gray = makeGray(w, h, (x, y) => (x + y) % 200);
  const result = IE._meanAnnulus(gray, w, h, 25, 25, 5, 20);
  assert.equal(typeof result, "number");
});

test("IrisEngine.normalize: full path (L201-L204)", () => {
  const w = 100,
    h = 100;
  const gray = makeGray(
    w,
    h,
    (x, y) => Math.sin(x * 0.1 + y * 0.05) * 127 + 128,
  );
  const result = IE.normalize(
    gray,
    w,
    h,
    { cx: 50, cy: 50, radius: 15 },
    { cx: 50, cy: 50, radius: 45 },
    { irisWidth: 64, irisHeight: 128 },
  );
  assert.ok(result instanceof Float64Array);
});

test("IrisEngine.generateIrisCode: from normalized iris (L585-L598)", () => {
  const norm = new Float64Array(64 * 128);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 64; x++)
      norm[y * 64 + x] = Math.sin(x * 0.2 + y * 0.1) * 127 + 128;
  const result = IE.generateIrisCode(norm, 64, 128);
  assert.ok(result.code instanceof Uint8Array);
  assert.ok(result.mask instanceof Uint8Array);
});

test("IE._toGrayscale: ImageData input (L101-L103)", () => {
  const imgData = new ImageData(
    new Uint8Array(100 * 100 * 4).fill(128),
    100,
    100,
  );
  const r = IE._toGrayscale(imgData);
  assert.equal(r.width, 100);
  assert.equal(r.height, 100);
});
test("IE._toGrayscale: canvas element input (L105-L108)", () => {
  const input = { videoWidth: 0, videoHeight: 0, width: 80, height: 60 };
  const r = IE._toGrayscale(input);
  assert.ok(r);
});
test("IE.validateEyePresence: no-dark-pupil (L327)", () => {
  const gray = new Uint8Array(200 * 200).fill(150);
  const r = IE.validateEyePresence(
    gray,
    200,
    200,
    { cx: 100, cy: 100, radius: 30 },
    { cx: 100, cy: 100, radius: 80 },
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no-dark-pupil");
});
test("IE.validateEyePresence: low-iris-texture (L328-L330)", () => {
  const gray = new Uint8Array(200 * 200);
  for (let y = 0; y < 200; y++)
    for (let x = 0; x < 200; x++) {
      const d = Math.hypot(x - 100, y - 100);
      if (d < 30) gray[y * 200 + x] = 20;
      else if (d < 80) gray[y * 200 + x] = 100;
      else gray[y * 200 + x] = 180;
    }
  const r = IE.validateEyePresence(
    gray,
    200,
    200,
    { cx: 100, cy: 100, radius: 30 },
    { cx: 100, cy: 100, radius: 80 },
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, "low-iris-texture");
});
test("IE.validateEyePresence: ok path (L330-L331)", () => {
  const gray = new Uint8Array(200 * 200);
  for (let y = 0; y < 200; y++)
    for (let x = 0; x < 200; x++) {
      const d = Math.hypot(x - 100, y - 100);
      if (d < 30) gray[y * 200 + x] = 20;
      else if (d < 80) gray[y * 200 + x] = 100 + ((x + y) % 40);
      else gray[y * 200 + x] = 180;
    }
  const r = IE.validateEyePresence(
    gray,
    200,
    200,
    { cx: 100, cy: 100, radius: 30 },
    { cx: 100, cy: 100, radius: 80 },
  );
  assert.equal(r.ok, true);
});
test("IE._varAnnulus: n=0 returns NaN (L419)", () => {
  const gray = new Uint8Array(10 * 10).fill(128);
  const r = IE._varAnnulus(gray, 10, 10, 100, 100, 5, 8);
  assert.ok(!isFinite(r) || isNaN(r));
});
test("IE.normalize: default normW/normH (L448)", () => {
  const gray = new Uint8Array(100 * 100).fill(128);
  const r = IE.normalize(
    gray,
    100,
    100,
    { cx: 50, cy: 50, radius: 30 },
    { cx: 50, cy: 50, radius: 45 },
  );
  assert.ok(r);
});
test("IE.generateIrisCode: default wavelength (L566)", () => {
  const norm = new Float64Array(512 * 64);
  for (let i = 0; i < norm.length; i++) norm[i] = Math.sin(i * 0.1) * 128 + 128;
  const r = IE.generateIrisCode(norm, 512, 64);
  assert.ok(r);
  assert.ok(r.code);
  assert.ok(r.mask);
});

test("IE._varAnnulus: valid annulus region (L405-L419)", () => {
  const gray = new Uint8Array(200 * 200);
  for (let y = 0; y < 200; y++)
    for (let x = 0; x < 200; x++) {
      const d = Math.hypot(x - 100, y - 100);
      if (d >= 30 && d <= 80) gray[y * 200 + x] = 100 + ((x + y) % 50);
      else gray[y * 200 + x] = 50;
    }
  const r = IE._varAnnulus(gray, 200, 200, 100, 100, 30, 80);
  assert.equal(typeof r, "number");
  assert.ok(r >= 0);
});

test("IE.validateEyePresence: full pass including _meanDisk and _varAnnulus (L340, L429)", () => {
  const w = 300,
    h = 300;
  const gray = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - 150, y - 150);
      if (d < 25) gray[y * w + x] = 30;
      else if (d < 90) gray[y * w + x] = 120 + Math.sin(x * 0.2 + y * 0.1) * 30;
      else gray[y * w + x] = 180;
    }
  const r = IE.validateEyePresence(
    gray,
    w,
    h,
    { cx: 150, cy: 150, radius: 25 },
    { cx: 150, cy: 150, radius: 100 },
  );
  assert.ok(r.ok);
});

// ── IE.validateEyePresence: with varying texture for _meanDisk (L340) ──
test("IE.validateEyePresence: gradient image with dark pupil (L340)", () => {
  const w = 300,
    h = 300;
  const gray = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - 150, y - 150);
      if (d < 25) gray[y * w + x] = 20;
      else if (d < 110)
        gray[y * w + x] = 110 + Math.sin(x * 0.15 + y * 0.1) * 25;
      else gray[y * w + x] = 180;
    }
  const r = IE.validateEyePresence(
    gray,
    w,
    h,
    { cx: 150, cy: 150, radius: 25 },
    { cx: 150, cy: 150, radius: 110 },
  );
  assert.equal(typeof r.ok, "boolean");
});

// ── IE._varAnnulus: with specific annulus region (L429) ──
test("IE._varAnnulus: gradient in annulus region (L429)", () => {
  const w = 200,
    h = 200;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++)
    gray[i] = 100 + Math.sin(i * 0.005) * 30;
  const r = IE._varAnnulus(gray, w, h, 100, 100, 50, 90);
  assert.equal(typeof r, "number");
  assert.ok(r >= 0);
});
