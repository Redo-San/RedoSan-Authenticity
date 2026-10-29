// Background: one context-menu item, and the injection it triggers.
//
// The manifest declares `activeTab` (granted by the menu click) and no host
// permissions, so the inspector file is injected into the clicked frame only,
// on demand, and never on page load.
import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { translate } from "../utils/messages.js";
import { INSPECT_MESSAGE } from "../utils/protocol.js";
import { readLanguage, watchLanguage } from "../utils/settings-storage.js";

const MENU_ID = "redosan-inspect-image";
const INSPECTOR_FILE = "content-scripts/inspector.js";

/** Serializes menu rebuilds so two language changes cannot race. */
let menuQueue = Promise.resolve();

/**
 * Rebuild the context menu with the current label.
 *
 * Menus persist across service-worker restarts, so they are only rebuilt on
 * install and when the language setting changes.
 * @param {string} lang Language code for the menu item.
 * @returns {Promise<void>} Resolves once the menu is recreated.
 */
async function refreshMenu(lang) {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: MENU_ID,
    title: translate("contextMenuTitle", lang),
    contexts: ["image"],
  });
}

/**
 * Queue a menu rebuild after the previous one.
 * @param {string} lang Language code for the menu item.
 * @returns {Promise<void>} Resolves when this rebuild has finished.
 */
function scheduleMenu(lang) {
  menuQueue = menuQueue.then(() => refreshMenu(lang)).catch(() => {});
  return menuQueue;
}

/**
 * Is the extension running as MV3 (Chrome) or MV2 (Firefox)?
 * @returns {boolean} True when `browser.scripting` is available.
 */
function isManifestV3() {
  return browser.runtime.getManifest().manifest_version === 3;
}

/**
 * Inject the inspector bundle into one frame.
 * @param {number} tabId Target tab.
 * @param {number|undefined} frameId Target frame; the top frame when omitted.
 * @returns {Promise<void>} Resolves once the script has been injected.
 */
async function injectInspector(tabId, frameId) {
  if (isManifestV3()) {
    const target =
      typeof frameId === "number" ? { tabId, frameIds: [frameId] } : { tabId };
    await browser.scripting.executeScript({
      target,
      files: [INSPECTOR_FILE],
    });
    return;
  }
  // Firefox MV2 has no `scripting` API; `activeTab` also covers executeScript.
  await browser.tabs.executeScript(tabId, {
    file: INSPECTOR_FILE,
    ...(typeof frameId === "number" && { frameId }),
  });
}

/**
 * Tell the injected content script which image to inspect.
 * @param {number} tabId Target tab.
 * @param {string} srcUrl Image address from the context menu.
 * @param {number|undefined} frameId Target frame.
 * @returns {Promise<void>} Resolves once the content script acknowledged.
 */
async function sendInspect(tabId, srcUrl, frameId) {
  const message = { type: INSPECT_MESSAGE, srcUrl };
  const options = typeof frameId === "number" ? { frameId } : undefined;
  try {
    await browser.tabs.sendMessage(tabId, message, options);
  } catch {
    // The injected wrapper may still be attaching its listener; retry once.
    await new Promise((resolve) => setTimeout(resolve, 80));
    await browser.tabs.sendMessage(tabId, message, options);
  }
}

/**
 * Handle a context-menu click on an image.
 * @param {object} info Chrome/Firefox context-menu info.
 * @param {object|undefined} tab The tab the menu was opened in.
 * @returns {Promise<void>} Resolves when the panel has been asked to render.
 */
async function handleClick(info, tab) {
  if (!info || info.menuItemId !== MENU_ID) return;
  if (!tab || typeof tab.id !== "number") return;
  if (typeof info.srcUrl !== "string" || info.srcUrl === "") return;

  const frameId = typeof info.frameId === "number" ? info.frameId : undefined;
  await injectInspector(tab.id, frameId);
  await sendInspect(tab.id, info.srcUrl, frameId);
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void readLanguage().then(scheduleMenu);
  });

  // Keep the menu label in step with the language setting.
  watchLanguage((lang) => {
    void scheduleMenu(lang);
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    void handleClick(info, tab).catch((error) => {
      console.warn("RedoSan: could not start an inspection", error);
    });
  });
});
