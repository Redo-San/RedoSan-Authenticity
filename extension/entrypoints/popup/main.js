// Popup: choose, drop or paste an image, inspect it locally, copy the report.
import { browser } from "wxt/browser";
import "../../assets/report.css";
import { reportToJson } from "../../utils/format-report.js";
import { inspectImage, isImageName } from "../../utils/inspect-image.js";
import { directionFor, translate } from "../../utils/messages.js";
import {
  buildReportModel,
  renderNotice,
  renderReport,
} from "../../utils/report-view.js";
import { readSettings, watchSettings } from "../../utils/settings-storage.js";

/**
 * Look up a required element.
 * @param {string} selector CSS selector.
 * @returns {HTMLElement} The matching element.
 */
function query(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`popup: missing ${selector}`);
  return element;
}

const elements = {
  drop: query("#drop"),
  file: /** @type {HTMLInputElement} */ (query("#file")),
  status: query("#status"),
  report: query("#report"),
  copy: /** @type {HTMLButtonElement} */ (query("#copy")),
  options: query("#options"),
};

/** @type {{lang: string, hashes: string[]}} */
let settings = { lang: "en", hashes: [] };
/** @type {object|null} */
let lastReport = null;

/**
 * Is this a file the inspector should attempt to decode?
 * @param {File} file Chosen or dropped file.
 * @returns {boolean} True for an image MIME type or image extension.
 */
function isImageFile(file) {
  return file.type.startsWith("image/") || isImageName(file.name);
}

/**
 * Show a one-line status message.
 * @param {string} text Already-localized text; empty clears the line.
 * @param {"info"|"success"|"error"} kind Visual tone.
 * @returns {void}
 */
function showStatus(text, kind) {
  elements.status.textContent = text;
  elements.status.dataset.kind = kind;
}

/**
 * Apply a language to every static label.
 * @param {string} lang Language code.
 * @returns {void}
 */
function applyLanguage(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = directionFor(lang);
  document.title = translate("popupHeading", lang);
  for (const element of document.querySelectorAll("[data-i18n]")) {
    const key = element.dataset.i18n;
    if (key) element.textContent = translate(key, lang);
  }
  elements.file.setAttribute("aria-label", translate("popupChoose", lang));
  if (!lastReport && elements.report.childElementCount === 0) {
    elements.report.replaceChildren(
      renderNotice("info", translate("popupEmpty", lang)),
    );
  }
}

/**
 * Re-render the last report in the current language.
 * @returns {void}
 */
function renderLastReport() {
  if (!lastReport) return;
  renderReport(elements.report, buildReportModel(lastReport, settings.lang));
  elements.copy.hidden = false;
}

/**
 * Inspect one file and paint the result.
 * @param {File} file Image chosen, dropped or pasted by the user.
 * @returns {Promise<void>} Resolves once the popup shows the outcome.
 */
async function run(file) {
  if (!isImageFile(file)) {
    showStatus(translate("errorNotImage", settings.lang), "error");
    return;
  }

  lastReport = null;
  elements.copy.hidden = true;
  elements.report.replaceChildren();
  showStatus(translate("popupInspecting", settings.lang), "info");

  try {
    const report = await inspectImage(file, { enabledHashes: settings.hashes });
    lastReport = report;
    renderLastReport();
    showStatus("", "info");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    showStatus(`${translate("errorRead", settings.lang)} ${detail}`, "error");
  }
}

/**
 * Run the first file of a FileList, if any.
 * @param {FileList|null|undefined} files Files from an input or drop event.
 * @returns {void}
 */
function runFirst(files) {
  const file = files && files.length > 0 ? files[0] : null;
  if (file) void run(file);
}

/**
 * Copy the last report as JSON.
 * @returns {Promise<void>} Resolves once the status line is updated.
 */
async function copyReport() {
  if (!lastReport) return;
  try {
    await navigator.clipboard.writeText(reportToJson(lastReport));
    showStatus(translate("copyDone", settings.lang), "success");
  } catch {
    showStatus(translate("copyFailed", settings.lang), "error");
  }
}

/**
 * Wire the popup controls.
 * @returns {void}
 */
function attachEvents() {
  // A drop outside the zone would otherwise navigate the popup to the file.
  document.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  document.addEventListener("drop", (event) => {
    event.preventDefault();
  });

  elements.file.addEventListener("change", () => {
    runFirst(elements.file.files);
    elements.file.value = "";
  });

  elements.drop.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.drop.classList.add("drop--over");
  });
  elements.drop.addEventListener("dragleave", () => {
    elements.drop.classList.remove("drop--over");
  });
  elements.drop.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.drop.classList.remove("drop--over");
    runFirst(event.dataTransfer?.files);
  });

  document.addEventListener("paste", (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      event.preventDefault();
      void run(file);
      return;
    }
  });

  elements.copy.addEventListener("click", () => {
    void copyReport();
  });
  elements.options.addEventListener("click", () => {
    void browser.runtime.openOptionsPage();
  });
}

/**
 * Load settings, localize the popup and start listening for changes.
 * @returns {Promise<void>} Resolves after the first paint.
 */
async function init() {
  settings = await readSettings();
  applyLanguage(settings.lang);
  attachEvents();
  watchSettings((next) => {
    settings = next;
    applyLanguage(next.lang);
    renderLastReport();
  });
}

void init();
