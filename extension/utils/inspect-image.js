// Orchestrates one inspection: bytes -> cryptographic hashes, perceptual
// hashes and a C2PA presence check. Everything runs locally.
import { cryptoHashes } from "./hashes.js";
import { perceptualHashes } from "./perceptual.js";
import { detectC2pa } from "./c2pa-presence.js";

/** Perceptual hashes are defined on a 32x32 RGBA image. */
export const PERCEPTUAL_SIZE = 32;

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "bmp",
  "gif",
  "tif",
  "tiff",
  "webp",
]);

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isImageName(name) {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return false;
  return IMAGE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

/**
 * Draw any browser-decodable image at 32x32 and return the pixels in the shape
 * Fingerprint/hashing_perceptual.js expects ({ data, w, h }).
 * @param {Blob} blob
 * @returns {Promise<{data: Uint8ClampedArray, w: number, h: number, width: number, height: number}>}
 */
export async function decodeTo32(blob) {
  if (typeof globalThis.createImageBitmap !== "function") {
    throw new TypeError("createImageBitmap is unavailable in this context");
  }
  const bitmap = await globalThis.createImageBitmap(blob);
  try {
    const canvas =
      typeof globalThis.OffscreenCanvas === "function"
        ? new globalThis.OffscreenCanvas(PERCEPTUAL_SIZE, PERCEPTUAL_SIZE)
        : Object.assign(globalThis.document.createElement("canvas"), {
            width: PERCEPTUAL_SIZE,
            height: PERCEPTUAL_SIZE,
          });
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, PERCEPTUAL_SIZE, PERCEPTUAL_SIZE);
    const { data } = context.getImageData(
      0,
      0,
      PERCEPTUAL_SIZE,
      PERCEPTUAL_SIZE,
    );
    return {
      data,
      w: PERCEPTUAL_SIZE,
      h: PERCEPTUAL_SIZE,
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    if (typeof bitmap.close === "function") bitmap.close();
  }
}

/**
 * Inspect one file.
 *
 * `options.decode` is injectable so unit tests can skip canvas decoding; the
 * default draws the real image at 32x32.
 * @param {File} file
 * @param {object} [options]
 * @param {(blob: Blob) => Promise<object>} [options.decode]
 * @param {(name: string) => void} [options.onProgress]
 * @returns {Promise<object>}
 */
export async function inspectImage(file, options = {}) {
  const decode = options.decode || decodeTo32;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const hashes = await cryptoHashes(bytes, options.onProgress);
  const report = {
    file: {
      name: file.name || "",
      size: bytes.length,
      type: file.type || "",
    },
    hashes,
    perceptual_hashes: null,
    c2pa: detectC2pa(bytes),
    image: null,
  };

  if (isImageName(report.file.name)) {
    try {
      const small = await decode(
        new Blob([bytes], { type: file.type || "application/octet-stream" }),
      );
      report.perceptual_hashes = perceptualHashes(small);
      report.image = { width: small.width, height: small.height };
    } catch (error) {
      report.image = { error: error.message };
    }
  }

  return report;
}
