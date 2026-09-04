const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};

const src = fs.readFileSync(
  path.join(__dirname, "../../Document_Watermark/document_watermark_core.js"),
  "utf8",
);
vm.runInThisContext(src, {
  filename: path.resolve(
    __dirname,
    "../../Document_Watermark/document_watermark_core.js",
  ),
});

const reportSrc = fs.readFileSync(
  path.join(__dirname, "../../Document_Watermark/document_watermark_report.js"),
  "utf8",
);
vm.runInThisContext(reportSrc, {
  filename: path.resolve(
    __dirname,
    "../../Document_Watermark/document_watermark_report.js",
  ),
});

const pdfSrc = fs.readFileSync(
  path.join(__dirname, "../../Document_Watermark/document_watermark_pdf.js"),
  "utf8",
);
vm.runInThisContext(pdfSrc, {
  filename: path.resolve(
    __dirname,
    "../../Document_Watermark/document_watermark_pdf.js",
  ),
});

describe("Document Watermark — _checkPassword", () => {
  it("should return result unchanged when no password", () => {
    assert.equal(_checkPassword("hello world", ""), "hello world");
    assert.equal(_checkPassword("hello world", null), "hello world");
    assert.equal(_checkPassword("hello world", undefined), "hello world");
  });

  it("should strip password prefix when password matches", () => {
    assert.equal(_checkPassword("secret:hello world", "secret"), "hello world");
  });

  it("should throw WRONG_PASSWORD when password prefix does not match", () => {
    assert.throws(
      () => _checkPassword("secret:hello world", "wrong"),
      /WRONG_PASSWORD/,
    );
  });

  it("should return result unchanged when no colon in first 50 chars", () => {
    assert.equal(
      _checkPassword("this string has no colon with password", "secret"),
      "this string has no colon with password",
    );
  });

  it("should throw when colon present but not matching password", () => {
    assert.throws(
      () => _checkPassword("hello:world", "secret"),
      /WRONG_PASSWORD/,
    );
  });

  it("should return result unchanged when password missing but colon present", () => {
    assert.equal(_checkPassword("hello:world", ""), "hello:world");
  });
});

describe("Document Watermark — _isGarbageResult", () => {
  it("should return true for null/undefined", () => {
    assert.equal(_isGarbageResult(null), true);
    assert.equal(_isGarbageResult(undefined), true);
  });

  it("should return true for too short messages (< 2 chars)", () => {
    assert.equal(_isGarbageResult(""), true);
    assert.equal(_isGarbageResult("a"), true);
  });

  it("should return false for short but valid messages (2-3 chars)", () => {
    assert.equal(_isGarbageResult("ab"), false);
    assert.equal(_isGarbageResult("abc"), false);
  });

  it("should return true for repetitive single-char messages", () => {
    assert.equal(_isGarbageResult("aaaaaaaaaaaaaaaaaaaa"), true);
  });

  it("should return false for diverse character messages", () => {
    assert.equal(_isGarbageResult("abcdefghij"), false);
  });

  it("should check only first 50 characters", () => {
    const longRepetitive = "a".repeat(100);
    assert.equal(_isGarbageResult(longRepetitive), true);
    const diverseInFirst50 = "abcdefghij" + "a".repeat(90);
    assert.equal(_isGarbageResult(diverseInFirst50), false);
  });
});

describe("Document Watermark — _getWmAtPos", () => {
  it("should return null when segText extends beyond origFull", () => {
    assert.equal(_getWmAtPos("abc", "abc", "abcd", 0), null);
  });

  it("should return null when segText does not match at startPos", () => {
    assert.equal(_getWmAtPos("abcde", "abcde", "xyz", 0), null);
  });

  it("should return null when segText chars cannot be found in wmFull", () => {
    assert.equal(_getWmAtPos("abc", "---", "abc", 0), null);
  });

  it("should extract watermarked segment when segText matches at startPos", () => {
    const result = _getWmAtPos(
      "hello world",
      "he\u200Bllo\u200B world",
      "hello",
      0,
    );
    assert.notEqual(result, null);
    assert.ok(result.length > 0);
    assert.ok(result.includes("h"));
    assert.ok(result.includes("e"));
  });

  it("should extract watermarked segment at a non-zero position", () => {
    const result = _getWmAtPos(
      "prefix hello world",
      "prefix he\u200Bllo\u200B world",
      "hello",
      7,
    );
    assert.notEqual(result, null);
    assert.ok(result.length > 0);
    assert.ok(result.includes("h"));
  });

  it("should return watermarked segment with ZWC chars included", () => {
    const result = _getWmAtPos(
      "hello world",
      "he\u200Bllo\u200B world",
      "hello",
      0,
    );
    assert.notEqual(result, null);
    assert.ok(result.includes("\u200B"));
    assert.equal(result.length, 6); // h e ZWC l l o
  });

  it("should return null when watermarked chars are not found", () => {
    const result = _getWmAtPos("hello", "xxxxx", "hello", 0);
    assert.equal(result, null);
  });
});

describe("Document Watermark PDF — _stringToBytes", () => {
  it("should convert string to Uint8Array", () => {
    const result = _stringToBytes("ABC");
    assert.ok(result instanceof Uint8Array);
    assert.deepEqual(Array.from(result), [0x41, 0x42, 0x43]);
  });

  it("should handle empty string", () => {
    const result = _stringToBytes("");
    assert.equal(result.length, 0);
  });
});

describe("Document Watermark PDF — _decompressRaw", () => {
  it("should roundtrip compress and decompress", async () => {
    const original = new TextEncoder().encode(
      "Hello, World! This is a test string.",
    );
    const cs = new CompressionStream("deflate-raw");
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();
    writer.write(original);
    writer.close();
    const chunks = [];
    while (true) {
      const v = await reader.read();
      if (v.done) break;
      chunks.push(v.value);
    }
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const compressed = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      compressed.set(c, offset);
      offset += c.length;
    }

    const decompressed = await _decompressRaw(compressed);
    assert.ok(decompressed instanceof Uint8Array);
    assert.deepEqual(Array.from(decompressed), Array.from(original));
  });

  it("should decompress empty array", async () => {
    const original = new Uint8Array(0);
    const cs = new CompressionStream("deflate-raw");
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();
    writer.write(original);
    writer.close();
    const chunks = [];
    while (true) {
      const v = await reader.read();
      if (v.done) break;
      chunks.push(v.value);
    }
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const compressed = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      compressed.set(c, offset);
      offset += c.length;
    }

    const result = await _decompressRaw(compressed);
    assert.ok(result instanceof Uint8Array);
  });

  it("should throw when DecompressionStream is not available", async () => {
    var orig = globalThis.DecompressionStream;
    globalThis.DecompressionStream = undefined;
    try {
      var bytes = new Uint8Array([0, 1, 2]);
      await assert.rejects(
        async function () {
          await _decompressRaw(bytes);
        },
        { name: "TypeError" },
      );
    } finally {
      globalThis.DecompressionStream = orig;
    }
  });
});

describe("Document Watermark PDF — _pdfReplaceInStream (segment parsing)", () => {
  it("should locate TJ text segments", () => {
    const content = "BT /F1 12 Tf (Hello) Tj ET";
    const cmap = { forward: {}, reverse: {} };
    const result = _pdfReplaceInStream(content, content, content, cmap);
    assert.ok(typeof result === "string");
  });

  it("should handle TJ arrays with hex codes", () => {
    const content = "<0048> Tj <0065> Tj";
    const cmap = {
      forward: { 0x0048: 0x48, 0x0065: 0x65 },
      reverse: { 0x48: 0x0048, 0x65: 0x0065 },
    };
    const result = _pdfReplaceInStream(content, "He", content, cmap);
    assert.ok(result);
    assert.ok(result.includes("<0048>"));
  });

  it("should handle empty content", () => {
    const result = _pdfReplaceInStream("", "", "", {
      forward: {},
      reverse: {},
    });
    assert.equal(result, "");
  });
});

describe("Document Watermark PDF — buildWatermarkedPdfDoc", () => {
  async function makeCompressedStream(text) {
    const bytes = new TextEncoder().encode(text);
    const cs = new CompressionStream("deflate");
    const w = cs.writable.getWriter();
    const r = cs.readable.getReader();
    await w.write(bytes);
    await w.close();
    const chunks = [];
    while (true) {
      const v = await r.read();
      if (v.done) break;
      chunks.push(v.value);
    }
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const result = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      result.set(c, off);
      off += c.length;
    }
    return result;
  }

  it("should return a Uint8Array", async () => {
    const pdfText = "BT /F1 12 Tf (Hello World) Tj ET";
    const comp = await makeCompressedStream(pdfText);
    const pdfStr =
      "xref\n0 1\n0000000000 65535 f \ntrailer\n<</Size 1>>\nstartxref\n0\n%%EOF";
    var streamData = "";
    for (let i = 0; i < comp.length; i++)
      streamData += String.fromCharCode(comp[i]);
    const fullPdf = pdfStr + "\nstream\n" + streamData + "\nendstream";
    const pdfBytes = new TextEncoder().encode(fullPdf);
    const result = await buildWatermarkedPdfDoc(
      pdfBytes,
      "Hello World",
      "Hello\u200BWorld",
    );
    assert.ok(result instanceof Uint8Array);
  });

  it("should preserve non-stream content unchanged", async () => {
    const comp = await makeCompressedStream("BT (Test) Tj ET");
    const header = "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n";
    let sd = "";
    for (let i = 0; i < comp.length; i++) sd += String.fromCharCode(comp[i]);
    const src = header + "stream\n" + sd + "\nendstream\n%%EOF";
    const bytes = new TextEncoder().encode(src);
    const result = await buildWatermarkedPdfDoc(bytes, "Test", "TestWM");
    const resultStr = new TextDecoder().decode(result);
    assert.ok(resultStr.includes("%PDF-1.4"));
    assert.ok(resultStr.includes("%%EOF"));
  });

  it("should handle empty original text", async () => {
    const comp = await makeCompressedStream("BT /F1 12 Tf (Hello) Tj ET");
    let sd = "";
    for (let i = 0; i < comp.length; i++) sd += String.fromCharCode(comp[i]);
    const src = "stream\n" + sd + "\nendstream";
    const bytes = new TextEncoder().encode(src);
    const result = await buildWatermarkedPdfDoc(bytes, "", "");
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });

  it("should modify content when watermark differs from original", async () => {
    const comp = await makeCompressedStream(
      "BT /F1 12 Tf (Hello World) Tj ET\nBT /F2 10 Tf (End) Tj ET",
    );
    var sd = "";
    for (let i = 0; i < comp.length; i++) sd += String.fromCharCode(comp[i]);
    const src = "stream\n" + sd + "\nendstream";
    const bytes = new TextEncoder().encode(src);
    const result = await buildWatermarkedPdfDoc(
      bytes,
      "Hello WorldEnd",
      "Hello\u200BWorld\u200BEnd",
    );
    assert.ok(result instanceof Uint8Array);
    const resultStr = new TextDecoder().decode(result);
    // Stream should be re-compressed, so exact content check is not needed
    assert.ok(resultStr.includes("stream"));
    assert.ok(resultStr.includes("endstream"));
  });

  it("should handle PDF with no streams gracefully", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4\n%%EOF");
    const result = await buildWatermarkedPdfDoc(bytes, "test", "modified");
    assert.ok(result instanceof Uint8Array);
    const resultStr = new TextDecoder().decode(result);
    assert.equal(resultStr, "%PDF-1.4\n%%EOF");
  });

  it("should handle decompression failure gracefully (corrupt stream)", async () => {
    // Create a PDF with a corrupt stream (random bytes that aren't valid deflate)
    const corruptData = "CORRUPTDATA!";
    const src = "stream\n" + corruptData + "\nendstream\n%%EOF";
    const bytes = new TextEncoder().encode(src);
    const result = await buildWatermarkedPdfDoc(bytes, "test", "modified");
    assert.ok(result instanceof Uint8Array);
    const resultStr = new TextDecoder().decode(result);
    // Corrupt stream data should pass through unchanged
    assert.ok(resultStr.includes("CORRUPTDATA!"));
  });

  it("should handle stream with no text segments", async () => {
    // A stream that decompresses but has no TJ/Tj operators
    const plainText = "q Q n S W J j w M m l c v y h re";
    const comp = await makeCompressedStream(plainText);
    let sd = "";
    for (let i = 0; i < comp.length; i++) sd += String.fromCharCode(comp[i]);
    const src = "stream\n" + sd + "\nendstream";
    const bytes = new TextEncoder().encode(src);
    const result = await buildWatermarkedPdfDoc(
      bytes,
      "original",
      "watermarked",
    );
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });
});

describe("Document Watermark PDF — buildWatermarkedPdfDoc pageStream path", () => {
  async function makeCompressedBytes(text) {
    const bytes = new TextEncoder().encode(text);
    const cs = new CompressionStream("deflate");
    const w = cs.writable.getWriter();
    const r = cs.readable.getReader();
    await w.write(bytes);
    await w.close();
    const chunks = [];
    while (true) {
      const v = await r.read();
      if (v.done) break;
      chunks.push(v.value);
    }
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const result = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      result.set(c, off);
      off += c.length;
    }
    return result;
  }

  it("should append watermark stream when no text match but BT/ET present", async () => {
    // Stream content that won't match originalText but has BT/ET
    // Use 2+ text segments so segs.sort comparator is invoked
    const streamContent =
      "BT /F1 12 Tf (NonMatching) Tj /F2 14 Tf (TextHere) Tj ET";
    const comp = await makeCompressedBytes(streamContent);
    // Build PDF bytes as Uint8Array directly — avoiding TextEncoder round trip
    // that would corrupt bytes > 127 in compressed data
    const prefix = new TextEncoder().encode("stream\n");
    const suffix = new TextEncoder().encode("\nendstream");
    const bytes = new Uint8Array(prefix.length + comp.length + suffix.length);
    bytes.set(prefix, 0);
    bytes.set(comp, prefix.length);
    bytes.set(suffix, prefix.length + comp.length);
    // originalText won't match "NonMatchingText" in the stream
    const result = await buildWatermarkedPdfDoc(
      bytes,
      "OriginalText",
      "Watermarked\u200BText",
    );
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
    // Verify the output is different from input (watermark was appended)
    const resultStr = new TextDecoder().decode(result);
    assert.ok(resultStr.includes("stream"));
    assert.ok(resultStr.includes("endstream"));
    // Result should differ from input because watermark snippet was injected
    assert.notDeepEqual(Array.from(result), Array.from(bytes));
  });

  it("should parse TJ arrays in _pdfReplaceInStream", async () => {
    // Content with TJ arrays (square brackets) to trigger lines 175-203
    const streamContent = "BT /F1 12 Tf [(A)] TJ /F2 14 Tf [(B)] TJ ET";
    const comp = await makeCompressedBytes(streamContent);
    const prefix = new TextEncoder().encode("stream\n");
    const suffix = new TextEncoder().encode("\nendstream");
    const bytes = new Uint8Array(prefix.length + comp.length + suffix.length);
    bytes.set(prefix, 0);
    bytes.set(comp, prefix.length);
    bytes.set(suffix, prefix.length + comp.length);
    const result = await buildWatermarkedPdfDoc(bytes, "AB", "A\u200BB");
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
    // Verify output differs from input (watermark was applied)
    assert.notDeepEqual(Array.from(result), Array.from(bytes));
  });

  it("should handle TJ arrays with escaped parens and nested depth", async () => {
    // TJ array with escaped parens and nested depth
    const streamContent = "BT /F1 12 Tf [(Hello\\() (World\\))] TJ ET";
    const comp = await makeCompressedBytes(streamContent);
    const prefix = new TextEncoder().encode("stream\n");
    const suffix = new TextEncoder().encode("\nendstream");
    const bytes = new Uint8Array(prefix.length + comp.length + suffix.length);
    bytes.set(prefix, 0);
    bytes.set(comp, prefix.length);
    bytes.set(suffix, prefix.length + comp.length);
    const result = await buildWatermarkedPdfDoc(
      bytes,
      "Hello( World)",
      "Hello\u200B( World)",
    );
    assert.ok(result instanceof Uint8Array);
  });

  it("should handle hex Tj strings with CID not in CMap", async () => {
    // Stream content with only hex Tj strings (no regular TJ/Tj)
    // CID 0x41 = 'A' which is NOT in the CMap forward mapping
    const streamContent = "BT /F1 12 Tf <0041> Tj ET";
    const comp = await makeCompressedBytes(streamContent);
    const prefix = new TextEncoder().encode("stream\n");
    const suffix = new TextEncoder().encode("\nendstream");
    const bytes = new Uint8Array(prefix.length + comp.length + suffix.length);
    bytes.set(prefix, 0);
    bytes.set(comp, prefix.length);
    bytes.set(suffix, prefix.length + comp.length);
    // CMap is empty so no CID mapping exists → hits else branch (line 227-228)
    const result = await buildWatermarkedPdfDoc(bytes, "A", "B");
    assert.ok(result instanceof Uint8Array);
    assert.ok(result.length > 0);
  });

  it("should handle decompression failure in outer catch block", async () => {
    // Mock DecompressionStream to throw on construction, triggering the outer catch
    var origDecompressionStream = globalThis.DecompressionStream;
    var mockCalled = false;
    globalThis.DecompressionStream = function () {
      mockCalled = true;
      throw new Error("mock decompression error");
    };
    try {
      const bytes = new TextEncoder().encode("stream\nhello\nendstream");
      const result = await buildWatermarkedPdfDoc(bytes, "orig", "wm");
      assert.ok(result instanceof Uint8Array);
      assert.ok(result.length > 0);
      assert.ok(mockCalled);
    } finally {
      globalThis.DecompressionStream = origDecompressionStream;
    }
  });
});

describe("Document Watermark PDF — _pdfBuildCMap", () => {
  it("should build empty CMap for PDF with no objects", async () => {
    const cmap = await _pdfBuildCMap("%PDF-1.4\n%%EOF");
    assert.ok(cmap);
    assert.deepEqual(cmap.forward, {});
    assert.deepEqual(cmap.reverse, {});
  });

  it("should build CMap from PDF with bfchar entries", async () => {
    const pdfObj =
      "1 0 obj\n<</Filter/FlateDecode/Length 100>>stream\n" +
      // compressed content with begincmap/bfchar
      "x\u009c\xabV\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000" +
      "\nendstream\nendobj\n";
    // Use a simpler approach: create minimal compressed data with cmap content
    const cmapContent =
      "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n" +
      "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n" +
      "/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n" +
      "1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n" +
      "2 beginbfchar\n<0101> <0041>\n<0102> <0042>\nendbfchar\n" +
      "1 beginbfrange\n<0103> <0105> <0043>\nendbfrange\n" +
      "endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend";

    // Compress the cmapContent and build a PDF object
    const comp = new Uint8Array(Buffer.from(cmapContent, "latin1"));
    const cs = new CompressionStream("deflate-raw");
    const w = cs.writable.getWriter();
    const r = cs.readable.getReader();
    await w.write(comp);
    await w.close();
    const chunks = [];
    while (true) {
      const v = await r.read();
      if (v.done) break;
      chunks.push(v.value);
    }
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const cData = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      cData.set(c, off);
      off += c.length;
    }

    let sd = "";
    for (let i = 0; i < cData.length; i++) sd += String.fromCharCode(cData[i]);

    const pdfSrc =
      "1 0 obj<</Filter/FlateDecode/Length " +
      sd.length +
      ">>stream\n" +
      sd +
      "\nendstream\nendobj\n" +
      "2 0 obj<</Filter/FlateDecode>>stream\ntoo_long_to_skip\nendstream\nendobj\n";

    const cmap = await _pdfBuildCMap(pdfSrc);
    assert.ok(cmap);
    assert.equal(cmap.forward[0x0101], 0x0041); // A
    assert.equal(cmap.forward[0x0102], 0x0042); // B
    assert.equal(cmap.forward[0x0103], 0x0043); // C (bfrange start)
    assert.equal(cmap.forward[0x0104], 0x0044); // D (bfrange mid)
    assert.equal(cmap.forward[0x0105], 0x0045); // E (bfrange end)
    assert.equal(cmap.reverse[0x0041], 0x0101); // reverse A → cid
  });

  it("should handle decompression errors gracefully", async () => {
    // Invalid compressed data
    const src =
      "1 0 obj<</Filter/FlateDecode>>stream\ninvalid!\nendstream\nendobj\n";
    const cmap = await _pdfBuildCMap(src);
    assert.ok(cmap);
    assert.deepEqual(cmap.forward, {});
  });

  it("should handle content without begincmap marker", async () => {
    // Valid deflate but no cmap content inside
    const plainText = "BT /F1 12 Tf (Hello) Tj ET";
    const enc = new TextEncoder().encode(plainText);
    const cs = new CompressionStream("deflate-raw");
    const w = cs.writable.getWriter();
    const r = cs.readable.getReader();
    await w.write(enc);
    await w.close();
    const ch = [];
    while (true) {
      const v = await r.read();
      if (v.done) break;
      ch.push(v.value);
    }
    const t = ch.reduce((a, c) => a + c.length, 0);
    const cd = new Uint8Array(t);
    let o = 0;
    for (const c of ch) {
      cd.set(c, o);
      o += c.length;
    }
    let s = "";
    for (let i = 0; i < cd.length; i++) s += String.fromCharCode(cd[i]);
    const src =
      "1 0 obj<</Filter/FlateDecode/Length " +
      s.length +
      ">>stream\n" +
      s +
      "\nendstream\nendobj\n";
    const cmap = await _pdfBuildCMap(src);
    assert.ok(cmap);
    assert.deepEqual(cmap.forward, {});
  });

  it("should handle empty stream data", async () => {
    const src = "1 0 obj<</Filter/FlateDecode>>stream\n\nendstream\nendobj\n";
    const cmap = await _pdfBuildCMap(src);
    assert.ok(cmap);
    assert.deepEqual(cmap.forward, {});
  });

  it("should skip object without FlateDecode", async () => {
    const src = "1 0 obj<</Length 100>>stream\nhello\nendstream\nendobj\n";
    const cmap = await _pdfBuildCMap(src);
    assert.ok(cmap);
  });

  it("should skip object with very large stream", async () => {
    const largeData = "x".repeat(200_000);
    const src =
      "1 0 obj<</Filter/FlateDecode>>stream\n" +
      largeData +
      "\nendstream\nendobj\n";
    const cmap = await _pdfBuildCMap(src);
    assert.ok(cmap);
  });
});

describe("Document Watermark PDF — downloadDocw", () => {
  before(() => {
    globalThis.closeDownloadModal = function () {};
    globalThis.downloadBlobSimple = function () {};
    globalThis.__ = function (key, def) {
      return def;
    };
  });

  it("should return early when no result", () => {
    const orig = globalThis._docwResult;
    globalThis._docwResult = null;
    try {
      downloadDocw("txt");
    } finally {
      globalThis._docwResult = orig;
    }
  });

  it("should download as PDF", async () => {
    globalThis._docwResult = {
      algo: "ZWC",
      message: "secret",
      watermarkedText: "wm",
      textLength: 10,
      timestamp: "t",
      hash: "h",
    };
    const orig = globalThis._docwBuildReportPdf;
    let called = false;
    globalThis._docwBuildReportPdf = async (r, mode) => {
      called = true;
      assert.equal(mode, "embed");
      return new Blob(["pdf"], { type: "application/pdf" });
    };
    try {
      await downloadDocw("pdf");
      assert.ok(called);
    } finally {
      globalThis._docwResult = null;
      globalThis._docwBuildReportPdf = orig;
    }
  });

  it("should download as DOCX", async () => {
    globalThis._docwResult = {
      algo: "ZWC",
      message: "secret",
      watermarkedText: "wm",
      textLength: 10,
      timestamp: "t",
      hash: "h",
    };
    const orig = globalThis._docwBuildReportDocx;
    let called = false;
    globalThis._docwBuildReportDocx = async (r, mode) => {
      called = true;
      assert.equal(mode, "embed");
      return new Blob(["docx"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    };
    try {
      await downloadDocw("doc");
      assert.ok(called);
    } finally {
      globalThis._docwResult = null;
      globalThis._docwBuildReportDocx = orig;
    }
  });

  it("should download as JSON", async () => {
    globalThis._docwResult = {
      algo: "ZWC",
      message: "secret",
      watermarkedText: "wm",
      textLength: 10,
      timestamp: "t",
      hash: "h",
      resultLength: 100,
    };
    try {
      await downloadDocw("json");
    } finally {
      globalThis._docwResult = null;
    }
  });

  it("should download as CSV", async () => {
    globalThis._docwResult = {
      algo: "ZWC",
      message: "test",
      watermarkedText: "wm",
      textLength: 5,
      timestamp: "t",
      hash: "h",
      resultLength: 20,
    };
    try {
      await downloadDocw("csv");
    } finally {
      globalThis._docwResult = null;
    }
  });

  it("should download as TXT", async () => {
    globalThis._docwResult = {
      algo: "ZWC",
      message: "secret",
      watermarkedText: "wm",
      textLength: 10,
      timestamp: "t",
      hash: "h",
    };
    try {
      await downloadDocw("txt");
    } finally {
      globalThis._docwResult = null;
    }
  });

  it("should download as XML", async () => {
    globalThis._docwResult = {
      algo: "ZWC",
      message: "secret",
      watermarkedText: "wm",
      textLength: 10,
      timestamp: "t",
      hash: "h",
    };
    try {
      await downloadDocw("xml");
    } finally {
      globalThis._docwResult = null;
    }
  });

  it("should download as HTML", async () => {
    globalThis._docwResult = {
      algo: "ZWC",
      message: "secret",
      watermarkedText: "wm",
      textLength: 10,
      timestamp: "t",
      hash: "h",
    };
    try {
      await downloadDocw("html");
    } finally {
      globalThis._docwResult = null;
    }
  });

  it("should skip unknown format", async () => {
    globalThis._docwResult = {
      algo: "ZWC",
      message: "secret",
      watermarkedText: "wm",
      textLength: 10,
      timestamp: "t",
      hash: "h",
    };
    try {
      await downloadDocw("unknown_format");
    } finally {
      globalThis._docwResult = null;
    }
  });
});
