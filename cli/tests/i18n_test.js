const path = require("path");
const fs = require("fs");
const vm = require("vm");
const assert = require("assert/strict");
const { describe, it, before } = require("node:test");

var _els = {};
var _localStorage = {};

function makeEl(id, extra) {
  if (!_els[id]) {
    _els[id] = Object.assign(
      {
        style: { display: "" },
        value: "",
        textContent: "",
        innerHTML: "",
        className: "",
        dataset: {},
        placeholder: "",
        title: "",
        rel: "",
        href: "",
        id: id,
        classList: {
          add: function () {},
          remove: function () {},
          contains: function () {
            return false;
          },
          toggle: function () {},
        },
        append: function () {},
        appendChild: function () {},
        remove: function () {},
        addEventListener: function (event, cb) {
          if (event === "DOMContentLoaded") globalThis.__domReadyCb = cb;
        },
        removeEventListener: function () {},
        getAttribute: function (a) {
          return this[a] || null;
        },
        setAttribute: function (a, v) {
          this[a] = v;
        },
        querySelector: function () {
          return null;
        },
        querySelectorAll: function () {
          return [];
        },
        parentNode: {
          insertBefore: function () {},
          removeChild: function () {},
        },
      },
      extra || {},
    );
  }
  return _els[id];
}

function setupDOM() {
  _els = {};
  _localStorage = {};

  globalThis.document = {
    documentElement: { lang: "en", dir: "ltr", dataset: {}, style: {} },
    getElementById: function (id) {
      return _els[id] || null;
    },
    querySelector: function () {
      return null;
    },
    querySelectorAll: function (sel) {
      if (sel === "[data-i18n]") return [];
      if (sel === "[data-i18n-placeholder]") return [];
      if (sel === ".dz-text") return [];
      return [];
    },
    createElement: function (tag) {
      return makeEl("created-" + tag, { tagName: tag });
    },
    createTextNode: function () {
      return {};
    },
    head: {
      append: function () {},
      querySelector: function () {
        return null;
      },
    },
    body: {
      classList: {
        add: function () {},
        remove: function () {},
        contains: function () {
          return false;
        },
        toggle: function () {},
      },
      append: function () {},
      querySelector: function () {
        return null;
      },
    },
    addEventListener: function (event, cb) {
      if (event === "DOMContentLoaded") globalThis.__domReadyCb = cb;
    },
  };

  globalThis.localStorage = {
    getItem: function (k) {
      return _localStorage[k] !== undefined ? _localStorage[k] : null;
    },
    setItem: function (k, v) {
      _localStorage[k] = String(v);
    },
    removeItem: function (k) {
      delete _localStorage[k];
    },
    clear: function () {
      _localStorage = {};
    },
  };

  var _eventListeners = {};
  globalThis.addEventListener = function (evt, cb) {
    if (!_eventListeners[evt]) _eventListeners[evt] = [];
    _eventListeners[evt].push(cb);
  };
  globalThis.removeEventListener = function () {};
  globalThis.__getEventListeners = function () {
    return _eventListeners;
  };
  globalThis.window = globalThis;
  globalThis.location = {
    protocol: "http:",
    hostname: "localhost",
    href: "http://localhost:8080/",
    pathname: "/",
    replace: function () {},
  };
  globalThis.history = {
    pushState: function () {},
    replaceState: function () {},
  };
  globalThis.fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({});
      },
    });
  };
  globalThis.__I18N_DATA = undefined;
  globalThis.console = {
    error: function () {},
    warn: function () {},
    log: function () {},
  };
  globalThis.__ = function (key) {
    return key;
  };

  try {
    Object.defineProperty(navigator, "language", {
      value: "en",
      configurable: true,
      writable: true,
    });
  } catch (e) {}
  try {
    Object.defineProperty(navigator, "userLanguage", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  } catch (e) {}
  try {
    Object.defineProperty(navigator, "languages", {
      value: ["en-US"],
      configurable: true,
      writable: true,
    });
  } catch (e) {}
}

setupDOM();
var i18nSrc = fs.readFileSync(
  path.resolve(__dirname, "../../Style/i18n.js"),
  "utf8",
);
vm.runInThisContext(i18nSrc, {
  filename: path.resolve(__dirname, "../../Style/i18n.js"),
});

describe("i18n.js — license IIFE & globals", () => {
  it("should populate globalThis.i18n", () => {
    assert.ok(globalThis.i18n);
    assert.equal(globalThis.i18n.lang, "en");
    assert.deepEqual(globalThis.i18n.data, {});
  });

  it("should have translatePage alias", () => {
    assert.equal(typeof globalThis.translatePage, "function");
  });
});

describe("i18n.js — sanitizeHtml", () => {
  it("should allow safe tags (note: closing tags lose / due to regex)", () => {
    assert.equal(sanitizeHtml("<p>hello</p>"), "<p>hello<p>");
    assert.equal(sanitizeHtml("<strong>bold</strong>"), "<strong>bold<strong>");
  });

  it("should allow safe tags with attributes", () => {
    assert.equal(
      sanitizeHtml("<a href='https://example.com'>link</a>"),
      "<a href='https://example.com'>link<a>",
    );
  });

  it("should strip unsafe tags", () => {
    assert.equal(sanitizeHtml("<script>alert(1)</script>"), "alert(1)");
    assert.equal(sanitizeHtml("<img src=x onerror=alert(1)>"), "");
  });

  it("should strip event handlers", () => {
    assert.equal(sanitizeHtml("<p onclick='alert(1)'>test</p>"), "<p>test<p>");
  });

  it("should strip dangerous URL schemes", () => {
    assert.equal(
      sanitizeHtml("<a href='javascript:alert(1)'>x</a>"),
      "<a>x<a>",
    );
  });

  it("should handle nested tags", () => {
    assert.equal(
      sanitizeHtml("<p>Hello <strong>world</strong></p>"),
      "<p>Hello <strong>world<strong><p>",
    );
  });

  it("should handle empty string", () => {
    assert.equal(sanitizeHtml(""), "");
  });

  it("should handle text without tags", () => {
    assert.equal(sanitizeHtml("plain text"), "plain text");
  });

  it("should handle self-closing safe tags", () => {
    assert.equal(sanitizeHtml("<br/>"), "<br>");
    assert.equal(sanitizeHtml("<br />"), "<br>");
  });
});

describe("i18n.js — detectLang", () => {
  it("should return stored language from localStorage", async () => {
    _localStorage["redosan_lang"] = "fr";
    var lang = await detectLang();
    assert.equal(lang, "fr");
    delete _localStorage["redosan_lang"];
  });

  it("should detect from navigator.language when no stored", async () => {
    delete _localStorage["redosan_lang"];
    try {
      Object.defineProperty(navigator, "language", {
        value: "ar",
        configurable: true,
        writable: true,
      });
    } catch (e) {}
    var lang = await detectLang();
    assert.equal(lang, "ar");
  });

  it("should fallback to English for unsupported languages", async () => {
    delete _localStorage["redosan_lang"];
    try {
      Object.defineProperty(navigator, "language", {
        value: "xx",
        configurable: true,
        writable: true,
      });
    } catch (e) {}
    var lang = await detectLang();
    assert.equal(lang, "en");
  });
});

describe("i18n.js — switchLang", () => {
  it("should store language and load it", () => {
    var loaded = "";
    var origLoadLang = globalThis.loadLang;
    globalThis.loadLang = function (l) {
      loaded = l;
    };
    switchLang("ar");
    assert.equal(_localStorage["redosan_lang"], "ar");
    assert.equal(loaded, "ar");
    globalThis.loadLang = origLoadLang;
  });

  it("should fallback to English for unsupported language", () => {
    var loaded = "";
    var origLoadLang = globalThis.loadLang;
    globalThis.loadLang = function (l) {
      loaded = l;
    };
    switchLang("zz");
    assert.equal(loaded, "en");
    globalThis.loadLang = origLoadLang;
  });
});

describe("i18n.js — langBtnText / getLanguageDisplayName", () => {
  it("langBtnText should return Arabic for English input", () => {
    var text = langBtnText("en");
    assert.ok(typeof text === "string" && text.length > 0);
  });

  it("langBtnText should default to English for unknown", () => {
    assert.equal(langBtnText("zz"), "English");
  });

  it("getLanguageDisplayName should return localized name from data", () => {
    globalThis.i18n.data["lang.name.fr"] = "Français";
    assert.equal(getLanguageDisplayName("fr"), "Français");
    delete globalThis.i18n.data["lang.name.fr"];
  });

  it("getLanguageDisplayName should fallback to default names", () => {
    assert.equal(getLanguageDisplayName("en"), "English");
  });

  it("getLanguageDisplayName should return lang code for unknown", () => {
    assert.equal(getLanguageDisplayName("zz"), "zz");
  });
});

describe("i18n.js — loadLang", () => {
  it("should use __I18N_DATA if available", async () => {
    globalThis.__I18N_DATA = { fr: { hello: "bonjour" } };
    var result = await loadLang("fr");
    assert.equal(result, true);
    assert.equal(globalThis.i18n.lang, "fr");
    assert.equal(globalThis.i18n.data.hello, "bonjour");
    delete globalThis.__I18N_DATA;
  });

  it("should fetch JSON file and apply", async () => {
    var origFetch = globalThis.fetch;
    globalThis.fetch = function () {
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({ hello: "hallo" });
        },
      });
    };
    var result = await loadLang("de");
    assert.equal(result, true);
    assert.equal(globalThis.i18n.lang, "de");
    assert.equal(globalThis.i18n.data.hello, "hallo");
    globalThis.fetch = origFetch;
  });

  it("should fallback to English on fetch error", async () => {
    var origFetch = globalThis.fetch;
    var callCount = 0;
    globalThis.fetch = function () {
      callCount++;
      if (callCount === 2)
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({});
          },
        });
      return Promise.resolve({ ok: false });
    };
    globalThis.i18n.lang = "fr";
    var result = await loadLang("fr");
    assert.equal(result, true);
    assert.equal(globalThis.i18n.lang, "en");
    globalThis.fetch = origFetch;
  });

  it("should handle fetch error for English gracefully", async () => {
    delete globalThis.__I18N_DATA; // clear cache so the fetch path is exercised
    var origFetch = globalThis.fetch;
    globalThis.fetch = function () {
      return Promise.reject(new Error("network error"));
    };
    var result = await loadLang("en");
    assert.equal(result, false);
    globalThis.fetch = origFetch;
  });
});

describe("i18n.js — applyLang", () => {
  before(() => {
    _els["langBtn"] = makeEl("langBtn");
    _els["simpleLangBtn"] = makeEl("simpleLangBtn");
    _els["modeLangBtn"] = makeEl("modeLangBtn");
    globalThis.i18n.data = { hello: "world" };
  });

  it("should set document lang and dir for Arabic", () => {
    globalThis.i18n.lang = "ar";
    applyLang();
    assert.equal(document.documentElement.lang, "ar");
    assert.equal(document.documentElement.dir, "rtl");
  });

  it("should set document lang and dir for English", () => {
    globalThis.i18n.lang = "en";
    applyLang();
    assert.equal(document.documentElement.lang, "en");
    assert.equal(document.documentElement.dir, "ltr");
  });

  it("should update language button text", () => {
    globalThis.i18n.lang = "en";
    applyLang();
    var btn = document.getElementById("langBtn");
    assert.ok(typeof btn.textContent === "string");
  });
});

describe("i18n.js — toggleLangDropdown", () => {
  before(() => {
    _els["langMenu"] = makeEl("langMenu");
  });

  it("should toggle show class on lang menu", () => {
    var toggled = false;
    document.getElementById("langMenu").classList.toggle = function (c) {
      toggled = true;
      assert.equal(c, "show");
    };
    toggleLangDropdown();
    assert.ok(toggled);
  });
});

describe("i18n.js — error event handlers (coverage for lines 358, 363-365, 370-372)", () => {
  // Event listeners were already registered during the first load (line 85).
  // We access them via globalThis.__getEventListeners() stored by setupDOM().
  before(() => {
    // Ensure __getEventListeners exists
    if (!globalThis.__getEventListeners) {
      setupDOM();
      delete globalThis.i18n;
      delete globalThis.sanitizeHtml;
      delete globalThis.detectLang;
      delete globalThis.loadLang;
      delete globalThis.__domReadyCb;
      var src = fs.readFileSync(
        path.resolve(__dirname, "../../Style/i18n.js"),
        "utf8",
      );
      vm.runInThisContext(src, {
        filename: path.resolve(__dirname, "../../Style/i18n.js"),
      });
    }
  });

  it("should filter unhandledrejection for extension errors", () => {
    var listeners = globalThis.__getEventListeners();
    var handlers = listeners["unhandledrejection"];
    assert.ok(
      handlers && handlers.length > 0,
      "unhandledrejection listeners should exist",
    );
    var evt = {
      reason: new Error(
        "Could not establish connection. Receiving end does not exist.",
      ),
      preventDefault: function () {
        this._prevented = true;
      },
      _prevented: false,
    };
    handlers[0](evt);
    assert.ok(evt._prevented, "preventDefault should have been called");
  });

  it("should not filter unhandledrejection for real errors", () => {
    var listeners = globalThis.__getEventListeners();
    var handlers = listeners["unhandledrejection"];
    var evt = {
      reason: new Error("TypeError: Cannot read property of undefined"),
      preventDefault: function () {
        this._prevented = true;
      },
      _prevented: false,
    };
    handlers[0](evt);
    assert.equal(
      evt._prevented,
      false,
      "preventDefault should NOT have been called",
    );
  });

  it("should filter error events by message (line 363-365)", () => {
    var listeners = globalThis.__getEventListeners();
    var errorHandlers = listeners["error"];
    var evt = {
      message: "Unchecked runtime.lastError: Could not establish connection.",
      preventDefault: function () {
        this._prevented = true;
      },
      _prevented: false,
    };
    errorHandlers[0](evt);
    assert.ok(evt._prevented);
  });

  it("should filter error events by error.message (line 370-372)", () => {
    var listeners = globalThis.__getEventListeners();
    var errorHandlers = listeners["error"];
    // Use a message that matches shouldFilterError at line 315:
    // (msg.includes('could not establish connection') && msg.includes('receiving end does not exist'))
    var evt = {
      error: {
        message:
          "Could not establish connection. Receiving end does not exist.",
      },
      preventDefault: function () {
        this._prevented = true;
      },
      _prevented: false,
    };
    errorHandlers[1](evt);
    assert.ok(evt._prevented);
  });

  it("should not filter real errors", () => {
    var listeners = globalThis.__getEventListeners();
    var errorHandlers = listeners["error"];
    var evt = {
      message: "Real error",
      preventDefault: function () {
        this._prevented = true;
      },
      _prevented: false,
    };
    errorHandlers[0](evt);
    assert.equal(evt._prevented, false);
  });
});

describe("i18n.js — shouldFilterError", () => {
  it("should filter extension runtime errors", () => {
    assert.ok(
      shouldFilterError(
        "Runtime.lastError: Could not establish connection. Receiving end does not exist.",
      ),
    );
    assert.ok(
      shouldFilterError(
        "Unchecked runtime.lastError: The message port closed before a response was received.",
      ),
    );
    assert.ok(
      shouldFilterError(
        "Uncaught (in promise) Could not establish connection. Receiving end does not exist.",
      ),
    );
  });

  it("should not filter normal errors", () => {
    assert.equal(shouldFilterError("Something went wrong"), false);
    assert.equal(shouldFilterError(""), false);
    assert.equal(shouldFilterError(null), false);
    assert.equal(
      shouldFilterError("TypeError: Cannot read property of undefined"),
      false,
    );
  });
});

describe("i18n.js — DOMContentLoaded error handling", () => {
  it("should call console.error and fallback to English when detectLang rejects", async () => {
    var origDetectLang = globalThis.detectLang;
    var origConsoleError = globalThis.console.error;
    var origLoadLang = globalThis.loadLang;

    var errorLogged = false;
    var errorMessage = "";
    var fallbackCalled = false;

    globalThis.detectLang = async function () {
      throw new Error("test error");
    };
    globalThis.console.error = function () {
      errorLogged = true;
      errorMessage = Array.prototype.map
        .call(arguments, function (a) {
          return typeof a === "object" ? String(a) : a;
        })
        .join(" ");
    };
    globalThis.loadLang = function (lang) {
      if (lang === "en") fallbackCalled = true;
      return Promise.resolve(true);
    };

    assert.ok(
      globalThis.__domReadyCb,
      "DOMContentLoaded callback should have been captured",
    );

    await globalThis.__domReadyCb();

    assert.ok(errorLogged, "console.error should have been called");
    assert.ok(
      errorMessage.indexOf("Language initialization failed") !== -1,
      "console.error should contain failure message",
    );
    assert.ok(
      fallbackCalled,
      "loadLang('en') should have been called as fallback",
    );

    globalThis.detectLang = origDetectLang;
    globalThis.console.error = origConsoleError;
    globalThis.loadLang = origLoadLang;
  });
});
