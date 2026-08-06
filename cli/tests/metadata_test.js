const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };

globalThis.loadImage = async (file) => {
  const buf = await file.arrayBuffer();
  return { w: 100, h: 50 };
};

const src = fs.readFileSync(path.join(__dirname, "../../Metadata/metadata.js"), "utf8");
vm.runInThisContext(src, { filename: path.resolve(__dirname, "../../Metadata/metadata.js") });

// ── Hardcoded minimal JPEG with EXIF for Make="TestMaker" ──
// Calculated:
//   SOI(2) + APP1_marker(2) + segLen(2) + ExifHdr(6) + TIFF(36) + SOS(9) + EOI(2) = 59 bytes
//   segLen = 2 + 6 + 36 = 44 = 0x002C
const JPEG_WITH_EXIF = new Uint8Array([
  0xff,
  0xd8, // SOI
  0xff,
  0xe1, // APP1 marker
  0x00,
  0x2c, // segment length = 44
  0x45,
  0x78,
  0x69,
  0x66,
  0x00,
  0x00, // "Exif\0\0"
  // TIFF Little-Endian (36 bytes)
  0x49,
  0x49, // endian
  0x2a,
  0x00, // magic 42
  0x08,
  0x00,
  0x00,
  0x00, // IFD0 offset = 8
  // IFD0 (2 + 12 + 4 = 18 bytes)
  0x01,
  0x00, // 1 entry
  // Entry: Make (0x010F), type 2 (ASCII), count 10, data at offset 26 (0x1A)
  0x0f,
  0x01, // tag 0x010F
  0x02,
  0x00, // type ASCII
  0x0a,
  0x00,
  0x00,
  0x00, // count = 10 ("TestMaker\0")
  0x1a,
  0x00,
  0x00,
  0x00, // data offset = 26
  // Next IFD pointer
  0x00,
  0x00,
  0x00,
  0x00,
  // String data at TIFF offset 26
  0x54,
  0x65,
  0x73,
  0x74,
  0x4d,
  0x61,
  0x6b,
  0x65,
  0x72,
  0x00, // "TestMaker\0"
  // SOS + EOI
  0xff,
  0xda,
  0x00,
  0x08,
  0x01,
  0x00,
  0x00,
  0x3f,
  0x00,
  0xff,
  0xd9,
]);

describe("Metadata — parseJPEGExif", () => {
  it("should parse EXIF Make tag from hardcoded JPEG", () => {
    const exif = parseJPEGExif(JPEG_WITH_EXIF);
    assert.ok(exif);
    assert.equal(exif.Make, "TestMaker");
  });

  it("should return empty object for non-JPEG data", () => {
    const data = new Uint8Array([0xff, 0xd8, 0x89, 0x50, 0x4e, 0x47, 0xff, 0xd9]);
    const exif = parseJPEGExif(data);
    assert.deepEqual(exif, {});
  });

  it("should return empty object for JPEG without APP1", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xd9]);
    const exif = parseJPEGExif(jpeg);
    assert.deepEqual(exif, {});
  });

  it("should handle JPEG with APP1 but no Exif header", () => {
    const arr = [0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x4e, 0x6f, 0x74, 0x45, 0x78, 0x69, 0x66, 0x00, 0xff, 0xd9];
    const exif = parseJPEGExif(new Uint8Array(arr));
    assert.deepEqual(exif, {});
  });

  it("should return empty object for very short data", () => {
    const exif = parseJPEGExif(new Uint8Array([0xff, 0xd8]));
    assert.deepEqual(exif, {});
  });
});

describe("Metadata — readMetadata (with loadImage stub)", () => {
  function makeFile(name, content) {
    const blob = new Blob([content], { type: "image/jpeg" });
    Object.defineProperty(blob, "name", { value: name });
    return blob;
  }

  it("should return basic file info for minimal JPEG", async () => {
    const file = makeFile("test.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
    const result = await readMetadata(file);
    assert.equal(result.file, "test.jpg");
    assert.ok(result.size > 0);
    assert.ok(result.sha256);
    assert.ok(result.image);
    assert.equal(result.image.width, 100);
    assert.equal(result.image.height, 50);
  });

  it("should parse EXIF from hardcoded JPEG via readMetadata", async () => {
    const file = makeFile("photo.jpg", JPEG_WITH_EXIF);
    const result = await readMetadata(file);
    assert.ok(result.exif, "EXIF should be parsed: " + JSON.stringify(result));
    assert.equal(result.exif.Make, "TestMaker");
  });

  it("should set error when loadImage fails", async () => {
    const orig = globalThis.loadImage;
    globalThis.loadImage = async () => {
      throw new Error("Image load failed");
    };
    try {
      const file = makeFile("bad.jpg", new Uint8Array(10));
      const result = await readMetadata(file);
      assert.ok(result.error);
      assert.ok(result.error.includes("failed"));
    } finally {
      globalThis.loadImage = orig;
    }
  });
});

// ── Setup for format converter tests ──
var _capturedBlobs = [];
var _capturedNames = [];
globalThis.downloadBlobSimple = (blob, name) => {
  _capturedBlobs.push(blob);
  _capturedNames.push(name);
};
globalThis.closeDownloadModal = () => {};
globalThis.showDownloadModal = () => {};
globalThis.getResult = (k) => globalThis._resultStore[k];
globalThis.setResult = (k, d) => { globalThis._resultStore[k] = d; };
globalThis._resultStore = {};
globalThis.escHtml = (s) => { if (s == null) return ""; return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
globalThis.jspdf = {
  jsPDF: class {
    constructor() { this._pages = 1; this._y = 20; }
    setFontSize(s) { this._fs = s; }
    setTextColor(r, g, b) { this._tc = [r, g, b]; }
    text(t, x, y) { this._y = y + 6; }
    addPage() { this._pages++; this._y = 20; }
    output(format) { return new Blob(["mock pdf"], { type: "application/pdf" }); }
  },
};
globalThis.docx = {
  Paragraph: class { constructor(opts) { this.opts = opts; } },
  TextRun: class { constructor(opts) { this.opts = opts; } },
  Document: class { constructor(opts) { this.opts = opts; this.sections = opts.sections; } },
  Packer: { toBlob: async (doc) => new Blob(["mock docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }) },
};

var mdResult = {
  file: "photo.jpg",
  size: 102400,
  sha256: "abcdef1234567890",
  image: { width: 640, height: 480, mode: "RGBA", format: "JPEG" },
  exif: { Make: "TestMaker", Model: "TestModel" },
};

const { beforeEach } = require("node:test");

describe("Metadata — _xmlEsc", () => {
  it("should escape XML special characters", () => {
    assert.equal(_xmlEsc("<test>"), "&lt;test&gt;");
    assert.equal(_xmlEsc('a&b "c"'), "a&amp;b &quot;c&quot;");
    assert.equal(_xmlEsc("normal text"), "normal text");
  });

  it("should handle null/undefined", () => {
    assert.equal(_xmlEsc(null), "");
    assert.equal(_xmlEsc(undefined), "");
  });
});

describe("Metadata — mdToCSV", () => {
  it("should produce CSV with headers and values", () => {
    var csv = mdToCSV(mdResult);
    assert.ok(csv.includes("Property,Value"));
    assert.ok(csv.includes("photo.jpg"));
    assert.ok(csv.includes("100.0")); // 102400/1024
    assert.ok(csv.includes("TestMaker"));
  });

  it("should handle result without image/exif", () => {
    var csv = mdToCSV({ file: "test.txt", size: 512, sha256: "abc" });
    assert.ok(csv.includes("test.txt"));
    assert.ok(!csv.includes("Dimensions"));
  });
});

describe("Metadata — mdToTXT", () => {
  it("should produce formatted text output", () => {
    var txt = mdToTXT(mdResult);
    assert.ok(txt.includes("File: photo.jpg"));
    assert.ok(txt.includes("Make: TestMaker"));
  });

  it("should handle result without image/exif", () => {
    var txt = mdToTXT({ file: "test.txt", size: 512, sha256: "abc" });
    assert.ok(txt.includes("File: test.txt"));
  });
});

describe("Metadata — mdToXML", () => {
  it("should produce valid XML with all fields", () => {
    var xml = mdToXML(mdResult);
    assert.ok(xml.includes("<?xml version"));
    assert.ok(xml.includes("<file>photo.jpg</file>"));
    assert.ok(xml.includes("<sha256>abcdef1234567890</sha256>"));
    assert.ok(xml.includes('<tag name="Make">TestMaker</tag>'));
    assert.ok(xml.includes("<dimensions>640 x 480</dimensions>"));
  });

  it("should handle result without image/exif", () => {
    var xml = mdToXML({ file: "test.txt", size: 512, sha256: "abc" });
    assert.ok(xml.includes("<file>test.txt</file>"));
    assert.ok(!xml.includes("<image>"));
    assert.ok(!xml.includes("<exif>"));
  });
});

describe("Metadata — mdToHTML", () => {
  it("should produce HTML document with all fields", () => {
    var html = mdToHTML(mdResult);
    assert.ok(html.includes("<!doctype html>"));
    assert.ok(html.includes("<h1>Metadata Report</h1>"));
    assert.ok(html.includes("photo.jpg"));
    assert.ok(html.includes("TestMaker"));
  });

  it("should handle result without image/exif", () => {
    var html = mdToHTML({ file: "test.txt", size: 512, sha256: "abc" });
    assert.ok(html.includes("test.txt"));
    assert.ok(!html.includes("Dimensions"));
  });
});

describe("Metadata — mdToPDF", () => {
  it("should produce a PDF blob", () => {
    _capturedBlobs = [];
    _capturedNames = [];
    mdToPDF(mdResult, "photo");
    assert.equal(_capturedBlobs.length, 1);
    assert.ok(_capturedNames[0].endsWith(".metadata.pdf"));
  });

  it("should handle result without image/exif", () => {
    _capturedBlobs = [];
    _capturedNames = [];
    mdToPDF({ file: "test.txt", size: 512, sha256: "abc" }, "test");
    assert.equal(_capturedBlobs.length, 1);
  });
});

describe("Metadata — mdToDOCX", () => {
  it("should produce a DOCX blob", async () => {
    _capturedBlobs = [];
    _capturedNames = [];
    await mdToDOCX(mdResult, "photo");
    assert.equal(_capturedBlobs.length, 1);
    assert.ok(_capturedNames[0].endsWith(".metadata.docx"));
  });

  it("should handle result without image/exif", async () => {
    _capturedBlobs = [];
    _capturedNames = [];
    await mdToDOCX({ file: "test.txt", size: 512, sha256: "abc" }, "test");
    assert.equal(_capturedBlobs.length, 1);
  });
});

describe("Metadata — downloadMetadata", () => {
  beforeEach(() => {
    _capturedBlobs = [];
    _capturedNames = [];
    globalThis._resultStore.mdResult = mdResult;
  });

  it("should generate JSON download", () => {
    downloadMetadata("json");
    assert.equal(_capturedBlobs.length, 1);
    assert.ok(_capturedNames[0].endsWith(".metadata.json"));
  });

  it("should generate CSV download", () => {
    downloadMetadata("csv");
    assert.equal(_capturedBlobs.length, 1);
    assert.ok(_capturedNames[0].endsWith(".metadata.csv"));
  });

  it("should generate TXT download", () => {
    downloadMetadata("txt");
    assert.equal(_capturedBlobs.length, 1);
    assert.ok(_capturedNames[0].endsWith(".metadata.txt"));
  });

  it("should generate XML download", () => {
    downloadMetadata("xml");
    assert.equal(_capturedBlobs.length, 1);
    assert.ok(_capturedNames[0].endsWith(".metadata.xml"));
  });

  it("should generate HTML download", () => {
    downloadMetadata("html");
    assert.equal(_capturedBlobs.length, 1);
    assert.ok(_capturedNames[0].endsWith(".metadata.html"));
  });

  it("should generate PDF download", () => {
    downloadMetadata("pdf");
    assert.equal(_capturedBlobs.length, 1);
    assert.ok(_capturedNames[0].endsWith(".metadata.pdf"));
  });

  it("should generate DOCX download", async () => {
    downloadMetadata("doc");
    await new Promise(r => setTimeout(r, 5));
    assert.equal(_capturedBlobs.length, 1);
    assert.ok(_capturedNames[0].endsWith(".metadata.docx"));
  });

  it("should do nothing when no result stored", () => {
    delete globalThis._resultStore.mdResult;
    downloadMetadata("json");
    assert.equal(_capturedBlobs.length, 0);
  });

  it("should do nothing for unknown format", () => {
    downloadMetadata("unknown");
    assert.equal(_capturedBlobs.length, 0);
  });
});

// ── JPEG with type 5 (RATIONAL) tag: FNumber = 28/10 = 2.8 ──
// SOI(2) + APP1(2) + segLen(2) + Exif\0\0(6) + TIFF(34) + SOS+EOI(11) = 57 bytes
// TIFF: endian(2) + magic(2) + IFD0_off(4) + IFD0(18) + rational(8) = 34
// IFD0: num(2) + entry(12) + nextIFD(4) = 18
const JPEG_TYPE5 = new Uint8Array([
  0xff, 0xd8, // SOI
  0xff, 0xe1, // APP1 marker
  0x00, 0x28, // segLen = 40
  0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
  0x49, 0x49, // endian (LE)
  0x2a, 0x00, // magic 42
  0x08, 0x00, 0x00, 0x00, // IFD0 TIFF offset = 8
  0x01, 0x00, // 1 entry
  0x9d, 0x82, // tag 0x829D (FNumber)
  0x05, 0x00, // type 5 (RATIONAL)
  0x01, 0x00, 0x00, 0x00, // count = 1
  0x1a, 0x00, 0x00, 0x00, // value TIFF offset = 26
  0x00, 0x00, 0x00, 0x00, // next IFD = 0
  0x1c, 0x00, 0x00, 0x00, // numerator = 28
  0x0a, 0x00, 0x00, 0x00, // denominator = 10
  // SOS + EOI
  0xff, 0xda, 0x00, 0x08, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9,
]);

// ── JPEG with inline type 2 (ASCII) tag: Make="ABC", count=4 (inline in 4-byte field) ──
// SOI(2) + APP1(2) + segLen(2) + Exif\0\0(6) + TIFF(26) + SOS+EOI(11) = 49 bytes
const JPEG_INLINE_TYPE2 = new Uint8Array([
  0xff, 0xd8, // SOI
  0xff, 0xe1, // APP1 marker
  0x00, 0x20, // segLen = 32
  0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
  0x49, 0x49, // endian (LE)
  0x2a, 0x00, // magic 42
  0x08, 0x00, 0x00, 0x00, // IFD0 TIFF offset = 8
  0x01, 0x00, // 1 entry
  0x0f, 0x01, // tag 0x010F (Make)
  0x02, 0x00, // type 2 (ASCII) with count <= 4 → inline in value field
  0x04, 0x00, 0x00, 0x00, // count = 4
  0x41, 0x42, 0x43, 0x00, // inline "ABC\0" in 4-byte value field
  0x00, 0x00, 0x00, 0x00, // next IFD = 0
  // SOS + EOI
  0xff, 0xda, 0x00, 0x08, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9,
]);

// ── JPEG with type 3 (SHORT) tag: Orientation=1 ──
// SOI(2) + APP1(2) + segLen(2) + Exif\0\0(6) + TIFF(26) + SOS+EOI(11) = 49 bytes
const JPEG_TYPE3 = new Uint8Array([
  0xff, 0xd8, // SOI
  0xff, 0xe1, // APP1 marker
  0x00, 0x20, // segLen = 32
  0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
  0x49, 0x49, // endian (LE)
  0x2a, 0x00, // magic 42
  0x08, 0x00, 0x00, 0x00, // IFD0 TIFF offset = 8
  0x01, 0x00, // 1 entry
  0x12, 0x01, // tag 0x0112 (Orientation)
  0x03, 0x00, // type 3 (SHORT)
  0x01, 0x00, 0x00, 0x00, // count = 1
  0x01, 0x00, 0x00, 0x00, // value = 1 (inline)
  0x00, 0x00, 0x00, 0x00, // next IFD = 0
  // SOS + EOI
  0xff, 0xda, 0x00, 0x08, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9,
]);

// ── JPEG with type 4 (LONG) tag: ExifOffset=100 ──
// SOI(2) + APP1(2) + segLen(2) + Exif\0\0(6) + TIFF(26) + SOS+EOI(11) = 49 bytes
const JPEG_TYPE4 = new Uint8Array([
  0xff, 0xd8, // SOI
  0xff, 0xe1, // APP1 marker
  0x00, 0x20, // segLen = 32
  0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
  0x49, 0x49, // endian (LE)
  0x2a, 0x00, // magic 42
  0x08, 0x00, 0x00, 0x00, // IFD0 TIFF offset = 8
  0x01, 0x00, // 1 entry
  0x69, 0x87, // tag 0x8769 (ExifOffset)
  0x04, 0x00, // type 4 (LONG)
  0x01, 0x00, 0x00, 0x00, // count = 1
  0x64, 0x00, 0x00, 0x00, // value = 100 (inline)
  0x00, 0x00, 0x00, 0x00, // next IFD = 0
  // SOS + EOI
  0xff, 0xda, 0x00, 0x08, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9,
]);

// ── JPEG with type 7 (UNDEFINED) tag: tag 0x89AB, count=4, inline data ──
// SOI(2) + APP1(2) + segLen(2) + Exif\0\0(6) + TIFF(26) + SOS+EOI(11) = 49 bytes
// TIFF: endian(2) + magic(2) + IFD0_off(4) + IFD0(18) = 26
const JPEG_TYPE7 = new Uint8Array([
  0xff, 0xd8, // SOI
  0xff, 0xe1, // APP1 marker
  0x00, 0x20, // segLen = 32
  0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
  0x49, 0x49, // endian (LE)
  0x2a, 0x00, // magic 42
  0x08, 0x00, 0x00, 0x00, // IFD0 TIFF offset = 8
  0x01, 0x00, // 1 entry
  0xab, 0x89, // tag 0x89AB (not in EXIF_TAGS)
  0x07, 0x00, // type 7 (UNDEFINED)
  0x04, 0x00, 0x00, 0x00, // count = 4
  0x01, 0x02, 0x03, 0x04, // inline value
  0x00, 0x00, 0x00, 0x00, // next IFD = 0
  // SOS + EOI
  0xff, 0xda, 0x00, 0x08, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9,
]);

// ── JPEG with chained IFDs: IFD0 has Make, next IFD points to IFD1 with Model ──
// SOI(2) + APP1(2) + segLen(2) + Exif\0\0(6) + TIFF(68) + SOS+EOI(11) = 91 bytes
// TIFF: endian(2) + magic(2) + IFD0_off(4) + IFD0(18) + str1(10) + gap(4) + IFD1(18) + str2(10) = 68
const JPEG_NEXT_IFD = new Uint8Array([
  0xff, 0xd8, // SOI
  0xff, 0xe1, // APP1 marker
  0x00, 0x4a, // segLen = 74
  0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
  0x49, 0x49, // endian (LE)
  0x2a, 0x00, // magic 42
  0x08, 0x00, 0x00, 0x00, // IFD0 TIFF offset = 8
  // IFD0 (at TIFF offset 8)
  0x01, 0x00, // 1 entry
  0x0f, 0x01, // tag 0x010F (Make)
  0x02, 0x00, // type 2 (ASCII)
  0x0a, 0x00, 0x00, 0x00, // count = 10
  0x1a, 0x00, 0x00, 0x00, // value TIFF offset = 26
  0x28, 0x00, 0x00, 0x00, // next IFD = 40 (TIFF offset)
  // "TestMaker\0" at TIFF offset 26
  0x54, 0x65, 0x73, 0x74, 0x4d, 0x61, 0x6b, 0x65, 0x72, 0x00,
  // gap (unused bytes)
  0x00, 0x00, 0x00, 0x00,
  // IFD1 (at TIFF offset 40)
  0x01, 0x00, // 1 entry
  0x10, 0x01, // tag 0x0110 (Model)
  0x02, 0x00, // type 2 (ASCII)
  0x0a, 0x00, 0x00, 0x00, // count = 10
  0x3a, 0x00, 0x00, 0x00, // value TIFF offset = 58
  0x00, 0x00, 0x00, 0x00, // next IFD = 0
  // "TestModel\0" at TIFF offset 58
  0x54, 0x65, 0x73, 0x74, 0x4d, 0x6f, 0x64, 0x65, 0x6c, 0x00,
  // SOS + EOI
  0xff, 0xda, 0x00, 0x08, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9,
]);

describe("Metadata — parseIFD type 5 (RATIONAL)", () => {
  it("should parse FNumber rational tag", () => {
    const exif = parseJPEGExif(JPEG_TYPE5);
    assert.ok(exif);
    assert.equal(exif.FNumber, "2.8");
  });

  it("should skip rational when data extends beyond buffer", () => {
    // Create a JPEG where the rational offset points past end of buffer
    const bad = new Uint8Array(JPEG_TYPE5);
    // Overwrite denominator bytes at offset 42-45 with 0 to make the rational
    // value area extend past the SOS boundary... actually easier: truncate file
    // so that numOff + 8 > data.length - tiffStart
    // tiffStart=12, so data.length must be < 12+26+8 = 46.
    // Cut data at offset 44 (truncate denominator)
    const truncated = bad.slice(0, 44);
    const exif = parseJPEGExif(truncated);
    // Val stays undefined, so FNumber is not stored
    assert.equal(exif.FNumber, undefined);
    assert.deepEqual(Object.keys(exif), []);
  });
});

describe("Metadata — parseIFD type 7 (UNDEFINED)", () => {
  it("should parse type 7 tag without storing (tag not in EXIF_TAGS)", () => {
    const exif = parseJPEGExif(JPEG_TYPE7);
    // The type 7 case executes but tag 0x89AB is not in EXIF_TAGS
    assert.ok(exif);
    assert.deepEqual(Object.keys(exif), []);
  });
});

describe("Metadata — parseIFD recursive (next IFD)", () => {
  it("should parse chained IFDs (Make from IFD0, Model from IFD1)", () => {
    const exif = parseJPEGExif(JPEG_NEXT_IFD);
    assert.ok(exif);
    assert.equal(exif.Make, "TestMaker");
    assert.equal(exif.Model, "TestModel");
  });
});

describe("Metadata — parseIFD type 2 inline (count <= 4)", () => {
  it("should parse inline ASCII string (Make=ABC)", () => {
    const exif = parseJPEGExif(JPEG_INLINE_TYPE2);
    assert.ok(exif);
    assert.equal(exif.Make, "ABC");
  });
});

describe("Metadata — parseIFD type 3 (SHORT)", () => {
  it("should parse Orientation SHORT tag", () => {
    const exif = parseJPEGExif(JPEG_TYPE3);
    assert.ok(exif);
    assert.equal(exif.Orientation, "1");
  });
});

describe("Metadata — parseIFD type 4 (LONG)", () => {
  it("should parse ExifOffset LONG tag", () => {
    const exif = parseJPEGExif(JPEG_TYPE4);
    assert.ok(exif);
    assert.equal(exif.ExifOffset, "100");
  });
});

describe("Metadata — mdToPDF page break", () => {
  it("should add page when y exceeds 270 with many exif tags", () => {
    const manyTags = {};
    for (let i = 0; i < 45; i++) {
      manyTags["Tag" + i] = "val" + i;
    }
    const r = {
      file: "photo.jpg",
      size: 102400,
      sha256: "abc123",
      image: { width: 640, height: 480, mode: "RGBA", format: "JPEG" },
      exif: manyTags,
    };
    _capturedBlobs = [];
    _capturedNames = [];
    mdToPDF(r, "photo");
    assert.equal(_capturedBlobs.length, 1);
    assert.ok(_capturedNames[0].endsWith(".metadata.pdf"));
  });
});

// ── Helper to build a JPEG with a custom Make string value ──
function makeJPEGWithMakeValue(str) {
  const valueBytes = [];
  for (let i = 0; i < str.length; i++) {
    valueBytes.push(str.charCodeAt(i));
  }
  valueBytes.push(0); // null terminator
  const count = valueBytes.length;

  // TIFF: endian(2) + magic(2) + IFD0_off(4) + IFD0(18) = 26
  // Exif\0\0 = 6; segLen = 6 + 26 + count
  const segLen = 6 + 26 + count;
  const total = 2 + 2 + 2 + segLen + 11;
  const data = new Uint8Array(total);

  let off = 0;
  const w = (v) => { data[off++] = v & 0xff; };
  // JPEG marker segment lengths are big-endian (per JPEG spec)
  const w16be = (v) => { w(v >> 8); w(v); };
  // TIFF values are little-endian (since we set endian = II)
  const w16le = (v) => { w(v); w(v >> 8); };
  const w32le = (v) => { w(v); w(v >> 8); w(v >> 16); w(v >> 24); };

  w(0xff); w(0xd8); // SOI
  w(0xff); w(0xe1); // APP1
  w16be(segLen);
  data.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], off); off += 6; // "Exif\0\0"
  w(0x49); w(0x49); // LE endian
  w(0x2a); w(0x00); // magic 42
  w32le(8); // IFD0 offset = 8
  w16le(1); // 1 entry
  w16le(0x010f); // tag Make
  w16le(2); // type ASCII
  w32le(count);
  w32le(26); // value at TIFF offset 26
  w32le(0); // next IFD
  data.set(valueBytes, off); off += count; // string value
  // SOS + EOI
  data.set([0xff, 0xda, 0x00, 0x08, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9], off);

  return data;
}

describe("Metadata — parseIFD big-endian TIFF", () => {
  it("should parse EXIF with big-endian byte order (MM)", () => {
    // Same structure as JPEG_WITH_EXIF but big-endian (MM)
    const jpeg = new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xe1, // APP1
      0x00, 0x2c, // segLen = 44
      0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // Exif header
      0x4d, 0x4d, // endian (MM = big endian)
      0x00, 0x2a, // magic 42 (big-endian order)
      0x00, 0x00, 0x00, 0x08, // IFD0 offset = 8 (big-endian)
      0x00, 0x01, // 1 entry (big-endian)
      0x01, 0x0f, // tag 0x010F Make (big-endian)
      0x00, 0x02, // type 2 ASCII (big-endian)
      0x00, 0x00, 0x00, 0x0a, // count = 10 (big-endian)
      0x00, 0x00, 0x00, 0x1a, // value TIFF offset = 26 (big-endian)
      0x00, 0x00, 0x00, 0x00, // next IFD = 0
      0x54, 0x65, 0x73, 0x74, 0x4d, 0x61, 0x6b, 0x65, 0x72, 0x00, // "TestMaker\0"
      0xff, 0xda, 0x00, 0x08, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9, // SOS+EOI
    ]);
    const exif = parseJPEGExif(jpeg);
    assert.ok(exif);
    assert.equal(exif.Make, "TestMaker");
  });
});

describe("Metadata — parseIFD invalid TIFF magic", () => {
  it("should return empty exif when TIFF magic != 0x002A", () => {
    // Same as JPEG_WITH_EXIF but with invalid magic
    const jpeg = new Uint8Array(JPEG_WITH_EXIF);
    jpeg[14] = 0x00; // Overwrite magic byte: 0x2a → 0x00
    const exif = parseJPEGExif(jpeg);
    assert.deepEqual(exif, {});
  });
});

describe("Metadata — _csvEsc with special characters", () => {
  it("should escape commas in CSV values", () => {
    const csv = mdToCSV({
      file: "test.jpg",
      size: 512,
      sha256: "abc",
      exif: { Make: "Test, Inc." },
    });
    assert.ok(csv.includes('"Test, Inc."'));
  });

  it("should escape double quotes in CSV values", () => {
    const csv = mdToCSV({
      file: "test.jpg",
      size: 512,
      sha256: "abc",
      exif: { Make: 'Say "Hello"' },
    });
    assert.ok(csv.includes('"Say ""Hello"""'));
  });

  it("should handle null in _csvEsc", () => {
    assert.equal(_csvEsc(null), "");
  });
});

describe("Metadata — downloadMetadata with edge cases", () => {
  beforeEach(() => {
    _capturedBlobs = [];
    _capturedNames = [];
  });

  it("should fallback to metadata filename when file has no extension base", () => {
    globalThis._resultStore.mdResult = {
      file: ".hidden",
      size: 100,
      sha256: "abc",
    };
    downloadMetadata("json");
    assert.equal(_capturedBlobs.length, 1);
    assert.ok(_capturedNames[0].endsWith(".metadata.json"));
  });
});

describe("Metadata — value truncation (>200 chars)", () => {
  it("should truncate EXIF values longer than 200 characters", () => {
    const longValue = "X".repeat(250);
    const jpeg = makeJPEGWithMakeValue(longValue);
    const exif = parseJPEGExif(jpeg);
    assert.ok(exif.Make);
    assert.equal(exif.Make.length, 200); // 197 + "..."
    assert.ok(exif.Make.endsWith("..."));
  });
});
