// Perceptual hashes (aHash/dHash/pHash/wHash) for the inspector.
//
// Same bundler constraint as hashes.js: Fingerprint/hashing_perceptual.js
// attaches window.RedosanPerceptual for bundled consumers.
import "../../Fingerprint/hashing_perceptual.js";
import { PERCEPTUAL_NAMES, toAllowedSet } from "./hash-names.js";

export { PERCEPTUAL_NAMES } from "./hash-names.js";

/**
 * The functions expect a 32x32 RGBA buffer shaped like `{ data, w, h }`; they
 * do not resize, so the caller must draw the image at 32x32 first.
 * @param {{ data: Uint8ClampedArray|Uint8Array, w: number, h: number }} imageData
 *   32x32 RGBA pixels; `w` and `h` are both 32.
 * @param {Iterable<string>|null} [enabled] Perceptual names to compute.
 *   Omitted or `null` computes every name in `PERCEPTUAL_NAMES`; an empty
 *   iterable computes nothing.
 * @returns {Record<string, string>} Perceptual hash name to lowercase hex, 16
 *   characters each.
 */
export function perceptualHashes(imageData, enabled) {
  const namespace = globalThis.RedosanPerceptual;
  if (!namespace) {
    throw new Error(
      "Fingerprint/hashing_perceptual.js did not attach RedosanPerceptual; check the import order",
    );
  }
  if (!imageData || !imageData.data || !imageData.w || !imageData.h) {
    throw new TypeError("perceptualHashes expects { data, w, h }");
  }

  // Resolve the implementations once: dispatch through a Map keeps the name
  // lookup off the object itself, and a missing entry is skipped rather than
  // called.
  const allowed = toAllowedSet(enabled);
  const implementations = new Map(Object.entries(namespace));
  const entries = [];
  for (const name of PERCEPTUAL_NAMES) {
    if (allowed && !allowed.has(name)) continue;
    const implementation = implementations.get(name);
    if (typeof implementation !== "function") continue;
    try {
      entries.push([name, implementation(imageData)]);
    } catch {
      // whash has historically thrown for some inputs; omit it rather than fail.
    }
  }
  return Object.fromEntries(entries);
}
