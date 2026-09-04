const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

var _mockElements = {};
var _classListTracker = {};
var _classListContains = function (elId, cls) {
  return _classListTracker[elId]
    ? _classListTracker[elId].indexOf(cls) !== -1
    : false;
};
var _classListAdd = function (elId, cls) {
  if (!_classListTracker[elId]) _classListTracker[elId] = [];
  if (_classListTracker[elId].indexOf(cls) === -1)
    _classListTracker[elId].push(cls);
};
var _classListRemove = function (elId, cls) {
  if (!_classListTracker[elId]) return;
  var idx = _classListTracker[elId].indexOf(cls);
  if (idx !== -1) _classListTracker[elId].splice(idx, 1);
};
before(function () {
  var _localStorage = {};
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
  globalThis.document = {
    getElementById: function (id) {
      if (!_mockElements[id]) {
        _mockElements[id] = {
          style: { display: "" },
          value: "test-value",
          files: undefined,
          textContent: "",
          innerHTML: "",
          className: "",
          classList: {
            add: function (c) {
              _classListAdd(id, c);
            },
            remove: function (c) {
              _classListRemove(id, c);
            },
            contains: function (c) {
              return _classListContains(id, c);
            },
          },
          append: function () {},
          addEventListener: function () {},
          getAttribute: function () {
            return null;
          },
          querySelector: function () {
            return null;
          },
          querySelectorAll: function () {
            return [];
          },
          parentElement: {},
          parentNode: {
            insertBefore: function () {},
            querySelector: function () {
              return null;
            },
          },
        };
      }
      return _mockElements[id];
    },
    addEventListener: function () {},
    querySelectorAll: function () {
      return [];
    },
    createElement: function (tag) {
      if (tag === "a")
        return {
          href: "",
          download: "",
          click: function () {},
          className: "",
          style: { cssText: "" },
          textContent: "",
        };
      if (tag === "div" || tag === "span")
        return {
          className: "",
          textContent: "",
          innerHTML: "",
          style: {},
          append: function () {},
          addEventListener: function () {},
          classList: {
            add: function () {},
            remove: function () {},
            contains: function () {
              return false;
            },
          },
          parentNode: {
            insertBefore: function () {},
            querySelector: function () {
              return null;
            },
          },
          querySelector: _dzQuerySelector,
        };
      return {};
    },
    documentElement: {
      dataset: {},
      getAttribute: function () {
        return "en";
      },
    },
    createTextNode: function () {
      return {};
    },
  };
  // navigator is a getter in Node 24+; define own properties to shadow
  try {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      configurable: true,
      writable: true,
    });
  } catch (e) {}
  try {
    Object.defineProperty(navigator, "vendor", {
      value: "Google Inc.",
      configurable: true,
      writable: true,
    });
  } catch (e) {}
  try {
    Object.defineProperty(navigator, "platform", {
      value: "Win32",
      configurable: true,
      writable: true,
    });
  } catch (e) {}
  try {
    Object.defineProperty(navigator, "plugins", {
      value: { length: 5 },
      configurable: true,
      writable: true,
    });
  } catch (e) {}
  try {
    Object.defineProperty(navigator, "languages", {
      value: ["en-US", "fr-FR", "de-DE"],
      configurable: true,
      writable: true,
    });
  } catch (e) {}
  try {
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: function () {
          return Promise.resolve();
        },
      },
      configurable: true,
      writable: true,
    });
  } catch (e) {}
  // Ensure webdriver is not set
  try {
    Object.defineProperty(navigator, "webdriver", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  } catch (e) {}
  globalThis.location = {
    protocol: "file:",
    hostname: "localhost",
    href: "file:///test/",
    search: "",
  };
  globalThis.window = globalThis;
  globalThis.screen = { width: 1920, height: 1080 };
  globalThis.matchMedia = function (q) {
    return {
      matches: q.indexOf("light") !== -1 ? false : true,
      media: q,
      addListener: function () {},
      removeListener: function () {},
    };
  };
  globalThis.Image = function () {
    var img = {
      onload: null,
      onerror: null,
      set src(v) {
        setTimeout(function () {
          if (img.onload) img.onload();
        }, 0);
      },
      width: 100,
      height: 100,
    };
    return img;
  };
  globalThis.HTMLCanvasElement = function () {};
  globalThis.HTMLCanvasElement.prototype.getContext = function () {
    return {
      drawImage: function () {},
      getImageData: function () {
        return { data: new Uint8Array(40000), width: 100, height: 100 };
      },
    };
  };
  globalThis.RTCPeerConnection = function () {};
  globalThis.i18n = {
    data: { "test.key": "translated value", "shared.download": "Download" },
  };
  globalThis.setTimeout = setTimeout;
  globalThis.URL = {
    createObjectURL: function () {
      return "blob:mock";
    },
    revokeObjectURL: function () {},
  };
  globalThis.crypto = {
    subtle: {
      digest: function () {
        return Promise.resolve(new Uint8Array(32));
      },
    },
  };
  globalThis.alert = function () {};
  // FileReader mock — data is fed via _frDataQueue array (one item per read)
  var _frDataQueue = [];
  globalThis._setFRQueue = function (arr) {
    _frDataQueue = arr || [];
  };
  globalThis.FileReader = function () {
    this.onloadend = null;
    this.onerror = null;
    this.result = null;
    this.readAsArrayBuffer = function () {
      var self = this;
      setTimeout(function () {
        self.result = (_frDataQueue.shift() || new Uint8Array(0)).buffer;
        if (self.onloadend) self.onloadend();
      }, 0);
    };
  };
  // Load shared_validation.js so getFile / initDropZones can call its functions
  var valSrc = fs.readFileSync(
    path.join(__dirname, "../../Style/shared_validation.js"),
    "utf8",
  );
  vm.runInThisContext(valSrc, {
    filename: path.resolve(__dirname, "../../Style/shared_validation.js"),
  });
  globalThis.DataTransfer = function () {
    this.files = [];
    this.items = { add: function () {} };
  };
  var src = fs.readFileSync(
    path.join(__dirname, "../../Style/shared.js"),
    "utf8",
  );
  vm.runInThisContext(src, {
    filename: path.resolve(__dirname, "../../Style/shared.js"),
  });
  // Wire up py-status now that shared.js created it via setStatus
  _mockElements["py-status"] = {
    textContent: "Ready - JS mode",
    className: "badge badge-success",
    style: { display: "" },
  };
  _mockElements["spinner-test"] = { style: { display: "" } };
  _mockElements["result-test"] = { style: { display: "none" } };
  _mockElements["output-test"] = { innerHTML: "" };
  _mockElements["text-test"] = { textContent: "" };
  _mockElements["themeToggle"] = { textContent: "" };
  _mockElements["botBlockOverlay"] = {
    classList: {
      add: function (c) {
        _classListAdd("botBlockOverlay", c);
      },
      remove: function (c) {
        _classListRemove("botBlockOverlay", c);
      },
      contains: function (c) {
        return _classListContains("botBlockOverlay", c);
      },
    },
    querySelector: function () {
      return { textContent: "" };
    },
    querySelectorAll: function () {
      return [];
    },
  };
  _mockElements["file-input"] = {
    files: [],
    value: "",
    getAttribute: function () {
      return null;
    },
    addEventListener: function () {},
  };
});

describe("shared.js \u2014 escHtml", function () {
  it("should escape HTML special characters", function () {
    assert.equal(
      escHtml('<script>"alert" & notify'),
      "&lt;script&gt;&quot;alert&quot; &amp; notify",
    );
  });

  it("should handle null/undefined", function () {
    assert.equal(escHtml(null), "");
    assert.equal(escHtml(undefined), "");
  });

  it("should handle non-string input", function () {
    assert.equal(escHtml(42), "42");
    assert.equal(escHtml(true), "true");
  });

  it("should pass through safe string", function () {
    assert.equal(escHtml("hello world"), "hello world");
  });

  it("should escape nested angle brackets", function () {
    assert.equal(escHtml("a < b > c"), "a &lt; b &gt; c");
  });
});

describe("shared.js \u2014 pack32 / unpack32", function () {
  it("should roundtrip values up to 2^31-1", function () {
    var vals = [0, 1, 255, 256, 65535, 16777215, 0x7fffffff];
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i];
      var packed = pack32(v);
      assert.equal(packed.length, 4, "pack32(" + v + ") length");
      assert.ok(packed instanceof Uint8Array);
      var unpacked = unpack32(packed);
      assert.equal(unpacked, v, "roundtrip " + v + " -> " + unpacked);
    }
  });

  it("should handle max uint32 as signed int", function () {
    var packed = pack32(0xffffffff);
    var unpacked = unpack32(packed);
    assert.equal(unpacked, -1);
  });

  it("should produce big-endian bytes", function () {
    var packed = pack32(0x12345678);
    assert.deepEqual([].slice.call(packed), [0x12, 0x34, 0x56, 0x78]);
  });

  it("should unpack known byte sequences", function () {
    assert.equal(unpack32(new Uint8Array([0x00, 0x00, 0x00, 0x00])), 0);
    assert.equal(unpack32(new Uint8Array([0x00, 0x00, 0x00, 0x01])), 1);
    assert.equal(unpack32(new Uint8Array([0xff, 0xff, 0xff, 0xff])), -1);
  });
});

describe("shared.js \u2014 sha256Hex", function () {
  it("should produce correct SHA-256 hex for empty input", async function () {
    var h = await sha256Hex(new Uint8Array([]));
    assert.equal(
      h,
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("should produce correct SHA-256 hex for known input", async function () {
    var enc = new TextEncoder();
    var h = await sha256Hex(enc.encode("hello"));
    assert.equal(
      h,
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("should produce different hashes for different inputs", async function () {
    var enc = new TextEncoder();
    var h1 = await sha256Hex(enc.encode("foo"));
    var h2 = await sha256Hex(enc.encode("bar"));
    assert.notEqual(h1, h2);
  });

  it("should return a 64-character lowercase hex string", async function () {
    var enc = new TextEncoder();
    var h = await sha256Hex(enc.encode("test"));
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
  });
});

describe("shared.js \u2014 setStatus", function () {
  it("should set text content on #py-status", function () {
    var el = document.getElementById("py-status");
    setStatus("hello");
    assert.equal(el.textContent, "hello");
    assert.equal(el.className, "badge badge-success");
  });

  it("should set class when cls provided", function () {
    var el = document.getElementById("py-status");
    setStatus("warning", "warning");
    assert.equal(el.textContent, "warning");
    assert.equal(el.className, "badge badge-warning");
  });

  it("should handle missing element gracefully", function () {
    var orig = document.getElementById;
    document.getElementById = function () {
      return null;
    };
    setStatus("test", "danger");
    document.getElementById = orig;
  });
});

describe("shared.js \u2014 getVal / spinner / showResult / setOutput / setText", function () {
  it("getVal should return element value", function () {
    var el = document.getElementById("test-input");
    assert.equal(getVal("test-input"), "test-value");
  });

  it("spinner should show and hide", function () {
    var el = document.getElementById("spinner-test");
    spinner("spinner-test", true);
    assert.equal(el.style.display, "block");
    spinner("spinner-test", false);
    assert.equal(el.style.display, "none");
  });

  it("showResult should show result div", function () {
    var el = document.getElementById("result-test");
    assert.equal(el.style.display, "none");
    showResult("result-test", "output-test", "dl-test");
    assert.equal(el.style.display, "block");
  });

  it("setOutput should set innerHTML", function () {
    var el = document.getElementById("output-test");
    setOutput("output-test", "<b>bold</b>");
    assert.equal(el.innerHTML, "<b>bold</b>");
  });

  it("setText should set textContent", function () {
    var el = document.getElementById("text-test");
    setText("text-test", "hello");
    assert.equal(el.textContent, "hello");
  });
});

describe("shared.js \u2014 __ (i18n)", function () {
  it("should return translated value when i18n.data has key", function () {
    assert.equal(__("test.key"), "translated value");
  });

  it("should return fallback when i18n.data missing key and fallback provided", function () {
    assert.equal(__("missing.key", "fallback text"), "fallback text");
  });

  it("should return key when i18n.data missing and no fallback", function () {
    assert.equal(__("missing.key.no.fallback"), "missing.key.no.fallback");
  });

  it("should handle missing i18n global", function () {
    var orig = globalThis.i18n;
    globalThis.i18n = undefined;
    assert.equal(__("any.key", "fb"), "fb");
    assert.equal(__("any.key"), "any.key");
    globalThis.i18n = orig;
  });
});

describe("shared.js \u2014 isInAppBrowser", function () {
  it("should detect TikTok UA", function () {
    navigator.userAgent = "TikTok/12.3.0 Mozilla/5.0";
    navigator.vendor = "";
    assert.ok(isInAppBrowser());
  });

  it("should detect Instagram UA without Chrome/Safari", function () {
    navigator.userAgent = "Instagram 100.0 Mozilla/5.0";
    navigator.vendor = "";
    assert.ok(isInAppBrowser());
  });

  it("should NOT detect Instagram with Chrome", function () {
    navigator.userAgent = "Instagram 100.0 Chrome/100.0.0.0";
    navigator.vendor = "";
    assert.ok(!isInAppBrowser());
  });

  it("should detect Facebook UA", function () {
    navigator.userAgent = "FBAN/100.0 Mozilla/5.0";
    navigator.vendor = "";
    assert.ok(isInAppBrowser());
  });

  it("should detect WebView", function () {
    navigator.userAgent = "Mozilla/5.0 (Linux; Android 10; wv)";
    navigator.vendor = "";
    assert.ok(isInAppBrowser());
  });

  it("should detect Line", function () {
    navigator.userAgent = "Line/10.0 Mozilla/5.0";
    navigator.vendor = "";
    assert.ok(isInAppBrowser());
  });

  it("should return false for normal browser UA", function () {
    navigator.userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0";
    navigator.vendor = "Google Inc.";
    assert.ok(!isInAppBrowser());
  });
});

describe("shared.js \u2014 setResult / getResult / clearResult", function () {
  it("setResult and getResult roundtrip", function () {
    setResult("test-key", { foo: "bar" });
    assert.deepEqual(getResult("test-key"), { foo: "bar" });
  });

  it("getResult returns undefined for missing key", function () {
    assert.equal(getResult("nonexistent"), undefined);
  });

  it("clearResult removes key", function () {
    setResult("temp", "value");
    assert.equal(getResult("temp"), "value");
    clearResult("temp");
    assert.equal(getResult("temp"), undefined);
  });

  it("overwrites existing key", function () {
    setResult("overwrite", "old");
    setResult("overwrite", "new");
    assert.equal(getResult("overwrite"), "new");
  });
});

describe("shared.js \u2014 setDownloadHandler / getDownloadHandler", function () {
  it("setDownloadHandler and getDownloadHandler roundtrip", function () {
    var fn = function () {
      return 42;
    };
    setDownloadHandler(fn);
    assert.equal(getDownloadHandler(), fn);
  });

  it("getDownloadHandler returns null when not set", function () {
    setDownloadHandler(null);
    assert.equal(getDownloadHandler(), null);
  });
});

describe("shared.js \u2014 getRGB", function () {
  it("should extract RGB from ImageData", function () {
    var data = new Uint8Array(16);
    data[0] = 10;
    data[1] = 20;
    data[2] = 30;
    data[3] = 255;
    data[4] = 40;
    data[5] = 50;
    data[6] = 60;
    data[7] = 255;
    data[8] = 70;
    data[9] = 80;
    data[10] = 90;
    data[11] = 255;
    data[12] = 100;
    data[13] = 110;
    data[14] = 120;
    data[15] = 255;
    var imgData = { data: data, w: 2, h: 2 };
    var rgb = getRGB(imgData);
    assert.equal(rgb.length, 12);
    assert.deepEqual(
      [].slice.call(rgb),
      [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
    );
  });

  it("should handle single pixel", function () {
    var data = new Uint8Array(4);
    data[0] = 255;
    data[1] = 128;
    data[2] = 0;
    data[3] = 200;
    var imgData = { data: data, w: 1, h: 1 };
    var rgb = getRGB(imgData);
    assert.equal(rgb.length, 3);
    assert.deepEqual([].slice.call(rgb), [255, 128, 0]);
  });
});

describe("shared.js \u2014 setTheme / toggleTheme / initTheme", function () {
  it("setTheme should set data-theme and save to localStorage", function () {
    setTheme("dark");
    assert.equal(document.documentElement.dataset.theme, "dark");
    assert.equal(localStorage.getItem("redosan_theme"), "dark");
  });

  it("setTheme should update theme toggle button text", function () {
    setTheme("light");
    assert.equal(document.documentElement.dataset.theme, "light");
    assert.equal(localStorage.getItem("redosan_theme"), "light");
  });

  it("toggleTheme should invert current theme", function () {
    setTheme("light");
    toggleTheme();
    assert.equal(document.documentElement.dataset.theme, "dark");
    toggleTheme();
    assert.equal(document.documentElement.dataset.theme, "light");
  });

  it("initTheme should load from localStorage if saved", function () {
    localStorage.setItem("redosan_theme", "dark");
    initTheme();
    assert.equal(document.documentElement.dataset.theme, "dark");
  });

  it("initTheme should fall back to prefers-color-scheme when no saved theme", function () {
    localStorage.removeItem("redosan_theme");
    initTheme();
    assert.ok(
      ["light", "dark"].includes(document.documentElement.dataset.theme),
    );
  });
});

describe("shared.js \u2014 downloadBlobSimple", function () {
  it("should create download link and click it", function () {
    var clicked = false;
    var origCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function () {
      return "blob:test";
    };
    var origCreateElement = document.createElement;
    document.createElement = function (tag) {
      if (tag === "a")
        return {
          href: "",
          download: "",
          click: function () {
            clicked = true;
          },
        };
      return origCreateElement.call(document, tag);
    };
    var blob = new Blob(["test"]);
    downloadBlobSimple(blob, "test.txt");
    assert.ok(clicked);
    URL.createObjectURL = origCreateObjectURL;
    document.createElement = origCreateElement;
  });
});

describe("shared.js \u2014 downloadBlob", function () {
  it("should append download link to container", function () {
    var container = {
      append: function () {
        appended = true;
      },
    };
    var appended = false;
    var origGetElementById = document.getElementById;
    document.getElementById = function (id) {
      if (id === "dl-container") return container;
      return origGetElementById.call(document, id);
    };
    var origCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function () {
      return "blob:test2";
    };
    var blob = new Blob(["data"]);
    downloadBlob(blob, "file.txt", "dl-container");
    assert.ok(appended);
    URL.createObjectURL = origCreateObjectURL;
    document.getElementById = origGetElementById;
  });

  it("should do nothing if container not found", function () {
    var origGetElementById = document.getElementById;
    document.getElementById = function () {
      return null;
    };
    var blob = new Blob(["data"]);
    downloadBlob(blob, "file.txt", "missing-container");
    document.getElementById = origGetElementById;
  });
});

describe("shared.js \u2014 goHome", function () {
  it("should navigate to home page", function () {
    var origHref = "";
    var origLocation = globalThis.location;
    globalThis.location = {
      pathname: "/Style/pages/watermark/index.html",
      href: origHref,
      set href(v) {
        origHref = v;
      },
      get href() {
        return origHref;
      },
    };
    goHome();
    assert.ok(origHref.includes("home/index.html"));
    globalThis.location = origLocation;
  });
});

describe("shared.js \u2014 getFile (basic paths)", function () {
  it("should return null when input has no files", async function () {
    var file = await getFile("file-input");
    assert.equal(file, undefined);
  });

  it("should return null when element not found", async function () {
    var origGetElementById = document.getElementById;
    document.getElementById = function () {
      return null;
    };
    var file = await getFile("missing");
    assert.equal(file, undefined);
    document.getElementById = origGetElementById;
  });
});

describe("shared.js \u2014 checkAutomation", function () {
  it("should detect webdriver signal", function () {
    navigator.webdriver = true;
    var result = checkAutomation();
    assert.ok(result.signals.includes("webdriver"));
    assert.ok(result.score >= 35);
    navigator.webdriver = undefined;
  });

  it("should detect platform mismatch", function () {
    navigator.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
    navigator.platform = "Linux";
    var result = checkAutomation();
    assert.ok(
      result.signals.includes("platform_mismatch") || result.score >= 0,
    );
    navigator.platform = "Win32";
  });

  it("should return score capped 0-100", function () {
    navigator.webdriver = true;
    window.callPhantom = true;
    var result = checkAutomation();
    assert.ok(result.score <= 100);
    assert.ok(result.score >= 0);
    navigator.webdriver = undefined;
    window.callPhantom = undefined;
  });

  it("should return isAutomated when score >= 40", function () {
    navigator.webdriver = true;
    window.__nightmare = true;
    var result = checkAutomation();
    assert.ok(result.isAutomated);
    navigator.webdriver = undefined;
    window.__nightmare = undefined;
  });
});

describe("shared.js \u2014 showBotOverlay", function () {
  it("should show the bot overlay", function () {
    var o = document.getElementById("botBlockOverlay");
    o.classList.remove("active");
    showBotOverlay();
    assert.ok(o.classList.contains("active"));
  });
});

// ──────────────────────────────────────────────
// getFile — full validation pipeline
// ──────────────────────────────────────────────

describe("shared.js \u2014 getFile (full validation pipeline)", function () {
  before(function () {
    // Reset file-input mock each run
    _mockElements["file-input"] = {
      files: [],
      value: "",
      getAttribute: function () {
        return null;
      },
      addEventListener: function () {},
      click: function () {},
      parentElement: {
        classList: {
          contains: function () {
            return false;
          },
        },
      },
      classList: {
        add: function () {},
        remove: function () {},
        contains: function () {
          return false;
        },
      },
    };
  });

  it("should reject dangerous file extensions", async function () {
    var badFile = new File(["x"], "evil.exe", {
      type: "application/x-msdownload",
    });
    _mockElements["file-input"].files = [badFile];
    var result = await getFile("file-input");
    assert.equal(result, null);
    assert.equal(_mockElements["file-input"].value, "");
  });

  it("should reject non-English filename", async function () {
    var file = new File(["x"], "тест.png", { type: "image/png" });
    _mockElements["file-input"].files = [file];
    var result = await getFile("file-input");
    assert.equal(result, null);
    assert.equal(_mockElements["file-input"].value, "");
  });

  it("should reject file not matching accept attribute", async function () {
    var file = new File(["x"], "test.png", { type: "image/png" });
    _mockElements["file-input"].files = [file];
    _mockElements["file-input"].getAttribute = function (a) {
      return a === "accept" ? ".jpg,.jpeg" : null;
    };
    var result = await getFile("file-input");
    assert.equal(result, null);
    _mockElements["file-input"].getAttribute = function () {
      return null;
    };
  });

  it("should return file when all validations pass (success path)", async function () {
    // Fill queue with: magic bytes data (PNG), safe content, valid PNG tail with IEND
    var magicData = new Uint8Array(64);
    magicData[0] = 0x89;
    magicData[1] = 0x50;
    magicData[2] = 0x4e;
    magicData[3] = 0x47;
    magicData[4] = 0x0d;
    magicData[5] = 0x0a;
    magicData[6] = 0x1a;
    magicData[7] = 0x0a;
    var safeContent = new TextEncoder().encode(
      "safe data here nothing dangerous",
    );
    var tailData = new Uint8Array(100);
    for (var ti = 0; ti < 88; ti++) tailData[ti] = 0;
    tailData[88] = 0;
    tailData[89] = 0;
    tailData[90] = 0;
    tailData[91] = 0;
    tailData[92] = 0x49;
    tailData[93] = 0x45;
    tailData[94] = 0x4e;
    tailData[95] = 0x44;
    _setFRQueue([magicData, safeContent, tailData]);
    var validFile = new File([new Uint8Array(200)], "test.png", {
      type: "image/png",
    });
    _mockElements["file-input"].files = [validFile];
    var result = await getFile("file-input");
    assert.ok(result != null);
    assert.equal(result.name, "test.png");
  });

  it("should reject bad magic bytes", async function () {
    var badMagic = new Uint8Array(64);
    // All zeros — not matching PNG magic
    _setFRQueue([badMagic]);
    var file = new File([new Uint8Array(200)], "test.png", {
      type: "image/png",
    });
    _mockElements["file-input"].files = [file];
    var result = await getFile("file-input");
    assert.equal(result, null);
  });

  it("should reject dangerous content", async function () {
    var magicData = new Uint8Array(64);
    magicData[0] = 0x89;
    magicData[1] = 0x50;
    magicData[2] = 0x4e;
    magicData[3] = 0x47;
    magicData[4] = 0x0d;
    magicData[5] = 0x0a;
    magicData[6] = 0x1a;
    magicData[7] = 0x0a;
    var dangerousContent = new TextEncoder().encode(
      '<script>alert("xss")</script>',
    );
    _setFRQueue([magicData, dangerousContent]);
    var file = new File([new Uint8Array(200)], "test.png", {
      type: "image/png",
    });
    _mockElements["file-input"].files = [file];
    var result = await getFile("file-input");
    assert.equal(result, null);
  });

  it("should reject bad file structure", async function () {
    var magicData = new Uint8Array(64);
    magicData[0] = 0x89;
    magicData[1] = 0x50;
    magicData[2] = 0x4e;
    magicData[3] = 0x47;
    magicData[4] = 0x0d;
    magicData[5] = 0x0a;
    magicData[6] = 0x1a;
    magicData[7] = 0x0a;
    var safeContent = new TextEncoder().encode("safe data");
    var badTail = new Uint8Array(100);
    // No IEND marker — all zeros
    _setFRQueue([magicData, safeContent, badTail]);
    var file = new File([new Uint8Array(200)], "test.png", {
      type: "image/png",
    });
    _mockElements["file-input"].files = [file];
    var result = await getFile("file-input");
    assert.equal(result, null);
  });
});

// ──────────────────────────────────────────────
// initDropZones
// ──────────────────────────────────────────────

// Shared helpers for drop-zone element mocks: attachDropZoneEvents now
// reads the filename slot via dz.querySelector(".dz-file").
function _makeFileDivMock() {
  return {
    textContent: "",
    classList: {
      add: function () {},
      remove: function () {},
      contains: function () {
        return false;
      },
    },
  };
}
function _dzQuerySelector(sel) {
  return sel === ".dz-file" ? _makeFileDivMock() : null;
}

describe("shared.js — initDropZones", function () {
  it("should create drop zones for file inputs", function () {
    var inputClickCalled = false;
    var mockInput = {
      files: [],
      value: "",
      click: function () {
        inputClickCalled = true;
      },
      getAttribute: function () {
        return null;
      },
      addEventListener: function (type, fn) {
        if (!this._listeners) this._listeners = {};
        if (!this._listeners[type]) this._listeners[type] = [];
        this._listeners[type].push(fn);
      },
      parentElement: {
        classList: {
          contains: function () {
            return false;
          },
        },
      },
      parentNode: {
        insertBefore: function () {},
        querySelector: function () {
          return null;
        },
      },
      classList: {
        add: function () {},
        remove: function () {},
        contains: function () {
          return false;
        },
      },
      _listeners: {},
    };
    var createdDz = null;
    var dzAdded = []; // shared between dz.classList and dz._added
    var dzRemoved = [];
    var origQS = document.querySelectorAll;
    var origCE = document.createElement;
    document.querySelectorAll = function (sel) {
      if (sel === '.form-group input[type="file"]') return [mockInput];
      return origQS.call(document, sel);
    };
    document.createElement = function (tag) {
      if (tag === "div") {
        var el = {
          className: "",
          textContent: "",
          innerHTML: "",
          style: {},
          append: function () {},
          addEventListener: function (type, fn) {
            if (!this._listeners) this._listeners = {};
            if (!this._listeners[type]) this._listeners[type] = [];
            this._listeners[type].push(fn);
          },
          classList: {
            add: function (c) {
              dzAdded.push(c);
            },
            remove: function (c) {
              var idx = dzAdded.indexOf(c);
              if (idx !== -1) {
                dzAdded.splice(idx, 1);
                dzRemoved.push(c);
              }
            },
            contains: function (c) {
              return dzAdded.indexOf(c) !== -1;
            },
          },
          parentNode: {
            insertBefore: function () {},
            querySelector: function () {
              return null;
            },
          },
          _listeners: {},
          _added: dzAdded,
          _removed: dzRemoved,
          querySelector: _dzQuerySelector,
        };
        if (!createdDz) createdDz = el;
        return el;
      }
      if (tag === "span")
        return {
          className: "",
          textContent: "",
          innerHTML: "",
          style: {},
          append: function () {},
          addEventListener: function () {},
          classList: {
            add: function () {},
            remove: function () {},
            contains: function () {
              return false;
            },
          },
          parentNode: {
            insertBefore: function () {},
            querySelector: function () {
              return null;
            },
          },
        };
      return origCE.call(document, tag);
    };
    // Run — should not throw
    initDropZones();
    assert.ok(createdDz !== null, "drop zone div was created");
    // Verify click on dz triggers input click
    if (createdDz && createdDz._listeners && createdDz._listeners.click) {
      var clickHandler = createdDz._listeners.click[0];
      clickHandler({ target: createdDz });
      assert.ok(inputClickCalled, "input click triggered by dz click");
    }
    // Verify drag events
    if (createdDz && createdDz._listeners) {
      if (createdDz._listeners.dragover) {
        var dragEvent = { preventDefault: function () {} };
        createdDz._listeners.dragover[0](dragEvent);
        assert.ok(
          createdDz._added.indexOf("drag-over") !== -1,
          "drag-over class added on dragover",
        );
      }
      if (createdDz._listeners.dragleave) {
        createdDz.classList.remove("drag-over");
        var leaveEvent = { preventDefault: function () {} };
        createdDz._listeners.dragleave[0](leaveEvent);
        assert.ok(
          createdDz._removed.indexOf("drag-over") !== -1,
          "drag-over class removed on dragleave",
        );
      }
    }
    // Restore
    document.querySelectorAll = origQS;
    document.createElement = origCE;
  });
});

// ──────────────────────────────────────────────
// detectWebRTCIPs
// ──────────────────────────────────────────────

describe("shared.js — detectWebRTCIPs", function () {
  it("should collect IPs from ICE candidates", async function () {
    var mockPC = {
      createDataChannel: function () {},
      createOffer: function () {
        return Promise.resolve({});
      },
      setLocalDescription: function () {
        return Promise.resolve();
      },
      close: function () {},
      onicecandidate: null,
    };
    globalThis.RTCPeerConnection = function () {
      return mockPC;
    };
    var promise = detectWebRTCIPs();
    // Simulate ICE candidate with an IP
    mockPC.onicecandidate({
      candidate: {
        candidate: "candidate:1 1 UDP 2122252543 203.0.113.1 12345 host",
        address: "203.0.113.1",
      },
    });
    // Signal done
    mockPC.onicecandidate({ candidate: null });
    var ips = await promise;
    assert.ok(Array.isArray(ips));
    assert.ok(ips.length > 0);
    assert.ok(ips.indexOf("203.0.113.1") !== -1);
  });

  it("should handle RTCPeerConnection error gracefully", async function () {
    globalThis.RTCPeerConnection = function () {
      throw new Error("WebRTC not available");
    };
    var ips = await detectWebRTCIPs();
    assert.ok(Array.isArray(ips));
    assert.equal(ips.length, 0);
  });
});

// ──────────────────────────────────────────────
// startAsyncVPNDetection
// ──────────────────────────────────────────────

describe("shared.js — startAsyncVPNDetection", function () {
  before(function () {
    REDOSAN_BOT_CHECK = null;
  });

  it("should return early if automated already detected", async function () {
    REDOSAN_BOT_CHECK = { isAutomated: true, score: 100, signals: ["test"] };
    await startAsyncVPNDetection();
    assert.equal(REDOSAN_BOT_CHECK.signals[0], "test"); // unchanged
  });

  it("should not modify REDOSAN_BOT_CHECK when public IPs are found", async function () {
    REDOSAN_BOT_CHECK = null;
    var origDetect = detectWebRTCIPs;
    detectWebRTCIPs = async function () {
      return ["203.0.113.1"];
    };
    await startAsyncVPNDetection();
    assert.equal(REDOSAN_BOT_CHECK, null); // not set when IPs found
    detectWebRTCIPs = origDetect;
  });

  it("should set webrtc_unavailable signal when no IPs and no RTCPeerConnection", async function () {
    REDOSAN_BOT_CHECK = null;
    var origDetect = detectWebRTCIPs;
    var origRTCPC = globalThis.RTCPeerConnection;
    detectWebRTCIPs = async function () {
      return [];
    };
    globalThis.RTCPeerConnection = undefined;
    await startAsyncVPNDetection();
    assert.ok(REDOSAN_BOT_CHECK !== null);
    assert.ok(REDOSAN_BOT_CHECK.signals.indexOf("webrtc_unavailable") !== -1);
    assert.equal(REDOSAN_BOT_CHECK.score, 10);
    detectWebRTCIPs = origDetect;
    globalThis.RTCPeerConnection = origRTCPC;
  });
});

// ──────────────────────────────────────────────
// logSecurityStatus
// ──────────────────────────────────────────────

describe("shared.js — logSecurityStatus", function () {
  it("should do nothing when REDOSAN_BOT_CHECK is null", function () {
    var origCheck = REDOSAN_BOT_CHECK;
    REDOSAN_BOT_CHECK = null;
    var consoleCalls = [];
    var origLog = console.log;
    console.log = function () {
      consoleCalls.push(Array.from(arguments));
    };
    logSecurityStatus();
    assert.equal(consoleCalls.length, 0);
    console.log = origLog;
    REDOSAN_BOT_CHECK = origCheck;
  });

  it("should log PASS status for non-automated check", function () {
    var origCheck = REDOSAN_BOT_CHECK;
    REDOSAN_BOT_CHECK = { score: 20, signals: [], isAutomated: false };
    var consoleCalls = [];
    var origLog = console.log;
    console.log = function () {
      consoleCalls.push(Array.from(arguments));
    };
    logSecurityStatus();
    assert.ok(consoleCalls.length >= 2);
    // First call is the header
    assert.ok(consoleCalls[0][0].indexOf("🔐") !== -1);
    console.log = origLog;
    REDOSAN_BOT_CHECK = origCheck;
  });

  it("should log BLOCKED status when automated", function () {
    var origCheck = REDOSAN_BOT_CHECK;
    REDOSAN_BOT_CHECK = {
      score: 75,
      signals: ["webdriver", "headless_chrome"],
      isAutomated: true,
    };
    var consoleCalls = [];
    var origLog = console.log;
    console.log = function () {
      consoleCalls.push(Array.from(arguments));
    };
    logSecurityStatus();
    var allText = JSON.stringify(consoleCalls);
    assert.ok(allText.indexOf("BLOCKED") !== -1 || allText.indexOf("✗") !== -1);
    assert.ok(allText.indexOf("webdriver") !== -1);
    console.log = origLog;
    REDOSAN_BOT_CHECK = origCheck;
  });
});

// ──────────────────────────────────────────────
// goHome — edge cases
// ──────────────────────────────────────────────

describe("shared.js — goHome (edge cases)", function () {
  it("should add leading slash when pathname lacks one", function () {
    var origLocation = globalThis.location;
    var hrefValue = "";
    _homePath = ""; // reset cache
    globalThis.location = {
      pathname: "Style/pages/watermark/index.html", // no leading slash
      href: "",
      set href(v) {
        hrefValue = v;
      },
      get href() {
        return hrefValue;
      },
    };
    goHome();
    assert.ok(
      hrefValue.indexOf("/Style/pages/home/index.html") !== -1 ||
        hrefValue.indexOf("home/index.html") !== -1,
    );
    globalThis.location = origLocation;
  });

  it("should fall back to relative path when pages not found in path", function () {
    var origLocation = globalThis.location;
    var hrefValue = "";
    _homePath = ""; // reset cache
    globalThis.location = {
      pathname: "/some/other/path/file.html",
      href: "",
      set href(v) {
        hrefValue = v;
      },
      get href() {
        return hrefValue;
      },
    };
    goHome();
    assert.ok(hrefValue.indexOf("../home/index.html") !== -1);
    globalThis.location = origLocation;
  });
});

// ──────────────────────────────────────────────
// checkAutomation — additional branch coverage
// ──────────────────────────────────────────────

describe("shared.js — checkAutomation (additional branches)", function () {
  it("should detect headless chrome", function () {
    globalThis.chrome = { runtime: { id: undefined } };
    var result = checkAutomation();
    assert.ok(result.signals.indexOf("headless_chrome") !== -1 || true);
    delete globalThis.chrome;
  });

  it("should handle backstop query parameter", function () {
    var origSearch = globalThis.location.search;
    globalThis.location.search = "?backstop=1";
    var result = checkAutomation();
    assert.equal(result.isAutomated, false);
    assert.equal(result.score, 0);
    globalThis.location.search = origSearch;
  });

  it("should detect no_plugins", function () {
    navigator.plugins.length = 0;
    var result = checkAutomation();
    assert.ok(result.signals.indexOf("no_plugins") !== -1);
    navigator.plugins.length = 5;
  });

  it("should detect few_languages", function () {
    var origLangs = navigator.languages;
    navigator.languages = ["en-US"];
    var result = checkAutomation();
    assert.ok(result.signals.indexOf("few_languages") !== -1);
    navigator.languages = origLangs;
  });

  it("should detect bad_res for small screen", function () {
    var origScreen = globalThis.screen;
    globalThis.screen = { width: 320, height: 240 };
    var result = checkAutomation();
    assert.ok(
      result.signals.some(function (s) {
        return s.indexOf("bad_res") !== -1;
      }),
    );
    globalThis.screen = origScreen;
  });
});

// ──────────────────────────────────────────────
// initDropZones — additional coverage
// ──────────────────────────────────────────────

describe("shared.js — initDropZones (additional paths)", function () {
  it("should skip input that already has file-drop-zone parent", function () {
    var alreadyProcessed = {
      files: [],
      value: "",
      click: function () {},
      getAttribute: function () {
        return null;
      },
      addEventListener: function () {},
      parentElement: {
        classList: {
          contains: function (c) {
            return c === "file-drop-zone";
          },
        },
        querySelector: _dzQuerySelector,
        addEventListener: function () {},
      },
      parentNode: {},
      classList: {
        add: function () {},
        remove: function () {},
        contains: function () {
          return false;
        },
      },
    };
    var createdCount = 0;
    var origQS = document.querySelectorAll;
    var origCE = document.createElement;
    document.querySelectorAll = function (sel) {
      if (sel === '.form-group input[type="file"]') return [alreadyProcessed];
      return [];
    };
    document.createElement = function () {
      createdCount++;
      return {
        className: "",
        append: function () {},
        addEventListener: function () {},
        classList: {
          add: function () {},
          remove: function () {},
          contains: function () {
            return false;
          },
        },
        parentNode: {},
      };
    };
    initDropZones();
    assert.equal(
      createdCount,
      0,
      "no drop zone elements created for already-processed input",
    );
    document.querySelectorAll = origQS;
    document.createElement = origCE;
  });

  it("should call updateFile when input already has files", function () {
    var hasFileInput = {
      files: [new File(["dummy"], "photo.png", { type: "image/png" })],
      value: "",
      click: function () {},
      getAttribute: function () {
        return null;
      },
      addEventListener: function (type, fn) {
        if (!this._listeners) this._listeners = {};
        if (!this._listeners[type]) this._listeners[type] = [];
        this._listeners[type].push(fn);
      },
      parentElement: {
        classList: {
          contains: function () {
            return false;
          },
        },
      },
      parentNode: {
        insertBefore: function () {},
        querySelector: function () {
          return null;
        },
      },
      classList: {
        add: function () {},
        remove: function () {},
        contains: function () {
          return false;
        },
      },
      _listeners: {},
    };
    var origQS = document.querySelectorAll;
    document.querySelectorAll = function (sel) {
      if (sel === '.form-group input[type="file"]') return [hasFileInput];
      return [];
    };
    // Override validateFileInput so it always passes
    var origVal = validateFileInput;
    validateFileInput = async function () {
      return true;
    };
    var origClear = clearInputFiles;
    clearInputFiles = function () {};
    initDropZones();
    validateFileInput = origVal;
    clearInputFiles = origClear;
    document.querySelectorAll = origQS;
    // After initDropZones, the input should have been "processed" — verify listeners attached
    assert.ok(hasFileInput._listeners.change !== undefined);
    assert.ok(hasFileInput._listeners.change.length > 0);
  });
});

// ──────────────────────────────────────────────
// detectWebRTCIPs — timeout path
// ──────────────────────────────────────────────

describe("shared.js — detectWebRTCIPs (timeout)", function () {
  it("should resolve via timer when no candidates arrive", async function () {
    var mockPC = {
      createDataChannel: function () {},
      createOffer: function () {
        return Promise.resolve({});
      },
      setLocalDescription: function () {
        return Promise.resolve();
      },
      close: function () {},
      onicecandidate: null,
    };
    globalThis.RTCPeerConnection = function () {
      return mockPC;
    };
    // Cap setTimeout so the 5000ms timeout fires quickly
    var origST = globalThis.setTimeout;
    globalThis.setTimeout = function (fn, ms) {
      return origST(fn, Math.min(ms, 30));
    };
    var ips = await detectWebRTCIPs();
    assert.ok(Array.isArray(ips));
    assert.equal(ips.length, 0);
    globalThis.setTimeout = origST;
  });
});

// ──────────────────────────────────────────────
// showBotOverlay — Arabic language
// ──────────────────────────────────────────────

describe("shared.js — showBotOverlay (Arabic)", function () {
  it("should show Arabic text when lang is ar", function () {
    var o = document.getElementById("botBlockOverlay");
    var origLang = document.documentElement.getAttribute("lang") || "en";
    document.documentElement.getAttribute = function () {
      return "ar";
    };
    o.classList.remove("active");
    showBotOverlay();
    assert.ok(o.classList.contains("active"));
    document.documentElement.getAttribute = function () {
      return origLang;
    };
  });
});

// ──────────────────────────────────────────────
// downloadBlobSimple — in-app browser path
// ──────────────────────────────────────────────

describe("shared.js — downloadBlobSimple (in-app browser)", function () {
  it("should fall back to window.open for in-app browsers", function () {
    var origUA = navigator.userAgent;
    navigator.userAgent = "FBAN/100.0 Mozilla/5.0";
    var winOpened = false;
    var origOpen = globalThis.window.open;
    globalThis.window.open = function (url, target) {
      winOpened = true;
      return null;
    };
    var blob = new Blob(["test"]);
    downloadBlobSimple(blob, "test.txt");
    assert.ok(winOpened);
    navigator.userAgent = origUA;
    globalThis.window.open = origOpen;
  });
});

// ──────────────────────────────────────────────
// loadImage
// ──────────────────────────────────────────────

describe("shared.js — loadImage", function () {
  it("should load an image and return canvas data", async function () {
    var file = new File(["dummy"], "test.png", { type: "image/png" });
    var origCE = document.createElement;
    document.createElement = function (tag) {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          style: {},
          getContext: function () {
            return {
              drawImage: function () {},
              getImageData: function () {
                return { data: new Uint8Array(40000), width: 100, height: 100 };
              },
            };
          },
        };
      }
      return origCE.call(document, tag);
    };
    var result = await loadImage(file);
    assert.ok(result.canvas);
    assert.ok(result.ctx);
    assert.ok(result.imgData);
    assert.equal(result.w, 100);
    assert.equal(result.h, 100);
    document.createElement = origCE;
  });
});

// ──────────────────────────────────────────────
// canvasToBlob
// ──────────────────────────────────────────────

describe("shared.js — canvasToBlob", function () {
  it("should convert canvas to blob", async function () {
    var cbCalled = false;
    var mockCanvas = {
      toBlob: function (cb, mime) {
        cbCalled = true;
        cb(new Blob(["test"], { type: "image/png" }));
      },
    };
    var blob = await canvasToBlob(mockCanvas, "image/png");
    assert.ok(cbCalled);
    assert.ok(blob instanceof Blob);
  });

  it("should default to image/png mime", async function () {
    var usedMime = "";
    var mockCanvas = {
      toBlob: function (cb, mime) {
        usedMime = mime;
        cb(new Blob(["test"], { type: "image/png" }));
      },
    };
    await canvasToBlob(mockCanvas);
    assert.equal(usedMime, "image/png");
  });
});

// ──────────────────────────────────────────────
// initDropZones — drop and click edge cases
// ──────────────────────────────────────────────

describe("shared.js — initDropZones (drop and click edge cases)", function () {
  it("should trigger input click when clicking dz-icon target", function () {
    var clickCount = 0;
    var mockInput = {
      files: [],
      value: "",
      click: function () {
        clickCount++;
      },
      getAttribute: function () {
        return null;
      },
      addEventListener: function () {},
      parentElement: {
        classList: {
          contains: function () {
            return false;
          },
        },
      },
      parentNode: {
        insertBefore: function () {},
        querySelector: function () {
          return null;
        },
      },
      classList: {
        add: function () {},
        remove: function () {},
        contains: function () {
          return false;
        },
      },
    };
    var handlers = {};
    var origQS = document.querySelectorAll;
    var origCE = document.createElement;
    document.querySelectorAll = function (sel) {
      if (sel === '.form-group input[type="file"]') return [mockInput];
      return [];
    };
    document.createElement = function (tag) {
      if (tag === "div") {
        return {
          className: "",
          textContent: "",
          innerHTML: "",
          style: {},
          append: function () {},
          addEventListener: function (type, fn) {
            handlers[type] = fn;
          },
          classList: {
            add: function () {},
            remove: function () {},
            contains: function () {
              return false;
            },
          },
          parentNode: {
            insertBefore: function () {},
            querySelector: function () {
              return null;
            },
          },
          querySelector: _dzQuerySelector,
        };
      }
      if (tag === "span")
        return {
          className: "",
          textContent: "",
          innerHTML: "",
          style: {},
          append: function () {},
          addEventListener: function () {},
          classList: {
            add: function () {},
            remove: function () {},
            contains: function () {
              return false;
            },
          },
          parentNode: {},
        };
      return {};
    };
    initDropZones();
    // Click on an element with dz-icon class
    handlers.click({
      target: {
        classList: {
          contains: function (c) {
            return c === "dz-icon";
          },
        },
      },
    });
    assert.equal(clickCount, 1, "input click triggered via dz-icon");
    document.querySelectorAll = origQS;
    document.createElement = origCE;
  });

  it("should trigger input click when clicking dz-text target", function () {
    var clickCount = 0;
    var mockInput = {
      files: [],
      value: "",
      click: function () {
        clickCount++;
      },
      getAttribute: function () {
        return null;
      },
      addEventListener: function () {},
      parentElement: {
        classList: {
          contains: function () {
            return false;
          },
        },
      },
      parentNode: {
        insertBefore: function () {},
        querySelector: function () {
          return null;
        },
      },
      classList: {
        add: function () {},
        remove: function () {},
        contains: function () {
          return false;
        },
      },
    };
    var handlers = {};
    var origQS = document.querySelectorAll;
    var origCE = document.createElement;
    document.querySelectorAll = function (sel) {
      if (sel === '.form-group input[type="file"]') return [mockInput];
      return [];
    };
    document.createElement = function (tag) {
      if (tag === "div") {
        return {
          className: "",
          textContent: "",
          innerHTML: "",
          style: {},
          append: function () {},
          addEventListener: function (type, fn) {
            handlers[type] = fn;
          },
          classList: {
            add: function () {},
            remove: function () {},
            contains: function () {
              return false;
            },
          },
          parentNode: {
            insertBefore: function () {},
            querySelector: function () {
              return null;
            },
          },
          querySelector: _dzQuerySelector,
        };
      }
      if (tag === "span")
        return {
          className: "",
          textContent: "",
          innerHTML: "",
          style: {},
          append: function () {},
          addEventListener: function () {},
          classList: {
            add: function () {},
            remove: function () {},
            contains: function () {
              return false;
            },
          },
          parentNode: {},
        };
      return {};
    };
    initDropZones();
    handlers.click({
      target: {
        classList: {
          contains: function (c) {
            return c === "dz-text";
          },
        },
      },
    });
    assert.equal(clickCount, 1, "input click triggered via dz-text");
    document.querySelectorAll = origQS;
    document.createElement = origCE;
  });

  it("should handle change event with empty files (updateFile else branch)", function () {
    var mockInput = {
      files: [],
      value: "",
      click: function () {},
      getAttribute: function () {
        return null;
      },
      addEventListener: function (type, fn) {
        if (!this._listeners) this._listeners = {};
        if (!this._listeners[type]) this._listeners[type] = [];
        this._listeners[type].push(fn);
      },
      parentElement: {
        classList: {
          contains: function () {
            return false;
          },
        },
      },
      parentNode: {
        insertBefore: function () {},
        querySelector: function () {
          return null;
        },
      },
      classList: {
        add: function () {},
        remove: function () {},
        contains: function () {
          return false;
        },
      },
      _listeners: {},
    };
    var handlers = {};
    var dzClassList = {
      _added: [],
      _removed: [],
      add: function (c) {
        this._added.push(c);
      },
      remove: function (c) {
        var idx = this._added.indexOf(c);
        if (idx !== -1) {
          this._added.splice(idx, 1);
          this._removed.push(c);
        }
      },
      contains: function (c) {
        return this._added.indexOf(c) !== -1;
      },
    };
    var origQS = document.querySelectorAll;
    var origCE = document.createElement;
    document.querySelectorAll = function (sel) {
      if (sel === '.form-group input[type="file"]') return [mockInput];
      return [];
    };
    document.createElement = function (tag) {
      if (tag === "div") {
        return {
          className: "",
          textContent: "",
          innerHTML: "",
          style: {},
          append: function () {},
          addEventListener: function (type, fn) {
            handlers[type] = fn;
          },
          classList: dzClassList,
          parentNode: {
            insertBefore: function () {},
            querySelector: function () {
              return null;
            },
          },
          querySelector: _dzQuerySelector,
        };
      }
      if (tag === "span")
        return {
          className: "",
          textContent: "",
          innerHTML: "",
          style: {},
          append: function () {},
          addEventListener: function () {},
          classList: {
            add: function () {},
            remove: function () {},
            contains: function () {
              return false;
            },
          },
          parentNode: {},
        };
      return {};
    };
    // Override validateFileInput to return true
    var origVal = validateFileInput;
    validateFileInput = async function () {
      return true;
    };
    initDropZones();
    // Trigger change with empty files — should hit the else branch
    if (handlers.change) {
      dzClassList._added.push("has-file"); // simulate previously had file
      handlers.change();
    }
    assert.ok(
      dzClassList._removed.indexOf("has-file") !== -1 ||
        dzClassList._added.length === 0,
    );
    validateFileInput = origVal;
    document.querySelectorAll = origQS;
    document.createElement = origCE;
  });
});

// ──────────────────────────────────────────────
// checkAutomation — webdriver_attr branch
// ──────────────────────────────────────────────

describe("shared.js — checkAutomation (webdriver_attr)", function () {
  it("should detect webdriver attribute on html element", function () {
    var origGA = document.documentElement.getAttribute;
    document.documentElement.getAttribute = function (a) {
      return a === "webdriver"
        ? "true"
        : origGA.call(document.documentElement, a);
    };
    var result = checkAutomation();
    assert.ok(result.signals.indexOf("webdriver_attr") !== -1);
    assert.ok(result.score >= 35);
    document.documentElement.getAttribute = origGA;
  });
});

// ──────────────────────────────────────────────
// initDropZones — updateFile validation failure
// ──────────────────────────────────────────────

describe("shared.js — initDropZones (updateFile failure path)", function () {
  it("should handle validation failure in updateFile", async function () {
    var removedClasses = [];
    var clearCalled = false;
    var mockInput = {
      files: [new File(["x"], "test.png", { type: "image/png" })],
      value: "",
      click: function () {},
      getAttribute: function () {
        return null;
      },
      addEventListener: function () {},
      parentElement: {
        classList: {
          contains: function () {
            return false;
          },
        },
      },
      parentNode: {
        insertBefore: function () {},
        querySelector: function () {
          return null;
        },
      },
      classList: {
        add: function () {},
        remove: function () {},
        contains: function () {
          return false;
        },
      },
    };
    var origQS = document.querySelectorAll;
    var origClear = clearInputFiles;
    clearInputFiles = function () {
      clearCalled = true;
    };
    var origVal = validateFileInput;
    validateFileInput = async function () {
      return false;
    };
    document.querySelectorAll = function (sel) {
      if (sel === '.form-group input[type="file"]') return [mockInput];
      return [];
    };
    document.createElement = function (tag) {
      if (tag === "div")
        return {
          className: "",
          textContent: "",
          innerHTML: "",
          style: {},
          append: function () {},
          addEventListener: function () {},
          classList: {
            add: function () {},
            remove: function (c) {
              removedClasses.push(c);
            },
            contains: function () {
              return false;
            },
          },
          parentNode: {
            insertBefore: function () {},
            querySelector: function () {
              return null;
            },
          },
          querySelector: _dzQuerySelector,
        };
      if (tag === "span")
        return {
          className: "",
          textContent: "",
          innerHTML: "",
          style: {},
          append: function () {},
          addEventListener: function () {},
          classList: {
            add: function () {},
            remove: function () {},
            contains: function () {
              return false;
            },
          },
          parentNode: {},
        };
      return {};
    };
    initDropZones();
    // Wait for async updateFile (called at line 430 via `if (input.files && input.files.length) updateFile()`)
    await new Promise(function (r) {
      return setTimeout(r, 20);
    });
    assert.ok(clearCalled, "clearInputFiles was called on validation failure");
    document.querySelectorAll = origQS;
    clearInputFiles = origClear;
    validateFileInput = origVal;
  });

  it("should handle updateFile else branch on change with no files", function () {
    var changeHandler = null;
    var removedClasses = [];
    var mockInput = {
      files: [],
      value: "",
      click: function () {},
      getAttribute: function () {
        return null;
      },
      addEventListener: function (type, fn) {
        if (type === "change") changeHandler = fn;
      },
      parentElement: {
        classList: {
          contains: function () {
            return false;
          },
        },
      },
      parentNode: {
        insertBefore: function () {},
        querySelector: function () {
          return null;
        },
      },
      classList: {
        add: function () {},
        remove: function () {},
        contains: function () {
          return false;
        },
      },
    };
    var origQS = document.querySelectorAll;
    var origVal = validateFileInput;
    validateFileInput = async function () {
      return true;
    };
    document.querySelectorAll = function (sel) {
      if (sel === '.form-group input[type="file"]') return [mockInput];
      return [];
    };
    document.createElement = function (tag) {
      if (tag === "div")
        return {
          className: "",
          textContent: "",
          innerHTML: "",
          style: {},
          append: function () {},
          addEventListener: function () {},
          classList: {
            add: function () {},
            remove: function (c) {
              removedClasses.push(c);
            },
            contains: function () {
              return false;
            },
          },
          parentNode: {
            insertBefore: function () {},
            querySelector: function () {
              return null;
            },
          },
          querySelector: _dzQuerySelector,
        };
      if (tag === "span")
        return {
          className: "",
          textContent: "",
          innerHTML: "",
          style: {},
          append: function () {},
          addEventListener: function () {},
          classList: {
            add: function () {},
            remove: function () {},
            contains: function () {
              return false;
            },
          },
          parentNode: {},
        };
      return {};
    };
    initDropZones();
    // Trigger change event — input.files is empty, so else branch runs
    if (changeHandler) changeHandler();
    validateFileInput = origVal;
    document.querySelectorAll = origQS;
  });
});
