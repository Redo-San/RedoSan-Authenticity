import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Fingerprint/hashing*.js are browser scripts: they attach their namespaces to
// `window` and skip that when it is undefined. Set it before importing.
globalThis.window = globalThis;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, "..", "..", "cli", "tests", "fixtures");

const { cryptoHashes } = await import("../utils/hashes.js");
const { perceptualHashes } = await import("../utils/perceptual.js");
const { inspectImage } = await import("../utils/inspect-image.js");

/**
 * Read a file from the shared CLI fixture directory.
 * @param {string} name File name inside `cli/tests/fixtures`.
 * @returns {Uint8Array} Raw fixture bytes.
 */
function fixture(name) {
  // `name` is always a literal at the call sites in this file.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return readFileSync(path.join(FIXTURES, name));
}

/**
 * Build a deterministic 32x32 RGBA image.
 * @returns {{data: Uint8ClampedArray, w: number, h: number}} ImageData-shaped object.
 */
function syntheticImage32() {
  const data = new Uint8ClampedArray(32 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      data.set(
        [(x % 8) * 31, (x * 13 + y * 7) % 256, (x * 5 + y * 17) % 256, 255],
        (y * 32 + x) * 4,
      );
    }
  }
  return { data, w: 32, h: 32 };
}

/**
 * Decode stub that returns fixed 32x32 pixels and source dimensions.
 * @param {{data: Uint8ClampedArray}} image Synthetic pixels.
 * @returns {(blob: Blob) => Promise<object>} Decode function.
 */
function stubDecode(image) {
  return async () => ({
    data: image.data,
    w: 32,
    h: 32,
    width: 64,
    height: 64,
  });
}

test("computes only the requested digests and keeps their values", async () => {
  const bytes = fixture("testimg_64x64.png");
  const all = await cryptoHashes(bytes);
  const subset = await cryptoHashes(bytes, undefined, ["SHA-256", "MD5"]);

  assert.deepEqual(Object.keys(subset), ["SHA-256", "MD5"]);
  assert.equal(subset["SHA-256"], all["SHA-256"]);
  assert.equal(subset.MD5, all.MD5);
});

test("an empty filter computes nothing", async () => {
  const hashes = await cryptoHashes(
    fixture("testimg_64x64.png"),
    undefined,
    [],
  );
  assert.deepEqual(hashes, {});
});

test("a null filter still computes every digest", async () => {
  const hashes = await cryptoHashes(
    fixture("testimg_64x64.png"),
    undefined,
    null,
  );
  assert.equal(Object.keys(hashes).length, 21);
});

test("the perceptual filter keeps only the requested hash", () => {
  const image = syntheticImage32();
  const all = perceptualHashes(image);
  const one = perceptualHashes(image, ["phash"]);

  assert.deepEqual(Object.keys(one), ["phash"]);
  assert.equal(one.phash, all.phash);
  assert.deepEqual(perceptualHashes(image, []), {});
});

test("inspectImage forwards the hash filter", async () => {
  const image = syntheticImage32();
  const file = new File([fixture("testimg_64x64.png")], "hidden.png", {
    type: "image/png",
  });
  const report = await inspectImage(file, {
    enabledHashes: ["SHA-256"],
    decode: stubDecode(image),
  });

  assert.deepEqual(Object.keys(report.hashes), ["SHA-256"]);
  assert.equal(report.perceptual_hashes, null);
  // Decoding is skipped when no perceptual hash is enabled.
  assert.equal(report.image, null);
});

test("a MIME type is enough to run perceptual hashes without an extension", async () => {
  const image = syntheticImage32();
  const file = new File([fixture("testimg_64x64.png")], "download", {
    type: "image/png",
  });
  const report = await inspectImage(file, { decode: stubDecode(image) });

  assert.equal(Object.keys(report.perceptual_hashes).length, 4);
  assert.deepEqual(report.image, { width: 64, height: 64 });
});

test("a nameless non-image file skips decoding", async () => {
  let decoded = false;
  const file = new File(["not an image"], "download", { type: "" });
  const report = await inspectImage(file, {
    decode: async () => {
      decoded = true;
      return syntheticImage32();
    },
  });

  assert.equal(decoded, false);
  assert.equal(report.perceptual_hashes, null);
  assert.equal(report.image, null);
});
