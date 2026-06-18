const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };

globalThis.loadImage = async (file) => {
  const _buf = await file.arrayBuffer();
  return { w: 100, h: 50 };
};

const src = fs.readFileSync(path.join(__dirname, "../../Metadata/metadata.js"), "utf8");
vm.runInThisContext(src, { filename: "metadata.js" });

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
    assert.ok(result.exif, `EXIF should be parsed: ${JSON.stringify(result)}`);
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
