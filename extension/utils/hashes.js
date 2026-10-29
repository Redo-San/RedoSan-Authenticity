// Cryptographic hashes for the inspector.
//
// The implementations are the site's own (Fingerprint/hashing.js), imported for
// their side effects because a bundler cannot see that file's top-level
// declarations. The module attaches window.RedosanHashing for exactly this
// reason; see the B8 notes in .Plans/TAURI-WXT-DISTRIBUTION-PLAN.md.
import "../../Fingerprint/hashing.js";
import { JS_DIGESTS, toAllowedSet, WEB_CRYPTO } from "./hash-names.js";

export { HASH_NAMES } from "./hash-names.js";

/**
 * Normalize the accepted binary inputs.
 * @param {Uint8Array|ArrayBuffer} input Bytes, or a buffer wrapping them.
 * @returns {Uint8Array} A byte view over the same memory.
 */
export function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new TypeError("cryptoHashes: expected a Uint8Array or an ArrayBuffer");
}

/**
 * Render a digest as hex.
 * @param {ArrayBuffer|Uint8Array} buffer Digest bytes straight from a hash.
 * @returns {string} Lowercase hex, two characters per byte.
 */
function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Run one digest through WebCrypto.
 * @param {string} algorithm WebCrypto name, e.g. `SHA-256`.
 * @param {Uint8Array} data Bytes to digest.
 * @returns {Promise<string>} Lowercase hex digest.
 */
async function webCryptoSha(algorithm, data) {
  return toHex(await globalThis.crypto.subtle.digest(algorithm, data));
}

/**
 * Yield to the event loop between digests.
 * @returns {Promise<void>} Resolves on the next turn of the event loop.
 */
function yieldToEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Compute the selected digests for `input`.
 *
 * A digest that throws is omitted from the result (same behaviour as the CLI),
 * so callers must treat the key set as best-effort rather than fixed.
 * @param {Uint8Array|ArrayBuffer} input File bytes to hash.
 * @param {(name: string) => void} [onProgress] Progress callback: the digest
 *   name before each one runs, then "" once the set is complete.
 * @param {Iterable<string>|null} [enabled] Hash names to compute. Omitted or
 *   `null` computes every name in `HASH_NAMES`; an empty iterable computes
 *   nothing.
 * @returns {Promise<Record<string, string>>} Hash name to lowercase hex digest.
 */
export async function cryptoHashes(input, onProgress, enabled) {
  const data = toBytes(input);
  const namespace = globalThis.RedosanHashing;
  if (!namespace) {
    throw new Error(
      "Fingerprint/hashing.js did not attach RedosanHashing; check the import order",
    );
  }

  const allowed = toAllowedSet(enabled);
  const notify = typeof onProgress === "function" ? onProgress : () => {};
  const entries = [];

  for (const algorithm of WEB_CRYPTO) {
    if (allowed && !allowed.has(algorithm)) continue;
    notify(algorithm);
    entries.push([algorithm, await webCryptoSha(algorithm, data)]);
  }

  // Dispatch through a Map: the pure-JS implementations are looked up by name
  // once, and an entry that is missing or not a function is skipped instead of
  // being called.
  const implementations = new Map(Object.entries(namespace));
  for (const [name, fn] of JS_DIGESTS) {
    if (allowed && !allowed.has(name)) continue;
    notify(name);
    const implementation = implementations.get(fn);
    if (typeof implementation === "function") {
      try {
        entries.push([name, await implementation(data)]);
      } catch {
        // An implementation that is unavailable or fails is simply not reported.
      }
    }
    // Keep the popup responsive: a single pure-JS digest blocks the thread.
    await yieldToEventLoop();
  }

  notify("");
  return Object.fromEntries(entries);
}
