// Canonical hash names, shared by the inspector, the options page and the
// tests. Kept apart from hashes.js/perceptual.js so a page that only lists the
// names does not have to bundle the implementations.

/** Digests computed by WebCrypto, in report order. */
export const WEB_CRYPTO = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

/**
 * Pure-JS digests as `[report name, implementation name]`, in report order.
 * The names match the web app and the CLI.
 */
export const JS_DIGESTS = [
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

/** Every cryptographic digest the extension can report. */
export const HASH_NAMES = [...WEB_CRYPTO, ...JS_DIGESTS.map(([name]) => name)];

/** Perceptual hash names, matching the web app and the CLI. */
export const PERCEPTUAL_NAMES = ["ahash", "dhash", "phash", "whash"];

/**
 * Normalize an enabled-name filter to a set.
 *
 * `null`/`undefined` means "everything"; an empty iterable means "nothing", so
 * the two cases stay distinguishable.
 * @param {Iterable<string>|null|undefined} enabled Names to keep.
 * @returns {Set<string>|null} Names to compute, or `null` for no filter.
 */
export function toAllowedSet(enabled) {
  if (enabled === null || enabled === undefined) return null;
  return enabled instanceof Set ? enabled : new Set(enabled);
}
