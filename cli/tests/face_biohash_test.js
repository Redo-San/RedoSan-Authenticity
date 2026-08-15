const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills for GPL check
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };

const src = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_biohash.js"),
  "utf8",
);
vm.runInThisContext(src, { filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_biohash.js") });

/** @returns {Float32Array} */
function makeDescriptor(len, fill) {
  const arr = new Float32Array(len);
  for (let i = 0; i < len; i++) arr[i] = fill !== undefined ? fill : Math.sin(i * 0.7);
  return arr;
}

describe("FaceBioHash — internal SHA-256 (FIPS 180-4 vectors)", () => {
  it("matches NIST vectors", () => {
    assert.equal(
      FaceBioHash._sha256Hex("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    assert.equal(
      FaceBioHash._sha256Hex(""),
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    assert.equal(
      FaceBioHash._sha256Hex("hello world"),
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  it("handles unicode input (surrogate pairs)", () => {
    const h = FaceBioHash._sha256Hex("RedoSan أصالة 🎨");
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
  });
});

describe("FaceBioHash — generate", () => {
  it("is deterministic for the same descriptor + PIN", () => {
    const a = FaceBioHash.generate(makeDescriptor(192), "1234");
    const b = FaceBioHash.generate(makeDescriptor(192), "1234");
    assert.deepEqual(Array.from(a.code), Array.from(b.code));
    assert.equal(a.bits, 128);
    assert.equal(a.pinFingerprint, b.pinFingerprint);
  });

  it("produces an unlinkable code for a different PIN (≈50% bit disagreement)", () => {
    const d = makeDescriptor(192);
    const a = FaceBioHash.generate(d, "1234");
    const b = FaceBioHash.generate(d, "9999");
    const sim = FaceBioHash.similarity(a.code, b.code);
    assert.ok(sim > 0.3 && sim < 0.7, "different PINs should be uncorrelated, got " + sim);
  });

  it("produces a different code for a different salt (renewability)", () => {
    const d = makeDescriptor(192);
    const a = FaceBioHash.generate(d, "1234", { salt: "redosan-biohash-v1" });
    const b = FaceBioHash.generate(d, "1234", { salt: "redosan-biohash-v2" });
    assert.ok(FaceBioHash.similarity(a.code, b.code) < 0.7, "renewed salt must change the code");
  });

  it("packed code has the requested bit length", () => {
    const code = FaceBioHash.generate(makeDescriptor(200), "pin", { dim: 192 });
    assert.equal(code.code.length, 24); // 192 bits = 24 bytes
    assert.equal(code.bits, 192);
  });

  it("throws when no PIN is provided", () => {
    assert.throws(() => FaceBioHash.generate(makeDescriptor(192), ""), /PIN is required/);
    assert.throws(() => FaceBioHash.generate(makeDescriptor(192), null), /PIN is required/);
  });

  it("throws when descriptor is missing", () => {
    assert.throws(() => FaceBioHash.generate(null, "1234"), /descriptor is required/);
  });

  it("throws when dim exceeds descriptor length", () => {
    assert.throws(() => FaceBioHash.generate(makeDescriptor(64), "1234", { dim: 128 }), /exceeds descriptor length/);
  });
});

describe("FaceBioHash — distance & similarity", () => {
  it("returns 0 distance and 1 similarity for identical codes", () => {
    const code = FaceBioHash.generate(makeDescriptor(192), "1234");
    assert.equal(FaceBioHash.hammingDistance(code.code, code.code), 0);
    assert.equal(FaceBioHash.similarity(code.code, code.code), 1);
  });

  it("returns -1 for invalid input", () => {
    assert.equal(FaceBioHash.hammingDistance(null, new Uint8Array(2)), -1);
    assert.equal(FaceBioHash.similarity(null, new Uint8Array(2)), -1);
  });

  it("counts differing bits correctly", () => {
    const a = new Uint8Array([0b11110000]);
    const b = new Uint8Array([0b10101010]);
    assert.equal(FaceBioHash.hammingDistance(a, b), 4); // 0b11110000 ^ 0b10101010 = 0b01011010 popcount = 4
  });

  it("robustness: small descriptor perturbation keeps code similarity high", () => {
    const d = makeDescriptor(192);
    const noisy = new Float32Array(192);
    for (let i = 0; i < 192; i++) noisy[i] = d[i] + Math.sin(i) * 0.001;
    const a = FaceBioHash.generate(d, "1234");
    const b = FaceBioHash.generate(noisy, "1234");
    const sim = FaceBioHash.similarity(a.code, b.code);
    assert.ok(sim > 0.7, "perturbed descriptor should keep most bits, got " + sim);
  });

  it("discriminability: different descriptors yield far codes", () => {
    const a = FaceBioHash.generate(makeDescriptor(192, 0.5), "1234");
    const b = FaceBioHash.generate(makeDescriptor(192, -0.5), "1234");
    const sim = FaceBioHash.similarity(a.code, b.code);
    assert.ok(sim < 0.7, "different faces must not collide, got " + sim);
  });
});

describe("FaceBioHash — match", () => {
  it("finds the right entry above threshold", () => {
    const d = makeDescriptor(192);
    const query = FaceBioHash.generate(d, "1234");
    const other = FaceBioHash.generate(makeDescriptor(192, 1), "1234");
    const registry = [
      { code: other.code, label: "other" },
      { code: query.code, label: "me" },
    ];
    const result = FaceBioHash.match(query.code, registry, 0.7);
    assert.notEqual(result.match, null);
    assert.equal(result.match.label, "me");
    assert.ok(result.similarity > 0.7);
  });

  it("returns null when below threshold", () => {
    const query = FaceBioHash.generate(makeDescriptor(192, 0.5), "1234");
    const far = FaceBioHash.generate(makeDescriptor(192, -0.5), "1234");
    const result = FaceBioHash.match(query.code, [{ code: far.code, label: "far" }], 0.9);
    assert.equal(result.match, null);
  });

  it("handles empty registry", () => {
    const query = FaceBioHash.generate(makeDescriptor(192), "1234");
    const result = FaceBioHash.match(query.code, [], 0.7);
    assert.equal(result.match, null);
  });
});

describe("FaceBioHash — pin fingerprint", () => {
  it("is a deterministic 64-char hex and never contains the PIN", () => {
    const fp = FaceBioHash.pinFingerprint("4321", "salt");
    assert.equal(fp.length, 64);
    assert.match(fp, /^[0-9a-f]{64}$/);
    assert.ok(!fp.includes("4321"));
  });

  it("differs across PINs and salts", () => {
    assert.notEqual(
      FaceBioHash.pinFingerprint("1111", "s"),
      FaceBioHash.pinFingerprint("2222", "s"),
    );
    assert.notEqual(
      FaceBioHash.pinFingerprint("1111", "s1"),
      FaceBioHash.pinFingerprint("1111", "s2"),
    );
  });
});

describe("FaceBioHash — export helpers", () => {
  it("bytesToHex produces lowercase hex pairs", () => {
    const hex = FaceBioHash.bytesToHex(new Uint8Array([0, 255, 15]));
    assert.equal(hex, "00ff0f");
  });
});
