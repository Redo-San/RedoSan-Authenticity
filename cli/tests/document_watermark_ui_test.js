const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };

function loadDocwFile(name) {
  const src = fs.readFileSync(path.join(__dirname, "../../Document_Watermark/" + name), "utf8");
  vm.runInThisContext(src, { filename: name });
}
loadDocwFile("document_watermark_report.js");
loadDocwFile("document_watermark_pdf.js");
loadDocwFile("document_watermark.js");

describe("Document Watermark UI — _formatFingerprint", () => {
  it("should format a complete fingerprint", () => {
    const parsed = {
      file_info: { file_name: "test.jpg", width: 1920, height: 1080, file_size_bytes: 12345 },
      hashes: { "SHA-256": "abc123" },
      perceptual_hashes: { dHash: "dhashval" },
    };
    const result = _formatFingerprint(parsed);
    assert.ok(result.includes("test.jpg"));
    assert.ok(result.includes("1920x1080"));
    assert.ok(result.includes("12345"));
    assert.ok(result.includes("SHA-256"));
    assert.ok(result.includes("dHash"));
  });

  it("should handle missing perceptual hashes", () => {
    const parsed = {
      file_info: { file_name: "test.jpg" },
      hashes: { MD5: "md5val" },
    };
    const result = _formatFingerprint(parsed);
    assert.ok(result.includes("test.jpg"));
    assert.ok(result.includes("MD5"));
  });

  it("should handle empty object", () => {
    const result = _formatFingerprint({});
    assert.equal(typeof result, "string");
  });
});

describe("Document Watermark UI — _formatFingerprintShort", () => {
  it("should count hashes", () => {
    const parsed = {
      hashes: { "SHA-256": "a", MD5: "b" },
      perceptual_hashes: { dHash: "c", pHash: "d" },
    };
    const result = _formatFingerprintShort(parsed);
    assert.equal(result, "4 hashes");
  });

  it("should return 0 for empty", () => {
    const result = _formatFingerprintShort({});
    assert.equal(result, "0 hashes");
  });
});

describe("Document Watermark UI — _docwEscXml", () => {
  it('should escape & < > "', () => {
    assert.equal(_docwEscXml('a&b<c>d"e'), "a&amp;b&lt;c&gt;d&quot;e");
  });

  it("should return empty string for empty input", () => {
    assert.equal(_docwEscXml(""), "");
  });

  it("should leave safe strings unchanged", () => {
    assert.equal(_docwEscXml("hello world"), "hello world");
  });
});

describe("Document Watermark UI — _stringToBytes", () => {
  it("should convert string to Uint8Array", () => {
    const bytes = _stringToBytes("ABC");
    assert.ok(bytes instanceof Uint8Array);
    assert.deepEqual(Array.from(bytes), [0x41, 0x42, 0x43]);
  });

  it("should handle empty string", () => {
    const bytes = _stringToBytes("");
    assert.equal(bytes.length, 0);
  });
});

describe("Document Watermark UI — docwToCSV", () => {
  it("should produce CSV output with headers", () => {
    const r = {
      algo: "ZWC",
      message: "hello",
      timestamp: "2024-01-01",
      textLength: 100,
      hash: "abc",
      resultLength: 50,
    };
    const csv = docwToCSV(r);
    assert.ok(csv.includes('"Key","Value"'));
    assert.ok(csv.includes('"ZWC"'));
    assert.ok(csv.includes('"hello"'));
    assert.ok(csv.includes('"100"'));
    assert.ok(csv.includes('"abc"'));
    assert.ok(csv.includes('"50"'));
  });

  it("should escape double quotes in message", () => {
    const r = { algo: "test", message: 'say "hello"', timestamp: "", textLength: 0, hash: "", resultLength: 0 };
    const csv = docwToCSV(r);
    assert.ok(csv.includes('""'));
  });
});

describe("Document Watermark UI — docwToXML", () => {
  it("should produce XML output", () => {
    const r = {
      algo: "ZWC",
      message: "test msg",
      timestamp: "2024-01-01",
      textLength: 50,
      hash: "abc",
      resultLength: 25,
    };
    const xml = docwToXML(r);
    assert.ok(xml.includes("<algo>ZWC</algo>"));
    assert.ok(xml.includes("<message>test msg</message>"));
    assert.ok(xml.includes("<textLength>50</textLength>"));
    assert.ok(xml.includes("<hash>abc</hash>"));
    assert.ok(xml.includes("<resultLength>25</resultLength>"));
  });

  it("should escape XML special chars", () => {
    const r = { algo: "test", message: "a&b<c>", timestamp: "", textLength: 0, hash: "", resultLength: 0 };
    const xml = docwToXML(r);
    assert.ok(xml.includes("a&amp;b&lt;c&gt;"));
  });
});

describe("Document Watermark UI — _docwBuildCertificateText", () => {
  it("should build certificate text with all fields", () => {
    const r = {
      algo: "ZWC",
      message: "secret",
      timestamp: "2024-06-01T00:00:00Z",
      textLength: 100,
      hash: "sha256hash",
    };
    const cert = _docwBuildCertificateText(r);
    assert.ok(cert.includes("ZWC"));
    assert.ok(cert.includes("secret"));
    assert.ok(cert.includes("100"));
    assert.ok(cert.includes("sha256hash"));
    assert.ok(cert.length > 500);
  });

  it("should include separator lines", () => {
    const r = { algo: "test", message: "msg", timestamp: "t", textLength: 1, hash: "h" };
    const cert = _docwBuildCertificateText(r);
    assert.ok(cert.includes("==="));
    assert.ok(cert.includes("---"));
  });
});

describe("Document Watermark UI — docwToTXT", () => {
  it("should delegate to _docwBuildCertificateText", () => {
    const r = { algo: "ZWC", message: "test", timestamp: "t", textLength: 5, hash: "h" };
    const txt = docwToTXT(r);
    assert.equal(txt, _docwBuildCertificateText(r));
  });
});

describe("Document Watermark UI — docwToHTML", () => {
  it("should produce HTML with result info", () => {
    const r = { algo: "ZWC", message: "test msg", timestamp: "t", textLength: 50, hash: "abc", resultLength: 25 };
    const html = docwToHTML(r);
    assert.ok(html.includes("ZWC"));
    assert.ok(html.includes("test msg"));
    assert.ok(html.includes("50"));
  });
});
