const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills for the GPL origin check
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};

// ── Module loader with vm.compileFunction for V8 coverage mapping ──
const mods = {};
function loadModule(rel) {
  const absPath = path.join(__dirname, "../..", rel);
  let src = fs.readFileSync(absPath, "utf8");
  src = src.replace(
    /^import\s*\{([\s\S]+?)\}\s*from\s*"[^"]+";?/gm,
    (_m, names) =>
      names
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)
        .map((p) => {
          const [orig, as] = p.split(/\s+as\s+/).map((s) => s.trim());
          return `const ${as || orig} = __imp("${orig}");`;
        })
        .join("\n"),
  );
  const hoisted = [];
  src = src
    .replace(/^export (async )?function\s+(\w+)/gm, (_m, asyncKw, name) => {
      hoisted.push(name);
      return (asyncKw ? "async " : "") + "function " + name;
    })
    .replace(
      /^export const\s+(\w+)\s*=/gm,
      (_m, name) => `const ${name} = __exp.${name} =`,
    )
    .replace(/^export default\s+/gm, "");
  if (hoisted.length) {
    src += "\n" + hoisted.map((n) => `__exp.${n} = ${n};`).join("\n") + "\n";
  }
  const fn = vm.compileFunction(src, ["__exp", "__imp"], { filename: absPath });
  fn(mods, (name) => mods[name]);
}

loadModule("C2PA/cbor.js");
loadModule("Voice_Biometric/audio_embed.js");
loadModule("Voice_Biometric/c2pa_audio_hash.js");

const C2H = mods;

// ══════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════

describe("c2pa_audio_hash", () => {
  describe("validateExclusions", () => {
    it("accepts empty exclusions", () => {
      assert.doesNotThrow(() => C2H.validateExclusions([]));
    });
    it("accepts valid non-overlapping ranges", () => {
      assert.doesNotThrow(() =>
        C2H.validateExclusions([
          { start: 0, length: 10 },
          { start: 20, length: 5 },
        ]),
      );
    });
    it("throws on negative start", () => {
      assert.throws(() => C2H.validateExclusions([{ start: -1, length: 5 }]));
    });
    it("throws on negative length", () => {
      assert.throws(() => C2H.validateExclusions([{ start: 0, length: -1 }]));
    });
    it("throws on non-integer start", () => {
      assert.throws(() => C2H.validateExclusions([{ start: 1.5, length: 5 }]));
    });
    it("throws on non-integer length", () => {
      assert.throws(() => C2H.validateExclusions([{ start: 0, length: 2.5 }]));
    });
    it("throws on overlapping ranges", () => {
      assert.throws(() =>
        C2H.validateExclusions([
          { start: 0, length: 10 },
          { start: 5, length: 5 },
        ]),
      );
    });
    it("accepts adjacent ranges", () => {
      assert.doesNotThrow(() =>
        C2H.validateExclusions([
          { start: 0, length: 10 },
          { start: 10, length: 5 },
        ]),
      );
    });
  });

  describe("sha256Excluding", () => {
    it("hashes bytes with no exclusions", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hash = await C2H.sha256Excluding(data, []);
      assert.ok(hash instanceof Uint8Array);
      assert.equal(hash.length, 32);
    });
    it("excludes a middle range", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hash1 = await C2H.sha256Excluding(data, []);
      const hash2 = await C2H.sha256Excluding(data, [{ start: 1, length: 2 }]);
      // Different because bytes 2,3 excluded
      assert.notDeepEqual([...hash1], [...hash2]);
    });
    it("excludes from start", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hash = await C2H.sha256Excluding(data, [{ start: 0, length: 5 }]);
      assert.ok(hash instanceof Uint8Array);
    });
    it("excludes past end (clamped)", async () => {
      const data = new Uint8Array([1, 2, 3]);
      const hash = await C2H.sha256Excluding(data, [{ start: 2, length: 100 }]);
      assert.ok(hash instanceof Uint8Array);
    });
    it("multiple exclusions", async () => {
      const data = new Uint8Array(20).fill(0xaa);
      const hash = await C2H.sha256Excluding(data, [
        { start: 0, length: 5 },
        { start: 10, length: 5 },
      ]);
      assert.ok(hash instanceof Uint8Array);
    });
  });

  describe("compareBytes", () => {
    it("returns 0 for equal arrays", () => {
      assert.equal(
        C2H.compareBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2])),
        0,
      );
    });
    it("returns negative when a < b", () => {
      assert.ok(C2H.compareBytes(new Uint8Array([1]), new Uint8Array([2])) < 0);
    });
    it("returns positive when a > b", () => {
      assert.ok(C2H.compareBytes(new Uint8Array([2]), new Uint8Array([1])) > 0);
    });
    it("returns difference in length when equal prefix", () => {
      assert.ok(
        C2H.compareBytes(new Uint8Array([1, 2]), new Uint8Array([1])) > 0,
      );
    });
  });

  describe("buildDataHashMapDeterministic", () => {
    it("returns CBOR-encoded map", () => {
      const hash = new Uint8Array(32).fill(0xbb);
      const result = C2H.buildDataHashMapDeterministic(
        0,
        new Uint8Array(0),
        hash,
        [],
      );
      assert.ok(result instanceof Uint8Array);
      assert.ok(result.length > 0);
    });
    it("with exclusions", () => {
      const hash = new Uint8Array(32).fill(0xcc);
      const result = C2H.buildDataHashMapDeterministic(
        0,
        new Uint8Array(0),
        hash,
        [{ start: 0, length: 10 }],
      );
      assert.ok(result instanceof Uint8Array);
    });
    it("with pad bytes", () => {
      const hash = new Uint8Array(32).fill(0xdd);
      const result = C2H.buildDataHashMapDeterministic(
        0,
        new Uint8Array([0xff, 0xfe]),
        hash,
        [],
      );
      assert.ok(result instanceof Uint8Array);
    });
    it("with no padBytes (default)", () => {
      const hash = new Uint8Array(32).fill(0xee);
      const result = C2H.buildDataHashMapDeterministic(
        0,
        undefined,
        hash,
        undefined,
      );
      assert.ok(result instanceof Uint8Array);
    });
  });

  describe("buildDataHashMap (async)", () => {
    it("builds hash map from raw bytes", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await C2H.buildDataHashMap(data, [], 0, new Uint8Array(0));
      assert.ok(result.hash instanceof Uint8Array);
      assert.equal(result.hash.length, 32);
      assert.ok(result.map instanceof Uint8Array);
    });
    it("with exclusions", async () => {
      const data = new Uint8Array(100).fill(0xaa);
      const result = await C2H.buildDataHashMap(
        data,
        [{ start: 10, length: 20 }],
        0,
        new Uint8Array(0),
      );
      assert.ok(result.hash instanceof Uint8Array);
    });
  });
});
