// Guard for the manifest the extension ships. The v1 promise is "no host
// permissions, nothing injected on page load", and a stray `<all_urls>` or
// content-script registration would silently break it. The config is evaluated
// with the same `defineConfig` the build uses, so the test cannot drift from
// the shipped manifest shape.
import test from "node:test";
import assert from "node:assert/strict";

import config from "../wxt.config.js";
import { DEFAULT_LANGUAGE, MANIFEST_MESSAGE_KEYS } from "../utils/messages.js";

/**
 * Resolve the manifest for one target.
 * @param {string} browser Target browser reported by WXT.
 * @returns {Promise<object>} Manifest object for that browser.
 */
async function manifestFor(browser) {
  assert.equal(typeof config.manifest, "function");
  return config.manifest({ browser, command: "build", mode: "production" });
}

const CHROME = await manifestFor("chrome");
const FIREFOX = await manifestFor("firefox");

test("neither target asks for host permissions", () => {
  assert.deepEqual(CHROME.host_permissions, []);
  assert.deepEqual(FIREFOX.host_permissions, []);
  assert.ok(
    !JSON.stringify(CHROME).includes("<all_urls>"),
    "chrome manifest must not mention <all_urls>",
  );
  assert.ok(
    !JSON.stringify(FIREFOX).includes("<all_urls>"),
    "firefox manifest must not mention <all_urls>",
  );
});

test("no content script is registered at build time", () => {
  assert.ok(!("content_scripts" in CHROME));
  assert.ok(!("content_scripts" in FIREFOX));
  assert.ok(
    !("web_accessible_resources" in CHROME),
    "the injected bundle must not be web-accessible",
  );
});

test("permissions stay minimal and differ only where the platform does", () => {
  assert.deepEqual(CHROME.permissions, [
    "contextMenus",
    "activeTab",
    "storage",
    "scripting",
  ]);
  assert.deepEqual(FIREFOX.permissions, [
    "contextMenus",
    "activeTab",
    "storage",
  ]);
  assert.ok(!FIREFOX.permissions.includes("scripting"));
});

test("manifest strings are localized through _locales", () => {
  assert.equal(CHROME.default_locale, DEFAULT_LANGUAGE);
  assert.equal(FIREFOX.default_locale, DEFAULT_LANGUAGE);
  assert.equal(CHROME.name, "__MSG_extName__");
  assert.equal(CHROME.description, "__MSG_extDescription__");
  assert.equal(CHROME.action.default_title, "__MSG_actionTitle__");
  for (const key of MANIFEST_MESSAGE_KEYS) {
    assert.ok(
      CHROME.name.includes(`__MSG_${key}__`) ||
        CHROME.description.includes(`__MSG_${key}__`) ||
        CHROME.action.default_title.includes(`__MSG_${key}__`),
      `${key} should be referenced by the manifest`,
    );
  }
});

test("Firefox carries a stable add-on id for signing", () => {
  const gecko = FIREFOX.browser_specific_settings?.gecko;
  assert.ok(gecko);
  assert.match(gecko.id, /@/);
  assert.match(gecko.strict_min_version, /^\d+\.\d+$/);
  assert.ok(!("browser_specific_settings" in CHROME));
});

test("the AMO sources zip includes the shared fingerprint modules", () => {
  // The extension imports two scripts from the repository root. WXT archives
  // its own project root by default, which would make the sources zip
  // impossible to rebuild, so the config must widen the root and allowlist them.
  assert.equal(config.zip.sourcesRoot, "..");
  assert.ok(config.zip.includeSources.includes("Fingerprint/hashing.js"));
  assert.ok(
    config.zip.includeSources.includes("Fingerprint/hashing_perceptual.js"),
  );
  assert.ok(config.zip.excludeSources.includes("extension/tests/**"));
});
