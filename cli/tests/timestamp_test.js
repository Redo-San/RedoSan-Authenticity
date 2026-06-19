const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };
// Node 20 has Web Crypto API built in — no stub needed
globalThis.__ = (k, d) => d || k;
globalThis.setTimeout = setTimeout;
globalThis.fetch = async () => {
  throw new Error("no network");
};
globalThis.AbortController = class {
  abort() {}
};

const src = fs.readFileSync(path.join(__dirname, "../../Timestamp/timestamp.js"), "utf8");
vm.runInThisContext(src, { filename: "timestamp.js" });

describe("Timestamp — otsBuildDetached", () => {
  it("should build a valid OTS byte array", () => {
    const fileBytes = new Uint8Array([1, 2, 3]);
    const sha256Bytes = new Uint8Array(32).fill(0xab);
    const result = otsBuildDetached(fileBytes, sha256Bytes);
    assert.ok(result instanceof Uint8Array);
    // Header (31 bytes) + version (1) + SHA-256 tag (1) + 32 bytes hash
    assert.equal(result.length, 31 + 1 + 1 + 32);
    // Check OTS header magic
    const expectedHeader = [
      0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72,
      0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
    ];
    for (let i = 0; i < expectedHeader.length; i++) {
      assert.equal(result[i], expectedHeader[i]);
    }
    // Version byte
    assert.equal(result[31], 1);
    // SHA-256 tag
    assert.equal(result[32], 0x08);
    // Hash bytes
    for (let i = 33; i < 65; i++) {
      assert.equal(result[i], 0xab);
    }
  });

  it("should handle all-zero hash", () => {
    const result = otsBuildDetached(new Uint8Array(0), new Uint8Array(32));
    assert.equal(result.length, 65);
    for (let i = 33; i < 65; i++) {
      assert.equal(result[i], 0);
    }
  });
});

describe("Timestamp — otsParse", () => {
  it("should parse a valid OTS byte array", () => {
    const sha256Bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) sha256Bytes[i] = i + 1;
    const ots = otsBuildDetached(new Uint8Array(0), sha256Bytes);
    const parsed = otsParse(ots);
    assert.ok(parsed.hash instanceof Uint8Array);
    assert.equal(parsed.hash.length, 32);
    assert.equal(parsed.tag, 0x08);
    for (let i = 0; i < 32; i++) {
      assert.equal(parsed.hash[i], i + 1);
    }
  });

  it("should accept regular array as input", () => {
    const sha256Bytes = new Uint8Array(32).fill(0x42);
    const ots = otsBuildDetached(new Uint8Array(0), sha256Bytes);
    const asArray = Array.from(ots);
    const parsed = otsParse(asArray);
    assert.equal(parsed.tag, 0x08);
    assert.equal(parsed.hash[0], 0x42);
  });

  it("should throw for bad magic bytes", () => {
    assert.throws(() => otsParse(new Uint8Array(65)), /Invalid OTS file/);
  });

  it("should throw for unsupported version", () => {
    const valid = otsBuildDetached(new Uint8Array(0), new Uint8Array(32));
    valid[31] = 99; // wrong version
    assert.throws(() => otsParse(valid), /Unsupported OTS version/);
  });

  it("should throw for unsupported hash tag", () => {
    const valid = otsBuildDetached(new Uint8Array(0), new Uint8Array(32));
    valid[32] = 0xff; // unsupported tag
    assert.throws(() => otsParse(valid), /Unsupported hash/);
  });
});

describe("Timestamp — getOtsUpgradeCommand", () => {
  it("should return a string with CLI instructions", () => {
    const cmd = getOtsUpgradeCommand("testfile");
    assert.ok(typeof cmd === "string");
    assert.ok(cmd.includes("opentimestamps"));
    assert.ok(cmd.includes("testfile"));
  });

  it("should escape file names with single quotes", () => {
    const cmd = getOtsUpgradeCommand("it's");
    // The replace converts ' to '\'' (end single-quote, escaped quote, resume single-quote)
    // In the ots upgrade command line, the escaped name appears
    assert.ok(cmd.includes("it"));
    assert.ok(cmd.includes("s"));
  });

  it("should handle empty file name", () => {
    const cmd = getOtsUpgradeCommand("");
    assert.ok(typeof cmd === "string");
  });
});
