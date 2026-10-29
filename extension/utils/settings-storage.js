// Storage-backed settings. Uses @wxt-dev/storage (MIT) over
// `browser.storage.local`, so the same code works in the popup, the options
// page, the content script and the MV3 service worker.
import { browser } from "wxt/browser";
import { storage } from "wxt/utils/storage";
import {
  DEFAULT_LANGUAGE,
  normalizeEnabledHashes,
  resolveLanguage,
} from "./settings.js";

/**
 * Stored language. `null` means "never chosen", which falls back to the
 * browser UI language when a supported one is available.
 */
export const languageItem = storage.defineItem("local:lang", {
  fallback: null,
});

/** Stored hash selection; `null` means "all hashes". */
export const hashesItem = storage.defineItem("local:enabledHashes", {
  fallback: null,
});

/**
 * Read the effective language: the stored choice, else the browser UI
 * language, else the default.
 * @returns {Promise<string>} Supported language code.
 */
export async function readLanguage() {
  const stored = await languageItem.getValue();
  if (typeof stored === "string") return resolveLanguage(stored);
  const uiLanguage = browser.i18n.getUILanguage().slice(0, 2).toLowerCase();
  return resolveLanguage(uiLanguage || DEFAULT_LANGUAGE);
}

/**
 * Read both settings with defaults applied.
 * @returns {Promise<{lang: string, hashes: string[]}>} Effective settings.
 */
export async function readSettings() {
  const [lang, hashes] = await Promise.all([
    readLanguage(),
    hashesItem.getValue(),
  ]);
  return { lang, hashes: normalizeEnabledHashes(hashes) };
}

/**
 * Watch the stored settings and call back with the effective values.
 * @param {(settings: {lang: string, hashes: string[]}) => void} callback
 *   Called after every change, with the freshly read settings.
 * @returns {() => void} Stops watching.
 */
export function watchSettings(callback) {
  let active = true;

  /**
   * Read the settings and hand them to the caller while the watcher lives.
   * @returns {Promise<void>} Resolves after the callback returns.
   */
  async function emit() {
    const settings = await readSettings();
    if (active) callback(settings);
  }

  const unwatchLanguage = languageItem.watch(emit);
  const unwatchHashes = hashesItem.watch(emit);
  return () => {
    active = false;
    unwatchLanguage();
    unwatchHashes();
  };
}

/**
 * Watch just the language, for callers that only re-label UI.
 * @param {(lang: string) => void} callback Called with the new language.
 * @returns {() => void} Stops watching.
 */
export function watchLanguage(callback) {
  return languageItem.watch(async () => {
    const lang = await readLanguage();
    callback(lang);
  });
}
