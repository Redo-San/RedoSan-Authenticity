const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills for GPL check
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};

// Load FaceBioHash first (FaceFuzzy depends on its SHA-256)
const biohashSrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_biohash.js"),
  "utf8",
);
vm.runInThisContext(biohashSrc, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Face_Biometric",
    "face_biohash.js",
  ),
});

const fuzzySrc = fs.readFileSync(
  path.join(__dirname, "..", "..", "Face_Biometric", "face_fuzzy.js"),
  "utf8",
);
vm.runInThisContext(fuzzySrc, {
  filename: path.resolve(__dirname, "../..", "Face_Biometric", "face_fuzzy.js"),
});

/** @returns {Float32Array} */
function makeDescriptor(len, mode) {
  const arr = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    if (mode === "ramp") arr[i] = i;
    else if (mode === "inverse") arr[i] = 999 - i;
    else arr[i] = Math.sin(i * 0.7);
  }
  return arr;
}

describe("FaceFuzzy — quantize", () => {
  it("splits at the median (half ones, half zeros)", () => {
    const bits = FaceFuzzy.quantize(makeDescriptor(64, "ramp"));
    let ones = 0;
    for (let i = 0; i < 64; i++) ones += (bits[i >> 3] >> (7 - (i & 7))) & 1;
    assert.equal(ones, 32);
  });

  it("throws on missing descriptor", () => {
    assert.throws(() => FaceFuzzy.quantize(null), /descriptor is required/);
  });

  it("packed length is ceil(dim/8)", () => {
    const bits = FaceFuzzy.quantize(makeDescriptor(192));
    assert.equal(bits.length, 24);
  });
});

describe("FaceFuzzy — encode/decode round trip", () => {
  const rep = 15;
  const bits = FaceFuzzy.quantize(makeDescriptor(256, "ramp")); // 256 bits = 17 secret bits

  it("reproduces the exact same key with identical bits", () => {
    const enc = FaceFuzzy.encode(bits, { rep, secret: "a1b2c3d4" });
    assert.equal(enc.key.length, 64);
    const dec = FaceFuzzy.decode(enc.helper, bits, { rep });
    assert.equal(dec.key, enc.key);
    assert.equal(dec.corrected, 0);
  });

  it("corrects up to 40% bit flips per group (majority vote)", () => {
    const enc = FaceFuzzy.encode(bits, { rep, secret: "a1b2c3d4" });
    // flip 6 of the first 15 bits (40%)
    const noisy = new Uint8Array(bits);
    for (let p = 0; p < 6; p++) noisy[0] ^= 1 << (7 - p);
    const dec = FaceFuzzy.decode(enc.helper, noisy, { rep });
    assert.equal(dec.key, enc.key);
    assert.ok(dec.corrected >= 1);
  });

  it("fails (key mismatch) when a group exceeds 50% flips", () => {
    const enc = FaceFuzzy.encode(bits, { rep, secret: "a1b2c3d4" });
    const noisy = new Uint8Array(bits);
    for (let p = 0; p < 8; p++) noisy[0] ^= 1 << (7 - p);
    const dec = FaceFuzzy.decode(enc.helper, noisy, { rep });
    assert.notEqual(dec.key, enc.key);
  });

  it("returns a different key for an unrelated face", () => {
    const enc = FaceFuzzy.encode(bits, { rep, secret: "a1b2c3d4" });
    const dec = FaceFuzzy.decode(
      enc.helper,
      FaceFuzzy.quantize(makeDescriptor(256, "inverse")),
      { rep },
    );
    assert.notEqual(dec.key, enc.key);
  });

  it("generates a fresh random key each encode when no secret given", () => {
    const a = FaceFuzzy.encode(bits, { rep });
    const b = FaceFuzzy.encode(bits, { rep });
    assert.notEqual(a.key, b.key);
  });

  it("helper has the same length as the biometric bits", () => {
    const enc = FaceFuzzy.encode(bits, { rep });
    assert.equal(enc.helper.length, bits.length);
  });
});

describe("FaceFuzzy — error handling", () => {
  it("throws when bits are missing", () => {
    assert.throws(
      () => FaceFuzzy.encode(null, { rep: 15 }),
      /bits are required/,
    );
    assert.throws(
      () => FaceFuzzy.decode(null, new Uint8Array(32), { rep: 15 }),
      /Helper data/,
    );
  });

  it("throws when not enough bits for the repetition factor", () => {
    const small = FaceFuzzy.quantize(makeDescriptor(64)); // 64 bits / 15 < 8
    assert.throws(
      () => FaceFuzzy.encode(small, { rep: 15 }),
      /Not enough biometric bits/,
    );
  });

  it("throws when helper and bits lengths differ", () => {
    const bits = FaceFuzzy.quantize(makeDescriptor(256));
    const enc = FaceFuzzy.encode(bits, { rep: 15, secret: "ab" });
    const wrongLen = new Uint8Array(enc.helper.length - 1);
    assert.throws(
      () => FaceFuzzy.decode(enc.helper, wrongLen, { rep: 15 }),
      /lengths differ/,
    );
  });
});

describe("FaceFuzzy — edge branches", () => {
  it("quantize computes the median for an odd-length descriptor", () => {
    const bits = FaceFuzzy.quantize(makeDescriptor(63));
    assert.ok(bits.length >= 7);
  });

  it("encodes an odd-length secret hex with a leading zero", () => {
    const bits = FaceFuzzy.quantize(makeDescriptor(256, "ramp"));
    const enc = FaceFuzzy.encode(bits, { rep: 15, secret: "1ab" });
    assert.equal(enc.key.length, 64);
  });

  it("falls back to Math.random when WebCrypto is unavailable", () => {
    const saved = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    try {
      const bits = FaceFuzzy.quantize(makeDescriptor(256, "ramp"));
      const enc = FaceFuzzy.encode(bits, { rep: 15 });
      assert.equal(enc.key.length, 64);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: saved,
        configurable: true,
      });
    }
  });

  it("encode uses default opts when none are supplied", () => {
    const bits = FaceFuzzy.quantize(makeDescriptor(256, "ramp"));
    const enc = FaceFuzzy.encode(bits);
    assert.equal(enc.key.length, 64);
  });

  it("decode honours a default repetition factor when opts omitted", () => {
    const bits = FaceFuzzy.quantize(makeDescriptor(256, "ramp"));
    const enc = FaceFuzzy.encode(bits, { rep: 15, secret: "a1b2c3d4" });
    const dec = FaceFuzzy.decode(enc.helper, bits);
    assert.equal(dec.key, enc.key);
  });

  it("decode throws when there are not enough bits for the repetition factor", () => {
    assert.throws(
      () => FaceFuzzy.decode(new Uint8Array(8), new Uint8Array(8), { rep: 15 }),
      /Not enough bits for repetition factor/,
    );
  });

  it("degrades gracefully when FaceBioHash is unavailable", () => {
    const savedBio = globalThis.FaceBioHash;
    delete globalThis.FaceBioHash;
    try {
      vm.runInThisContext(fuzzySrc, {
        filename: path.resolve(
          __dirname,
          "../..",
          "Face_Biometric",
          "face_fuzzy.js",
        ),
      });
      const degraded = globalThis.FaceFuzzy;
      const bits = degraded.quantize(makeDescriptor(64, "ramp"));
      const enc = degraded.encode(bits, { rep: 8 });
      assert.equal(enc.key, "");
      const dec = degraded.decode(enc.helper, bits, { rep: 8 });
      assert.equal(dec.key, "");
    } finally {
      globalThis.FaceBioHash = savedBio;
      vm.runInThisContext(fuzzySrc, {
        filename: path.resolve(
          __dirname,
          "../..",
          "Face_Biometric",
          "face_fuzzy.js",
        ),
      });
    }
  });
});
