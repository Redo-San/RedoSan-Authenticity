// On-demand inspector panel.
//
// The background injects this file into the clicked frame with
// `scripting.executeScript` (MV3) or `tabs.executeScript` (MV2) after an
// "Inspect with RedoSan" context-menu click, so nothing runs on page load and
// the manifest keeps `host_permissions: []`. `matches` is deliberately empty:
// WXT still builds `content-scripts/inspector.js`, but never registers it in
// the manifest.
import { browser } from "wxt/browser";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { defineContentScript } from "wxt/utils/define-content-script";
import panelCss from "../assets/panel.css?inline";
import reportCss from "../assets/report.css?inline";
import { inspectImage, isImageName } from "../utils/inspect-image.js";
import { directionFor, translate } from "../utils/messages.js";
import {
  buildReportModel,
  renderNotice,
  renderReport,
} from "../utils/report-view.js";
import { INSPECT_MESSAGE, MAX_IMAGE_BYTES } from "../utils/protocol.js";
import { readSettings } from "../utils/settings-storage.js";
import { fileNameFromUrl, isFetchableImageUrl } from "../utils/url.js";

/** Error whose message is a locale key rather than prose. */
class InspectionError extends Error {
  /**
   * @param {string} key Message key from `public/_locales/<lang>/messages.json`.
   */
  constructor(key) {
    super(key);
    this.name = "InspectionError";
    this.key = key;
  }
}

/**
 * Fetch the clicked image and turn it into a File for the inspector.
 * @param {string} srcUrl Image address reported by the context menu.
 * @returns {Promise<File>} Bytes named after the address.
 */
async function loadImageFile(srcUrl) {
  if (!isFetchableImageUrl(srcUrl, location.href)) {
    throw new InspectionError("errorUrl");
  }

  let response;
  try {
    response = await fetch(srcUrl);
  } catch {
    throw new InspectionError("errorFetch");
  }
  if (!response.ok) throw new InspectionError("errorFetch");

  const blob = await response.blob();
  if (blob.size > MAX_IMAGE_BYTES) throw new InspectionError("errorTooLarge");

  const name = fileNameFromUrl(srcUrl);
  if (!blob.type.startsWith("image/") && !isImageName(name)) {
    throw new InspectionError("errorNotImage");
  }
  return new File([blob], name, { type: blob.type });
}

export default defineContentScript({
  matches: [],
  registration: "runtime",
  cssInjectionMode: "manual",
  main(ctx) {
    // WXT's runtime-registration wrapper aborts the previous instance (and
    // removes its panel) before this one starts, so no manual "already
    // injected" guard is needed: a second context-menu click replaces the
    // panel instead of stacking a duplicate.
    /** @type {Awaited<ReturnType<typeof createShadowRootUi>>|null} */
    let ui = null;

    /**
     * Mount the panel, or reuse the mounted one, and apply the language.
     * @param {string} lang Language code for the chrome of the panel.
     * @returns {Promise<object>} The mounted panel elements.
     */
    async function openPanel(lang) {
      if (!ui) {
        ui = await createShadowRootUi(ctx, {
          name: "redosan-inspector",
          position: "overlay",
          alignment: "top-right",
          zIndex: 2_147_483_647,
          css: `${panelCss}\n${reportCss}`,
          onMount(container) {
            const panel = document.createElement("section");
            panel.className = "redosan-panel";
            panel.setAttribute("role", "dialog");
            panel.setAttribute("aria-label", translate("panelTitle", lang));

            const header = document.createElement("header");
            header.className = "redosan-panel__header";

            const title = document.createElement("h2");
            title.className = "redosan-panel__title";
            title.textContent = translate("panelTitle", lang);

            const close = document.createElement("button");
            close.type = "button";
            close.className = "redosan-panel__close";
            close.textContent = "×";
            close.setAttribute("aria-label", translate("panelClose", lang));
            close.title = translate("panelClose", lang);
            close.addEventListener("click", () => {
              ui?.remove();
            });

            const body = document.createElement("div");
            body.className = "redosan-panel__body";
            body.setAttribute("aria-live", "polite");

            header.append(title, close);
            panel.append(header, body);
            container.append(panel);
            return { panel, title, close, body };
          },
        });
      }
      if (!ui.mounted) ui.mount();

      const mounted = ui.mounted;
      mounted.panel.setAttribute("dir", directionFor(lang));
      mounted.title.textContent = translate("panelTitle", lang);
      mounted.close.setAttribute("aria-label", translate("panelClose", lang));
      mounted.close.title = translate("panelClose", lang);
      return mounted;
    }

    /**
     * Inspect one address and paint the result into the panel.
     * @param {string} srcUrl Image address reported by the context menu.
     * @returns {Promise<void>} Resolves once the panel shows the outcome.
     */
    async function run(srcUrl) {
      const settings = await readSettings();
      const mounted = await openPanel(settings.lang);
      mounted.body.replaceChildren(
        renderNotice("info", translate("popupInspecting", settings.lang)),
      );

      try {
        const file = await loadImageFile(srcUrl);
        const report = await inspectImage(file, {
          enabledHashes: settings.hashes,
        });
        renderReport(mounted.body, buildReportModel(report, settings.lang));
      } catch (error) {
        const detail =
          error instanceof InspectionError
            ? translate(error.key, settings.lang)
            : error instanceof Error
              ? error.message
              : String(error);
        mounted.body.replaceChildren(
          renderNotice(
            "error",
            `${translate("errorRead", settings.lang)} ${detail}`,
          ),
        );
        if (error instanceof InspectionError && error.key === "errorFetch") {
          mounted.body.append(
            renderNotice("info", translate("errorFetchHint", settings.lang)),
          );
        }
      }
    }

    /**
     * Handle the background's instruction to inspect one image.
     * @param {unknown} message Runtime message.
     * @returns {void}
     */
    function onMessage(message) {
      if (typeof message !== "object" || message === null) return;
      if (!("type" in message) || message.type !== INSPECT_MESSAGE) return;
      if (!("srcUrl" in message)) return;
      if (typeof message.srcUrl !== "string") return;
      void run(message.srcUrl);
    }

    // Register synchronously: the background sends the message as soon as
    // executeScript resolves, which can be before any awaited setup finishes.
    browser.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(onMessage);
    });

    ctx.addEventListener(document, "keydown", (event) => {
      if (event.key === "Escape" && ui?.mounted) ui.remove();
    });
  },
});
