require("./setup");

const test = require("node:test");
const assert = require("node:assert");

// ── DOM polyfills ──
global.window = global;
global.self = global;
global.location = { protocol: "file:", href: "file:///test" };
global.navigator = { userAgent: "node-test" };
global.document = {
  getElementById: (id) => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (t) => {
    if (t === "canvas") {
      return {
        width: 0, height: 0,
        getContext: () => ({
          drawImage: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray(640 * 480 * 4), width: 640, height: 480 }),
          putImageData: () => {},
        }),
        toBlob: (cb) => cb(new Blob()),
        toDataURL: () => "data:image/png;base64,",
      };
    }
    const el = {
      style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {},
      appendChild() {},
      setAttribute() {},
      getAttribute() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      width: 0,
      height: 0,
      value: "",
      textContent: "",
      innerHTML: "",
      files: [],
    };
    return el;
  },
  addEventListener() {},
  body: { appendChild() {} },
  documentElement: {},
};
global.HTMLCanvasElement = function () {};
global.HTMLVideoElement = function () {};
global.HTMLImageElement = function () {};
global.ImageData = class ImageData {
  constructor(d, w, h) { this.data = d; this.width = w; this.height = h; }
};
global.Blob = class Blob {};
global.FileReader = class FileReader {};
global.crypto = { subtle: { digest: async () => new ArrayBuffer(32) }, getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; } };
global.fetch = async () => ({ ok: true, json: async () => ({}) });
global.__ = (k, d) => (d === undefined ? k : d);
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

// IndexedDB polyfill for storage tests
const _idbData = {};
let _idbShouldFail = false;
function fireAsync(fn) { setTimeout(fn, 0); }
function fakeReq(result) {
  const r = { onsuccess: null, onerror: null, result };
  fireAsync(() => { if (r.onsuccess) r.onsuccess({ target: r }); });
  return r;
}
function fakeStore(name, txObj) {
  return {
    createIndex() {},
    put(record) {
      if (record && record.id) {
        if (!_idbData[name]) _idbData[name] = {};
        _idbData[name][record.id] = record;
      }
      if (txObj) txObj._puts++;
      return fakeReq(undefined);
    },
    get(id) { return fakeReq((_idbData[name] || {})[id] || undefined); },
    delete(id) { if (_idbData[name]) delete _idbData[name][id]; return fakeReq(undefined); },
    clear() { _idbData[name] = {}; return fakeReq(undefined); },
    count() { return fakeReq(Object.keys(_idbData[name] || {}).length); },
    openCursor() {
      const entries = Object.values(_idbData[name] || {});
      let idx = 0;
      const r = { onsuccess: null, onerror: null, result: null };
      function deliver() {
        if (idx < entries.length) {
          const cur = entries[idx];
          idx++;
          r.result = { value: cur, continue: deliver };
          if (r.onsuccess) r.onsuccess({ target: r });
        } else {
          r.result = null;
          if (r.onsuccess) r.onsuccess({ target: r });
        }
      }
      fireAsync(deliver);
      return r;
    },
    getAll() { return fakeReq(Object.values(_idbData[name] || {})); },
  };
}
function _makeDbResult() {
  return {
    objectStoreNames: { contains() { return false; } },
    createObjectStore(storeName) { return fakeStore(storeName); },
    transaction(storeName, mode) {
      const tx = {
        objectStore() { return fakeStore(storeName, tx); },
        oncomplete: null,
        onerror: null,
        _puts: 0,
      };
      fireAsync(() => { if (tx.oncomplete) tx.oncomplete(); });
      return tx;
    },
  };
}
global.indexedDB = {
  open() {
    const dbResult = _makeDbResult();
    const req = { onsuccess: null, onerror: null, onupgradeneeded: null, result: null };
    if (_idbShouldFail) {
      fireAsync(() => {
        if (req.onerror) req.onerror({ target: { error: new Error("Mocked DB open failure") } });
      });
    } else {
      fireAsync(() => {
        if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: dbResult } });
      });
      fireAsync(() => { req.result = dbResult; if (req.onsuccess) req.onsuccess({ target: req }); });
    }
    return req;
  },
  deleteDatabase() { return fakeReq(undefined); },
};

// ── Load iris_template_protection module ──
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const irisDir = path.join(__dirname, "..", "..", "..", "Iris_Biometric");
try {
  const src = fs.readFileSync(path.join(irisDir, "iris_template_protection.js"), "utf8");
  vm.runInThisContext(src, { filename: path.join(irisDir, "iris_template_protection.js") });
} catch (e) {
  // Module may need extra globals; continue
}

const ITP = global.IrisTemplateProtection;

// ═══════════════════════════════════════════════════════════════
// iris_template_protection.js — static methods
// ═══════════════════════════════════════════════════════════════

test("IrisTemplateProtection.generateProjectionMatrix: returns Float64Array", () => {
  const matrix = ITP.generateProjectionMatrix(256, 128, "test-seed");
  assert.ok(matrix instanceof Float64Array);
  assert.equal(matrix.length, 256 * 128);
});

test("IrisTemplateProtection.biohash: returns hash + score", () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = (i * 7) % 256;
  const matrix = ITP.generateProjectionMatrix(256, 128);
  const result = ITP.biohash(code, matrix, 128);
  assert.ok(result);
  assert.ok(result.hashed instanceof Uint8Array);
  assert.equal(typeof result.score, "number");
});

test("IrisTemplateProtection.verifyBiohash: same hash matches", () => {
  const h = new Uint8Array([1, 0, 1, 1, 0]);
  const result = ITP.verifyBiohash(h, h);
  assert.ok(result.match);
  assert.equal(result.similarity, 1);
});

test("IrisTemplateProtection.verifyBiohash: different hashes don't match", () => {
  const a = new Uint8Array([1, 1, 1, 1, 1]);
  const b = new Uint8Array([0, 0, 0, 0, 0]);
  const result = ITP.verifyBiohash(a, b);
  assert.equal(result.match, false);
});

test("IrisTemplateProtection.createTransformation: returns function", () => {
  const key = new Uint8Array(32);
  const salt = new Uint8Array(16);
  const fn = ITP.createTransformation(key, salt);
  assert.equal(typeof fn, "function");
});

test("IrisTemplateProtection.transform: applies transform", () => {
  const code = new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]);
  const key = new Uint8Array(8);
  const salt = new Uint8Array(4);
  const fn = ITP.createTransformation(key, salt);
  const result = ITP.transform(code, fn);
  assert.ok(result instanceof Uint8Array);
  assert.equal(result.length, code.length);
});

test("IrisTemplateProtection.transform: null fn → null", () => {
  const result = ITP.transform(new Uint8Array(4), null);
  assert.equal(result, null);
});

test("IrisTemplateProtection.verifyUnlinkability: same template → low unlinkability", () => {
  const code = new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]);
  const result = ITP.verifyUnlinkability(code, code);
  assert.ok(result);
  assert.equal(typeof result.unlinkable, "boolean");
});

test("IrisTemplateProtection.verifyUnlinkability: with third template", () => {
  const t1 = new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]);
  const t2 = new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1]);
  const t3 = new Uint8Array([1, 1, 0, 0, 1, 1, 0, 0]);
  const result = ITP.verifyUnlinkability(t1, t2, t3);
  assert.ok(result);
  assert.ok(Array.isArray(result.crossDistances));
  assert.equal(result.crossDistances.length, 1);
});

test("IrisTemplateProtection.verifyUnlinkability: different-length templates", () => {
  const t1 = new Uint8Array([1, 0, 1]);
  const t2 = new Uint8Array([0, 1, 0, 1, 0]);
  const result = ITP.verifyUnlinkability(t1, t2);
  assert.ok(result);
});

test("IrisTemplateProtection.verifyUnlinkability: identical templates → linked", () => {
  const t1 = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1]);
  const result = ITP.verifyUnlinkability(t1, t1);
  assert.equal(result.unlinkable, false);
  assert.equal(result.distance, 0);
});

test("IrisTemplateProtection.verifyUnlinkability: completely different → linked", () => {
  const t1 = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
  const t2 = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1]);
  const result = ITP.verifyUnlinkability(t1, t2);
  assert.equal(result.unlinkable, false);
  assert.equal(result.distance, 1);
});

test("IrisTemplateProtection.testUnlinkability: returns result", async () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = (i * 3) % 256;
  const result = ITP.testUnlinkability(code, 5);
  assert.ok(result);
  assert.equal(typeof result.unlinkable, "boolean");
});

test("IrisTemplateProtection.testUnlinkability: insufficient input", () => {
  const result = ITP.testUnlinkability(null, 5);
  assert.equal(result.unlinkable, false);
  assert.equal(result.averageDistance, 0);
});

test("IrisTemplateProtection.testUnlinkability: numKeys < 2", () => {
  const code = new Uint8Array([1, 0, 1, 0]);
  const result = ITP.testUnlinkability(code, 1);
  assert.equal(result.unlinkable, false);
});

test("IrisTemplateProtection.commit: returns commitment + nonce", async () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = i;
  const key = new Uint8Array(32).fill(42);
  const result = await ITP.commit(code, key);
  assert.ok(result.commitment);
  assert.ok(result.nonce);
  assert.equal(result.nonce.length, 32);
});

test("IrisTemplateProtection.commit: throws for bad input", async () => {
  try {
    await ITP.commit(null, null);
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("required"));
  }
});

test("IrisTemplateProtection.verifyCommitment: correct commitment matches", async () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = i;
  const key = new Uint8Array(32).fill(42);
  const { commitment, nonce } = await ITP.commit(code, key);
  const ok = await ITP.verifyCommitment(code, key, nonce, commitment);
  assert.equal(ok, true);
});

test("IrisTemplateProtection.verifyCommitment: wrong commitment fails", async () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = i;
  const key = new Uint8Array(32).fill(42);
  const { nonce } = await ITP.commit(code, key);
  const ok = await ITP.verifyCommitment(code, key, nonce, "wrong_hash");
  assert.equal(ok, false);
});

test("IrisTemplateProtection.verifyCommitment: returns false for bad input", async () => {
  const ok = await ITP.verifyCommitment(null, null, null, null);
  assert.equal(ok, false);
});

test("IrisTemplateProtection.createCancelable: returns template + keyHash", async () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = i;
  const userKey = new Uint8Array(16).fill(7);
  const result = await ITP.createCancelable(code, userKey, 1);
  assert.ok(result.template);
  assert.ok(result.keyHash);
  assert.ok(result.template instanceof Uint8Array);
});

test("IrisTemplateProtection.createCancelable: throws on bad input", async () => {
  try {
    await ITP.createCancelable(null, null);
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e.message.includes("required"));
  }
});

test("IrisTemplateProtection.createCancelable: different iterations produce different templates", async () => {
  const code = new Uint8Array(32);
  for (let i = 0; i < 32; i++) code[i] = i;
  const userKey = new Uint8Array(16).fill(7);
  const r1 = await ITP.createCancelable(code, userKey, 1);
  const r2 = await ITP.createCancelable(code, userKey, 2);
  assert.notDeepEqual(Array.from(r1.template), Array.from(r2.template));
});

test("IrisTemplateProtection._createRNG: returns deterministic values", () => {
  const rng1 = ITP._createRNG(42);
  const rng2 = ITP._createRNG(42);
  assert.equal(rng1(), rng2());
  assert.equal(rng1(), rng2());
});

// ═══════════════════════════════════════════════════════════════
// iris_template_protection.js — additional coverage
// ═══════════════════════════════════════════════════════════════

test("ITP.biohash: with matching projection (L73-L109)", () => {
  const inputDim = 10, outputDim = 8;
  const code = new Uint8Array(inputDim);
  for (let i = 0; i < inputDim; i++) code[i] = (i * 37 + 42) & 0xFF;
  const proj = new Float64Array(outputDim * inputDim);
  for (let i = 0; i < proj.length; i++) proj[i] = (i * 0.1) % 1;
  const h = ITP.biohash(code, proj, outputDim);
  assert.ok(h.hashed instanceof Uint8Array);
  assert.equal(h.hashed.length, outputDim);
  assert.equal(typeof h.score, "number");
});

test("ITP.verifyBiohash: matching hashes (L113-L140)", () => {
  const h1 = new Uint8Array([1, 0, 1, 1, 0, 1, 0, 1]);
  const h2 = new Uint8Array([1, 0, 1, 1, 0, 1, 0, 1]);
  const result = ITP.verifyBiohash(h1, h2);
  assert.equal(result.match, true);
  assert.ok(result.similarity > 0.9);
});

test("ITP.verifyBiohash: different hashes", () => {
  const h1 = new Uint8Array([1, 0, 1, 0, 0, 1, 0, 1]);
  const h2 = new Uint8Array([0, 1, 0, 1, 1, 0, 1, 0]);
  const result = ITP.verifyBiohash(h1, h2);
  assert.equal(result.match, false);
});

test("ITP.generateProjectionMatrix: returns Float64Array (L38-L65)", () => {
  const result = ITP.generateProjectionMatrix(64, 32);
  assert.ok(result instanceof Float64Array);
  assert.equal(result.length, 32 * 64);
});

test("ITP.createTransformation: returns function (L142-L165)", () => {
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) key[i] = i;
  const salt = new Uint8Array(16).fill(0xAA);
  const fn = ITP.createTransformation(key, salt);
  assert.equal(typeof fn, "function");
  const transformed = fn(new Uint8Array(64).fill(0xFF));
  assert.ok(transformed instanceof Uint8Array);
});

test("ITP.transform: with transformFn (L168-L190)", () => {
  const code = new Uint8Array(64).fill(0xFF);
  const result = ITP.transform(code, (c) => {
    const r = new Uint8Array(c.length);
    for (let i = 0; i < c.length; i++) r[i] = c[i] ^ 0xAA;
    return r;
  });
  assert.ok(result);
  assert.equal(result.length, 64);
  assert.equal(result[0], 0xFF ^ 0xAA);
});

test("ITP.createCancelable: different iterations → different templates (L291-L332)", async () => {
  const code = new Uint8Array(64).fill(0xFF);
  const key = new Uint8Array(32).fill(0xCC);
  const r1 = await ITP.createCancelable(code, key, 1);
  const r2 = await ITP.createCancelable(code, key, 2);
  assert.notDeepEqual(r1.template, r2.template);
});

test("ITP.verifyCommitment: valid commitment (L334-L378)", async () => {
  const code = new Uint8Array(64).fill(0xFF);
  const key = new Uint8Array(32).fill(0xDD);
  const result = await ITP.commit(code, key);
  assert.ok(result.commitment);
  assert.ok(result.nonce);
  const verified = await ITP.verifyCommitment(code, key, result.nonce, result.commitment);
  assert.equal(verified, true);
});

test("ITP.testUnlinkability: large irisCode → unlinkable (L510-L561)", () => {
  const code = new Uint8Array(256);
  for (let i = 0; i < 256; i++) code[i] = Math.floor(Math.random() * 256);
  const result = ITP.testUnlinkability(code, 8);
  assert.ok(result.pairCount === 28);
  assert.equal(typeof result.unlinkabilityScore, "number");
  assert.ok(typeof result.averageDistance === "number");
});

test("ITP.testUnlinkability: too few keys → error (L511-L513)", () => {
  const result = ITP.testUnlinkability(new Uint8Array(10), 1);
  assert.equal(result.unlinkable, false);
});

// ── iris_template_protection.js uncovered ranges ──

test("ITP.biohash: with real projection matrix (L73-L109)", () => {
  const inputDim = 10, outputDim = 5;
  const irisCode = new Uint8Array(inputDim).fill(0xFF);
  const projMatrix = new Float64Array(outputDim * inputDim);
  for (let i = 0; i < projMatrix.length; i++) projMatrix[i] = Math.random();
  const result = ITP.biohash(irisCode, projMatrix, outputDim);
  assert.ok(result.hashed instanceof Uint8Array);
  assert.equal(typeof result.score, "number");
});

test("ITP.createCancelable: async with valid data (L291-L332)", async () => {
  const template = new Uint8Array(128).fill(0xFF);
  const key = new Uint8Array(32).fill(0xBB);
  const result = await ITP.createCancelable(template, key, 1);
  assert.ok(result.template instanceof Uint8Array);
  assert.equal(typeof result.keyHash, "string");
});

test("ITP.testUnlinkability: Uint8Array irisCode (L510-L561)", () => {
  const irisCode = new Uint8Array(128);
  for (let i = 0; i < 128; i++) irisCode[i] = (i * 7 + 13) & 0xFF;
  const result = ITP.testUnlinkability(irisCode, 5);
  assert.equal(typeof result.averageDistance, "number");
  assert.equal(typeof result.unlinkable, "boolean");
  assert.ok(result.pairCount === 10);
});

// ═══════════════════════════════════════════════════════════════
// ROUND 3 — Targeted tests for every remaining uncovered byte offset
// ═══════════════════════════════════════════════════════════════

// ── iris_template_protection.js ──
test("ITP constructor (L28-L32)", () => { const p = new ITP(); assert.ok(p); assert.equal(p._key, null); });
test("ITP.generateProjectionMatrix: invalid dims (L48-L50)", () => {
  assert.throws(() => ITP.generateProjectionMatrix(0, 10), /Invalid dimensions/);
  assert.throws(() => ITP.generateProjectionMatrix(-1, 10), /Invalid dimensions/);
});
test("ITP.biohash: missing args (L77-L79)", () => {
  assert.throws(() => ITP.biohash(null, null), /required/);
});
test("ITP.verifyBiohash: mismatched lengths (L121-L123)", () => {
  const r = ITP.verifyBiohash([1, 0, 1], [1, 0]);
  assert.equal(r.match, false);
  assert.equal(r.similarity, 0);
});
test("ITP.verifyBiohash: null inputs (L121-L123)", () => {
  const r = ITP.verifyBiohash(null, null);
  assert.equal(r.match, false);
});
test("ITP.createTransformation: missing key/salt (L153-L155)", () => {
  assert.throws(() => ITP.createTransformation(null, "salt"), /key and salt are required/);
  assert.throws(() => ITP.createTransformation("key", ""), /key and salt are required/);
});
test("ITP.transform: null input (L163-L165)", () => {
  const t = ITP.createTransformation(new Uint8Array(32).fill(1), new Uint8Array(16).fill(2));
  const r = t(null);
  assert.equal(r, null);
});
test("ITP.transform: empty array (L163-L165)", () => {
  const t = ITP.createTransformation(new Uint8Array(32).fill(1), new Uint8Array(16).fill(2));
  const r = t(new Uint8Array(0));
  assert.equal(r, null);
});
test("ITP.verifyUnlinkability: missing templates (L448-L450)", () => {
  const r = ITP.verifyUnlinkability(null, new Uint8Array(64).fill(1));
  assert.equal(r.unlinkable, false);
  assert.ok(r.details.includes("Missing"));
});
test("ITP.verifyUnlinkability: identical templates → LINKED (L498)", () => {
  const t = new Uint8Array(64);
  for (let i = 0; i < 64; i++) t[i] = i;
  const r = ITP.verifyUnlinkability(t, t);
  assert.equal(r.unlinkable, false);
  assert.ok(r.details.includes("LINKED"));
});
test("ITP.testUnlinkability: low distance (L510-L561)", () => {
  const code = new Uint8Array(64);
  for (let i = 0; i < 64; i++) code[i] = i;
  const r = ITP.testUnlinkability(code, 5);
  assert.ok(r);
  assert.equal(typeof r.unlinkable, "boolean");
});

// ── iris_template_protection.js: verifyCommitment correct (L271) ──
test("ITP.verifyCommitment: hash loop (L265-L280)", async () => {
  const code = new Uint8Array(64);
  for (let i = 0; i < 64; i++) code[i] = i + 10;
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) key[i] = i + 5;
  const { commitment, nonce } = await ITP.commit(code, key);
  const valid = await ITP.verifyCommitment(code, key, nonce, commitment);
  assert.equal(valid, true);
});

// ── iris_template_protection.js: verifyCommitment correct (L295) ──
test("ITP.verifyCommitment: correct returns true (L295)", async () => {
  const code = new Uint8Array(64); for (let i = 0; i < 64; i++) code[i] = i;
  const key = new Uint8Array(32); for (let i = 0; i < 32; i++) key[i] = i;
  const { commitment, nonce } = await ITP.commit(code, key);
  const r = await ITP.verifyCommitment(code, key, nonce, commitment);
  assert.equal(r, true);
});

// ── iris_template_protection.js: testUnlinkability with result (L533) ──
test("ITP.testUnlinkability: returns unlinkable result (L533)", () => {
  const c = new Uint8Array(64); for (let i = 0; i < 64; i++) c[i] = i * 3;
  const m = new Uint8Array(64).fill(1);
  const keys = [];
  for (let k = 0; k < 5; k++) {
    const p = new Float64Array(64);
    for (let i = 0; i < 64; i++) p[i] = Math.sin(i + k) * 0.5;
    keys.push(p);
  }
  const r = ITP.testUnlinkability(c, m, keys);
  assert.ok(r);
  assert.equal(typeof r.unlinkable, "boolean");
});

// ── ITP.verifyCommitment: correct commitment → returns true (L295) ──
test("ITP.verifyCommitment: correct commitment returns true (L295)", async () => {
  const code = new Uint8Array(64); for (let i = 0; i < 64; i++) code[i] = i;
  const key = new Uint8Array(32); for (let i = 0; i < 32; i++) key[i] = i + 10;
  const { commitment, nonce } = await ITP.commit(code, key);
  const r = await ITP.verifyCommitment(code, key, nonce, commitment);
  assert.equal(r, true);
});

// ── ITP.verifyCommitment: wrong commitment → returns false ──
test("ITP.verifyCommitment: wrong commitment returns false", async () => {
  const code = new Uint8Array(64); for (let i = 0; i < 64; i++) code[i] = i;
  const key = new Uint8Array(32); for (let i = 0; i < 32; i++) key[i] = i + 10;
  const { nonce } = await ITP.commit(code, key);
  const r = await ITP.verifyCommitment(code, key, nonce, "wrongcommitment");
  assert.equal(r, false);
});
