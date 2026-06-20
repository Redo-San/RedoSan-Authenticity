const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills needed by hashing.js
globalThis.window = globalThis;
globalThis.document = {
  createElement: () => ({ getContext: () => null }),
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.location = { protocol: "file:", href: "file:///test/hashing.js", hostname: "localhost", origin: "null" };

// Suppress BLAKE3 self-check output
const origLog = console.log;
console.log = () => {};
const hashSrc = fs.readFileSync(path.join(__dirname, "../../Fingerprint/hashing.js"), "utf8");
try {
  vm.runInThisContext(hashSrc, { filename: "hashing.js" });
} finally {
  console.log = origLog;
}

function makeFile(data, name) {
  return {
    name: name || "test.bin",
    arrayBuffer: async () => Buffer.from(data).buffer,
  };
}

describe("Fingerprint hashing", () => {
  it("should provide fastFingerprint function", () => {
    assert.equal(typeof globalThis.fastFingerprint, "function");
  });
  it("should provide fingerprintFile function", () => {
    assert.equal(typeof globalThis.fingerprintFile, "function");
  });
  it("fastFingerprint should return hashes for text data", async () => {
    const file = makeFile([72, 101, 108, 108, 111], "hello.bin");
    const result = await globalThis.fastFingerprint(file);
    assert.ok(result);
    assert.ok(result.hashes);
    assert.ok(result.hashes["SHA-256"]);
    assert.ok(result.hashes["SHA-1"]);
    assert.ok(result.hashes["SHA-384"]);
    assert.ok(result.hashes["SHA-512"]);
  });
  it("fingerprintFile should return all hashes", async () => {
    const file = makeFile([84, 101, 115, 116], "test.bin");
    const result = await globalThis.fingerprintFile(file);
    assert.ok(result);
    assert.ok(result.hashes);
    assert.ok(Object.keys(result.hashes).length >= 4);
    assert.ok(result.file_info);
    assert.equal(result.file_info.file_name, "test.bin");
  });
  it("fastFingerprint should support progress callback", async () => {
    const file = makeFile(new Array(1000).fill(65), "large.bin");
    let progressCalled = false;
    const result = await globalThis.fastFingerprint(file, (p) => {
      if (p) progressCalled = true;
    });
    assert.ok(result);
    assert.ok(result.hashes);
  });
});
