// UI strings for the extension.
//
// The JSON files under `public/_locales/` are the single source: the browser
// reads them for `__MSG_*__` manifest placeholders, and this module imports
// them for the in-page UI. Both locales are bundled on purpose, because
// `browser.i18n.getMessage` only returns the browser's UI language while the
// options page lets the user pick a different one.
import ar from "../public/_locales/ar/messages.json" with { type: "json" };
import en from "../public/_locales/en/messages.json" with { type: "json" };

/** Languages the options page offers, in display order. */
export const SUPPORTED_LANGUAGES = ["en", "ar"];

/** Default language; must match `default_locale` in wxt.config.js. */
export const DEFAULT_LANGUAGE = "en";

/** Message keys the manifest references through `__MSG_key__`. */
export const MANIFEST_MESSAGE_KEYS = [
  "extName",
  "extDescription",
  "actionTitle",
];

const CATALOGS = new Map([
  ["en", new Map(Object.entries(en))],
  ["ar", new Map(Object.entries(ar))],
]);

/**
 * Look up one message entry.
 * @param {string} key Message key, e.g. `panelTitle`.
 * @param {string} lang Language code; unknown codes fall back to the default.
 * @returns {{message: string}|undefined} Entry from the locale file, if any.
 */
function lookup(key, lang) {
  const catalog = CATALOGS.get(lang) ?? CATALOGS.get(DEFAULT_LANGUAGE);
  return catalog.get(key) ?? CATALOGS.get(DEFAULT_LANGUAGE).get(key);
}

/**
 * Translate one message key.
 *
 * Unknown keys return the key itself so a missing string is visible in the UI
 * instead of rendering as an empty element.
 * @param {string} key Message key from `public/_locales/<lang>/messages.json`.
 * @param {string} lang Language code (`en` or `ar`).
 * @returns {string} Localized text.
 */
export function translate(key, lang) {
  const entry = lookup(key, lang);
  return entry ? entry.message : key;
}

/**
 * Direction to use for a language.
 * @param {string} lang Language code.
 * @returns {"rtl"|"ltr"} Text direction.
 */
export function directionFor(lang) {
  return lang === "ar" ? "rtl" : "ltr";
}
