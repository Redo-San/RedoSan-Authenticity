// Options: language plus the hash selection. Every change is saved as it
// happens, and the popup/panel pick the new values up through storage.
import { HASH_NAMES, PERCEPTUAL_NAMES } from "../../utils/hash-names.js";
import { directionFor, translate } from "../../utils/messages.js";
import {
  ALL_HASHES,
  resolveLanguage,
  setGroupEnabled,
  setHashEnabled,
} from "../../utils/settings.js";
import {
  hashesItem,
  languageItem,
  readSettings,
} from "../../utils/settings-storage.js";

/**
 * Look up a required element.
 * @param {string} selector CSS selector.
 * @returns {HTMLElement} The matching element.
 */
function query(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`options: missing ${selector}`);
  return element;
}

const elements = {
  language: /** @type {HTMLSelectElement} */ (query("#language")),
  crypto: query("#crypto"),
  perceptual: query("#perceptual"),
  reset: query("#reset"),
  saved: query("#saved"),
};

const GROUPS = new Map([
  ["crypto", HASH_NAMES],
  ["perceptual", PERCEPTUAL_NAMES],
]);

/** @type {{lang: string, hashes: string[]}} */
let settings = { lang: "en", hashes: [] };
let savedTimer = 0;

/**
 * Apply a language to every static label.
 * @param {string} lang Language code.
 * @returns {void}
 */
function applyLanguage(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = directionFor(lang);
  document.title = `${translate("optionsTitle", lang)} — ${translate("extName", lang)}`;
  for (const element of document.querySelectorAll("[data-i18n]")) {
    const key = element.dataset.i18n;
    if (key) element.textContent = translate(key, lang);
  }
}

/**
 * Build the checkbox list for one hash group.
 * @param {HTMLElement} container List container.
 * @param {readonly string[]} names Hash names to offer.
 * @param {Set<string>} enabled Currently enabled names.
 * @returns {void}
 */
function buildList(container, names, enabled) {
  container.replaceChildren();
  for (const name of names) {
    const label = document.createElement("label");
    label.className = "options__item";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = enabled.has(name);
    input.dataset.hash = name;

    const text = document.createElement("span");
    text.textContent = name;

    label.append(input, text);
    container.append(label);
  }
}

/**
 * Reflect a selection in every checkbox.
 * @param {string[]} hashes Enabled hash names.
 * @returns {void}
 */
function applySelection(hashes) {
  const enabled = new Set(hashes);
  for (const input of document.querySelectorAll("input[data-hash]")) {
    if (input instanceof HTMLInputElement && input.dataset.hash) {
      input.checked = enabled.has(input.dataset.hash);
    }
  }
}

/**
 * Flash the "saved" confirmation.
 * @returns {void}
 */
function showSaved() {
  elements.saved.textContent = translate("optionsSaved", settings.lang);
  window.clearTimeout(savedTimer);
  savedTimer = window.setTimeout(() => {
    elements.saved.textContent = "";
  }, 1600);
}

/**
 * Persist a selection and update the page to match.
 * @param {string[]} hashes New selection, already normalized.
 * @returns {Promise<void>} Resolves once storage has the new value.
 */
async function save(hashes) {
  settings.hashes = hashes;
  applySelection(hashes);
  await hashesItem.setValue(hashes);
  showSaved();
}

/**
 * Wire the checkbox lists, the group buttons and the reset button.
 * @returns {void}
 */
function attachEvents() {
  for (const [id, names] of GROUPS) {
    const container = id === "crypto" ? elements.crypto : elements.perceptual;

    container.addEventListener("change", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      const name = input.dataset.hash;
      if (!name) return;
      void save(setHashEnabled(settings.hashes, name, input.checked));
    });

    const group = container.closest("[data-group]");
    group?.addEventListener("click", (event) => {
      const button = event.target;
      if (!(button instanceof HTMLButtonElement)) return;
      const action = button.dataset.action;
      if (action !== "all" && action !== "none") return;
      void save(setGroupEnabled(settings.hashes, names, action === "all"));
    });
  }

  elements.reset.addEventListener("click", () => {
    void save([...ALL_HASHES]);
  });

  elements.language.addEventListener("change", () => {
    const lang = resolveLanguage(elements.language.value);
    settings.lang = lang;
    applyLanguage(lang);
    showSaved();
    void languageItem.setValue(lang);
  });
}

/**
 * Load settings and paint the page.
 * @returns {Promise<void>} Resolves after the first paint.
 */
async function init() {
  settings = await readSettings();
  applyLanguage(settings.lang);
  elements.language.value = settings.lang;

  const enabled = new Set(settings.hashes);
  buildList(elements.crypto, HASH_NAMES, enabled);
  buildList(elements.perceptual, PERCEPTUAL_NAMES, enabled);

  attachEvents();
}

void init();
