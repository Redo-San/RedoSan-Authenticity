import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Fingerprint/hashing*.js are browser scripts: they attach their namespaces to
// `window` and skip that when it is undefined. Set it before importing.
globalThis.window = globalThis;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, "..", "..", "cli", "tests", "fixtures");

const { cryptoHashes, HASH_NAMES } = await import("../utils/hashes.js");
const { perceptualHashes } = await import("../utils/perceptual.js");
const { detectC2pa } = await import("../utils/c2pa-presence.js");
const { inspectImage, isImageName } = await import("../utils/inspect-image.js");
const { reportToJson, reportToText } =
  await import("../utils/format-report.js");

// Captured from `node cli/index.js fingerprint <file> --json` on 2026-10-27.
// The CLI computes 17 digests; the other four are checked against Node's
// OpenSSL implementation below.
const CLI_VECTORS_64 = {
  "SHA-1": "9f8d8a52850026e0d6bdebced81ea3a3b14d6986",
  "SHA-256": "f9985509b147ac80ef88092946e79ba45b01a42d2351b69bdcba81b8312bca2d",
  "SHA-384":
    "8cb5dd081ffd5178b09f5a25e8a03b3cb45cf95e002dd04913f2545e9dd85d70fc74655d1e7495663fd188296028be75",
  "SHA-512":
    "797b5be5978c2436bf39b94d9f54f09682eb0475683f4faab3ee5e9c9a12f301e052748310edc0f84892ae22ab18317859b7687cb819b2aaae2b2138807ac02d",
  "SHA-224": "b5f90e362b957636b2f78d1b63cebffcbe00a2642d4944b246f50e59",
  "SHA-3_224": "fddb931ba61769d7e1c42ac83f827db7a03b33221aedf936e30647b1",
  "SHA-3_256":
    "a353a4a75301196c70a79691785ec7236fe8c885bad87c05f97cc00773affa55",
  "SHA-3_384":
    "42f2122e0e88db262a514112c5aadcac7f6c4d4e6a43451d7d1f34085b62b0e719eccf4be915b259814bdfb86ac8def9",
  "SHA-3_512":
    "b63ab302f40c7c4f452b04008ca40db29b07ca8ff25ca417ce40df5a81e82d5cddf164bda7c5fb19fadb86874dae52cb38d44306fed4ce961aed4b10bce11977",
  BLAKE2b:
    "6024b374936385a8646cd9e8b4b5453436935ed851b3a3edceb30339e45cb32436af1f694f7d0e516c88f642539c059b86e7abe9fb26831f6618d077d3c7e05b",
  BLAKE2s: "82a6c7bef9faeffda34a0b70fb3b0299f5477a8d1a2af2528502fdda30b8ab39",
  BLAKE3: "4d9601040b13e352340bc19f4014bcd97651fb952a3e8f1cb47dce8fbd305375",
  MD2: "681be1eef97c5bd0346c51b392c79d70",
  MD4: "94d0415f30935067dbdb30b62fc0586a",
  MD5: "9d22b57ddf87b930135c8330a32e5b9a",
  "RIPEMD-160": "acb13c184c06b151f86bcb7eb27959423f56600a",
  Whirlpool:
    "c15f21ab9588fbcbe39ce5e21bf7fa4e6094124fbeb80c1cccadc185bfe2f070c4931c0bdb9fb33a6650b6f25622abbf28990a5b816559c67006df94f221e855",
};

// Independent reference for the four digests the CLI does not compute.
const OPENSSL_VECTORS = [
  ["SHA-512/224", "sha512-224"],
  ["SHA-512/256", "sha512-256"],
  ["SHAKE128", "shake128"],
  ["SHAKE256", "shake256"],
];

/**
 *
 * @param algorithm
 * @param data
 */
function opensslDigest(algorithm, data) {
  const options = algorithm === "shake128" ? { outputLength: 32 } : undefined;
  const outputOptions =
    algorithm === "shake256" ? { outputLength: 64 } : options;
  return createHash(algorithm, outputOptions).update(data).digest("hex");
}

/**
 *
 * @param name
 */
function fixture(name) {
  return readFileSync(path.join(FIXTURES, name));
}

/**
 *
 * @param value
 */
function u32be(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

/**
 *
 * @param value
 */
function u32le(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/**
 *
 * @param type
 * @param payload
 */
function pngWithChunk(type, payload) {
  const chunk = Buffer.concat([
    u32be(payload.length),
    Buffer.from(type, "ascii"),
    payload,
    Buffer.alloc(4), // CRC is not validated by the presence scan
  ]);
  const iend = Buffer.concat([
    u32be(0),
    Buffer.from("IEND", "ascii"),
    Buffer.alloc(4),
  ]);
  return Buffer.concat([PNG_SIGNATURE, chunk, iend]);
}

/**
 *
 * @param payload
 */
function jpegWithApp11(payload) {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    Buffer.from([0xff, 0xeb]),
    Buffer.from([(payload.length + 2) >> 8, (payload.length + 2) & 0xff]),
    payload,
    Buffer.from([0xff, 0xd9]),
  ]);
}

/**
 *
 * @param type
 * @param payload
 */
function webpWithChunk(type, payload) {
  const pad = payload.length % 2;
  return Buffer.concat([
    Buffer.from("RIFF", "ascii"),
    u32le(4 + 8 + payload.length + pad),
    Buffer.from("WEBP", "ascii"),
    Buffer.from(type, "ascii"),
    u32le(payload.length),
    payload,
    Buffer.alloc(pad),
  ]);
}

/**
 *
 */
function syntheticImage32() {
  const data = new Uint8ClampedArray(32 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const i = (y * 32 + x) * 4;
      data[i] = (x % 8) * 31;
      data[i + 1] = (x * 13 + y * 7) % 256;
      data[i + 2] = (x * 5 + y * 17) % 256;
      data[i + 3] = 255;
    }
  }
  return { data, w: 32, h: 32 };
}

test("exposes the 21 hash names in report order", () => {
  assert.equal(HASH_NAMES.length, 21);
  assert.equal(new Set(HASH_NAMES).size, 21);
  assert.equal(HASH_NAMES[0], "SHA-1");
  assert.equal(HASH_NAMES.at(-1), "SHAKE256");
});

test("matches every CLI vector for testimg_64x64.png", async () => {
  const hashes = await cryptoHashes(fixture("testimg_64x64.png"));
  for (const [name, expected] of Object.entries(CLI_VECTORS_64)) {
    assert.equal(hashes[name], expected, `${name} should match the CLI vector`);
  }
});

test("matches Node OpenSSL for the four digests the CLI omits", async () => {
  const bytes = fixture("testimg_64x64.png");
  const hashes = await cryptoHashes(bytes);
  for (const [name, algorithm] of OPENSSL_VECTORS) {
    assert.equal(hashes[name], opensslDigest(algorithm, bytes), name);
  }
});

test("reports progress and clears it at the end", async () => {
  const seen = [];
  await cryptoHashes(fixture("testimg_64x64.png"), (name) => seen.push(name));
  assert.equal(seen.at(-1), "");
  assert.ok(seen.includes("SHA-256"));
  assert.ok(seen.includes("Whirlpool"));
});

test("SHA-256 matches for a second fixture", async () => {
  const hashes = await cryptoHashes(fixture("testimg_200x200.png"));
  assert.equal(
    hashes["SHA-256"],
    "f569a6ddeca84df4a0fa3a554c2b9902c12468022452a21ba51de3221467ef39",
  );
});

test("perceptual hashes are deterministic for a fixed 32x32 buffer", () => {
  const hashes = perceptualHashes(syntheticImage32());
  assert.deepEqual(hashes, {
    ahash: "f8f8f8f0f0e0e0e0",
    dhash: "808080808080808080",
    phash: "02804ad48858b005",
    whash: "ceccccccdc9c88a8",
  });
  assert.match(hashes.ahash, /^[0-9a-f]{16}$/);
  assert.match(hashes.dhash, /^[0-9a-f]{18}$/);
  assert.match(hashes.phash, /^[0-9a-f]{16}$/);
  assert.match(hashes.whash, /^[0-9a-f]{16}$/);
});

test("perceptualHashes rejects a buffer without dimensions", () => {
  assert.throws(
    () => perceptualHashes({ data: new Uint8ClampedArray(4) }),
    /expects \{ data, w, h \}/,
  );
});

test("detects the spec PNG chunk caBX", () => {
  const result = detectC2pa(pngWithChunk("caBX", Buffer.from("manifest")));
  assert.equal(result.present, true);
  assert.equal(result.format, "png");
  assert.equal(result.standard, true);
  assert.equal(result.length, 8 + 12);
});

test("detects the legacy non-standard PNG chunk c2pa", () => {
  const result = detectC2pa(pngWithChunk("c2pa", Buffer.from("manifest")));
  assert.equal(result.present, true);
  assert.equal(result.standard, false);
  assert.equal(result.chunk, "c2pa");
});

test("ignores an unrelated PNG chunk", () => {
  const result = detectC2pa(pngWithChunk("tEXt", Buffer.from("hello")));
  assert.equal(result.present, false);
});

test("detects a JPEG APP11 JUMBF manifest store", () => {
  const payload = Buffer.concat([
    Buffer.from("JP", "ascii"),
    Buffer.from('jumbc2pa', "ascii"),
  ]);
  const result = detectC2pa(jpegWithApp11(payload));
  assert.equal(result.present, true);
  assert.equal(result.format, "jpeg");
  assert.equal(result.chunk, "APP11");
});

test("ignores a JPEG APP11 segment without the c2pa label", () => {
  const payload = Buffer.concat([
    Buffer.from("JP", "ascii"),
    Buffer.from('jumbother', "ascii"),
  ]);
  assert.equal(detectC2pa(jpegWithApp11(payload)).present, false);
});

test("detects a WebP C2PA chunk", () => {
  const result = detectC2pa(webpWithChunk("C2PA", Buffer.from("manifest")));
  assert.equal(result.present, true);
  assert.equal(result.format, "webp");
  assert.equal(result.standard, true);
});

test("returns absent for an unsigned PNG and a non-image", () => {
  assert.equal(detectC2pa(fixture("testimg_64x64.png")).present, false);
  assert.equal(detectC2pa(fixture("test.txt")).present, false);
});

test("isImageName accepts the supported image extensions only", () => {
  for (const name of ["a.png", "b.JPG", "c.jpeg", "d.webp", "e.tif"]) {
    assert.equal(isImageName(name), true, name);
  }
  for (const name of ["a.txt", "b", "c.pdf"]) {
    assert.equal(isImageName(name), false, name);
  }
});

test("inspectImage composes hashes, perceptual block and C2PA state", async () => {
  const bytes = fixture("testimg_64x64.png");
  const file = new File([bytes], "testimg_64x64.png", { type: "image/png" });
  const report = await inspectImage(file, {
    decode: async () => ({ ...syntheticImage32(), width: 64, height: 64 }),
  });

  assert.deepEqual(report.file, {
    name: "testimg_64x64.png",
    size: bytes.length,
    type: "image/png",
  });
  assert.equal(
    report.hashes["SHA-256"],
    "f9985509b147ac80ef88092946e79ba45b01a42d2351b69bdcba81b8312bca2d",
  );
  assert.equal(report.perceptual_hashes.ahash, "f8f8f8f0f0e0e0e0");
  assert.equal(report.image.width, 64);
  assert.equal(report.image.height, 64);
  assert.equal(report.c2pa.present, false);
});

test("inspectImage keeps going when decoding fails", async () => {
  const file = new File([fixture("testimg_64x64.png")], "broken.png", {
    type: "image/png",
  });
  const report = await inspectImage(file, {
    decode: async () => {
      throw new Error("decode failed");
    },
  });
  assert.equal(report.perceptual_hashes, null);
  assert.equal(report.image.error, "decode failed");
  assert.ok(report.hashes["SHA-256"]);
});

test("inspectImage skips the perceptual block for non-images", async () => {
  const file = new File([fixture("test.txt")], "test.txt", {
    type: "text/plain",
  });
  const report = await inspectImage(file);
  assert.equal(report.perceptual_hashes, null);
  assert.equal(report.image, null);
  assert.equal(report.c2pa.present, false);
});

test("format-report renders text and JSON without losing fields", async () => {
  const file = new File([fixture("testimg_64x64.png")], "testimg_64x64.png", {
    type: "image/png",
  });
  const report = await inspectImage(file, {
    decode: async () => ({ ...syntheticImage32(), width: 64, height: 64 }),
  });

  const text = reportToText(report);
  assert.match(text, /testimg_64x64\.png \(226 bytes\)/);
  assert.match(text, /Dimensions: 64x64/);
  assert.match(text, /SHA-256: f9985509/);
  assert.match(text, /No manifest store found/);

  const parsed = JSON.parse(reportToJson(report));
  assert.deepEqual(parsed.hashes, report.hashes);
  assert.deepEqual(parsed.perceptual_hashes, report.perceptual_hashes);
});
