// Pure settings logic: defaults, validation and the hash filter. Storage lives
// in settings-storage.js so this module can be unit-tested without a browser.
import { HASH_NAMES, PERCEPTUAL_NAMES } from "./hash-names.js";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "./messages.js";

export { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "./messages.js";

/** Every hash the options page can toggle, cryptographic first. */
export const ALL_HASHES = [...HASH_NAMES, ...PERCEPTUAL_NAMES];

/**
 * Coerce a stored language to a supported one.
 * @param {unknown} value Stored or requested language.
 * @returns {string} A member of `SUPPORTED_LANGUAGES`.
 */
export function resolveLanguage(value) {
  return typeof value === "string" && SUPPORTED_LANGUAGES.includes(value)
    ? value
    : DEFAULT_LANGUAGE;
}

/**
 * Normalize a stored hash selection.
 *
 * `undefined`/`null` means the user never saved a selection, so every hash is
 * enabled. An empty array is a deliberate "compute nothing" and stays empty.
 * Unknown names and duplicates are dropped, and the result follows the
 * canonical order used by the report.
 * @param {unknown} value Stored selection.
 * @returns {string[]} Enabled hash names, in report order.
 */
export function normalizeEnabledHashes(value) {
  if (!Array.isArray(value)) return [...ALL_HASHES];
  const wanted = new Set(value.filter((name) => typeof name === "string"));
  return ALL_HASHES.filter((name) => wanted.has(name));
}

/**
 * Turn one hash on or off and return the new normalized selection.
 * @param {string[]} enabled Current selection.
 * @param {string} name Hash name to change.
 * @param {boolean} on True to enable, false to disable.
 * @returns {string[]} New selection, in report order.
 */
export function setHashEnabled(enabled, name, on) {
  const next = new Set(normalizeEnabledHashes(enabled));
  if (on) next.add(name);
  else next.delete(name);
  return ALL_HASHES.filter((candidate) => next.has(candidate));
}

/**
 * Select or clear every hash in one group.
 * @param {string[]} enabled Current selection.
 * @param {readonly string[]} group Hash names that belong to the group.
 * @param {boolean} on True to select the group, false to clear it.
 * @returns {string[]} New selection, in report order.
 */
export function setGroupEnabled(enabled, group, on) {
  const next = new Set(normalizeEnabledHashes(enabled));
  for (const name of group) {
    if (on) next.add(name);
    else next.delete(name);
  }
  return ALL_HASHES.filter((candidate) => next.has(candidate));
}
