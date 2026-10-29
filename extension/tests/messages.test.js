import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_LANGUAGE,
  MANIFEST_MESSAGE_KEYS,
  SUPPORTED_LANGUAGES,
  directionFor,
  translate,
} from "../utils/messages.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.resolve(HERE, "..", "public", "_locales");

/**
 * Read one locale file.
 * @param {string} lang Language code.
 * @returns {Record<string, {message: string, description?: string}>} Messages.
 */
function loadLocale(lang) {
  // `lang` is always a literal taken from SUPPORTED_LANGUAGES in this file.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const file = readFileSync(path.join(LOCALES, lang, "messages.json"), "utf8");
  return JSON.parse(file);
}

test("both locales define exactly the same keys", () => {
  const english = loadLocale("en");
  const arabic = loadLocale("ar");
  assert.deepEqual(
    Object.keys(english).sort(),
    Object.keys(arabic).sort(),
    "en and ar must stay in step",
  );
});

test("the manifest placeholders exist in every locale", () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    const catalogue = new Map(Object.entries(loadLocale(lang)));
    for (const key of MANIFEST_MESSAGE_KEYS) {
      const entry = catalogue.get(key);
      assert.ok(entry, `${lang} is missing ${key}`);
      assert.ok(entry.message.length > 0, `${lang}.${key} is empty`);
    }
  }
});

test("every message and description is non-empty", () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    const catalogue = Object.entries(loadLocale(lang));
    for (const [key, entry] of catalogue) {
      assert.ok(entry.message.length > 0, `${lang}.${key} has no message`);
      assert.ok(entry.description, `${lang}.${key} has no description`);
      assert.ok(
        !entry.message.includes("$"),
        `${lang}.${key} uses a Chrome placeholder; substitute in code instead`,
      );
    }
  }
});

test("translate returns the selected locale", () => {
  const english = translate("panelTitle", "en");
  const arabic = translate("panelTitle", "ar");
  assert.equal(english, "RedoSan inspection");
  assert.notEqual(arabic, english);
});

test("translate falls back to the default language", () => {
  assert.equal(
    translate("panelTitle", "de"),
    translate("panelTitle", DEFAULT_LANGUAGE),
  );
  assert.equal(
    translate("panelTitle", undefined),
    translate("panelTitle", DEFAULT_LANGUAGE),
  );
});

test("translate returns an unknown key unchanged", () => {
  assert.equal(translate("no.such.key", "en"), "no.such.key");
});

test("directionFor marks Arabic as right-to-left", () => {
  assert.equal(directionFor("ar"), "rtl");
  assert.equal(directionFor("en"), "ltr");
  assert.equal(directionFor("de"), "ltr");
});
