const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };
globalThis.URL.createObjectURL = globalThis.URL.createObjectURL || (() => "blob:stub");
globalThis.URL.revokeObjectURL = globalThis.URL.revokeObjectURL || (() => {});

const srcUtils = fs.readFileSync(path.join(__dirname, "../../Certificate/certificate_utils.js"), "utf8");
const cleanUtils = srcUtils.replace(/^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/, "");
vm.runInThisContext(cleanUtils, { filename: "certificate_utils.js" });

const srcOts = fs.readFileSync(path.join(__dirname, "../../Certificate/certificate_ots.js"), "utf8");
const cleanOts = srcOts.replace(/^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/, "");
vm.runInThisContext(cleanOts, { filename: "certificate_ots.js" });

const srcPdf = fs.readFileSync(path.join(__dirname, "../../Certificate/certificate_pdf.js"), "utf8");
const cleanPdf = srcPdf.replace(/^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/, "");
vm.runInThisContext(cleanPdf, { filename: "certificate_pdf.js" });

const srcDocx = fs.readFileSync(path.join(__dirname, "../../Certificate/certificate_docx.js"), "utf8");
const cleanDocx = srcDocx.replace(/^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/, "");
vm.runInThisContext(cleanDocx, { filename: "certificate_docx.js" });

const srcEpub = fs.readFileSync(path.join(__dirname, "../../Certificate/certificate_epub.js"), "utf8");
const cleanEpub = srcEpub.replace(/^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/, "");
vm.runInThisContext(cleanEpub, { filename: "certificate_epub.js" });

const src = fs.readFileSync(path.join(__dirname, "../../Certificate/certificate.js"), "utf8");
// Remove the auto-executing license wrapper
const cleanSrc = src.replace(/^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/, "");
vm.runInThisContext(cleanSrc, { filename: "certificate.js" });

describe("Certificate — hasNonLatinChars", () => {
  it("returns false for pure ASCII", () => {
    assert.equal(hasNonLatinChars("Hello World 123"), false);
  });

  it("returns true for Arabic text", () => {
    assert.equal(hasNonLatinChars("مرحبا"), true);
  });

  it("returns true for Chinese characters", () => {
    assert.equal(hasNonLatinChars("你好"), true);
  });

  it("returns true for Japanese", () => {
    assert.equal(hasNonLatinChars("こんにちは"), true);
  });

  it("returns false for Latin-1 extended (U+00FF)", () => {
    assert.equal(hasNonLatinChars("café"), false); // é is U+00E9, within Latin-1
  });

  it("returns false for empty string", () => {
    assert.equal(hasNonLatinChars(""), false);
  });
});

describe("Certificate — bufToBase64", () => {
  it("should encode Uint8Array to base64", () => {
    const buf = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    assert.equal(bufToBase64(buf), "SGVsbG8=");
  });

  it("should encode empty buffer", () => {
    assert.equal(bufToBase64(new Uint8Array(0)), "");
  });

  it("should encode binary data", () => {
    const buf = new Uint8Array([0x00, 0x01, 0xff, 0xfe]);
    const result = bufToBase64(buf);
    assert.ok(typeof result === "string");
    assert.ok(result.length > 0);
    // decode and verify
    const decoded = Buffer.from(result, "base64");
    assert.equal(decoded[0], 0x00);
    assert.equal(decoded[3], 0xfe);
  });
});

describe("Certificate — bufToDataURL", () => {
  it("should produce a data URL with mime type", () => {
    const buf = new Uint8Array([0x48, 0x65, 0x6c]);
    const url = bufToDataURL(buf, "text/plain");
    assert.ok(url.startsWith("data:text/plain;base64,"));
    assert.ok(url.length > 20);
  });

  it("should use default mime when not provided", () => {
    const buf = new Uint8Array([0x00]);
    const url = bufToDataURL(buf);
    assert.ok(url.startsWith("data:application/octet-stream;base64,"));
  });

  it("should produce valid base64 content", () => {
    const buf = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    const url = bufToDataURL(buf, "text/plain");
    const b64 = url.split(",")[1];
    assert.equal(Buffer.from(b64, "base64").toString(), "Hello");
  });
});

describe("Certificate — makeCertDataURL", () => {
  it("should create a blob URL for given data", () => {
    // In Node, URL.createObjectURL is not available, so we need to stub it
    const originalCreateObjectURL = globalThis.URL.createObjectURL;
    globalThis.URL.createObjectURL = (blob) => "blob:test";
    try {
      const buf = new Uint8Array([0x01, 0x02]);
      const url = makeCertDataURL(buf, "image/png");
      assert.equal(url, "blob:test");
    } finally {
      globalThis.URL.createObjectURL = originalCreateObjectURL;
    }
  });
});

describe("Certificate — getFileHashSha256", () => {
  it("should compute SHA-256 of a buffer", async () => {
    const buf = new Uint8Array([0x61, 0x62, 0x63]); // "abc"
    const hash = await getFileHashSha256(buf);
    // SHA-256 of "abc"
    assert.equal(hash, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("should compute hash of empty buffer", async () => {
    const hash = await getFileHashSha256(new Uint8Array(0));
    assert.equal(hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("should return lowercase hex", async () => {
    const hash = await getFileHashSha256(new Uint8Array([0x00]));
    // SHA-256 of \x00
    assert.equal(hash, "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d");
    assert.ok(/^[0-9a-f]+$/.test(hash));
  });
});
