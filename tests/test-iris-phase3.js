const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ── harness: load browser sources into a node sandbox ── */
const docShim = (() => {
  const store = {};
  const el = () => ({
    style: {}, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, appendChild() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getContext() { return { getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }), drawImage() {}, putImageData() {} }; },
    width: 0, height: 0, value: '', textContent: '', innerHTML: '', files: [],
  });
  return {
    getElementById: (id) => (store[id] || (store[id] = el())),
    querySelector: () => el(), querySelectorAll: () => [],
    createElement: () => el(), addEventListener() {}, body: el(), documentElement: el(),
  };
})();

global.window = global;
global.self = global;
global.navigator = undefined;
global.location = { protocol: 'file:', href: 'file:///test' };
global.document = docShim;
global.ImageData = global.ImageData || (typeof ImageData === 'undefined' ? null : ImageData);
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.crypto = global.crypto || require('node:crypto').webcrypto;
global.__ = (k, d) => (d === undefined ? k : d);

const files = ['Iris_Biometric/iris_quality_full.js', 'Iris_Biometric/iris_ui.js'];
for (const f of files) {
  const src = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
  vm.runInThisContext(src, { filename: f });
}

const Q = global.IrisQualityFull;

const test = require('node:test');
const assert = require('node:assert');

/* ── Phase 3A: NIR capability detection ── */
test('detectNirCapability: no mediaDevices → unavailable (visible fallback)', async () => {
  Object.defineProperty(global, 'navigator', { value: { userAgent: 'node' }, configurable: true });
  const r = await Q.detectNirCapability();
  assert.strictEqual(r.nirAvailable, false);
  assert.strictEqual(r.reason, 'mediaDevices-unavailable');
  assert.strictEqual(r.fallback, 'visible');
});

test('detectNirCapability: IR device label → available', async () => {
  Object.defineProperty(global, 'navigator', { value: { mediaDevices: { enumerateDevices: async () => [
    { kind: 'videoinput', label: 'Integrated IR Camera' },
    { kind: 'videoinput', label: 'HD Webcam' },
  ] } }, configurable: true });
  const r = await Q.detectNirCapability();
  assert.strictEqual(r.nirAvailable, true);
  Object.defineProperty(global, 'navigator', { value: { userAgent: 'node' }, configurable: true });
});

test('detectNirCapability: no IR label → visible fallback', async () => {
  Object.defineProperty(global, 'navigator', { value: { mediaDevices: { enumerateDevices: async () => [
    { kind: 'videoinput', label: 'FaceTime HD Camera' },
  ] } }, configurable: true });
  const r = await Q.detectNirCapability();
  assert.strictEqual(r.nirAvailable, false);
  assert.strictEqual(r.fallback, 'visible');
  Object.defineProperty(global, 'navigator', { value: { userAgent: 'node' }, configurable: true });
});

/* ── Phase 3D: specular reflection in vendor slot 18 (index 17) ── */
/**
 *
 * @param W
 * @param H
 * @param brightAnnulus
 */
function fakeGrayImage(W, H, brightAnnulus) {
  // 1D grayscale array (matches how the pipeline passes `gray` to specularReflection)
  const data = new Uint8Array(W * H);
  if (brightAnnulus) {
    // Saturated specular highlight inside the iris annulus (around (50,70), dist 20)
    for (let y = 68; y < 72; y++) for (let x = 48; x < 52; x++) {
      data[y * W + x] = 255;
    }
  }
  return data;
}

test('generateQualityVector: specular in slot 18 (idx 17), VIA in slot 19 (idx 18)', () => {
  const W = 100, H = 100;
  const gray = fakeGrayImage(W, H, true);
  const pupil = { x: 50, y: 50, radius: 10 };
  const iris = { x: 50, y: 50, radius: 30 };
  const viaMask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot((x - 50), (y - 50));
    if (d >= 30 * 0.3 && d <= 30) viaMask[y * W + x] = 1;
  }
  const v = Q.generateQualityVector({ imageData: gray, width: W, height: H, pupil, iris, mask: viaMask });
  assert.strictEqual(v.length, 64, 'quality vector must be 64 slots');
  assert.ok(v[17] > 0, 'specular vendor slot 18 (idx 17) should be > 0, got ' + v[17]);
  assert.ok(v[11] > 0, 'defined specular metric slot 12 (idx 11) should be > 0, got ' + v[11]);
  assert.ok(v[18] > 0 && v[18] <= 100, 'VIA slot 19 (idx 18) should be in (0,100], got ' + v[18]);
});

test('generateQualityVector: no pupil/iris → specular slot 18 = 0', () => {
  const v = Q.generateQualityVector({});
  assert.strictEqual(v[17], 0);
});
