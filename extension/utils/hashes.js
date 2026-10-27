// Cryptographic hashes for the inspector.
//
// The implementations are the site's own (Fingerprint/hashing.js), imported for
// their side effects because a bundler cannot see that file's top-level
// declarations. The module attaches window.RedosanHashing for exactly this
// reason; see the B8 notes in .Plans/TAURI-WXT-DISTRIBUTION-PLAN.md.
import "../../Fingerprint/hashing.js";

// Native WebCrypto digests: fast and non-blocking, so they run first.
const WEB_CRYPTO = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

// Pure-JS digests, in report order. The names match the web app and the CLI.
const JS_DIGESTS = [
  ["SHA-224", "sha224"],
  ["SHA-3_224", "sha3_224"],
  ["SHA-3_256", "sha3_256"],
  ["SHA-3_384", "sha3_384"],
  ["SHA-3_512", "sha3_512"],
  ["BLAKE2b", "blake2b"],
  ["BLAKE2s", "blake2s"],
  ["BLAKE3", "blake3"],
  ["MD2", "md2"],
  ["MD4", "md4"],
  ["MD5", "md5"],
  ["RIPEMD-160", "ripemd160"],
  ["Whirlpool", "whirlpool"],
  ["SHA-512/224", "sha512_224"],
  ["SHA-512/256", "sha512_256"],
  ["SHAKE128", "shake128"],
  ["SHAKE256", "shake256"],
];

/** All hash names this module can produce, in report order. */
export const HASH_NAMES = [...WEB_CRYPTO, ...JS_DIGESTS.map(([name]) => name)];

/**
 * Normalize the accepted binary inputs.
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {Uint8Array}
 */
export function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new TypeError("cryptoHashes: expected a Uint8Array or an ArrayBuffer");
}

/**
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string} lowercase hex
 */
function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * @param {string} algorithm
 * @param {Uint8Array} data
 * @returns {Promise<string>}
 */
async function webCryptoSha(algorithm, data) {
  return toHex(await globalThis.crypto.subtle.digest(algorithm, data));
}

/**
 *
 */
function yieldToEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Compute every supported digest for `input`.
 *
 * A digest that throws is omitted from the result (same behaviour as the CLI),
 * so callers must treat the key set as best-effort rather than fixed.
 * @param {Uint8Array|ArrayBuffer} input
 * @param {(name: string) => void} [onProgress] receives the digest name, then ""
 * @returns {Promise<Record<string, string>>}
 */
export async function cryptoHashes(input, onProgress) {
  const data = toBytes(input);
  const namespace = globalThis.RedosanHashing;
  if (!namespace) {
    throw new Error(
      "Fingerprint/hashing.js did not attach RedosanHashing; check the import order",
    );
  }

  const notify = typeof onProgress === "function" ? onProgress : () => {};
  const hashes = {};

  for (const algorithm of WEB_CRYPTO) {
    notify(algorithm);
    hashes[algorithm] = await webCryptoSha(algorithm, data);
  }

  for (const [name, fn] of JS_DIGESTS) {
    notify(name);
    try {
      hashes[name] = await namespace[fn](data);
    } catch {
      // An implementation that is unavailable or fails is simply not reported.
    }
    // Keep the popup responsive: a single pure-JS digest blocks the thread.
    await yieldToEventLoop();
  }

  notify("");
  return hashes;
}
