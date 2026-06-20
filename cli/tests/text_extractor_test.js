const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };
globalThis.ReadableStream = require("stream/web").ReadableStream;

const realJSZip = require("jszip");
globalThis.JSZip = realJSZip;

const src = fs.readFileSync(path.join(__dirname, "../../Document_Watermark/text_extractor.js"), "utf8");
const cleanSrc = src.replace(/^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/, "");
vm.runInThisContext(cleanSrc, { filename: "text_extractor.js" });

describe("Text Extractor — DOCX error paths", () => {
  it("should reject invalid DOCX (no document.xml)", async () => {
    const zip = new realJSZip();
    zip.file("word/style.xml", "<xml/>");
    const buf = await zip.generateAsync({ type: "uint8array" });
    await assert.rejects(() => DOCX_EXTRACTOR.readDocx(buf), /not found/);
  });

  it("should reject if JSZip is not loaded", async () => {
    const orig = globalThis.JSZip;
    globalThis.JSZip = undefined;
    try {
      await assert.rejects(() => DOCX_EXTRACTOR.readDocx(new Uint8Array(0)), /JSZip library/);
    } finally {
      globalThis.JSZip = orig;
    }
  });
});

describe("Text Extractor — readPdf", () => {
  it("should return empty string for non-PDF data", async () => {
    const text = await DOCX_EXTRACTOR.readPdf(new Uint8Array([0, 1, 2, 3]));
    assert.equal(text, "");
  });

  it("should not throw for minimal valid PDF", async () => {
    const pdf = createMinimalPdf("Hello");
    const text = await DOCX_EXTRACTOR.readPdf(pdf);
    assert.ok(typeof text === "string");
  });
});

describe("Text Extractor — docwExtractText", () => {
  it("should be a function", () => {
    assert.equal(typeof docwExtractText, "function");
  });
});

// ── Helpers ──
function createMinimalPdf(text) {
  const content = "(" + text + ") Tj\n";
  const obj1 = "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n";
  const obj2 = "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n";
  const obj3 =
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n";
  const obj4 = "4 0 obj<</Length " + content.length + ">>stream\n" + content + "\nendstream\nendobj\n";
  const obj5 = "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n";
  const body = obj1 + obj2 + obj3 + obj4 + obj5;
  const full = "%PDF-1.4\n" + body + "xref\n0 1\n0000000000 65535 f \ntrailer\n<</Size 1>>\nstartxref\n0\n%%EOF\n";
  return new Uint8Array(full.split("").map((c) => c.charCodeAt(0)));
}
