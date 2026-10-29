// Perceptual hashes (aHash/dHash/pHash/wHash) for the inspector.
//
// Same bundler constraint as hashes.js: Fingerprint/hashing_perceptual.js
// attaches window.RedosanPerceptual for bundled consumers.
import "../../Fingerprint/hashing_perceptual.js";

/** Perceptual hash names, matching the web app and the CLI. */
export const PERCEPTUAL_NAMES = ["ahash", "dhash", "phash", "whash"];

/**
 * The functions expect a 32x32 RGBA buffer shaped like `{ data, w, h }`; they
 * do not resize, so the caller must draw the image at 32x32 first.
 * @param {{ data: Uint8ClampedArray|Uint8Array, w: number, h: number }} imageData
 *   32x32 RGBA pixels; `w` and `h` are both 32.
 * @returns {Record<string, string>} Perceptual hash name to lowercase hex, 16
 *   characters each.
 */
export function perceptualHashes(imageData) {
  const namespace = globalThis.RedosanPerceptual;
  if (!namespace) {
    throw new Error(
      "Fingerprint/hashing_perceptual.js did not attach RedosanPerceptual; check the import order",
    );
  }
  if (!imageData || !imageData.data || !imageData.w || !imageData.h) {
    throw new TypeError("perceptualHashes expects { data, w, h }");
  }

  const hashes = {};
  for (const name of PERCEPTUAL_NAMES) {
    try {
      hashes[name] = namespace[name](imageData);
    } catch {
      // whash has historically thrown for some inputs; omit it rather than fail.
    }
  }
  return hashes;
}
