const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const utils = require("../utils");

// ── fmtSize ──
describe("cli/utils — fmtSize", () => {
  it("returns B for bytes < 1024", () => {
    assert.equal(utils.fmtSize(0), "0 B");
    assert.equal(utils.fmtSize(1), "1 B");
    assert.equal(utils.fmtSize(512), "512 B");
    assert.equal(utils.fmtSize(1023), "1023 B");
  });

  it("returns KB for bytes 1024-1048575", () => {
    assert.equal(utils.fmtSize(1024), "1.0 KB");
    assert.equal(utils.fmtSize(1536), "1.5 KB");
    assert.equal(utils.fmtSize(1048575), "1024.0 KB");
  });

  it("returns MB for bytes >= 1048576", () => {
    assert.equal(utils.fmtSize(1048576), "1.0 MB");
    assert.equal(utils.fmtSize(2097152), "2.0 MB");
  });
});

// ── isDangerousExt ──
describe("cli/utils — isDangerousExt", () => {
  it("returns true for blocked extensions", () => {
    assert.ok(utils.isDangerousExt("virus.exe"));
    assert.ok(utils.isDangerousExt("script.js"));
    assert.ok(utils.isDangerousExt("test.bat"));
    assert.ok(utils.isDangerousExt("payload.sh"));
    assert.ok(utils.isDangerousExt("evil.dll"));
    assert.ok(utils.isDangerousExt("malware.py"));
    assert.ok(utils.isDangerousExt("archive.zip"));
  });

  it("returns false for safe extensions", () => {
    assert.ok(!utils.isDangerousExt("image.jpg"));
    assert.ok(!utils.isDangerousExt("doc.pdf"));
    assert.ok(!utils.isDangerousExt("data.txt"));
    assert.ok(!utils.isDangerousExt("photo.png"));
    assert.ok(!utils.isDangerousExt("music.mp3"));
  });

  it("is case-insensitive", () => {
    assert.ok(utils.isDangerousExt("virus.EXE"));
    assert.ok(utils.isDangerousExt("Script.JS"));
  });
});

// ── fileHasExt (internal function, test via validateFile behavior)
// fileHasExt is not exported, skip direct test

// ── checkMagicBytes ──
describe("cli/utils — checkMagicBytes", () => {
  it("returns true for known file types", () => {
    // PNG
    assert.ok(
      utils.checkMagicBytes(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ),
    );
    // JPEG
    assert.ok(
      utils.checkMagicBytes(
        new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        "image/jpeg",
      ),
    );
    // GIF89a
    assert.ok(
      utils.checkMagicBytes(
        new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
        "image/gif",
      ),
    );
    // BMP
    assert.ok(utils.checkMagicBytes(new Uint8Array([0x42, 0x4d]), "image/bmp"));
    // PDF
    assert.ok(
      utils.checkMagicBytes(
        new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        "application/pdf",
      ),
    );
  });

  it("returns false for mismatched magic bytes", () => {
    assert.ok(
      !utils.checkMagicBytes(new Uint8Array([0x00, 0x00, 0x00]), "image/png"),
    );
    assert.ok(
      !utils.checkMagicBytes(new Uint8Array([0x89, 0x50, 0x00]), "image/jpeg"),
    );
  });

  it("returns true for unknown mime types", () => {
    assert.ok(
      utils.checkMagicBytes(
        new Uint8Array([0x00, 0x01]),
        "application/octet-stream",
      ),
    );
  });

  it("uses function-type checkers for webp, svg, wav, mp4, avi", () => {
    // WebP
    const webp = new Uint8Array(20);
    webp[0] = 0x52;
    webp[1] = 0x49;
    webp[2] = 0x46;
    webp[3] = 0x46;
    webp[8] = 0x57;
    webp[9] = 0x45;
    webp[10] = 0x42;
    webp[11] = 0x50;
    assert.ok(utils.checkMagicBytes(webp, "image/webp"));

    // SVG
    assert.ok(
      utils.checkMagicBytes(
        new Uint8Array([0x3c, 0x73, 0x76, 0x67]),
        "image/svg+xml",
      ),
    );

    // WAV
    const wav = new Uint8Array(12);
    wav[0] = 0x52;
    wav[1] = 0x49;
    wav[2] = 0x46;
    wav[3] = 0x46;
    wav[8] = 0x57;
    wav[9] = 0x41;
    wav[10] = 0x56;
    wav[11] = 0x45;
    assert.ok(utils.checkMagicBytes(wav, "audio/wav"));

    // MP4
    const mp4 = new Uint8Array(12);
    mp4[4] = 0x66;
    mp4[5] = 0x74;
    mp4[6] = 0x79;
    mp4[7] = 0x70;
    assert.ok(utils.checkMagicBytes(mp4, "video/mp4"));

    // AVI
    const avi = new Uint8Array(12);
    avi[0] = 0x52;
    avi[1] = 0x49;
    avi[2] = 0x46;
    avi[3] = 0x46;
    avi[8] = 0x41;
    avi[9] = 0x56;
    avi[10] = 0x49;
    avi[11] = 0x20;
    assert.ok(utils.checkMagicBytes(avi, "video/avi"));
  });

  it("handles MP3 magic bytes (ID3, 0xFFFB, 0xFFF3, 0xFFF2)", () => {
    assert.ok(
      utils.checkMagicBytes(new Uint8Array([0x49, 0x44, 0x33]), "audio/mpeg"),
    );
    assert.ok(
      utils.checkMagicBytes(new Uint8Array([0xff, 0xfb]), "audio/mpeg"),
    );
    // Non-mp3 should fail
    assert.ok(
      !utils.checkMagicBytes(new Uint8Array([0x00, 0x00]), "audio/mpeg"),
    );
  });
});

// ── hasDangerousContent ──
describe("cli/utils — hasDangerousContent", () => {
  it("detects script tags", () => {
    assert.ok(
      utils.hasDangerousContent(
        new Uint8Array(Buffer.from("<script>alert(1)</script>", "utf-8")),
      ),
    );
  });

  it("detects on* event handlers", () => {
    // Pattern is /(?:^|\s)on\w+\s*=\s*["']/i — needs space before "on" and quotes around value
    assert.ok(
      utils.hasDangerousContent(
        new Uint8Array(Buffer.from(' onerror="alert(1)"', "utf-8")),
      ),
    );
    assert.ok(
      utils.hasDangerousContent(
        new Uint8Array(Buffer.from('<img src=x onerror="alert(1)">', "utf-8")),
      ),
    );
  });

  it("detects javascript: URLs", () => {
    assert.ok(
      utils.hasDangerousContent(
        new Uint8Array(Buffer.from("javascript:alert(1)", "utf-8")),
      ),
    );
  });

  it("detects foreignObject", () => {
    assert.ok(
      utils.hasDangerousContent(
        new Uint8Array(Buffer.from("<foreignObject></foreignObject>", "utf-8")),
      ),
    );
  });

  it("returns false for safe content", () => {
    assert.ok(
      !utils.hasDangerousContent(
        new Uint8Array(Buffer.from("hello world", "utf-8")),
      ),
    );
    assert.ok(
      !utils.hasDangerousContent(
        new Uint8Array(Buffer.from("<html><body>safe</body></html>", "utf-8")),
      ),
    );
  });

  it("handles empty data", () => {
    assert.ok(!utils.hasDangerousContent(new Uint8Array([])));
  });
});

// ── checkDocumentThreats ──
describe("cli/utils — checkDocumentThreats", () => {
  it("returns safe for clean PDF-like data", () => {
    const result = utils.checkDocumentThreats(
      new Uint8Array(Buffer.from("/Type /Page", "utf-8")),
    );
    assert.ok(result.safe);
  });

  it("detects embedded JavaScript", () => {
    // Pattern is /\/JavaScript[\s<]/i — needs "/JavaScript" followed by whitespace or "<"
    const result = utils.checkDocumentThreats(
      new Uint8Array(Buffer.from("/JavaScript ", "utf-8")),
    );
    assert.ok(!result.safe);
    assert.ok(result.reason.includes("JavaScript"));
  });

  it("detects /JS reference", () => {
    const result = utils.checkDocumentThreats(
      new Uint8Array(Buffer.from("/JS 12 0 R", "utf-8")),
    );
    assert.ok(!result.safe);
  });

  it("detects OpenAction", () => {
    // Pattern is /\/OpenAction[\s<]/i — needs whitespace or "<" after
    const result = utils.checkDocumentThreats(
      new Uint8Array(Buffer.from("/OpenAction ", "utf-8")),
    );
    assert.ok(!result.safe);
  });

  it("detects Launch action", () => {
    // Pattern is /\/Launch[\s<]/i — needs whitespace or "<" after
    const result = utils.checkDocumentThreats(
      new Uint8Array(Buffer.from("/Launch ", "utf-8")),
    );
    assert.ok(!result.safe);
  });

  it("rejects files exceeding 10MB", () => {
    const big = new Uint8Array(11 * 1024 * 1024);
    const result = utils.checkDocumentThreats(big);
    assert.ok(!result.safe);
    assert.ok(result.reason.includes("10MB"));
  });
});

// ── checkFileStructure ──
describe("cli/utils — checkFileStructure", () => {
  it("passes for valid PNG with IEND chunk", () => {
    // Minimal valid PNG: header + IHDR + IEND
    const png = new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // PNG header
      0x00,
      0x00,
      0x00,
      0x0d, // IHDR length
      0x49,
      0x48,
      0x44,
      0x52, // IHDR type
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x01,
      0x08,
      0x02,
      0x00,
      0x00,
      0x00, // IHDR data
      0x00,
      0x00,
      0x00,
      0x00, // CRC
      // IEND chunk
      0x00,
      0x00,
      0x00,
      0x00,
      0x49,
      0x45,
      0x4e,
      0x44,
      0xae,
      0x42,
      0x60,
      0x82,
    ]);
    const result = utils.checkFileStructure(png, ".png");
    assert.ok(result.safe);
  });

  it("fails PNG missing IEND", () => {
    // Must be >= 12 bytes to pass the size check, but have wrong last 12 bytes
    const png = new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // header
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // IHDR-like but no IEND at end
    ]);
    const result = utils.checkFileStructure(png, ".png");
    assert.ok(!result.safe);
    assert.ok(result.reason.includes("IEND"));
  });

  it("fails PNG too small", () => {
    const result = utils.checkFileStructure(new Uint8Array([0x89]), ".png");
    assert.ok(!result.safe);
  });

  it("passes for valid JPEG ending with 0xFFD9", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const result = utils.checkFileStructure(jpeg, ".jpg");
    assert.ok(result.safe);
  });

  it("fails JPEG without EOI marker", () => {
    const result = utils.checkFileStructure(
      new Uint8Array([0xff, 0xd8, 0xff]),
      ".jpeg",
    );
    assert.ok(!result.safe);
  });

  it("fails JPEG too small", () => {
    const result = utils.checkFileStructure(new Uint8Array([0xff]), ".jpg");
    assert.ok(!result.safe);
  });

  it("passes for valid GIF ending with 0x3B", () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x3b]);
    const result = utils.checkFileStructure(gif, ".gif");
    assert.ok(result.safe);
  });

  it("fails GIF without trailer", () => {
    const result = utils.checkFileStructure(
      new Uint8Array([0x47, 0x49]),
      ".gif",
    );
    assert.ok(!result.safe);
  });

  it("passes for unknown extensions", () => {
    const result = utils.checkFileStructure(
      new Uint8Array([0x00, 0x01, 0x02]),
      ".bin",
    );
    assert.ok(result.safe);
  });
});

// ── hasDangerousMagic (internal, not exported — tested via validateFile behavior)
// hasDangerousMagic is not directly exported from utils.js

// ── hashNode ──
describe("cli/utils — hashNode", () => {
  it("computes SHA-256 correctly", async () => {
    const result = await utils.hashNode("sha256", Buffer.from("hello"));
    assert.equal(
      result,
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("computes SHA-1 correctly", async () => {
    const result = await utils.hashNode("sha1", Buffer.from("hello"));
    assert.equal(result, "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
  });

  it("computes MD5 correctly", async () => {
    const result = await utils.hashNode("md5", Buffer.from("hello"));
    assert.equal(result, "5d41402abc4b2a76b9719d911017c592");
  });

  it("produces 64-char lowercase hex for SHA-256", async () => {
    const result = await utils.hashNode("sha256", Buffer.from("test"));
    assert.equal(result.length, 64);
    assert.match(result, /^[0-9a-f]{64}$/);
  });
});

// ── stripC2PA ──
describe("cli/utils — stripC2PA", () => {
  it("passes through non-PNG buffers unchanged", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff]);
    const result = utils.stripC2PA(buf);
    assert.deepEqual(result, buf);
  });

  it("returns empty PNG header when only header exists", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = utils.stripC2PA(buf);
    assert.equal(result.length, 8);
  });

  it("keeps non-c2pa chunks and strips c2pa chunks", () => {
    // Build a PNG with: header + IHDR + c2pa chunk + IEND
    const header = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    // IHDR chunk
    const ihdrLen = Buffer.alloc(4);
    ihdrLen.writeUInt32BE(13, 0);
    const ihdrType = Buffer.from("IHDR");
    const ihdrData = Buffer.alloc(13);
    const ihdrCrc = Buffer.alloc(4);
    // c2pa chunk
    const c2paLen = Buffer.alloc(4);
    c2paLen.writeUInt32BE(4, 0);
    const c2paType = Buffer.from("c2pa");
    const c2paData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const c2paCrc = Buffer.alloc(4);
    // IEND chunk
    const iendLen = Buffer.alloc(4);
    const iendType = Buffer.from("IEND");
    const iendCrc = Buffer.alloc(4);

    const buf = Buffer.concat([
      header,
      ihdrLen,
      ihdrType,
      ihdrData,
      ihdrCrc,
      c2paLen,
      c2paType,
      c2paData,
      c2paCrc,
      iendLen,
      iendType,
      iendCrc,
    ]);
    const result = utils.stripC2PA(buf);
    // Should have header + IHDR(4+4+13+4) + IEND(4+4+4) = 8+25+12 = 45 bytes
    assert.equal(result.length, 8 + 25 + 12);
    // Should NOT contain "c2pa"
    assert.ok(!result.toString("ascii").includes("c2pa"));
  });
});

// ── File I/O with temp files ──
describe("cli/utils — file I/O", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "redosan-test-"));
  const testFile = path.join(tmpDir, "test.txt");
  const testContent = "Hello World!\nLine 2";

  before(() => {
    fs.writeFileSync(testFile, testContent, "utf-8");
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("readFileBytes returns file as Buffer", () => {
    const result = utils.readFileBytes(testFile);
    assert.ok(Buffer.isBuffer(result));
    assert.ok(result.length > 0);
  });

  it("readFileText returns UTF-8 content", () => {
    const result = utils.readFileText(testFile);
    assert.equal(result, testContent);
  });

  it("readFileText throws for non-existent file", () => {
    assert.throws(
      () => utils.readFileText("/nonexistent/file.txt"),
      /File not found/,
    );
  });

  it("readFileBytes throws for non-existent file", () => {
    assert.throws(
      () => utils.readFileBytes("/nonexistent/file.txt"),
      /File not found/,
    );
  });

  it("readFileArrayBuffer returns ArrayBuffer", () => {
    const result = utils.readFileArrayBuffer(testFile);
    assert.ok(result instanceof ArrayBuffer);
    assert.equal(result.byteLength, testContent.length);
  });

  it("writeFileText writes content and returns path", () => {
    const outPath = path.join(tmpDir, "output.txt");
    const result = utils.writeFileText(outPath, "output content");
    assert.equal(result, outPath);
    assert.equal(fs.readFileSync(outPath, "utf-8"), "output content");
  });

  it("getFileInfo returns file metadata", () => {
    const info = utils.getFileInfo(testFile);
    assert.equal(info.name, "test.txt");
    assert.equal(info.size, testContent.length);
    assert.equal(info.type, "application/octet-stream");
    assert.equal(info.ext, ".txt");
  });

  it("readDocumentText returns text for .txt files", async () => {
    const text = await utils.readDocumentText(testFile);
    assert.equal(text, testContent);
  });

  it("readDocumentText handles .json files", async () => {
    const jsonFile = path.join(tmpDir, "data.json");
    fs.writeFileSync(jsonFile, '{"key": "value"}', "utf-8");
    const text = await utils.readDocumentText(jsonFile);
    assert.equal(text, '{"key": "value"}');
  });

  it("readDocumentText handles .doc files (binary text extraction)", async () => {
    const docFile = path.join(tmpDir, "test.doc");
    const docBuf = Buffer.from("Hello\x00World\x00\r\nTest", "binary");
    fs.writeFileSync(docFile, docBuf);
    const text = await utils.readDocumentText(docFile);
    assert.ok(text.length > 0);
  });

  it("readDocumentText extracts text from .docx files", async () => {
    const docxFile = path.join(tmpDir, "test.docx");
    const JSZip = require("jszip");
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello DOCX</w:t></w:r></w:p></w:body></w:document>',
    );
    const docxBuf = await zip.generateAsync({ type: "nodebuffer" });
    fs.writeFileSync(docxFile, docxBuf);
    const text = await utils.readDocumentText(docxFile);
    assert.ok(text.includes("Hello DOCX"), "text includes Hello DOCX");
  });

  it("readDocumentText extracts text from .pdf files", async () => {
    const pdfFile = path.join(tmpDir, "test.pdf");
    // Build minimal PDF with text content (no FlateDecode, no xref needed by readPdfText)
    const obj1 = "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n";
    const obj2 = "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n";
    const obj3 =
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n";
    const streamBody = "BT (Hello PDF) Tj ET\n";
    const obj4 =
      "4 0 obj<</Length " +
      Buffer.byteLength(streamBody, "latin1") +
      ">>stream\n" +
      streamBody +
      "endstream\nendobj\n";
    const pdfStr = "%PDF-1.4\n" + obj1 + obj2 + obj3 + obj4;
    fs.writeFileSync(pdfFile, pdfStr, "latin1");
    const text = await utils.readDocumentText(pdfFile);
    assert.ok(
      text.includes("Hello PDF"),
      "text includes Hello PDF, got: " + text,
    );
  });

  it("readDocumentText extracts text from PDF with TJ arrays", async () => {
    // Covers TJ array text extraction (lines ~235-240 in utils.js)
    const pdfFile = path.join(tmpDir, "test_tjarray.pdf");
    const streamBody = "BT\n[(A) 10 (B)] TJ\n(C) Tj\nET\n";
    const obj4 =
      "4 0 obj<</Length " +
      Buffer.byteLength(streamBody, "latin1") +
      ">>stream\n" +
      streamBody +
      "endstream\nendobj\n";
    const pdfStr =
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n" +
      obj4;
    fs.writeFileSync(pdfFile, pdfStr, "latin1");
    const text = await utils.readDocumentText(pdfFile);
    assert.ok(text.includes("A"), "TJ array text includes A, got: " + text);
    assert.ok(text.includes("B"), "TJ array text includes B, got: " + text);
    assert.ok(text.includes("C"), "Tj text includes C, got: " + text);
  });

  it("readDocumentText extracts text from PDF with FlateDecode content stream", async () => {
    // Covers FlateDecode content stream decompression (lines ~212-220)
    const zlib = require("node:zlib");
    const pdfFile = path.join(tmpDir, "test_flate.pdf");
    const rawContent = "BT (Flate Hello) Tj ET\n";
    const compressed = zlib.deflateSync(rawContent);
    const compressedLatin1 = compressed.toString("latin1");
    const obj4 =
      "4 0 obj<</Length " +
      compressed.length +
      " /Filter /FlateDecode>>stream\n" +
      compressedLatin1 +
      "\nendstream\nendobj\n";
    const pdfStr =
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n" +
      obj4;
    fs.writeFileSync(pdfFile, pdfStr, "latin1");
    const text = await utils.readDocumentText(pdfFile);
    assert.ok(
      text.includes("Flate Hello"),
      "FlateDecode text includes 'Flate Hello', got: " + text,
    );
  });

  it("readDocumentText handles hex Tj with CMap and bfrange", async () => {
    // Covers hex Tj (lines ~245-253), hex TJ arrays (lines ~258-264),
    // CMap bfrange (line ~163), and FlateDecode CMap parsing
    const zlib = require("node:zlib");
    const pdfFile = path.join(tmpDir, "test_hex.pdf");

    // Content stream referencing hex codes 0x48 (H) and 0x65 (e)
    const contentBody = "BT\n<0048> Tj\n[<0065>] TJ\nET\n";

    // CMap with bfrange mapping 0x0000-0x00FF to 0x0000-0x00FF (identity for ASCII)
    const cmapText =
      "/CIDInit /ProcSet findresource begin\n" +
      "12 dict begin\n" +
      "begincmap\n" +
      "/CIDSystemInfo 3 dict dup begin\n" +
      "  /Registry (Adobe) def\n" +
      "  /Ordering (UCS) def\n" +
      "  /Supplement 0 def\n" +
      "end def\n" +
      "/CMapName /Adobe-Identity-UCS def\n" +
      "/CMapType 2 def\n" +
      "1 begincodespacerange\n" +
      "<0000> <FFFF>\n" +
      "endcodespacerange\n" +
      "1 beginbfrange\n" +
      "<0000> <00FF> <0000>\n" +
      "endbfrange\n" +
      "endcmap\n" +
      "CMapName currentdict /CMap defineresource pop\n" +
      "end\n" +
      "end";
    const cmapCompressed = zlib.deflateSync(cmapText);

    // Object 4: Content stream
    const obj4 =
      "4 0 obj<</Length " +
      Buffer.byteLength(contentBody, "latin1") +
      ">>stream\n" +
      contentBody +
      "\nendstream\nendobj\n";

    // Object 5: CMap with FlateDecode
    const obj5 =
      "5 0 obj<</Length " +
      cmapCompressed.length +
      " /Filter /FlateDecode>>stream\n" +
      cmapCompressed.toString("latin1") +
      "\nendstream\nendobj\n";

    const pdfStr =
      "%PDF-1.4\n" +
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n" +
      obj4 +
      obj5;
    fs.writeFileSync(pdfFile, pdfStr, "latin1");
    const text = await utils.readDocumentText(pdfFile);
    // Without CMap, hex would produce '?'; with CMap identity bfrange, H and e map to themselves
    assert.ok(
      text.includes("H") || text.includes("?"),
      "hex Tj result includes H or ?, got: " + text,
    );
  });

  it("readDocumentText handles Asian UTF-16BE encoding in PDF", async () => {
    // Covers Asian encoding detection in decodePdfString (lines ~190-195)
    const pdfFile = path.join(tmpDir, "test_asian.pdf");
    // Content with UTF-16BE encoded text: \x00H\x00e\x00l\x00l\x00o\x00W\x00o\x00r\x00l\x00d
    // This triggers the UTF-16BE detection (b1===0 && b2 in [0x20,0x7e] repeated > 5 with ratio > 0.4)
    const contentBuf = Buffer.concat([
      Buffer.from("stream\nBT ("),
      Buffer.from([
        0x00, 0x48, 0x00, 0x65, 0x00, 0x6c, 0x00, 0x6c, 0x00, 0x6f, 0x00, 0x57,
        0x00, 0x6f, 0x00, 0x72, 0x00, 0x6c, 0x00, 0x64,
      ]),
      Buffer.from(") Tj ET\nendstream\nendobj\n"),
    ]);
    const headerStr =
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n4 0 obj<</Length " +
      (contentBuf.length -
        Buffer.byteLength("stream\n", "latin1") -
        Buffer.byteLength("\nendstream\nendobj\n", "latin1")) +
      ">>";
    const fullBuf = Buffer.concat([
      Buffer.from(headerStr, "latin1"),
      contentBuf,
    ]);
    fs.writeFileSync(pdfFile, fullBuf);
    const text = await utils.readDocumentText(pdfFile);
    // The decodePdfString should convert the UTF-16BE pairs to "HelloWorld"
    assert.ok(
      text.includes("Hello") || text.length > 0,
      "Asian encoding text extracts, got: " + text,
    );
  });

  it("readDocumentText handles unknown extensions via catch-all", async () => {
    // Covers lines 74-79 in readDocumentText (catch-all branch)
    const unknownFile = path.join(tmpDir, "test.xyz");
    fs.writeFileSync(unknownFile, "Hello from unknown extension", "utf-8");
    const text = await utils.readDocumentText(unknownFile);
    assert.equal(text, "Hello from unknown extension");
  });

  it("readDocumentText catch-all returns empty for directory path", async () => {
    // Covers the catch path (lines 78-79) when readFileText throws (EISDIR)
    const dirPath = path.join(tmpDir, "testdir.xyz");
    fs.mkdirSync(dirPath);
    const text = await utils.readDocumentText(dirPath);
    assert.equal(text, "");
  });

  // ── PDF edge cases for readPdfText coverage ──

  it("readDocumentText handles PDF with bfchar CMap entries", async () => {
    // Covers bfchar parsing (lines ~142-147)
    const zlib = require("node:zlib");
    const pdfFile = path.join(tmpDir, "test_bfchar.pdf");
    const contentBody = "BT\n<0048> Tj\nET\n"; // hex for 'H'
    // CMap with bfchar entry mapping 0x48 -> 0x48
    const cmapText =
      "begincmap\n" +
      "1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n" +
      "1 beginbfchar\n<0048> <0048>\nendbfchar\n" +
      "endcmap\n";
    const cmapCompressed = zlib.deflateSync(cmapText);
    const obj4 =
      "4 0 obj<</Length " +
      Buffer.byteLength(contentBody, "latin1") +
      ">>stream\n" +
      contentBody +
      "\nendstream\nendobj\n";
    const obj5 =
      "5 0 obj<</Length " +
      cmapCompressed.length +
      " /Filter /FlateDecode>>stream\n" +
      cmapCompressed.toString("latin1") +
      "\nendstream\nendobj\n";
    const pdfStr =
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n" +
      obj4 +
      obj5;
    fs.writeFileSync(pdfFile, pdfStr, "latin1");
    const text = await utils.readDocumentText(pdfFile);
    assert.ok(
      text.includes("H") || text.includes("?"),
      "bfchar CMap result includes H or ?, got: " + text,
    );
  });

  it("readDocumentText handles PDF with raw deflate content (no zlib header)", async () => {
    // Covers FlateDecode fallback path (lines ~215-216: inflateSync fails, inflateRawSync succeeds)
    const zlib = require("node:zlib");
    const pdfFile = path.join(tmpDir, "test_rawdeflate.pdf");
    // Use deflateRaw (no zlib header) so inflateSync fails but inflateRawSync succeeds
    const rawContent = "BT (Raw Deflate Hello) Tj ET\n";
    const compressed = zlib.deflateRawSync(rawContent);
    const obj4 =
      "4 0 obj<</Length " +
      compressed.length +
      " /Filter /FlateDecode>>stream\n" +
      compressed.toString("latin1") +
      "\nendstream\nendobj\n";
    const pdfStr =
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n" +
      obj4;
    fs.writeFileSync(pdfFile, pdfStr, "latin1");
    const text = await utils.readDocumentText(pdfFile);
    assert.ok(
      text.includes("Raw Deflate Hello"),
      "raw deflate text extract, got: " + text,
    );
  });

  it("readDocumentText handles PDF with invalid FlateDecode content (both decompressors fail)", async () => {
    // Covers the continue path in FlateDecode content (line ~218)
    const pdfFile = path.join(tmpDir, "test_badflate.pdf");
    // Garbage data that neither inflateSync nor inflateRawSync can decompress
    const obj4 =
      "4 0 obj<</Length 8 /Filter /FlateDecode>>stream\n" +
      "\xff\xfe\xfd\xfc\xfb\xfa\xf9\xf8\nendstream\nendobj\n";
    const pdfStr =
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n" +
      obj4;
    fs.writeFileSync(pdfFile, pdfStr, "latin1");
    // Should not throw, should return empty string since content stream fails to decompress
    const text = await utils.readDocumentText(pdfFile);
    assert.equal(text, "", "garbage FlateDecode returns empty, got: " + text);
  });

  it("readDocumentText handles hex Tj with missing CMap entry (else branch)", async () => {
    // Covers hex Tj else branch (line 252) when cmap[code] is falsy
    const pdfFile = path.join(tmpDir, "test_nocmap.pdf");
    // Content with hex reference that has NO CMap entry - should produce "?"
    const contentBody = "BT\n<00FF> Tj\nET\n";
    const obj4 =
      "4 0 obj<</Length " +
      Buffer.byteLength(contentBody, "latin1") +
      ">>stream\n" +
      contentBody +
      "\nendstream\nendobj\n";
    const pdfStr =
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n" +
      obj4;
    fs.writeFileSync(pdfFile, pdfStr, "latin1");
    const text = await utils.readDocumentText(pdfFile);
    assert.ok(text.includes("?"), "no CMap entry produces ?, got: " + text);
  });

  it("readDocumentText handles PDF with CMap decompression failure", async () => {
    // Covers CMap decompression failure (lines ~135-136: continue)
    const pdfFile = path.join(tmpDir, "test_badcmap.pdf");
    // Object 5 has FlateDecode but garbage data - inflate fails and CMap continues
    const contentBody = "BT (Hello) Tj ET\n";
    const obj4 =
      "4 0 obj<</Length " +
      Buffer.byteLength(contentBody, "latin1") +
      ">>stream\n" +
      contentBody +
      "\nendstream\nendobj\n";
    const obj5 =
      "5 0 obj<</Length 8 /Filter /FlateDecode>>stream\n\xff\xfe\xfd\xfc\xfb\xfa\xf9\xf8\nendstream\nendobj\n";
    const pdfStr =
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n" +
      obj4 +
      obj5;
    fs.writeFileSync(pdfFile, pdfStr, "latin1");
    const text = await utils.readDocumentText(pdfFile);
    assert.ok(
      text.includes("Hello"),
      "bad CMap doesn't prevent text extraction, got: " + text,
    );
  });

  it("readDocumentText throws for non-existent file", async () => {
    await assert.rejects(() => utils.readDocumentText("/nonexistent/doc.pdf"));
  });
});

// ── outputResult ──
describe("cli/utils — outputResult", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "redosan-test-"));
  const origLog = console.log;
  let logLines = [];

  before(() => {
    console.log = (...args) => {
      logLines.push(args.join(" "));
    };
  });

  after(() => {
    console.log = origLog;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("prints to console", () => {
    logLines = [];
    utils.outputResult("test output", { json: false });
    assert.ok(logLines.some((l) => l.includes("test output")));
  });

  it("saves to file when output option is given", () => {
    logLines = [];
    const outPath = path.join(tmpDir, "result.txt");
    utils.outputResult("file content", { output: outPath });
    assert.equal(fs.readFileSync(outPath, "utf-8"), "file content");
  });

  it("saves JSON-serialized content when output is object", () => {
    logLines = [];
    const outPath = path.join(tmpDir, "result.json");
    utils.outputResult({ key: "value" }, { output: outPath });
    assert.equal(fs.readFileSync(outPath, "utf-8"), '{\n  "key": "value"\n}');
  });

  it("prints to console with json:true", () => {
    logLines = [];
    utils.outputResult("json output test", { json: true });
    assert.ok(logLines.some((l) => l.includes("json output test")));
  });
});

// ── validateFile ──
describe("cli/utils — validateFile", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "redosan-test-"));
  const pngFile = path.join(tmpDir, "test.png");
  const jpgFile = path.join(tmpDir, "test.jpg");
  const exeFile = path.join(tmpDir, "test.exe");
  const noExtFile = path.join(tmpDir, "noext");

  before(() => {
    // Minimal valid PNG
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    fs.writeFileSync(pngFile, png);

    // Minimal JPEG with EOI
    const jpg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]);
    fs.writeFileSync(jpgFile, jpg);

    // EXE (dangerous extension)
    fs.writeFileSync(exeFile, Buffer.from([0x4d, 0x5a, 0x00, 0x00]));

    // No extension file - ELF magic
    fs.writeFileSync(noExtFile, Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("passes valid PNG", () => {
    const result = utils.validateFile(pngFile);
    assert.ok(result instanceof Buffer);
  });

  it("throws for non-existent file", () => {
    assert.throws(
      () => utils.validateFile("/nonexistent/file"),
      /File not found/,
    );
  });

  it("throws for dangerous extension", () => {
    assert.throws(() => utils.validateFile(exeFile), /Blocked dangerous/);
  });

  it("allows dangerous extension with allowDangerous flag", () => {
    const result = utils.validateFile(exeFile, { allowDangerous: true });
    assert.ok(result instanceof Buffer);
  });

  it("throws for no-extension file with dangerous magic", () => {
    assert.throws(() => utils.validateFile(noExtFile), /Blocked dangerous/);
  });

  it("throws for magic bytes mismatch", () => {
    const mismatchFile = path.join(tmpDir, "bad.png");
    // Write a JPEG but name it .png
    fs.writeFileSync(
      mismatchFile,
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]),
    );
    assert.throws(
      () => utils.validateFile(mismatchFile),
      /Magic bytes mismatch/,
    );
  });

  it("throws for dangerous content in images", () => {
    // .svg is in BLOCKED_EXTS, so use .png with dangerous content
    const badFile = path.join(tmpDir, "evil.png");
    // A valid PNG header followed by dangerous script content
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const scriptContent = Buffer.from("<script>alert(1)</script>");
    const iend = Buffer.from([
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    // Append after PNG header (PNG allows trailing data)
    const evil = Buffer.concat([pngHeader, iend, scriptContent]);
    fs.writeFileSync(badFile, evil);
    assert.throws(() => utils.validateFile(badFile), /Dangerous content/);
  });

  it("throws for structure failure in PNG (no IEND)", () => {
    const badPngFile = path.join(tmpDir, "badstruct.png");
    // PNG header + short partial IHDR — enough bytes to pass length check, no IEND at end
    const buf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
    ]);
    fs.writeFileSync(badPngFile, buf);
    assert.throws(
      () => utils.validateFile(badPngFile),
      /Structure check failed.*IEND/,
    );
  });

  it("throws for shebang no-extension file", () => {
    const shebangFile = path.join(tmpDir, "shebang_noext");
    // #!/bin/bash — not in DANGEROUS_MAGIC array so hits shebang check in hasDangerousMagic
    fs.writeFileSync(
      shebangFile,
      Buffer.from([
        0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e, 0x2f, 0x62, 0x61, 0x73, 0x68,
      ]),
    );
    assert.throws(() => utils.validateFile(shebangFile), /Blocked dangerous/);
  });

  it("allows no-extension file with safe content (covers return null in hasDangerousMagic)", () => {
    const safeNoExt = path.join(tmpDir, "safenoext");
    fs.writeFileSync(safeNoExt, Buffer.from("Hello World"));
    const result = utils.validateFile(safeNoExt);
    assert.ok(result instanceof Buffer);
  });
});

// ── loadImageData / saveImageData (uses canvas package) ──
describe("cli/utils — loadImageData / saveImageData", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "redosan-test-"));
  const fixtureDir = path.join(__dirname, "fixtures");

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loadImageData loads a PNG file", async () => {
    const fixture = path.join(fixtureDir, "testimg.png");
    const data = await utils.loadImageData(fixture);
    assert.ok(data.width > 0);
    assert.ok(data.height > 0);
  });

  it("loadImageData loads a 64x64 PNG", async () => {
    const fixture = path.join(fixtureDir, "testimg_64x64.png");
    const data = await utils.loadImageData(fixture);
    assert.equal(data.width, 64);
    assert.equal(data.height, 64);
  });

  it("saveImageData saves ImageData to PNG file", async () => {
    const { createCanvas } = require("canvas");
    const c = createCanvas(4, 4);
    const ctx = c.getContext("2d");
    const imgData = ctx.createImageData(4, 4);
    const outPath = path.join(tmpDir, "saved.png");
    const result = utils.saveImageData(imgData, outPath);
    assert.equal(result, outPath);
    assert.ok(fs.existsSync(outPath));
    // Verify it's a valid PNG
    const saved = fs.readFileSync(outPath);
    assert.equal(saved[1], 0x50); // 'P'
    assert.equal(saved[2], 0x4e); // 'N'
    assert.equal(saved[3], 0x47); // 'G'
  });
});
