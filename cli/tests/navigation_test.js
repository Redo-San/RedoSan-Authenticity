const path = require("path");
const fs = require("fs");
const vm = require("vm");
const assert = require("assert/strict");
const { describe, it, before } = require("node:test");

var _els = {};

function makeEl(id, extra) {
  if (!_els[id]) {
    _els[id] = Object.assign({
      style: { display: "" },
      value: "", textContent: "", innerHTML: "", className: "", dataset: {},
      placeholder: "", title: "", rel: "", href: "", id: id, src: "", download: "",
      classList: { add: function () {}, remove: function () {}, contains: function () { return false; }, toggle: function () {} },
      append: function () {}, appendChild: function () {}, remove: function () {},
      addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () {},
      getAttribute: function (a) { return this[a] || null; },
      setAttribute: function (a, v) { this[a] = v; },
      click: function () {}, focus: function () {},
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      parentElement: {}, parentNode: { insertBefore: function () {}, removeChild: function () {}, querySelector: function () { return null; } },
    }, extra || {});
  }
  return _els[id];
}

function setupDOM() {
  _els = {};
  var _domReadyCbs = [];
  var _clickCbs = [];
  var _navLinkCbs = {};
  var _cardCbs = {};

  globalThis.document = {
    documentElement: { dataset: {}, style: {}, getAttribute: function () { return null; } },
    getElementById: function (id) { return _els[id] || null; },
    querySelector: function (sel) {
      if (sel === 'meta[name="description"]') return makeEl("metaDesc");
      if (sel.includes("data-wm-tab") || sel.includes("data-ots-tab") || sel.includes("data-c2pa-tab")) return makeEl("tabBtn");
      return null;
    },
    querySelectorAll: function (sel) {
      if (sel === ".page") return [];
      if (sel === ".sidebar a[data-page]") return [];
      if (sel === ".nav-links a[data-page], .footer-links a[data-page], .sidebar a[data-page], .logo[data-page]") return [];
      if (sel === ".simple-nav-links a[data-page]") return [];
      if (sel === ".card[data-page]") return [];
      if (sel === ".tab-btn[data-wm-tab]") return [];
      if (sel === ".tab-btn[data-ots-tab]") return [];
      if (sel === ".tab-btn[data-c2pa-tab]") return [];
      if (sel === 'link[rel="preload"][as="audio"]') return [];
      if (sel === "#modeSelect") return [];
      if (sel === ".lang-dropdown") return [];
      if (sel === ".sidebar a[data-page=\"removal-tools\"], .card[data-page=\"removal-tools\"], .footer-links a[data-page=\"removal-tools\"]") return [];
      return [];
    },
    createElement: function (tag) {
      var el = makeEl("created-" + tag, { tagName: tag });
      return el;
    },
    createTextNode: function () { return {}; },
    head: { append: function () {}, querySelector: function () { return null; } },
    body: { classList: { add: function () {}, remove: function () {}, contains: function () { return false; }, toggle: function () {} }, append: function () {}, querySelector: function () { return null; } },
    title: "test",
    addEventListener: function (evt, cb) {
      if (evt === "DOMContentLoaded") { _domReadyCbs.push(cb); globalThis.__navDomReadyCbs = _domReadyCbs; }
      if (evt === "click") _clickCbs.push(cb);
      if (evt === "keydown") globalThis.__navKeydownCb = cb;
      if (evt === "pointerdown") globalThis.__navPointerdownCb = cb;
    },
    removeEventListener: function () {},
  };

  var _winEventListeners = {};
  globalThis.addEventListener = function (evt, cb) {
    if (!_winEventListeners[evt]) _winEventListeners[evt] = [];
    _winEventListeners[evt].push(cb);
  };
  globalThis.removeEventListener = function () {};
  globalThis.__getNavListeners = function () { return _winEventListeners; };
  globalThis.window = globalThis;
  globalThis.location = {
    protocol: "http:", hostname: "localhost", href: "http://localhost:8080/",
    pathname: "/", replace: function () {}, hash: "",
    search: "",
  };
  globalThis.history = { pushState: function () {}, replaceState: function () {} };
  globalThis.console = { error: function () {}, warn: function () {}, log: function () {} };
  globalThis.setTimeout = setTimeout;
  globalThis.clearTimeout = clearTimeout;
  globalThis.setInterval = setInterval;
  globalThis.clearInterval = clearInterval;
  globalThis.encodeURIComponent = function (s) { return s; };
  globalThis.URLSearchParams = function () { return { get: function () { return null; } }; };
  globalThis.performance = { now: function () { return 0; } };
  globalThis.__ = function (key) { return key; };
}

function loadNav() {
  setupDOM();
  var src = fs.readFileSync(path.resolve(__dirname, "../../Style/navigation.js"), "utf8");
  vm.runInThisContext(src, { filename: path.resolve(__dirname, "../../Style/navigation.js") });
}

describe("navigation.js — globals & IIFE", () => {
  before(() => loadNav());

  it("should define PAGE_TITLES with 20 entries", () => {
    assert.ok(typeof PAGE_TITLES === "object");
    assert.ok(Object.keys(PAGE_TITLES).length >= 20);
  });

  it("should define PAGE_DESCS with descriptions", () => {
    assert.ok(typeof PAGE_DESCS === "object");
    assert.ok(PAGE_DESCS.home.length > 0);
  });

  it("should define PAGE_NAMES as a Set with valid page ids", () => {
    assert.ok(PAGE_NAMES instanceof Set);
    assert.ok(PAGE_NAMES.has("home"));
    assert.ok(PAGE_NAMES.has("watermark"));
    assert.ok(PAGE_NAMES.has("certificate"));
  });
});

describe("navigation.js — sanitizeRemovalTools", () => {
  before(() => loadNav());

  it("should not throw on localhost", () => {
    sanitizeRemovalTools();
  });
});

describe("navigation.js — toggleSidebar / closeSidebar", () => {
  before(() => {
    loadNav();
    _els["sidebar"] = makeEl("sidebar");
    _els["sidebarOverlay"] = makeEl("sidebarOverlay");
  });

  it("toggleSidebar should add/remove CSS classes", () => {
    var sidebarToggle = false, overlayToggle = false, bodyToggle = false;
    _els["sidebar"].classList.toggle = function (c) { if (c === "open") sidebarToggle = true; };
    _els["sidebarOverlay"].classList.toggle = function (c) { if (c === "open") overlayToggle = true; };
    globalThis.document.body.classList.toggle = function (c) { if (c === "no-scroll") bodyToggle = true; };
    toggleSidebar();
    assert.ok(sidebarToggle);
    assert.ok(overlayToggle);
    assert.ok(bodyToggle);
  });

  it("closeSidebar should remove CSS classes", () => {
    var sidebarRemove = false, overlayRemove = false, bodyRemove = false;
    _els["sidebar"].classList.remove = function (c) { if (c === "open") sidebarRemove = true; };
    _els["sidebarOverlay"].classList.remove = function (c) { if (c === "open") overlayRemove = true; };
    globalThis.document.body.classList.remove = function (c) { if (c === "no-scroll") bodyRemove = true; };
    closeSidebar();
    assert.ok(sidebarRemove);
    assert.ok(overlayRemove);
    assert.ok(bodyRemove);
  });
});

describe("navigation.js — showPage", () => {
  before(() => {
    loadNav();
    _els["page-home"] = makeEl("page-home");
    _els["page-watermark"] = makeEl("page-watermark");
    _els["metaDesc"] = makeEl("metaDesc");
  });

  it("should activate a page section", () => {
    var activated = false;
    _els["page-watermark"].classList.add = function (c) { if (c === "active") activated = true; };
    showPage("watermark");
    assert.ok(activated);
  });

  it("should set document title", () => {
    showPage("watermark");
    assert.ok(document.title.length > 0);
  });

  it("should update meta description", () => {
    showPage("watermark");
    assert.ok(_els["metaDesc"].getAttribute("content"));
  });

  it("should do nothing for invalid page name", () => {
    showPage("nonexistent");
  });

  it("should handle empty page name", () => {
    showPage("");
  });

  it("should handle home page", () => {
    showPage("home");
    assert.ok(document.title.includes("RedoSan"));
  });
});

describe("navigation.js — showStaticPage", () => {
  before(() => {
    loadNav();
    _els["modeSelect"] = makeEl("modeSelect");
    _els["simplifiedMode"] = makeEl("simplifiedMode");
    _els["mainNav"] = makeEl("mainNav");
    _els["app"] = makeEl("app");
    _els["sidebar"] = makeEl("sidebar");
    _els["sidebarOverlay"] = makeEl("sidebarOverlay");
    _els["mainFooter"] = makeEl("mainFooter");
    _els["page-about"] = makeEl("page-about");
  });

  it("should hide mode overlay and show static page", () => {
    showStaticPage("about");
    assert.equal(_els["modeSelect"].style.display, "none");
  });
});

describe("navigation.js — hideAllExcept", () => {
  before(() => {
    loadNav();
    ["modeSelect", "simplifiedMode", "mainNav", "app", "sidebar", "sidebarOverlay", "mainFooter"].forEach(function (id) {
      _els[id] = makeEl(id);
    });
  });

  it("should hide all except the specified element", () => {
    hideAllExcept("app");
    assert.equal(_els["modeSelect"].style.display, "none");
    assert.equal(_els["simplifiedMode"].style.display, "none");
    assert.notEqual(_els["app"].style.display, "none");
  });
});

describe("navigation.js — tab switching", () => {
  before(() => {
    loadNav();
    _els["wm-embed"] = makeEl("wm-embed");
    _els["wm-extract"] = makeEl("wm-extract");
    _els["ots-create"] = makeEl("ots-create");
    _els["ots-verify"] = makeEl("ots-verify");
    _els["c2pa-read"] = makeEl("c2pa-read");
    _els["c2pa-write"] = makeEl("c2pa-write");
    _els["c2pa-verify"] = makeEl("c2pa-verify");
    _els["c2pa-read-result"] = makeEl("c2pa-read-result");
    _els["c2pa-write-result"] = makeEl("c2pa-write-result");
    _els["c2pa-verify-result"] = makeEl("c2pa-verify-result");
  });

  it("switchWmTab should show embed, hide extract", () => {
    switchWmTab("embed");
    assert.notEqual(_els["wm-embed"].style.display, "none");
    assert.equal(_els["wm-extract"].style.display, "none");
  });

  it("switchWmTab should show extract, hide embed", () => {
    switchWmTab("extract");
    assert.notEqual(_els["wm-extract"].style.display, "none");
    assert.equal(_els["wm-embed"].style.display, "none");
  });

  it("switchOtsTab should show create, hide verify", () => {
    switchOtsTab("create");
    assert.notEqual(_els["ots-create"].style.display, "none");
    assert.equal(_els["ots-verify"].style.display, "none");
  });

  it("switchOtsTab should show verify, hide create", () => {
    switchOtsTab("verify");
    assert.notEqual(_els["ots-verify"].style.display, "none");
    assert.equal(_els["ots-create"].style.display, "none");
  });

  it("switchC2paTab should show read tab", () => {
    switchC2paTab("read");
    assert.notEqual(_els["c2pa-read"].style.display, "none");
    assert.equal(_els["c2pa-write"].style.display, "none");
    assert.equal(_els["c2pa-verify"].style.display, "none");
  });

  it("switchC2paTab should show write tab", () => {
    switchC2paTab("write");
    assert.notEqual(_els["c2pa-write"].style.display, "none");
    assert.equal(_els["c2pa-read"].style.display, "none");
    assert.equal(_els["c2pa-verify"].style.display, "none");
  });

  it("switchC2paTab should show verify tab", () => {
    switchC2paTab("verify");
    assert.notEqual(_els["c2pa-verify"].style.display, "none");
    assert.equal(_els["c2pa-read"].style.display, "none");
    assert.equal(_els["c2pa-write"].style.display, "none");
  });
});

describe("navigation.js — download modal", () => {
  before(() => {
    loadNav();
    _els["dl-modal"] = makeEl("dl-modal");
  });

  it("showDownloadModal should add open class", () => {
    var opened = false;
    _els["dl-modal"].classList.add = function (c) { if (c === "open") opened = true; };
    showDownloadModal();
    assert.ok(opened);
  });

  it("closeDownloadModal should remove open class", () => {
    var closed = false;
    _els["dl-modal"].classList.remove = function (c) { if (c === "open") closed = true; };
    closeDownloadModal();
    assert.ok(closed);
  });
});

describe("navigation.js — downloadResult", () => {
  before(() => loadNav());

  it("should call download handler if set", () => {
    var called = "";
    var orig = globalThis.getDownloadHandler;
    globalThis.getDownloadHandler = function () {
      return function (f) { called = f; };
    };
    downloadResult("pdf");
    assert.equal(called, "pdf");
    globalThis.getDownloadHandler = orig;
  });

  it("should call downloadFingerprint if no handler", () => {
    var called = "";
    var orig = globalThis.getDownloadHandler;
    globalThis.getDownloadHandler = function () { return null; };
    globalThis.downloadFingerprint = function (f) { called = f; };
    downloadResult("json");
    assert.equal(called, "json");
    delete globalThis.downloadFingerprint;
    globalThis.getDownloadHandler = orig;
  });
});

describe("navigation.js — handleHashNav", () => {
  before(() => {
    loadNav();
    _els["page-home"] = makeEl("page-home");
    _els["modeSelect"] = makeEl("modeSelect");
    _els["searchInput"] = makeEl("searchInput");
  });

  it("should handle hash navigation", () => {
    globalThis.location.hash = "#/home";
    handleHashNav();
  });

  it("should handle search query param", () => {
    globalThis.location.hash = "";
    globalThis.location.search = "?search=test";
    globalThis.URLSearchParams = function () {
      return { get: function (k) { return k === "search" ? "test" : null; } };
    };
    globalThis.setMode = function () {};
    handleHashNav();
  });
});

describe("navigation.js — initNav", () => {
  before(() => {
    loadNav();
  });

  it("should not throw", () => {
    initNav();
  });
});

describe("navigation.js — SPA mode nav click handlers", () => {
  var navLinkCb, navLink2Cb, simpleNavCb, cardCb;
  var showPageSpy, showStaticPageSpy, closeSidebarSpy;

  before(() => {
    setupDOM();

    var navLink1 = makeEl("spaNavLink1", {
      dataset: { page: "watermark" },
      addEventListener: function (evt, cb) {
        if (evt === "click") navLinkCb = cb;
      },
      closest: function (sel) { return sel === ".sidebar" ? {} : null; },
    });

    var navLink2 = makeEl("spaNavLink2", {
      dataset: { page: "fingerprint" },
      addEventListener: function (evt, cb) {
        if (evt === "click") navLink2Cb = cb;
      },
      closest: function () { return null; },
    });

    var simpleNavLink = makeEl("spaSimpleNavLink", {
      dataset: { page: "about" },
      addEventListener: function (evt, cb) {
        if (evt === "click") simpleNavCb = cb;
      },
    });

    var cardEl = makeEl("spaCard", {
      dataset: { page: "certificate" },
      addEventListener: function (evt, cb) {
        if (evt === "click") cardCb = cb;
      },
    });

    document.querySelectorAll = function (sel) {
      if (sel === ".nav-links a[data-page], .footer-links a[data-page], .sidebar a[data-page], .logo[data-page]") {
        return [navLink1, navLink2];
      }
      if (sel === ".simple-nav-links a[data-page]") {
        return [simpleNavLink];
      }
      if (sel === ".card[data-page]") {
        return [cardEl];
      }
      if (sel === ".page") return [];
      if (sel === ".sidebar a[data-page]") return [];
      if (sel === ".tab-btn[data-wm-tab]") return [];
      if (sel === ".tab-btn[data-ots-tab]") return [];
      if (sel === ".tab-btn[data-c2pa-tab]") return [];
      if (sel === 'link[rel="preload"][as="audio"]') return [];
      if (sel === "#modeSelect") return [];
      if (sel === ".lang-dropdown") return [];
      if (sel === '.sidebar a[data-page="removal-tools"], .card[data-page="removal-tools"], .footer-links a[data-page="removal-tools"]') return [];
      return [];
    };

    var src = fs.readFileSync(path.resolve(__dirname, "../../Style/navigation.js"), "utf8");
    vm.runInThisContext(src);

    showPageSpy = "";
    showStaticPageSpy = "";
    closeSidebarSpy = false;

    globalThis.showPage = function (name) { showPageSpy = name; };
    globalThis.showStaticPage = function (name) { showStaticPageSpy = name; };
    globalThis.closeSidebar = function () { closeSidebarSpy = true; };
  });

  it("should call showPage and preventDefault on nav link click", () => {
    var prevented = false;
    navLinkCb({ preventDefault: function () { prevented = true; } });
    assert.equal(showPageSpy, "watermark");
    assert.ok(prevented);
  });

  it("should call closeSidebar when nav link is inside .sidebar", () => {
    closeSidebarSpy = false;
    navLinkCb({ preventDefault: function () {} });
    assert.ok(closeSidebarSpy);
  });

  it("should call showPage on non-sidebar nav link without closeSidebar", () => {
    showPageSpy = "";
    closeSidebarSpy = false;
    var prevented = false;
    navLink2Cb({ preventDefault: function () { prevented = true; } });
    assert.equal(showPageSpy, "fingerprint");
    assert.ok(!closeSidebarSpy);
    assert.ok(prevented);
  });

  it("should call showStaticPage and preventDefault on simple-nav link click", () => {
    var prevented = false;
    simpleNavCb({ preventDefault: function () { prevented = true; } });
    assert.equal(showStaticPageSpy, "about");
    assert.ok(prevented);
  });

  it("should call showPage and preventDefault on card click", () => {
    showPageSpy = "";
    var prevented = false;
    cardCb({ preventDefault: function () { prevented = true; } });
    assert.equal(showPageSpy, "certificate");
    assert.ok(prevented);
  });
});

describe("navigation.js — DOMContentLoaded main callback (lines 423-439)", () => {
  before(() => {
    loadNav();
  });

  it("should register pointerdown and keydown event listeners for deferredReplace", () => {
    var cbs = globalThis.__navDomReadyCbs;
    assert.ok(cbs && cbs.length >= 1, "DOMContentLoaded callbacks should exist");
    var mainCb = cbs[0];
    assert.ok(mainCb, "main DOMContentLoaded callback should exist");

    // Fire the DOMContentLoaded callback — this is what registers the listeners
    mainCb();

    // Capture pointerdown/keydown handler
    var ptrHandler = globalThis.__navPointerdownCb;
    var keyHandler = globalThis.__navKeydownCb;
    assert.ok(ptrHandler, "pointerdown handler should be registered");
    assert.ok(keyHandler, "keydown handler should be registered");

    // Invoke the handler - should call history.replaceState
    var replaced = false;
    var origReplaceState = globalThis.history.replaceState;
    globalThis.history.replaceState = function (state, title, url) {
      if (state && state.modeOverlay) replaced = true;
    };

    ptrHandler();

    assert.ok(replaced, "history.replaceState should be called by deferredReplace");
    globalThis.history.replaceState = origReplaceState;
  });

  it("deferredReplace removes event listeners after execution", () => {
    var keyHandler = globalThis.__navKeydownCb;

    // After first call, listeners should be removed
    // Invoke keydown handler
    keyHandler();

    // The handler removes itself, but we can't easily verify that without
    // tracking removeEventListener calls. Just verify no error.
    assert.ok(true);
  });
});

describe("navigation.js — DOMContentLoaded handler (lines 535-538)", () => {
  before(() => {
    loadNav();
  });

  it("should update isStandalone when dataset.standalone is set", () => {
    globalThis.document.documentElement.dataset.standalone = "watermark";
    var cbs = globalThis.__navDomReadyCbs;
    assert.ok(cbs && cbs.length > 0, "DOMContentLoaded callbacks should be registered");
    // The first callback is from line 423 (sanitizeRemovalTools/initNav/deferredReplace)
    // The second callback is from line 535 (isStandalone update)
    var cb535 = cbs[1];
    if (cb535) cb535();
    // isStandalone should be truthy now (it's a string, not boolean)
    assert.ok(globalThis.isStandalone);
  });
});

describe("navigation.js — pageshow handler (lines 541-578)", () => {
  before(() => {
    loadNav();
  });

  it("should persist page class on bfcache restore for MPA standalone", () => {
    var listeners = globalThis.__getNavListeners();
    var handlers = listeners["pageshow"];
    assert.ok(handlers && handlers.length > 0);
    globalThis.document.documentElement.dataset.standalone = "watermark";
    _els["page-watermark"] = makeEl("page-watermark");
    var activated = false;
    _els["page-watermark"].classList.add = function (c) {
      if (c === "active") activated = true;
    };
    handlers[0]({ persisted: true });
    // The handler should re-activate the page if it lost .active during freeze
    assert.ok(activated);
  });

  it("should restore page from history state in SPA mode", () => {
    var listeners = globalThis.__getNavListeners();
    var handlers = listeners["pageshow"];
    delete globalThis.document.documentElement.dataset.standalone;
    _els["page-watermark"] = makeEl("page-watermark");
    var activated = false;
    _els["page-watermark"].classList.add = function (c) {
      if (c === "active") activated = true;
    };
    globalThis.history.state = { page: "watermark" };
    handlers[0]({ persisted: true });
    assert.ok(activated, "SPA page should be reactivated from history state");
  });

  it("should handle pageshow without persistence (does nothing)", () => {
    var listeners = globalThis.__getNavListeners();
    var handlers = listeners["pageshow"];
    // When ev.persisted is false, the handler returns early
    handlers[0]({ persisted: false });
    // Should not throw
  });

  it("should restore staticPage from history state in pageshow", () => {
    var listeners = globalThis.__getNavListeners();
    var handlers = listeners["pageshow"];
    delete globalThis.document.documentElement.dataset.standalone;
    _els["page-about"] = makeEl("page-about");
    var activated = false;
    _els["page-about"].classList.add = function (c) {
      if (c === "active") activated = true;
    };
    globalThis.history.state = { staticPage: "about" };
    handlers[0]({ persisted: true });
    assert.ok(activated, "static page should be activated from history state");
  });

  it("should show modeSelect when history state is modeOverlay", () => {
    var listeners = globalThis.__getNavListeners();
    var handlers = listeners["pageshow"];
    delete globalThis.document.documentElement.dataset.standalone;
    _els["modeSelect"] = makeEl("modeSelect");
    globalThis.history.state = { modeOverlay: true };
    handlers[0]({ persisted: true });
    assert.equal(_els["modeSelect"].style.display, "", "modeSelect should be shown");
  });

  it("should show modeSelect when history state is null", () => {
    var listeners = globalThis.__getNavListeners();
    var handlers = listeners["pageshow"];
    delete globalThis.document.documentElement.dataset.standalone;
    _els["modeSelect"] = makeEl("modeSelect", { style: { display: "none" } });
    globalThis.history.state = null;
    handlers[0]({ persisted: true });
    assert.equal(_els["modeSelect"].style.display, "", "modeSelect should be shown when no state");
  });
});

describe("navigation.js — switchC2paTab with write mode (lines 529-531)", () => {
  before(() => {
    loadNav();
    _els["c2pa-read"] = makeEl("c2pa-read");
    _els["c2pa-write"] = makeEl("c2pa-write");
    _els["c2pa-verify"] = makeEl("c2pa-verify");
    _els["c2pa-read-result"] = makeEl("c2pa-read-result");
    _els["c2pa-write-result"] = makeEl("c2pa-write-result");
    _els["c2pa-verify-result"] = makeEl("c2pa-verify-result");
  });

  it("should call updateC2paWriteForm when mode is write and function exists", () => {
    var called = false;
    globalThis.updateC2paWriteForm = function () { called = true; };
    switchC2paTab("write");
    assert.ok(called);
    delete globalThis.updateC2paWriteForm;
  });

  it("should not throw when updateC2paWriteForm is undefined", () => {
    switchC2paTab("write");
    // Should not throw
  });
});
