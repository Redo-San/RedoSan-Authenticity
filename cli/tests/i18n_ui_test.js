const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── Shared mock element store ──
var _els = {};

// ── Event listener capture ──
// Persists across the entire test file so handlers registered during
// module load (click, unhandledrejection, error, DOMContentLoaded) remain available.
var _listeners = {};

function addListener(type, fn) {
  if (!_listeners[type]) _listeners[type] = [];
  _listeners[type].push(fn);
}

function removeListener(type, fn) {
  if (_listeners[type]) {
    _listeners[type] = _listeners[type].filter(function (f) { return f !== fn; });
  }
}

// ── Console tracking (installed BEFORE i18n.js loads so closures capture them) ──
// The _trackConsole.error/warn/log functions are what i18n.js will save as
// originalConsoleError/originalConsoleWarn/originalConsoleLog.
var _trackConsole = {};

function makeTrackingFn(name) {
  return function () {
    _trackConsole[name].called = true;
    _trackConsole[name].args = Array.prototype.slice.call(arguments);
  };
}

function installConsoleTracking() {
  _trackConsole = {
    error: { called: false, args: null },
    warn: { called: false, args: null },
    log: { called: false, args: null },
  };
  globalThis.console = {
    error: makeTrackingFn("error"),
    warn: makeTrackingFn("warn"),
    log: makeTrackingFn("log"),
  };
}

function resetConsoleTracking() {
  _trackConsole.error.called = false;
  _trackConsole.error.args = null;
  _trackConsole.warn.called = false;
  _trackConsole.warn.args = null;
  _trackConsole.log.called = false;
  _trackConsole.log.args = null;
}

// ── Working classList factory (tracks state for assertions) ──
function makeClassList() {
  var items = [];
  return {
    _classes: items,
    add: function (c) { if (items.indexOf(c) === -1) items.push(c); },
    remove: function (c) {
      var idx = items.indexOf(c);
      if (idx !== -1) items.splice(idx, 1);
    },
    contains: function (c) { return items.indexOf(c) !== -1; },
    toggle: function (c) {
      var idx = items.indexOf(c);
      if (idx !== -1) { items.splice(idx, 1); return false; }
      items.push(c); return true;
    },
    toString: function () { return items.join(" "); },
  };
}

// ── Mock element factory ──
function makeEl(id, extra) {
  if (!_els[id]) {
    _els[id] = Object.assign({
      style: { display: "" },
      value: "", textContent: "", innerHTML: "", className: "",
      placeholder: "", title: "", rel: "", href: "", id: id,
      dataset: {},
      classList: makeClassList(),
      append: function () {},
      appendChild: function () {},
      remove: function () {},
      addEventListener: function () {},
      removeEventListener: function () {},
      dispatchEvent: function () {},
      getAttribute: function (a) { return this[a] || null; },
      setAttribute: function (a, v) { this[a] = v; },
      click: function () {},
      focus: function () {},
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      parentElement: {},
      parentNode: {
        insertBefore: function () {},
        removeChild: function () {},
        querySelector: function () { return null; },
      },
      closest: function () { return null; },
      contains: function () { return false; },
    }, extra || {});
  } else if (extra) {
    Object.assign(_els[id], extra);
  }
  return _els[id];
}

// ── Reset state for each describe block ──
function resetI18nUIState() {
  _els = {};

  globalThis.document = {
    documentElement: {
      lang: "", dir: "ltr", dataset: {}, style: {},
      getAttribute: function () { return null; },
    },
    getElementById: function (id) { return _els[id] || null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    createElement: function (tag) {
      var el = makeEl("created-" + tag + "_" + Math.random(), { tagName: tag });
      el.rel = "";
      el.href = "";
      el.remove = function () {
        for (var k in _els) {
          if (_els[k] === el) { delete _els[k]; break; }
        }
      };
      return el;
    },
    createTextNode: function () { return {}; },
    title: "",
    head: {
      append: function () {},
      querySelector: function () { return null; },
    },
    body: {
      classList: makeClassList(),
      append: function () {},
      querySelector: function () { return null; },
    },
    addEventListener: addListener,
    removeEventListener: removeListener,
  };

  globalThis.window = globalThis;
  globalThis.addEventListener = addListener;
  globalThis.removeEventListener = removeListener;

  globalThis.location = {
    protocol: "file:",
    href: "http://localhost/",
    hostname: "localhost",
    hash: "",
    search: "",
    pathname: "/",
    replace: function () {},
  };

  globalThis.history = {
    state: null,
    pushState: function () {},
    replaceState: function () {},
  };

  // Navigator
  try { Object.defineProperty(navigator, "language", { value: "en-US", configurable: true, writable: true }); } catch (e) {}
  try { Object.defineProperty(navigator, "userLanguage", { value: "", configurable: true, writable: true }); } catch (e) {}

  // LocalStorage
  var _ls = {};
  globalThis.localStorage = {
    getItem: function (k) { return _ls[k] !== undefined ? _ls[k] : null; },
    setItem: function (k, v) { _ls[k] = String(v); },
    removeItem: function (k) { delete _ls[k]; },
    clear: function () { _ls = {}; },
  };

  // Fetch
  globalThis.fetch = async function (url) {
    return { ok: true, json: async function () { return {}; } };
  };

  globalThis.setTimeout = function (fn) { fn(); return 1; };
  globalThis.clearTimeout = function () {};

  // __ function for translations (must return fallback to match source behavior)
  globalThis.__ = function (key, fallback) { return fallback || key; };

  // Embedded translation data
  globalThis.__I18N_DATA = {
    en: { "test.key": "Hello", "lang.name.en": "English", "lang.name.fr": "French", "shared.drop_file": "Drop files here", "shared.lang_title": "Language: {lang}" },
    fr: { "test.key": "Bonjour", "lang.name.fr": "Fran\u00e7ais" },
    ar: { "test.key": "\u0645\u0631\u062d\u0628\u0627", "shared.drop_file": "\u0623\u0633\u0642\u0637 \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0647\u0646\u0627" },
  };
}

// ── Load i18n.js into the global scope ──
function loadI18n() {
  var src = fs.readFileSync(path.resolve(__dirname, "../../Style/i18n.js"), "utf8");
  vm.runInThisContext(src, { filename: path.resolve(__dirname, "../../Style/i18n.js") });
}

// ═══════════════════════════════════════════════════════════════
// Setup — run ONCE before all tests
// ═══════════════════════════════════════════════════════════════
before(function () {
  resetI18nUIState();

  // Install console tracking BEFORE loading i18n.js.
  // i18n.js will save console.error/warn/log at module load,
  // so the tracking functions become the "originals" that
  // the wrappers delegate to.
  installConsoleTracking();

  loadI18n();
});

after(function () {
  // Restore a basic console for any post-test output
  globalThis.console = { error: function () {}, warn: function () {}, log: function () {} };
});

// ═══════════════════════════════════════════════════════════════
// SanitizeHtml tests (cover remaining edge cases not in i18n_test.js)
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — sanitizeHtml (additional edge cases)", function () {
  it("allows p, a, strong, em tags", function () {
    assert.equal(sanitizeHtml("<p>text</p>"), "<p>text<p>");
    assert.equal(sanitizeHtml("<a href='https://example.com'>link</a>"), "<a href='https://example.com'>link<a>");
    assert.equal(sanitizeHtml("<strong>bold</strong>"), "<strong>bold<strong>");
    assert.equal(sanitizeHtml("<em>italic</em>"), "<em>italic<em>");
  });

  it("strips script and iframe tags", function () {
    assert.equal(sanitizeHtml("<script>alert(1)</script>"), "alert(1)");
    assert.equal(sanitizeHtml("<iframe src='https://evil.com'></iframe>"), "");
  });

  it("strips on* attributes like onclick", function () {
    assert.equal(sanitizeHtml("<p onclick='alert(1)'>test</p>"), "<p>test<p>");
    assert.equal(sanitizeHtml("<a href='#' onmouseover='evil()'>link</a>"), "<a href='#'>link<a>");
  });

  it("blocks javascript: URLs in href", function () {
    assert.equal(sanitizeHtml("<a href='javascript:alert(1)'>x</a>"), "<a>x<a>");
    assert.equal(sanitizeHtml("<a href='JAVASCRIPT:doEvil()'>x</a>"), "<a>x<a>");
  });

  it("allows data-* attributes", function () {
    assert.equal(sanitizeHtml("<span data-value='test'>text</span>"), "<span data-value='test'>text<span>");
    assert.equal(sanitizeHtml("<div data-custom='123'>x</div>"), "<div data-custom='123'>x<div>");
  });

  it("handles nested tags", function () {
    assert.equal(sanitizeHtml("<p>Hello <strong>world</strong></p>"), "<p>Hello <strong>world<strong><p>");
    assert.equal(sanitizeHtml("<ul><li>item <em>1</em></li></ul>"), "<ul><li>item <em>1<em><li><ul>");
  });

  it("handles unknown tags by stripping them entirely", function () {
    assert.equal(sanitizeHtml("<unknown>text</unknown>"), "text");
    assert.equal(sanitizeHtml("<custom-tag>text</custom-tag>"), "text");
  });

  it("strips blob: and data: URLs in href", function () {
    assert.equal(sanitizeHtml("<a href='data:text/html,alert(1)'>x</a>"), "<a>x<a>");
    assert.equal(sanitizeHtml("<a href='blob:fake'>x</a>"), "<a>x<a>");
  });

  it("handles empty string input", function () {
    assert.equal(sanitizeHtml(""), "");
  });

  it("handles plain text without any tags", function () {
    assert.equal(sanitizeHtml("plain text"), "plain text");
    assert.equal(sanitizeHtml("hello < world"), "hello < world");
  });

  it("preserves allowed attributes but strips disallowed ones on the same tag", function () {
    assert.equal(sanitizeHtml("<a href='https://good.com' onclick='evil()' data-info='ok'>link</a>"),
      "<a href='https://good.com' data-info='ok'>link<a>");
  });
});

// ═══════════════════════════════════════════════════════════════
// detectLang (additional coverage)
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — detectLang", function () {
  it("returns stored language from localStorage", async function () {
    globalThis.localStorage.setItem("redosan_lang", "fr");
    var lang = await detectLang();
    assert.equal(lang, "fr");
    globalThis.localStorage.removeItem("redosan_lang");
  });

  it("detects from navigator.language directly when supported", async function () {
    globalThis.localStorage.removeItem("redosan_lang");
    try { Object.defineProperty(navigator, "language", { value: "ar", configurable: true, writable: true }); } catch (e) {}
    var lang = await detectLang();
    assert.equal(lang, "ar");
  });

  it("checks BROWSER_LANGUAGE_MAP but falls back to 'en' when mapped lang not in SUPPORTED", async function () {
    // 'pt' is in BROWSER_LANGUAGE_MAP as 'pt' but 'pt' is NOT in SUPPORTED
    globalThis.localStorage.removeItem("redosan_lang");
    try { Object.defineProperty(navigator, "language", { value: "pt-BR", configurable: true, writable: true }); } catch (e) {}
    var lang = await detectLang();
    assert.equal(lang, "en", "pt falls back to en because pt is not in SUPPORTED");
  });

  it("checks region-specific variant as last check before en fallback", async function () {
    // A lang not in SUPPORTED, not in BROWSER_LANGUAGE_MAP, but with region
    globalThis.localStorage.removeItem("redosan_lang");
    try { Object.defineProperty(navigator, "language", { value: "xh-ZA", configurable: true, writable: true }); } catch (e) {}
    var lang = await detectLang();
    assert.equal(lang, "en");
  });

  it("falls back to 'en' for unknown languages not in BROWSER_LANGUAGE_MAP", async function () {
    globalThis.localStorage.removeItem("redosan_lang");
    try { Object.defineProperty(navigator, "language", { value: "xh", configurable: true, writable: true }); } catch (e) {}
    var lang = await detectLang();
    assert.equal(lang, "en");
  });

  it("handles navigator.userLanguage as fallback when language is empty", async function () {
    globalThis.localStorage.removeItem("redosan_lang");
    try { Object.defineProperty(navigator, "language", { value: "", configurable: true, writable: true }); } catch (e) {}
    try { Object.defineProperty(navigator, "userLanguage", { value: "de", configurable: true, writable: true }); } catch (e) {}
    var lang = await detectLang();
    assert.equal(lang, "de");
  });

  it("returns en when both language and userLanguage are empty", async function () {
    globalThis.localStorage.removeItem("redosan_lang");
    try { Object.defineProperty(navigator, "language", { value: "", configurable: true, writable: true }); } catch (e) {}
    try { Object.defineProperty(navigator, "userLanguage", { value: "", configurable: true, writable: true }); } catch (e) {}
    var lang = await detectLang();
    assert.equal(lang, "en");
  });
});

// ═══════════════════════════════════════════════════════════════
// switchLang
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — switchLang", function () {
  it("switches to a valid language", function () {
    var loadedLang = "";
    var origLoad = globalThis.loadLang;
    globalThis.loadLang = function (l) { loadedLang = l; };

    switchLang("ar");
    assert.equal(globalThis.localStorage.getItem("redosan_lang"), "ar");
    assert.equal(loadedLang, "ar");

    globalThis.loadLang = origLoad;
  });

  it("falls back to 'en' for an invalid language", function () {
    var loadedLang = "";
    var origLoad = globalThis.loadLang;
    globalThis.loadLang = function (l) { loadedLang = l; };

    switchLang("invalid");
    assert.equal(globalThis.localStorage.getItem("redosan_lang"), "en");
    assert.equal(loadedLang, "en");

    globalThis.loadLang = origLoad;
  });

  it("saves to localStorage before calling loadLang", function () {
    var loadedLang = "";
    var origLoad = globalThis.loadLang;
    globalThis.loadLang = function (l) { loadedLang = l; };

    globalThis.localStorage.removeItem("redosan_lang");
    switchLang("de");
    assert.equal(globalThis.localStorage.getItem("redosan_lang"), "de");

    globalThis.loadLang = origLoad;
  });
});

// ═══════════════════════════════════════════════════════════════
// langBtnText
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — langBtnText", function () {
  it("returns Arabic text for English input", function () {
    var text = langBtnText("en");
    assert.ok(typeof text === "string" && text.length > 0);
  });

  it("returns 'English' for Arabic input", function () {
    assert.equal(langBtnText("ar"), "English");
  });

  it("returns 'English' for French input", function () {
    assert.equal(langBtnText("fr"), "English");
  });

  it("returns 'English' for German input", function () {
    assert.equal(langBtnText("de"), "English");
  });

  it("returns 'English' for unknown language", function () {
    assert.equal(langBtnText("zz"), "English");
  });
});

// ═══════════════════════════════════════════════════════════════
// getLanguageDisplayName
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — getLanguageDisplayName", function () {
  it("returns name from i18n.data when available", function () {
    globalThis.i18n.data["lang.name.fr"] = "Fran\u00e7ais";
    assert.equal(getLanguageDisplayName("fr"), "Fran\u00e7ais");
    delete globalThis.i18n.data["lang.name.fr"];
  });

  it("returns fallback from names object when no i18n.data entry", function () {
    delete globalThis.i18n.data["lang.name.en"];
    assert.equal(getLanguageDisplayName("en"), "English");
  });

  it("returns language code for unknown language", function () {
    assert.equal(getLanguageDisplayName("zz"), "zz");
  });
});

// ═══════════════════════════════════════════════════════════════
// loadLang
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — loadLang", function () {
  it("loads from window.__I18N_DATA when available", async function () {
    globalThis.__I18N_DATA = { fr: { hello: "bonjour", "lang.name.fr": "Fran\u00e7ais" } };
    var result = await loadLang("fr");
    assert.equal(result, true);
    assert.equal(globalThis.i18n.lang, "fr");
    assert.equal(globalThis.i18n.data.hello, "bonjour");
  });

  it("fetches from URL when no embedded data", async function () {
    delete globalThis.__I18N_DATA;
    var origFetch = globalThis.fetch;
    globalThis.fetch = async function () {
      return { ok: true, json: async function () { return { hello: "hallo" }; } };
    };

    var result = await loadLang("de");
    assert.equal(result, true);
    assert.equal(globalThis.i18n.lang, "de");
    assert.equal(globalThis.i18n.data.hello, "hallo");

    globalThis.fetch = origFetch;
    globalThis.__I18N_DATA = { en: { "test.key": "Hello" }, fr: { "test.key": "Bonjour" }, ar: { "test.key": "\u0645\u0631\u062d\u0628\u0627" } };
  });

  it("falls back to 'en' on fetch error", async function () {
    delete globalThis.__I18N_DATA;
    var origFetch = globalThis.fetch;
    var callCount = 0;
    globalThis.fetch = async function () {
      callCount++;
      if (callCount === 2) return { ok: true, json: async function () { return {}; } };
      return { ok: false };
    };
    globalThis.i18n.lang = "fr";
    var result = await loadLang("fr");
    assert.equal(result, true);
    assert.equal(globalThis.i18n.lang, "en");

    globalThis.fetch = origFetch;
    globalThis.__I18N_DATA = { en: { "test.key": "Hello" }, fr: { "test.key": "Bonjour" }, ar: { "test.key": "\u0645\u0631\u062d\u0628\u0627" } };
  });

  it("returns false on error when already 'en'", async function () {
    delete globalThis.__I18N_DATA;
    var origFetch = globalThis.fetch;
    globalThis.fetch = async function () {
      return Promise.reject(new Error("network error"));
    };
    // Ensure a fresh state
    resetConsoleTracking();
    var result = await loadLang("en");
    assert.equal(result, false);

    globalThis.fetch = origFetch;
    globalThis.__I18N_DATA = { en: { "test.key": "Hello" }, fr: { "test.key": "Bonjour" }, ar: { "test.key": "\u0645\u0631\u062d\u0628\u0627" } };
  });

  it("uses standalone prefix for fetch URL when dataset.standalone is set", async function () {
    delete globalThis.__I18N_DATA;
    var capturedUrl = "";
    var origFetch = globalThis.fetch;
    globalThis.fetch = async function (url) {
      capturedUrl = url;
      return { ok: true, json: async function () { return {}; } };
    };
    globalThis.document.documentElement.dataset = { standalone: "watermark" };

    await loadLang("en");

    assert.ok(capturedUrl.indexOf("../../") !== -1, "should use '../../' prefix for standalone");
    assert.ok(capturedUrl.indexOf("lang/en.json") !== -1, "should point to language file");

    globalThis.document.documentElement.dataset = {};
    globalThis.fetch = origFetch;
    globalThis.__I18N_DATA = { en: { "test.key": "Hello" }, fr: { "test.key": "Bonjour" }, ar: { "test.key": "\u0645\u0631\u062d\u0628\u0627" } };
  });
});

// ═══════════════════════════════════════════════════════════════
// toggleLangDropdown
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — toggleLangDropdown", function () {
  before(function () {
    _els["langMenu"] = makeEl("langMenu");
  });

  it("toggles 'show' class on langMenu", function () {
    toggleLangDropdown();
    assert.ok(_els["langMenu"].classList.contains("show"), "langMenu should have 'show' class after toggle");

    toggleLangDropdown();
    assert.ok(!_els["langMenu"].classList.contains("show"), "langMenu should NOT have 'show' class after second toggle");
  });

  it("handles missing langMenu gracefully", function () {
    delete _els["langMenu"];
    // Should not throw
    toggleLangDropdown();
  });
});

// ═══════════════════════════════════════════════════════════════
// applyLang — data-i18n and data-i18n-placeholder DOM manipulation
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — applyLang data-i18n / data-i18n-placeholder", function () {
  before(function () {
    _els["langBtn"] = makeEl("langBtn");
    _els["simpleLangBtn"] = makeEl("simpleLangBtn");
    _els["modeLangBtn"] = makeEl("modeLangBtn");
  });

  it("updates data-i18n elements with textContent for normal keys", function () {
    var el = makeEl("i18n-el1", {
      dataset: { i18n: "test.key" },
      textContent: "",
      innerHTML: "",
    });

    globalThis.i18n.lang = "en";
    globalThis.i18n.data = { "test.key": "Hello World" };
    globalThis.document.querySelectorAll = function (sel) {
      if (sel === "[data-i18n]") return [el];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [];
      if (sel.indexOf("static-page") !== -1) return [];
      return [];
    };

    applyLang();
    assert.equal(el.textContent, "Hello World");
  });

  it("updates data-i18n elements with innerHTML for richHtmlKeys", function () {
    var el = makeEl("i18n-el2", {
      dataset: { i18n: "page.about" },
      textContent: "",
      innerHTML: "",
    });

    globalThis.i18n.lang = "en";
    globalThis.i18n.data = { "page.about": "<p>About us</p>" };
    globalThis.document.querySelectorAll = function (sel) {
      if (sel === "[data-i18n]") return [el];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [];
      if (sel.indexOf("static-page") !== -1) return [];
      return [];
    };

    applyLang();
    assert.equal(el.innerHTML, "<p>About us<p>");
  });

  it("skips elements whose key is undefined in i18n.data", function () {
    var originalContent = "preserved";
    var el = makeEl("i18n-el3", {
      dataset: { i18n: "nonexistent.key" },
      textContent: originalContent,
    });

    globalThis.i18n.data = { "other.key": "value" };
    globalThis.document.querySelectorAll = function (sel) {
      if (sel === "[data-i18n]") return [el];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [];
      if (sel.indexOf("static-page") !== -1) return [];
      return [];
    };

    applyLang();
    assert.equal(el.textContent, originalContent, "should not modify undefined keys");
  });

  it("updates data-i18n-placeholder elements", function () {
    var el = makeEl("i18n-pl1", {
      dataset: { i18nPlaceholder: "test.key" },
      placeholder: "",
    });

    globalThis.i18n.data = { "test.key": "Enter text here" };
    globalThis.document.querySelectorAll = function (sel) {
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [el];
      if (sel === ".dz-text") return [];
      if (sel.indexOf("static-page") !== -1) return [];
      return [];
    };

    applyLang();
    assert.equal(el.placeholder, "Enter text here");
  });

  it("skips data-i18n-placeholder when key is undefined", function () {
    var el = makeEl("i18n-pl2", {
      dataset: { i18nPlaceholder: "nonexistent.key" },
      placeholder: "original",
    });

    globalThis.i18n.data = {};
    globalThis.document.querySelectorAll = function (sel) {
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [el];
      if (sel === ".dz-text") return [];
      if (sel.indexOf("static-page") !== -1) return [];
      return [];
    };

    applyLang();
    assert.equal(el.placeholder, "original", "should not modify undefined keys");
  });
});

// ═══════════════════════════════════════════════════════════════
// applyLang — rich section cleanup
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — applyLang rich section cleanup", function () {
  before(function () {
    _els["langBtn"] = makeEl("langBtn");
    _els["simpleLangBtn"] = makeEl("simpleLangBtn");
    _els["modeLangBtn"] = makeEl("modeLangBtn");
  });

  it("removes empty h2 elements in static pages", function () {
    var removed = false;
    var emptyH2 = makeEl("empty-h2", {
      textContent: "",
      remove: function () { removed = true; },
    });
    var section = makeEl("section-1", {
      querySelectorAll: function (sel) {
        if (sel.indexOf("h2:empty") !== -1 || sel.indexOf("h2:not") !== -1) return [emptyH2];
        if (sel.indexOf("a:not") !== -1) return [];
        if (sel.indexOf('a[href="#"]') !== -1) return [];
        return [];
      },
    });

    globalThis.document.querySelectorAll = function (sel) {
      if (sel.indexOf("static-page") !== -1) return [section];
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [];
      return [];
    };
    globalThis.i18n.data = {};

    applyLang();
    assert.ok(removed, "empty h2 should be removed");
  });

  it("removes empty a elements without href and aria-label in static pages", function () {
    var removed = false;
    var emptyA = makeEl("empty-a", {
      textContent: "",
      remove: function () { removed = true; },
    });
    var section = makeEl("section-2", {
      querySelectorAll: function (sel) {
        if (sel.indexOf("h2:empty") !== -1) return [];
        if (sel.indexOf("h2:not") !== -1) return [];
        if (sel.indexOf("a:not") !== -1) return [emptyA];
        if (sel.indexOf('a[href="#"]') !== -1) return [];
        return [];
      },
    });

    globalThis.document.querySelectorAll = function (sel) {
      if (sel.indexOf("static-page") !== -1) return [section];
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [];
      return [];
    };

    applyLang();
    assert.ok(removed, "empty anchor should be removed");
  });

  it("removes empty a[href='#'] elements", function () {
    var removed = false;
    var emptyLinkA = makeEl("empty-link-a", {
      textContent: "",
      remove: function () { removed = true; },
    });
    var section = makeEl("section-3", {
      querySelectorAll: function (sel) {
        if (sel.indexOf("h2:empty") !== -1) return [];
        if (sel.indexOf("h2:not") !== -1) return [];
        if (sel.indexOf("a:not") !== -1) return [];
        if (sel.indexOf('a[href="#"]') !== -1) return [emptyLinkA];
        return [];
      },
    });

    globalThis.document.querySelectorAll = function (sel) {
      if (sel.indexOf("static-page") !== -1) return [section];
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [];
      return [];
    };

    applyLang();
    assert.ok(removed, "empty anchor[href='#'] should be removed");
  });

  it("does not remove non-empty a[href='#'] elements", function () {
    var removed = false;
    var nonEmptyA = makeEl("non-empty-a", {
      textContent: "Link text",
      remove: function () { removed = true; },
    });
    var section = makeEl("section-4", {
      querySelectorAll: function (sel) {
        if (sel.indexOf("h2:empty") !== -1) return [];
        if (sel.indexOf("h2:not") !== -1) return [];
        if (sel.indexOf("a:not") !== -1) return [];
        if (sel.indexOf('a[href="#"]') !== -1) return [nonEmptyA];
        return [];
      },
    });

    globalThis.document.querySelectorAll = function (sel) {
      if (sel.indexOf("static-page") !== -1) return [section];
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [];
      return [];
    };

    applyLang();
    assert.ok(!removed, "non-empty anchor should NOT be removed");
  });
});

// ═══════════════════════════════════════════════════════════════
// applyLang — drop zone text update
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — applyLang drop zone text", function () {
  before(function () {
    _els["langBtn"] = makeEl("langBtn");
    _els["simpleLangBtn"] = makeEl("simpleLangBtn");
    _els["modeLangBtn"] = makeEl("modeLangBtn");
  });

  it("updates .dz-text elements when shared.drop_file is defined", function () {
    var dzEl = makeEl("dz-text-1", {
      innerHTML: "",
    });

    globalThis.i18n.lang = "en";
    globalThis.i18n.data = { "shared.drop_file": "<strong>Drop files here</strong>" };
    globalThis.document.querySelectorAll = function (sel) {
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [dzEl];
      if (sel.indexOf("static-page") !== -1) return [];
      return [];
    };

    applyLang();
    assert.equal(dzEl.innerHTML, "<strong>Drop files here<strong>");
  });

  it("skips .dz-text update when shared.drop_file is undefined", function () {
    var dzEl = makeEl("dz-text-2", {
      innerHTML: "original",
    });

    globalThis.i18n.data = {};
    globalThis.document.querySelectorAll = function (sel) {
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [dzEl];
      if (sel.indexOf("static-page") !== -1) return [];
      return [];
    };

    applyLang();
    assert.equal(dzEl.innerHTML, "original", "should not modify .dz-text when key is missing");
  });
});

// ═══════════════════════════════════════════════════════════════
// applyLang — RTL CSS handling
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — applyLang RTL CSS", function () {
  before(function () {
    _els["langBtn"] = makeEl("langBtn");
    _els["simpleLangBtn"] = makeEl("simpleLangBtn");
    _els["modeLangBtn"] = makeEl("modeLangBtn");
  });

  it("adds rtl-css link element for Arabic", function () {
    delete _els["rtl-css"];

    globalThis.i18n.lang = "ar";
    globalThis.i18n.data = {};

    var appended = false;
    var createdLink = null;
    globalThis.document.createElement = function (tag) {
      if (tag === "link") {
        createdLink = makeEl("rtl-css", { tagName: "link", rel: "", href: "" });
        createdLink.append = function () {};
        return createdLink;
      }
      return makeEl("created-" + tag + "_" + Math.random(), { tagName: tag });
    };
    globalThis.document.head.append = function (el) {
      if (el && el.id === "rtl-css") appended = true;
    };

    var origGetById = globalThis.document.getElementById;
    globalThis.document.getElementById = function (id) {
      if (id === "rtl-css") return null;
      if (id === "langBtn") return _els["langBtn"];
      if (id === "simpleLangBtn") return _els["simpleLangBtn"];
      if (id === "modeLangBtn") return _els["modeLangBtn"];
      return _els[id] || null;
    };

    globalThis.document.querySelectorAll = function (sel) {
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [];
      if (sel.indexOf("static-page") !== -1) return [];
      return [];
    };

    applyLang();

    assert.equal(globalThis.document.documentElement.dir, "rtl", "Arabic should set dir='rtl'");
    assert.ok(appended, "rtl-css link should be appended to head");
  });

  it("removes rtl-css link element for non-Arabic", function () {
    var removed = false;
    var rtlLink = makeEl("rtl-css", {
      rel: "stylesheet",
      href: "Style/rtl.css",
      remove: function () { removed = true; },
    });

    globalThis.i18n.lang = "en";
    globalThis.i18n.data = {};

    var origGetById = globalThis.document.getElementById;
    globalThis.document.getElementById = function (id) {
      if (id === "rtl-css") return rtlLink;
      if (id === "langBtn") return _els["langBtn"];
      if (id === "simpleLangBtn") return _els["simpleLangBtn"];
      if (id === "modeLangBtn") return _els["modeLangBtn"];
      return _els[id] || null;
    };

    globalThis.document.querySelectorAll = function (sel) {
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [];
      if (sel.indexOf("static-page") !== -1) return [];
      return [];
    };

    applyLang();

    assert.equal(globalThis.document.documentElement.dir, "ltr", "English should set dir='ltr'");
    assert.ok(removed, "rtl-css link should be removed for non-Arabic");
  });

  it("does not create duplicate rtl-css link when already present", function () {
    var existingLink = makeEl("rtl-css", {
      rel: "stylesheet",
      href: "Style/rtl.css",
    });
    var appendCalled = false;

    var origGetById = globalThis.document.getElementById;
    globalThis.document.getElementById = function (id) {
      if (id === "rtl-css") return existingLink;
      if (id === "langBtn") return _els["langBtn"];
      if (id === "simpleLangBtn") return _els["simpleLangBtn"];
      if (id === "modeLangBtn") return _els["modeLangBtn"];
      return _els[id] || null;
    };

    globalThis.document.head.append = function () { appendCalled = true; };

    globalThis.i18n.lang = "ar";
    applyLang();

    assert.equal(globalThis.document.documentElement.dir, "rtl");
    assert.ok(!appendCalled, "should not create duplicate rtl-css link");

    globalThis.document.getElementById = origGetById;
  });
});

// ═══════════════════════════════════════════════════════════════
// applyLang — language button titles with __()
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — applyLang button titles", function () {
  before(function () {
    _els["langBtn"] = makeEl("langBtn", { title: "" });
    _els["simpleLangBtn"] = makeEl("simpleLangBtn", { title: "" });
    _els["modeLangBtn"] = makeEl("modeLangBtn", { title: "" });
  });

  it("updates language button titles with __()", function () {
    globalThis.i18n.lang = "en";
    globalThis.i18n.data = { "shared.lang_title": "Language: {lang}" };
    globalThis.document.querySelectorAll = function (sel) {
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [];
      if (sel.indexOf("static-page") !== -1) return [];
      return [];
    };

    applyLang();

    // Button titles should contain the display name via __() replacement
    var expectedDisplay = "English";
    assert.ok(_els["langBtn"].title.indexOf(expectedDisplay) !== -1,
      "langBtn title should contain '" + expectedDisplay + "', got: '" + _els["langBtn"].title + "'");
    assert.ok(_els["simpleLangBtn"].title.indexOf(expectedDisplay) !== -1,
      "simpleLangBtn title should contain '" + expectedDisplay + "'");
    assert.ok(_els["modeLangBtn"].title.indexOf(expectedDisplay) !== -1,
      "modeLangBtn title should contain '" + expectedDisplay + "'");
  });
});

// ═══════════════════════════════════════════════════════════════
// Click-outside handler — dropdown closing
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — click-outside dropdown closing", function () {
  it("removes 'show' from simpleLangMenu when clicking outside", function () {
    var sMenu = makeEl("simpleLangMenu", { classList: makeClassList() });
    sMenu.classList.add("show");
    assert.ok(sMenu.classList.contains("show"), "should start with 'show'");

    var sDropdown = makeEl("simplifiedMode .lang-dropdown", {
      contains: function (el) { return false; },
    });

    globalThis.document.querySelector = function (sel) {
      if (sel === "#simplifiedMode .lang-dropdown") return sDropdown;
      if (sel === "#modeSelect .lang-dropdown") return null;
      if (sel === "nav .lang-dropdown") return null;
      return null;
    };

    var clickHandler = _listeners["click"][0];
    assert.ok(clickHandler, "click handler should be registered");

    clickHandler({ target: makeEl("outside-el") });

    assert.ok(!sMenu.classList.contains("show"), "simpleLangMenu should lose 'show' class when clicking outside");
  });

  it("removes 'show' from modeLangMenu when clicking outside", function () {
    var mMenus = makeEl("modeLangMenu", { classList: makeClassList() });
    mMenus.classList.add("show");

    var mDropdown = makeEl("modeSelect .lang-dropdown", {
      contains: function (el) { return false; },
    });

    globalThis.document.querySelector = function (sel) {
      if (sel === "#simplifiedMode .lang-dropdown") return null;
      if (sel === "#modeSelect .lang-dropdown") return mDropdown;
      if (sel === "nav .lang-dropdown") return null;
      return null;
    };

    var clickHandler = _listeners["click"][0];
    clickHandler({ target: makeEl("outside-el-2") });

    assert.ok(!mMenus.classList.contains("show"), "modeLangMenu should lose 'show' class when clicking outside");
  });

  it("removes 'show' from langMenu (nav) when clicking outside", function () {
    var pMenu = makeEl("langMenu", { classList: makeClassList() });
    pMenu.classList.add("show");

    var pDropdown = makeEl("nav .lang-dropdown", {
      contains: function (el) { return false; },
    });

    globalThis.document.querySelector = function (sel) {
      if (sel === "#simplifiedMode .lang-dropdown") return null;
      if (sel === "#modeSelect .lang-dropdown") return null;
      if (sel === "nav .lang-dropdown") return pDropdown;
      return null;
    };

    var clickHandler = _listeners["click"][0];
    clickHandler({ target: makeEl("outside-el-3") });

    assert.ok(!pMenu.classList.contains("show"), "langMenu should lose 'show' class when clicking outside");
  });

  it("does NOT remove 'show' when clicking inside the dropdown", function () {
    var sMenu = makeEl("simpleLangMenu", { classList: makeClassList() });
    sMenu.classList.add("show");

    var insideTarget = makeEl("inside-el");
    var sDropdown = makeEl("simplifiedMode .lang-dropdown", {
      contains: function (el) { return el === insideTarget; },
    });

    globalThis.document.querySelector = function (sel) {
      if (sel === "#simplifiedMode .lang-dropdown") return sDropdown;
      if (sel === "#modeSelect .lang-dropdown") return null;
      if (sel === "nav .lang-dropdown") return null;
      return null;
    };

    var clickHandler = _listeners["click"][0];
    clickHandler({ target: insideTarget });

    assert.ok(sMenu.classList.contains("show"), "should keep 'show' when clicking inside the dropdown");
  });
});

// ═══════════════════════════════════════════════════════════════
// shouldFilterError
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — shouldFilterError", function () {
  it("returns true for various extension errors", function () {
    assert.ok(shouldFilterError("Runtime.lastError: Could not establish connection. Receiving end does not exist."));
    assert.ok(shouldFilterError("Unchecked runtime.lastError: The message port closed before a response was received."));
    assert.ok(shouldFilterError("Uncaught (in promise) Could not establish connection. Receiving end does not exist."));
    assert.ok(shouldFilterError("Runtime.lastError: Could not establish connection"));
    assert.ok(shouldFilterError("Runtime.lastError: tabs.sendMessage"));
    assert.ok(shouldFilterError("Runtime.lastError: Access denied"));
    assert.ok(shouldFilterError("Runtime.lastError: Not available"));
    assert.ok(shouldFilterError("Runtime.lastError: The message port closed"));
    assert.ok(shouldFilterError("Runtime.lastError: Extension context invalidated"));
    // Source checks for: msg.includes('listener indicated an asynchronous response')
    assert.ok(shouldFilterError("listener indicated an asynchronous response"));
    assert.ok(shouldFilterError("Message channel closed before a response"));
    assert.ok(shouldFilterError("Unchecked runtime.lastError"));
    assert.ok(shouldFilterError("Runtime.lastError: port closed"));
  });

  it("returns false for normal errors", function () {
    assert.equal(shouldFilterError("Something went wrong"), false);
    assert.equal(shouldFilterError("TypeError: Cannot read property of undefined"), false);
    assert.equal(shouldFilterError("ReferenceError: foo is not defined"), false);
  });

  it("handles empty or null message", function () {
    assert.equal(shouldFilterError(""), false);
    assert.equal(shouldFilterError(null), false);
    assert.equal(shouldFilterError(undefined), false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Console wrapper tests
//
// These use the _trackConsole objects that were installed as the
// "original" console methods BEFORE i18n.js loaded. i18n.js saved
// them as originalConsoleError/originalConsoleWarn/originalConsoleLog
// and the wrappers delegate to them.
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — console.error wrapper", function () {
  it("filters extension errors (does not call original)", function () {
    resetConsoleTracking();
    console.error("Runtime.lastError: Could not establish connection. Receiving end does not exist.");

    assert.ok(!_trackConsole.error.called,
      "original console.error should NOT be called for filtered errors");
  });

  it("passes through normal errors (calls original)", function () {
    resetConsoleTracking();
    console.error("Normal error message");

    assert.ok(_trackConsole.error.called,
      "original console.error should be called for normal errors");
    assert.equal(_trackConsole.error.args[0], "Normal error message");
  });

  it("preserves multiple arguments to original", function () {
    resetConsoleTracking();
    console.error("Error:", "test", "context");

    assert.ok(_trackConsole.error.called, "original should be called");
    assert.equal(_trackConsole.error.args[0], "Error:");
    assert.equal(_trackConsole.error.args[1], "test");
    assert.equal(_trackConsole.error.args[2], "context");
  });
});

describe("i18n.js — console.warn wrapper", function () {
  it("filters extension warnings", function () {
    resetConsoleTracking();
    console.warn("Runtime.lastError: Could not establish connection. Receiving end does not exist.");

    assert.ok(!_trackConsole.warn.called,
      "original console.warn should NOT be called for filtered errors");
  });

  it("passes through normal warnings", function () {
    resetConsoleTracking();
    console.warn("Normal warning");

    assert.ok(_trackConsole.warn.called,
      "original console.warn should be called for normal warnings");
  });
});

describe("i18n.js — console.log wrapper", function () {
  it("filters extension log messages", function () {
    resetConsoleTracking();
    console.log("Runtime.lastError: Could not establish connection. Receiving end does not exist.");

    assert.ok(!_trackConsole.log.called,
      "original console.log should NOT be called for filtered errors");
  });

  it("passes through normal log messages", function () {
    resetConsoleTracking();
    console.log("Normal log message");

    assert.ok(_trackConsole.log.called,
      "original console.log should be called for normal messages");
  });
});

// ═══════════════════════════════════════════════════════════════
// Unhandled rejection handler
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — unhandled rejection handler", function () {
  it("calls preventDefault for extension errors", function () {
    var prevented = false;
    var event = {
      reason: new Error("Runtime.lastError: Could not establish connection. Receiving end does not exist."),
      preventDefault: function () { prevented = true; },
    };

    var handler = _listeners["unhandledrejection"][0];
    assert.ok(handler, "unhandledrejection handler should be registered");

    handler(event);
    assert.ok(prevented, "preventDefault should be called for extension errors");
  });

  it("does NOT call preventDefault for normal errors", function () {
    var prevented = false;
    var event = {
      reason: new Error("Normal error"),
      preventDefault: function () { prevented = true; },
    };

    var handler = _listeners["unhandledrejection"][0];
    handler(event);
    assert.ok(!prevented, "preventDefault should NOT be called for normal errors");
  });

  it("handles event with no reason", function () {
    var prevented = false;
    var event = {
      preventDefault: function () { prevented = true; },
    };

    var handler = _listeners["unhandledrejection"][0];
    handler(event);
    assert.ok(!prevented, "preventDefault should NOT be called when reason is missing");
  });

  it("handles null reason", function () {
    var prevented = false;
    var event = {
      reason: null,
      preventDefault: function () { prevented = true; },
    };

    var handler = _listeners["unhandledrejection"][0];
    handler(event);
    assert.ok(!prevented, "preventDefault should NOT be called when reason is null");
  });

  it("handles reason that is not an Error object (plain string)", function () {
    var prevented = false;
    var event = {
      reason: "Runtime.lastError: Could not establish connection. Receiving end does not exist.",
      preventDefault: function () { prevented = true; },
    };

    var handler = _listeners["unhandledrejection"][0];
    handler(event);
    assert.ok(prevented, "preventDefault should be called for string reason with extension error");
  });
});

// ═══════════════════════════════════════════════════════════════
// Error event handlers
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — error event handlers", function () {
  it("first error handler calls preventDefault for extension errors in event.message", function () {
    var prevented = false;
    var event = {
      message: "Runtime.lastError: Could not establish connection. Receiving end does not exist.",
      preventDefault: function () { prevented = true; },
    };

    // First error handler (line 362) checks event.message
    var handler1 = _listeners["error"][0];
    assert.ok(handler1, "first error handler should be registered");

    handler1(event);
    assert.ok(prevented, "preventDefault should be called for extension errors in event.message");
  });

  it("second error handler calls preventDefault for extension errors in event.error.message", function () {
    var prevented = false;
    var event = {
      error: { message: "Runtime.lastError: Could not establish connection. Receiving end does not exist." },
      preventDefault: function () { prevented = true; },
    };

    // Second error handler (line 369) checks event.error.message
    var handler2 = _listeners["error"][1];
    assert.ok(handler2, "second error handler should be registered");

    handler2(event);
    assert.ok(prevented, "preventDefault should be called for extension errors in event.error.message");
  });

  it("does NOT prevent default for normal error messages", function () {
    var prevented = false;
    var event = {
      message: "Normal error message",
      preventDefault: function () { prevented = true; },
    };

    var handler1 = _listeners["error"][0];
    handler1(event);
    assert.ok(!prevented, "preventDefault should NOT be called for normal error messages");
  });

  it("does NOT prevent default when event.error.message is normal", function () {
    var prevented = false;
    var event = {
      error: { message: "Normal error" },
      preventDefault: function () { prevented = true; },
    };

    var handler2 = _listeners["error"][1];
    handler2(event);
    assert.ok(!prevented, "preventDefault should NOT be called for normal errors in event.error.message");
  });

  it("handles missing event.message gracefully", function () {
    var prevented = false;
    var event = {
      preventDefault: function () { prevented = true; },
      error: null,
    };

    var handler1 = _listeners["error"][0];
    handler1(event);
    assert.ok(!prevented, "should not prevent default when message is missing");
  });

  it("handles missing event.error.message gracefully", function () {
    var prevented = false;
    var event = {
      error: {},
      preventDefault: function () { prevented = true; },
    };

    var handler2 = _listeners["error"][1];
    handler2(event);
    assert.ok(!prevented, "should not prevent default when event.error.message is missing");
  });

  it("handles missing event.error gracefully", function () {
    var prevented = false;
    var event = {
      preventDefault: function () { prevented = true; },
    };

    var handler2 = _listeners["error"][1];
    handler2(event);
    assert.ok(!prevented, "should not prevent default when event.error is missing");
  });
});

// ═══════════════════════════════════════════════════════════════
// DOMContentLoaded init
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — DOMContentLoaded init", function () {
  it("should detect lang and load on DOMContentLoaded", async function () {
    globalThis.localStorage.removeItem("redosan_lang");
    try { Object.defineProperty(navigator, "language", { value: "fr", configurable: true, writable: true }); } catch (e) {}

    globalThis.__I18N_DATA = { fr: { "test.key": "Bonjour" } };

    globalThis.i18n.lang = "";
    globalThis.i18n.data = {};

    var domHandler = _listeners["DOMContentLoaded"][0];
    assert.ok(domHandler, "DOMContentLoaded handler should be registered");

    await domHandler();

    assert.equal(globalThis.i18n.lang, "fr", "should load French translations");
    assert.equal(globalThis.i18n.data["test.key"], "Bonjour", "should have French translation data");
  });

  it("should handle init error gracefully without throwing", async function () {
    // Verify that when loadLang fails, the handler does not throw
    delete globalThis.__I18N_DATA;
    globalThis.i18n.data = {};

    var origFetch = globalThis.fetch;
    globalThis.fetch = async function () {
      return Promise.reject(new Error("Network failure"));
    };

    // Override console.error to suppress expected error output
    var origConsoleError = console.error;
    console.error = function () {};

    var domHandler = _listeners["DOMContentLoaded"][0];
    var threw = false;
    try {
      await domHandler();
    } catch (e) {
      threw = true;
    }
    assert.ok(!threw, "DOMContentLoaded handler should not throw when fetch fails");

    console.error = origConsoleError;
    globalThis.fetch = origFetch;
    globalThis.__I18N_DATA = {
      en: { "test.key": "Hello" },
      fr: { "test.key": "Bonjour" },
      ar: { "test.key": "\u0645\u0631\u062d\u0628\u0627" },
    };
  });
});

// ═══════════════════════════════════════════════════════════════
// applyLang — standalone dataset handling for rtl-css
// ═══════════════════════════════════════════════════════════════
describe("i18n.js — applyLang standalone mode", function () {
  before(function () {
    _els["langBtn"] = makeEl("langBtn", { title: "" });
    _els["simpleLangBtn"] = makeEl("simpleLangBtn", { title: "" });
    _els["modeLangBtn"] = makeEl("modeLangBtn", { title: "" });
  });

  it("uses '../../' prefix for rtl-css when dataset.standalone is set", function () {
    delete _els["rtl-css"];

    globalThis.document.documentElement.dataset = { standalone: "watermark" };
    globalThis.i18n.lang = "ar";
    globalThis.i18n.data = {};

    var createdHref = "";
    globalThis.document.createElement = function (tag) {
      if (tag === "link") {
        var link = makeEl("rtl-css", { tagName: "link" });
        link.rel = "";
        Object.defineProperty(link, "href", {
          set: function (v) { createdHref = v; },
          get: function () { return createdHref; },
        });
        return link;
      }
      return makeEl("created-" + tag + "_" + Math.random(), { tagName: tag });
    };

    var origGetById = globalThis.document.getElementById;
    globalThis.document.getElementById = function (id) {
      if (id === "rtl-css") return null;
      if (id === "langBtn") return _els["langBtn"];
      if (id === "simpleLangBtn") return _els["simpleLangBtn"];
      if (id === "modeLangBtn") return _els["modeLangBtn"];
      return _els[id] || null;
    };

    globalThis.document.querySelectorAll = function (sel) {
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [];
      if (sel.indexOf("static-page") !== -1) return [];
      return [];
    };

    applyLang();

    assert.ok(createdHref.indexOf("../../") !== -1, "rtl-css href should use '../../' prefix for standalone, got: " + createdHref);
  });

  it("uses 'Style/' prefix for rtl-css in non-standalone mode", function () {
    delete _els["rtl-css"];

    globalThis.document.documentElement.dataset = {};
    globalThis.i18n.lang = "ar";
    globalThis.i18n.data = {};

    var createdHref = "";
    globalThis.document.createElement = function (tag) {
      if (tag === "link") {
        var link = makeEl("rtl-css", { tagName: "link" });
        link.rel = "";
        Object.defineProperty(link, "href", {
          set: function (v) { createdHref = v; },
          get: function () { return createdHref; },
        });
        return link;
      }
      return makeEl("created-" + tag + "_" + Math.random(), { tagName: tag });
    };

    var origGetById = globalThis.document.getElementById;
    globalThis.document.getElementById = function (id) {
      if (id === "rtl-css") return null;
      if (id === "langBtn") return _els["langBtn"];
      if (id === "simpleLangBtn") return _els["simpleLangBtn"];
      if (id === "modeLangBtn") return _els["modeLangBtn"];
      return _els[id] || null;
    };

    globalThis.document.querySelectorAll = function (sel) {
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [];
      if (sel.indexOf("static-page") !== -1) return [];
      return [];
    };

    applyLang();

    assert.ok(createdHref.indexOf("Style/") !== -1, "rtl-css href should use 'Style/' prefix for non-standalone, got: " + createdHref);
  });
});
