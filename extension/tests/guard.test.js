// Regression tests for the GPL origin guard at the top of the shared
// Fingerprint scripts.
//
// The guard is what stops a third-party site from hotlinking the site's own
// code, so it must (a) still reject unknown web origins, (b) accept the site,
// local development and file:// usage, and (c) accept extension contexts, which
// B1 relies on. Each case re-evaluates the real guard text from disk in an
// isolated vm context, so the test cannot drift from the shipped guard.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const GUARDED_FILES = [
  "Fingerprint/hashing.js",
  "Fingerprint/hashing_perceptual.js",
];

/**
 * @param {string} relativePath Repo-relative path to a guarded script.
 * @returns {string} the leading IIFE, including its `})();`
 */
function guardSource(relativePath) {
  // The path is a literal from GUARDED_FILES joined to the repo root; no user
  // input reaches the filesystem here.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const source = readFileSync(path.join(ROOT, relativePath), "utf8");
  const start = source.indexOf("(function () {");
  assert.notEqual(start, -1, `${relativePath} should open with an IIFE guard`);
  const end = source.indexOf("})();", start);
  assert.notEqual(end, -1, `${relativePath} guard should be closed`);
  return source.slice(start, end + "})();".length);
}

/**
 * Run one file's guard with a controlled global environment.
 * @param {string} relativePath Repo-relative path to a guarded script.
 * @param {object} sandbox globals visible to the guard
 * @returns {() => void} invoked with no arguments; throws if the guard rejects
 */
function loadGuard(relativePath, sandbox) {
  const context = vm.createContext({ URL, ...sandbox });
  return () =>
    vm.runInContext(guardSource(relativePath), context, {
      filename: relativePath,
    });
}

/**
 * @param {string} href Page URL to simulate.
 * @param {object} [extra] Extra globals merged into the sandbox.
 * @returns {object} sandbox with a window.location and no extension runtime
 */
function webPage(href, extra = {}) {
  return {
    window: { location: { href, protocol: new URL(href).protocol } },
    ...extra,
  };
}

for (const file of GUARDED_FILES) {
  test(`${file}: runs outside a browser (CLI, worker, Node)`, () => {
    assert.doesNotThrow(loadGuard(file, {}));
  });

  test(`${file}: accepts the published site and local development`, () => {
    const allowed = [
      "https://redo-san.github.io/RedoSan-Authenticity/",
      "http://localhost:8080/index.html",
      "http://127.0.0.1:3000/",
      "file:///C:/RedoSan%20Authenticity/index.html",
    ];
    for (const href of allowed) {
      assert.doesNotThrow(loadGuard(file, webPage(href)), href);
    }
  });

  test(`${file}: rejects unrelated web origins`, () => {
    const rejected = [
      "https://evil.example/",
      // Lookalike host that only matches as a suffix.
      "https://redo-san.github.io.evil.example/",
      // The old regex matched the host anywhere in href, so a path was enough.
      "https://evil.example/x.redo-san.github.io/",
      // Userinfo trick: the actual host is evil.example.
      "https://redo-san.github.io@evil.example/",
      "about:blank",
    ];
    for (const href of rejected) {
      assert.throws(
        loadGuard(file, webPage(href)),
        /protected by GPL license/,
        href,
      );
    }
  });

  test(`${file}: accepts a Chrome extension context`, () => {
    const chrome = { runtime: { id: "abcdefghijklmnop" } };
    assert.doesNotThrow(
      loadGuard(
        file,
        webPage("chrome-extension://abcdefghijklmnop/popup.html", { chrome }),
      ),
    );
    // Isolated content scripts keep the page's location; the runtime id is
    // what identifies the extension.
    assert.doesNotThrow(
      loadGuard(file, webPage("https://news.example/article", { chrome })),
    );
  });

  test(`${file}: accepts a Firefox extension context`, () => {
    const browser = { runtime: { id: "redosan@example" } };
    assert.doesNotThrow(
      loadGuard(file, webPage("https://news.example/article", { browser })),
    );
  });

  test(`${file}: rejects a page-defined chrome object without an id`, () => {
    assert.throws(
      loadGuard(file, webPage("https://evil.example/", { chrome: {} })),
      /protected by GPL license/,
    );
    assert.throws(
      loadGuard(
        file,
        webPage("https://evil.example/", { chrome: { runtime: {} } }),
      ),
      /protected by GPL license/,
    );
  });
}
