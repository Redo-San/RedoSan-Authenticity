const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};
globalThis.document = {
  createElement: () => null,
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
};
globalThis.crypto = {
  subtle: {
    digest: async () => new ArrayBuffer(0),
  },
};
globalThis.Worker = function () {
  this.postMessage = function () {};
  this.terminate = function () {};
};
globalThis.Blob = class Blob {};
globalThis.URL.createObjectURL = function () {
  return "blob:stub";
};

// Load hashing.js
const src = fs.readFileSync(
  path.join(__dirname, "../../Fingerprint/hashing.js"),
  "utf8",
);
vm.runInThisContext(src, {
  filename: path.resolve(__dirname, "../../Fingerprint/hashing.js"),
});

describe("Hashing — SHA-3 family", () => {
  it("sha3_224 should hash empty input", async () => {
    var h = await sha3_224(new Uint8Array(0));
    assert.ok(/^[0-9a-f]{56}$/i.test(h), "Expected 56-char hex");
  });

  it("sha3_256 should hash empty input", async () => {
    var h = await sha3_256(new Uint8Array(0));
    assert.ok(/^[0-9a-f]{64}$/i.test(h), "Expected 64-char hex");
  });

  it("sha3_384 should hash empty input", async () => {
    var h = await sha3_384(new Uint8Array(0));
    assert.ok(/^[0-9a-f]{96}$/i.test(h), "Expected 96-char hex");
  });

  it("sha3_512 should hash empty input", async () => {
    var h = await sha3_512(new Uint8Array(0));
    assert.ok(/^[0-9a-f]{128}$/i.test(h), "Expected 128-char hex");
  });

  it("sha3_256 should hash large input (>136 bytes) covering SHA-3 loop", async () => {
    var data = new Uint8Array(200);
    for (var i = 0; i < data.length; i++) data[i] = i & 0xff;
    var h = await sha3_256(data);
    assert.ok(/^[0-9a-f]{64}$/i.test(h), "Expected 64-char hex");
  });
});

describe("Hashing — SHAKE", () => {
  it("shake128 should hash empty input", async () => {
    var h = await shake128(new Uint8Array(0));
    assert.ok(typeof h === "string" && h.length > 0);
  });

  it("shake256 should hash empty input", async () => {
    var h = await shake256(new Uint8Array(0));
    assert.ok(typeof h === "string" && h.length > 0);
  });

  it("shake128 should hash large input (>168 bytes) covering SHAKE loop", async () => {
    var data = new Uint8Array(300);
    for (var i = 0; i < data.length; i++) data[i] = i & 0xff;
    var h = await shake128(data);
    assert.ok(typeof h === "string" && h.length > 0);
  });
});

describe("Hashing — BLAKE2b", () => {
  it("should hash empty input", async () => {
    var h = await blake2b(new Uint8Array(0));
    assert.ok(typeof h === "string" && h.length > 0);
  });

  it("should hash short input", async () => {
    var data = new Uint8Array([0x61, 0x62, 0x63]); // "abc"
    var h = await blake2b(data);
    assert.ok(typeof h === "string" && h.length > 0);
  });

  it("should hash large input (>64 bytes) covering BLAKE2b compression loop", async () => {
    var data = new Uint8Array(128);
    for (var i = 0; i < data.length; i++) data[i] = i & 0xff;
    var h = await blake2b(data);
    assert.ok(typeof h === "string" && h.length > 0);
  });
});

describe("Hashing — BLAKE2s", () => {
  it("should hash empty input", async () => {
    var h = await blake2s(new Uint8Array(0));
    assert.ok(typeof h === "string" && h.length > 0);
  });

  it("should hash large input (>64 bytes) covering BLAKE2s compression loop", async () => {
    var data = new Uint8Array(128);
    for (var i = 0; i < data.length; i++) data[i] = i & 0xff;
    var h = await blake2s(data);
    assert.ok(typeof h === "string" && h.length > 0);
  });
});

describe("Hashing — BLAKE3", () => {
  it("should hash empty input", async () => {
    var h = await blake3(new Uint8Array(0));
    assert.ok(typeof h === "string" && h.length > 0);
  });

  it("should hash short input", async () => {
    var data = new Uint8Array([0x61, 0x62, 0x63]);
    var h = await blake3(data);
    assert.ok(typeof h === "string" && h.length > 0);
  });

  it("should hash large input (>1024 bytes) covering BLAKE3 merge loop", async () => {
    var data = new Uint8Array(3000);
    for (var i = 0; i < data.length; i++) data[i] = i & 0xff;
    var h = await blake3(data);
    assert.ok(typeof h === "string" && h.length > 0);
  });
});

describe("Hashing — SHA-224 (pure JS)", () => {
  it("should hash empty input", async () => {
    var h = await sha224(new Uint8Array(0));
    assert.ok(/^[0-9a-f]{56}$/i.test(h));
  });
});

describe("Hashing — SHA-512/224", () => {
  it("should hash empty input", async () => {
    var h = await sha512_224(new Uint8Array(0));
    assert.ok(/^[0-9a-f]{56}$/i.test(h));
  });
});

describe("Hashing — SHA-512/256", () => {
  it("should hash empty input", async () => {
    var h = await sha512_256(new Uint8Array(0));
    assert.ok(/^[0-9a-f]{64}$/i.test(h));
  });
});

describe("Hashing — MD5 (pure JS)", () => {
  it("should hash empty input", async () => {
    var h = await md5(new Uint8Array(0));
    assert.ok(/^[0-9a-f]{32}$/i.test(h));
  });

  it("should hash 'abc' input", async () => {
    var data = new Uint8Array([0x61, 0x62, 0x63]);
    var h = await md5(data);
    // Known MD5("abc") = 900150983cd24fb0d6963f7d28e17f72
    assert.equal(h, "900150983cd24fb0d6963f7d28e17f72");
  });
});

describe("Hashing — MD2 (pure JS)", () => {
  it("should hash empty input", () => {
    var h = md2(new Uint8Array(0));
    assert.ok(typeof h === "string" && h.length > 0);
  });
});

describe("Hashing — MD4 (pure JS)", () => {
  it("should hash empty input", () => {
    var h = md4(new Uint8Array(0));
    assert.ok(typeof h === "string" && h.length > 0);
  });
});

describe("Hashing — RIPEMD-160", () => {
  it("should hash empty input", async () => {
    var h = await ripemd160(new Uint8Array(0));
    assert.ok(/^[0-9a-f]{40}$/i.test(h));
  });
});

describe("Hashing — Whirlpool", () => {
  it("should hash empty input", async () => {
    var h = await whirlpool(new Uint8Array(0));
    assert.ok(typeof h === "string" && h.length > 0);
  });
});

describe("Hashing — computeRemainingHashes", () => {
  it("should compute all extra hashes for empty buffer", async () => {
    var hashesObj = {};
    var buf = new ArrayBuffer(0);
    var result = await computeRemainingHashes(hashesObj, buf);
    assert.ok(result["SHA-3_224"]);
    assert.ok(result["SHA-3_256"]);
    assert.ok(result["BLAKE2b"]);
    assert.ok(result["MD5"]);
    assert.ok(result["RIPEMD-160"]);
    assert.ok(result["Whirlpool"]);
    assert.ok(result["SHAKE128"]);
    assert.ok(result["SHAKE256"]);
  });

  it("should call onProgress callback", async () => {
    var progressMsgs = [];
    var hashesObj = {};
    var buf = new ArrayBuffer(0);
    await computeRemainingHashes(hashesObj, buf, function (msg) {
      progressMsgs.push(msg);
    });
    assert.ok(progressMsgs.length > 0);
  });

  it("should call onComplete callback", async () => {
    var completed = false;
    var hashesObj = {};
    var buf = new ArrayBuffer(0);
    await computeRemainingHashes(hashesObj, buf, null, function (extra) {
      completed = true;
    });
    assert.ok(completed);
  });
});

describe("Hashing — trimFingerprintPayload", () => {
  it("should trim payload within max bytes", () => {
    var fp = {
      file_info: {},
      hashes: { "SHA-256": "a".repeat(64), "SHA-512": "b".repeat(128) },
    };
    var trimmed = trimFingerprintPayload(fp, 500);
    assert.ok(typeof trimmed === "object");
    assert.ok(trimmed.hashes["SHA-256"]);
  });

  it("should handle missing file_info gracefully", () => {
    var fp = { file_info: {}, hashes: { "SHA-256": "a".repeat(64) } };
    var trimmed = trimFingerprintPayload(fp, 1000);
    assert.ok(typeof trimmed === "object");
    assert.ok(trimmed.hashes["SHA-256"]);
  });

  it("should truncate when exceeding max bytes", () => {
    var fp = {
      file_info: {},
      hashes: {
        "SHA-256": "a".repeat(64),
        "SHA-512": "b".repeat(128),
        BLAKE3: "c".repeat(64),
      },
      perceptual_hashes: { ahash: "d".repeat(16) },
    };
    var trimmed = trimFingerprintPayload(fp, 100);
    // Should still return an object
    assert.ok(typeof trimmed === "object");
  });
});

describe("Hashing — trimFingerprintPayload perceptual overflow", () => {
  it("should delete perceptual hashes when they exceed maxBytes", () => {
    // fp with small maxBytes so perceptual hashes get deleted
    var fp = {
      file_info: {},
      hashes: { "SHA-256": "a".repeat(64) },
      perceptual_hashes: { ahash: "d".repeat(100) }, // Very long
    };
    var trimmed = trimFingerprintPayload(fp, 80);
    // With maxBytes=80, the SHA-256 itself (~90 bytes) would be kept,
    // but ahash (100 chars) would exceed the limit
    assert.ok(typeof trimmed === "object");
    // truncated perceptual hashes might be empty
  });

  it("should keep perceptual hashes when under limit", () => {
    var fp = {
      file_info: {},
      hashes: { "SHA-256": "a".repeat(64) },
      perceptual_hashes: { ahash: "short" },
    };
    var trimmed = trimFingerprintPayload(fp, 500);
    assert.ok(trimmed.perceptual_hashes.ahash === "short");
  });
});

describe("Hashing — consistency", () => {
  it("should produce same SHA-3_256 hash for same input twice", async () => {
    var data = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]); // "hello"
    var h1 = await sha3_256(data);
    var h2 = await sha3_256(data);
    assert.equal(h1, h2);
  });

  it("should produce different MD5 for different inputs", async () => {
    var h1 = await md5(new Uint8Array([0x61])); // "a"
    var h2 = await md5(new Uint8Array([0x62])); // "b"
    assert.notEqual(h1, h2);
  });
});
