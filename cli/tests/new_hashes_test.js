const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.document = {
  createElement: () => ({ getContext: () => null }),
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.location = {
  protocol: "file:",
  href: "file:///test/hashing.js",
  hostname: "localhost",
  origin: "null",
};

const origLog = console.log;
console.log = () => {};
const hashSrc = fs.readFileSync(
  path.join(__dirname, "../../Fingerprint/hashing.js"),
  "utf8",
);
try {
  vm.runInThisContext(hashSrc, {
    filename: path.resolve(__dirname, "../../Fingerprint/hashing.js"),
  });
} finally {
  console.log = origLog;
}

function hex(s) {
  return new Uint8Array(s.match(/../g).map((b) => parseInt(b, 16)));
}

describe("New hash algorithms", () => {
  it("SHAKE128 exists and is a function", () => {
    assert.equal(typeof globalThis.shake128, "function");
  });
  it("SHAKE256 exists and is a function", () => {
    assert.equal(typeof globalThis.shake256, "function");
  });
  it("sha512_224 exists and is a function", () => {
    assert.equal(typeof globalThis.sha512_224, "function");
  });
  it("sha512_256 exists and is a function", () => {
    assert.equal(typeof globalThis.sha512_256, "function");
  });

  it("SHAKE128 produces 64-char hex output for any input", async () => {
    const data = new TextEncoder().encode("abc");
    const result = await globalThis.shake128(data);
    assert.ok(result);
    assert.equal(result.length, 64);
    assert.match(result, /^[0-9a-f]+$/);
  });

  it("SHAKE256 produces 128-char hex output for any input", async () => {
    const data = new TextEncoder().encode("abc");
    const result = await globalThis.shake256(data);
    assert.ok(result);
    assert.equal(result.length, 128);
    assert.match(result, /^[0-9a-f]+$/);
  });

  it("SHAKE128 empty string produces valid hex output", async () => {
    const data = new TextEncoder().encode("");
    const result = await globalThis.shake128(data);
    assert.ok(result);
    assert.equal(result.length, 64);
    assert.match(result, /^[0-9a-f]+$/);
  });

  it("SHAKE256 empty string produces valid hex output", async () => {
    const data = new TextEncoder().encode("");
    const result = await globalThis.shake256(data);
    assert.ok(result);
    assert.equal(result.length, 128);
    assert.match(result, /^[0-9a-f]+$/);
  });

  it("sha512_224('abc') matches Node.js", async () => {
    const data = new TextEncoder().encode("abc");
    const result = await globalThis.sha512_224(data);
    const crypto = require("crypto");
    const expected = crypto
      .createHash("sha512-224")
      .update("abc")
      .digest("hex");
    assert.equal(result, expected);
  });

  it("sha512_256('abc') matches Node.js", async () => {
    const data = new TextEncoder().encode("abc");
    const result = await globalThis.sha512_256(data);
    const crypto = require("crypto");
    const expected = crypto
      .createHash("sha512-256")
      .update("abc")
      .digest("hex");
    assert.equal(result, expected);
  });

  it("sha512_224 empty string matches Node.js", async () => {
    const data = new TextEncoder().encode("");
    const result = await globalThis.sha512_224(data);
    const crypto = require("crypto");
    const expected = crypto.createHash("sha512-224").update("").digest("hex");
    assert.equal(result, expected);
  });

  it("sha512_256 empty string matches Node.js", async () => {
    const data = new TextEncoder().encode("");
    const result = await globalThis.sha512_256(data);
    const crypto = require("crypto");
    const expected = crypto.createHash("sha512-256").update("").digest("hex");
    assert.equal(result, expected);
  });

  it("SHAKE128 real file (binary data)", async () => {
    const data = new Uint8Array([
      0x00, 0xff, 0xab, 0xcd, 0x12, 0x34, 0x56, 0x78, 0x9a,
    ]);
    const result = await globalThis.shake128(data);
    assert.ok(result);
    assert.equal(result.length, 64);
    assert.match(result, /^[0-9a-f]+$/);
  });

  it("SHAKE256 real file (binary data)", async () => {
    const data = new Uint8Array([
      0x00, 0xff, 0xab, 0xcd, 0x12, 0x34, 0x56, 0x78, 0x9a,
    ]);
    const result = await globalThis.shake256(data);
    assert.ok(result);
    assert.equal(result.length, 128);
    assert.match(result, /^[0-9a-f]+$/);
  });

  it("All new hashes are deterministic (same input -> same output)", async () => {
    const data = new TextEncoder().encode("deterministic test data 12345");
    const a = await globalThis.shake128(data);
    const b = await globalThis.shake128(data);
    assert.equal(a, b);
    const c = await globalThis.shake256(data);
    const d = await globalThis.shake256(data);
    assert.equal(c, d);
    const e = await globalThis.sha512_224(data);
    const f = await globalThis.sha512_224(data);
    assert.equal(e, f);
    const g = await globalThis.sha512_256(data);
    const h = await globalThis.sha512_256(data);
    assert.equal(g, h);
  });

  it("Existing SHA hashes still work after adding new ones", async () => {
    const data = new TextEncoder().encode("test");
    const sha256 = await globalThis.sha3_256(data);
    assert.ok(sha256);
    assert.equal(sha256.length, 64);
    const sha224 = await globalThis.sha224(data);
    assert.ok(sha224);
    assert.equal(sha224.length, 56);
    const md5 = await globalThis.md5(data);
    assert.ok(md5);
    assert.equal(md5.length, 32);
  });
});
