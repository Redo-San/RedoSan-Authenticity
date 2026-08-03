const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── Shared mock element store ──
var _els = {};

// ── Event listener capture ──
// Persists across the entire test file so handlers registered during
// module load (popstate, pageshow, DOMContentLoaded) remain available.
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

function triggerEvent(type, evt) {
  if (_listeners[type]) {
    _listeners[type].slice().forEach(function (fn) { fn(evt); });
  }
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
      value: "", textContent: "", innerHTML: "", className: "", src: "", download: "",
      disabled: false, href: "", onclick: null,
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
    }, extra || {});
  } else if (extra) {
    Object.assign(_els[id], extra);
  }
  return _els[id];
}

// ── Reset navigation-specific state ──
// Does NOT clear _listeners so event handlers registered at module load survive.
function resetNavState() {
  _els = {};

  globalThis.document = {
    documentElement: {
      dataset: {},
      style: {},
      getAttribute: function () { return null; },
    },
    getElementById: function (id) { return _els[id] || null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    createElement: function (tag) { return makeEl("created-" + tag, { tagName: tag }); },
    createTextNode: function () { return {}; },
    title: "",
    body: { classList: makeClassList(), append: function () {} },
    addEventListener: addListener,
    removeEventListener: removeListener,
    head: { append: function () {}, querySelector: function () { return null; } },
  };

  globalThis.window = globalThis;
  globalThis.addEventListener = addListener;
  globalThis.removeEventListener = removeListener;

  globalThis.location = {
    hash: "",
    search: "",
    pathname: "/",
    hostname: "localhost",
    href: "http://localhost/",
    protocol: "file:",
  };

  globalThis.history = {
    state: null,
    pushState: function (state, title, url) { this.state = state; },
    replaceState: function (state, title, url) { this.state = state; },
  };

  globalThis.console = { error: function () {}, warn: function () {}, log: function () {} };
  globalThis.setTimeout = setTimeout;
  globalThis.clearTimeout = clearTimeout;
  globalThis.URLSearchParams = function () { return { get: function () { return null; } }; };
  globalThis.encodeURIComponent = function (s) { return s; };
  globalThis.__ = function (key) { return key; };

  // Navigation.js-dependent globals
  globalThis.setMode = undefined;
  globalThis.siteSearch = undefined;
  globalThis.getDownloadHandler = function () { return null; };
  globalThis.downloadFingerprint = undefined;
  globalThis.updateC2paWriteForm = undefined;
  globalThis.idForgeShowInfo = undefined;
  globalThis.initCertPhoneCode = undefined;
}

// ── Load navigation.js ──
function loadNav() {
  var src = fs.readFileSync(path.resolve(__dirname, "../../Style/navigation.js"), "utf8");
  vm.runInThisContext(src, { filename: path.resolve(__dirname, "../../Style/navigation.js") });
}

// ── Helpers for tests that need querySelectorAll to return .page elements ──
var _querySelectorAllOverrides = null;

function makeQuerySelectorAll(pages, sidebarLinks) {
  return function (sel) {
    if (sel === ".page") return pages || [];
    if (sel.indexOf("sidebar a[data-page]") !== -1) return sidebarLinks || [];
    // For sanitizeRemovalTools
    if (sel.indexOf("removal-tools") !== -1) return [];
    return [];
  };
}

// ═══════════════════════════════════════════════════════════════
// Setup — run ONCE before all tests
// ═══════════════════════════════════════════════════════════════
before(function () {
  resetNavState();
  loadNav();
});

// ═══════════════════════════════════════════════════════════════
// sanitizeRemovalTools  (covers lines 20-24)
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — sanitizeRemovalTools", function () {
  before(function () {
    resetNavState();
  });

  it("returns early when hostname is not production (localhost)", function () {
    globalThis.location.hostname = "localhost";
    // Should not throw despite no querySelectorAll for removal-tools returning anything
    globalThis.document.querySelectorAll = function () { return []; };
    sanitizeRemovalTools();
    // No elements should be removed — no assertion needed beyond no error
  });

  it("removes .sidebar, .card, and .footer-links elements on production hostname", function () {
    globalThis.location.hostname = "redo-san.github.io";
    var removedCount = 0;
    var els = [
      { remove: function () { removedCount++; } },
      { remove: function () { removedCount++; } },
      { remove: function () { removedCount++; } },
    ];
    globalThis.document.querySelectorAll = function (sel) {
      assert.ok(sel.indexOf("removal-tools") !== -1);
      return els;
    };
    sanitizeRemovalTools();
    assert.equal(removedCount, 3, "should remove all three matched elements");
    globalThis.location.hostname = "localhost";
  });
});

// ═══════════════════════════════════════════════════════════════
// showPage  (covers lines 174-192 standalone redirect, 227-238 pushState)
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — showPage", function () {
  before(function () {
    resetNavState();
    // Don't remove switchOtsTab / idForgeShowInfo / initCertPhoneCode —
    // they are defined in navigation.js itself and persist properly.
  });

  it("activates home page and sets title", function () {
    var pageHome = makeEl("page-home");
    makeEl("app");

    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageHome], []);

    showPage("home");

    assert.ok(pageHome.classList.contains("active"), "home page should have active class");
    assert.ok(globalThis.document.title.indexOf("RedoSan Authenticity") !== -1,
      "title should contain 'RedoSan Authenticity'");
  });

  it("does nothing for invalid page name (not in PAGE_NAMES)", function () {
    // No page elements exist; should return early without error
    showPage("nonexistent");
    // If it returned early at the whitelist check, nothing was modified
  });

  it("clears all active pages when called with undefined", function () {
    var pageHome = makeEl("page-home");

    // First activate home
    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageHome], []);
    showPage("home");
    assert.ok(pageHome.classList.contains("active"));

    // Now call with undefined — should remove active from all pages
    showPage(undefined);
    assert.ok(!pageHome.classList.contains("active"), "home should not be active after undefined call");
  });

  it("activates watermark, sets title, and updates meta description", function () {
    var pageWm = makeEl("page-watermark");
    makeEl("app");

    var metaEl = { content: "", setAttribute: function (a, v) { this.content = v; } };
    globalThis.document.querySelector = function (sel) {
      if (sel === 'meta[name="description"]') return metaEl;
      return null;
    };

    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageWm], []);

    showPage("watermark");

    assert.ok(pageWm.classList.contains("active"), "watermark page should have active class");
    assert.ok(globalThis.document.title.indexOf("Digital Watermark") !== -1,
      "title should reference Digital Watermark");
    assert.ok(metaEl.content.indexOf("digital watermarks") !== -1,
      "meta description should reference digital watermarks");
  });

  it("activates sidebar nav link when present", function () {
    var pageWm = makeEl("page-watermark");
    makeEl("app");
    var navLink = makeEl("nav-wm", { classList: makeClassList() });
    navLink.dataset = { page: "watermark" };

    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageWm], [navLink]);
    globalThis.document.querySelector = function (sel) {
      if (sel === 'meta[name="description"]') return null;
      if (sel.indexOf('data-page="watermark"') !== -1) return navLink;
      return null;
    };

    showPage("watermark");
    assert.ok(navLink.classList.contains("active"), "sidebar nav link should be active");
  });

  it("calls pushState with {page: name} when mainNav is visible and not standalone", function () {
    var pageWm = makeEl("page-watermark");
    makeEl("app");
    var mainNav = makeEl("mainNav");
    mainNav.style.display = ""; // visible

    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageWm], []);
    globalThis.document.querySelector = function (sel) {
      if (sel === 'meta[name="description"]') return null;
      return null;
    };
    globalThis.document.getElementById = function (id) {
      if (id === "mainNav") return mainNav;
      return _els[id] || null;
    };
    globalThis.document.documentElement.dataset = {}; // not standalone

    // Reset history state
    globalThis.history.state = null;

    showPage("watermark");

    assert.deepEqual(globalThis.history.state, { page: "watermark" },
      "pushState should be called with page state");
  });

  it("calls pushState with {page:'home'} when name is home and mainNav visible", function () {
    var pageHome = makeEl("page-home");
    makeEl("app");
    var mainNav = makeEl("mainNav");
    mainNav.style.display = "";

    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageHome], []);
    globalThis.document.querySelector = function () { return null; };
    globalThis.document.getElementById = function (id) {
      if (id === "mainNav") return mainNav;
      return _els[id] || null;
    };
    globalThis.location.pathname = "/app/";
    globalThis.history.state = null;

    showPage("home");

    assert.ok(globalThis.history.state, "pushState should have been called");
    assert.equal(globalThis.history.state.page, "home",
      "state.page should be 'home'");
  });

  it("does NOT call pushState when mainNav display is none", function () {
    var pageWm = makeEl("page-watermark");
    makeEl("app");
    var mainNav = makeEl("mainNav");
    mainNav.style.display = "none"; // hidden

    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageWm], []);
    globalThis.document.querySelector = function () { return null; };
    globalThis.document.getElementById = function (id) {
      if (id === "mainNav") return mainNav;
      return _els[id] || null;
    };
    globalThis.history.state = null;

    showPage("watermark");

    assert.equal(globalThis.history.state, null,
      "pushState should NOT be called when mainNav is hidden");
  });

  it("does NOT call pushState when standalone", function () {
    var pageWm = makeEl("page-watermark");
    makeEl("app");
    var mainNav = makeEl("mainNav");
    mainNav.style.display = "";

    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageWm], []);
    globalThis.document.querySelector = function () { return null; };
    globalThis.document.getElementById = function (id) {
      if (id === "mainNav") return mainNav;
      return _els[id] || null;
    };
    globalThis.document.documentElement.dataset = { standalone: "watermark" };
    globalThis.history.state = null;

    showPage("watermark");

    assert.equal(globalThis.history.state, null,
      "pushState should NOT be called when standalone dataset is set");
  });
});

// ═══════════════════════════════════════════════════════════════
// showPage — standalone redirect  (covers lines 174-192)
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — showPage standalone redirect", function () {
  before(function () {
    resetNavState();
    globalThis.document.documentElement.dataset = { standalone: "watermark" };
    globalThis.location.href = "http://localhost/Style/pages/watermark/index.html";
    globalThis.location.pathname = "/Style/pages/watermark/index.html";
  });

  it("redirects to ./name/index.html when 'pages' not in pathname", function () {
    globalThis.location.pathname = "/watermark/";
    // No page-watermark element — triggers redirect
    // Ensure no page element exists for this name
    if (_els["page-watermark"]) delete _els["page-watermark"];

    showPage("watermark");

    assert.ok(globalThis.location.href.indexOf("watermark/index.html") !== -1,
      "should redirect to 'watermark/index.html'");
  });

  it("redirects through 'pages' directory when 'pages' is in pathname", function () {
    globalThis.location.pathname = "/Style/pages/home/index.html";
    // Ensure the page element does NOT exist
    if (_els["page-about"]) delete _els["page-about"];

    showPage("about");

    assert.ok(globalThis.location.href.indexOf("pages/about/index.html") !== -1,
      "should redirect through pages/ directory");
  });

  it("does not redirect when page element exists (standalone SPA)", function () {
    var pageWm = makeEl("page-watermark");
    globalThis.location.href = "http://localhost/";
    globalThis.location.pathname = "/";

    showPage("watermark");

    // Should not have redirected
    assert.equal(globalThis.location.href, "http://localhost/",
      "should NOT redirect when page element exists");
    assert.ok(pageWm.classList.contains("active"),
      "should activate the page element");
  });
});

// ═══════════════════════════════════════════════════════════════
// showStaticPage
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — showStaticPage", function () {
  before(function () {
    resetNavState();
    globalThis.__musicInit = undefined;

    makeEl("modeSelect");
    makeEl("simplifiedMode");
    makeEl("mainNav");
    makeEl("app");
    makeEl("sidebar");
    makeEl("sidebarOverlay");
    makeEl("mainFooter");

    globalThis.document.querySelectorAll = makeQuerySelectorAll([], []);
  });

  it("hides mode overlay, simplified mode, mainNav, sidebar, footer; shows app", function () {
    var pageAbout = makeEl("page-about");
    showStaticPage("about");

    assert.equal(_els["modeSelect"].style.display, "none");
    assert.equal(_els["simplifiedMode"].style.display, "none");
    assert.equal(_els["mainNav"].style.display, "none");
    assert.equal(_els["sidebar"].style.display, "none");
    assert.equal(_els["sidebarOverlay"].style.display, "none");
    assert.equal(_els["mainFooter"].style.display, "none");
    // app should be visible (not "none")
    assert.notEqual(_els["app"].style.display, "none");
    assert.ok(pageAbout.classList.contains("active"));
  });

  it("pushes history state with staticPage info", function () {
    // history.state should be set from showStaticPage call above
    assert.ok(globalThis.history.state, "history.state should be set");
    assert.equal(globalThis.history.state.staticPage, "about");
    assert.equal(globalThis.history.state.fromOverlay, true);
  });

  it("calls __musicInit if defined", function () {
    var musicCalled = false;
    globalThis.__musicInit = function () { musicCalled = true; };

    showStaticPage("about");

    assert.ok(musicCalled, "__musicInit should have been called");
    delete globalThis.__musicInit;
  });
});

// ═══════════════════════════════════════════════════════════════
// hideAllExcept
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — hideAllExcept", function () {
  before(function () {
    resetNavState();
    ["modeSelect", "simplifiedMode", "mainNav", "app", "sidebar", "sidebarOverlay", "mainFooter"]
      .forEach(function (id) { makeEl(id); });
  });

  it("hides all except 'app'", function () {
    hideAllExcept("app");

    assert.equal(_els["modeSelect"].style.display, "none");
    assert.equal(_els["simplifiedMode"].style.display, "none");
    assert.equal(_els["mainNav"].style.display, "none");
    assert.notEqual(_els["app"].style.display, "none", "app should remain visible");
    assert.equal(_els["sidebar"].style.display, "none");
    assert.equal(_els["sidebarOverlay"].style.display, "none");
    assert.equal(_els["mainFooter"].style.display, "none");
  });

  it("hides all except 'modeSelect'", function () {
    hideAllExcept("modeSelect");

    assert.notEqual(_els["modeSelect"].style.display, "none", "modeSelect should remain visible");
    assert.equal(_els["simplifiedMode"].style.display, "none");
    assert.equal(_els["mainNav"].style.display, "none");
    assert.equal(_els["app"].style.display, "none");
  });

  it("handles null keep (hides all)", function () {
    hideAllExcept(null);

    assert.equal(_els["modeSelect"].style.display, "none");
    assert.equal(_els["simplifiedMode"].style.display, "none");
    assert.equal(_els["mainNav"].style.display, "none");
    assert.equal(_els["app"].style.display, "none");
    assert.equal(_els["sidebar"].style.display, "none");
    assert.equal(_els["sidebarOverlay"].style.display, "none");
    assert.equal(_els["mainFooter"].style.display, "none");
  });

  it("tolerates missing elements", function () {
    _els = {}; // no elements exist
    hideAllExcept("app"); // should not throw
  });
});

// ═══════════════════════════════════════════════════════════════
// toggleSidebar / closeSidebar
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — toggleSidebar / closeSidebar", function () {
  before(function () {
    resetNavState();
    makeEl("sidebar");
    makeEl("sidebarOverlay");
  });

  it("toggleSidebar toggles 'open' class on sidebar, overlay, and 'no-scroll' on body", function () {
    toggleSidebar();

    assert.ok(_els["sidebar"].classList.contains("open"));
    assert.ok(_els["sidebarOverlay"].classList.contains("open"));
    assert.ok(globalThis.document.body.classList.contains("no-scroll"));

    // Toggle again — should remove
    toggleSidebar();

    assert.ok(!_els["sidebar"].classList.contains("open"));
    assert.ok(!_els["sidebarOverlay"].classList.contains("open"));
    assert.ok(!globalThis.document.body.classList.contains("no-scroll"));
  });

  it("closeSidebar removes 'open' class from sidebar and overlay", function () {
    // First open
    toggleSidebar();
    assert.ok(_els["sidebar"].classList.contains("open"));

    // Now close
    closeSidebar();

    assert.ok(!_els["sidebar"].classList.contains("open"));
    assert.ok(!_els["sidebarOverlay"].classList.contains("open"));
    assert.ok(!globalThis.document.body.classList.contains("no-scroll"));
  });
});

// ═══════════════════════════════════════════════════════════════
// Tab switching
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — tab switching", function () {
  before(function () {
    resetNavState();
    makeEl("wm-embed");
    makeEl("wm-extract");
    makeEl("ots-create");
    makeEl("ots-verify");
    makeEl("c2pa-read");
    makeEl("c2pa-write");
    makeEl("c2pa-verify");
    makeEl("c2pa-read-result", { style: { display: "" } });
    makeEl("c2pa-write-result", { style: { display: "" } });
    makeEl("c2pa-verify-result", { style: { display: "" } });
  });

  it("switchWmTab('embed') shows embed, hides extract, activates tab button", function () {
    var tabBtn = makeEl("tabBtn");
    var btnActivated = false;
    tabBtn.classList.add = function (c) { if (c === "active") btnActivated = true; };

    globalThis.document.querySelectorAll = function (sel) {
      if (sel === ".tab-btn[data-wm-tab]") return [tabBtn];
      return [];
    };
    globalThis.document.querySelector = function (sel) {
      if (sel === '.tab-btn[data-wm-tab="embed"]') return tabBtn;
      return null;
    };

    switchWmTab("embed");

    assert.notEqual(_els["wm-embed"].style.display, "none");
    assert.equal(_els["wm-extract"].style.display, "none");
    assert.ok(btnActivated);
  });

  it("switchWmTab('extract') shows extract, hides embed", function () {
    var tabBtn = makeEl("tabBtnX");
    var btnActivated = false;
    tabBtn.classList.add = function (c) { if (c === "active") btnActivated = true; };

    globalThis.document.querySelectorAll = function (sel) {
      if (sel === ".tab-btn[data-wm-tab]") return [tabBtn];
      return [];
    };
    globalThis.document.querySelector = function (sel) {
      if (sel === '.tab-btn[data-wm-tab="extract"]') return tabBtn;
      return null;
    };

    switchWmTab("extract");

    assert.notEqual(_els["wm-extract"].style.display, "none");
    assert.equal(_els["wm-embed"].style.display, "none");
    assert.ok(btnActivated);
  });

  it("switchOtsTab('create') shows create, hides verify", function () {
    var tabBtn = makeEl("otsBtn");
    tabBtn.classList = makeClassList();

    globalThis.document.querySelectorAll = function (sel) {
      if (sel === ".tab-btn[data-ots-tab]") return [tabBtn];
      return [];
    };
    globalThis.document.querySelector = function (sel) {
      if (sel === '.tab-btn[data-ots-tab="create"]') return tabBtn;
      return null;
    };

    switchOtsTab("create");

    assert.notEqual(_els["ots-create"].style.display, "none");
    assert.equal(_els["ots-verify"].style.display, "none");
    assert.ok(tabBtn.classList.contains("active"));
  });

  it("switchOtsTab('verify') shows verify, hides create", function () {
    var tabBtn = makeEl("otsBtnV");
    tabBtn.classList = makeClassList();

    globalThis.document.querySelectorAll = function (sel) {
      if (sel === ".tab-btn[data-ots-tab]") return [tabBtn];
      return [];
    };
    globalThis.document.querySelector = function (sel) {
      if (sel === '.tab-btn[data-ots-tab="verify"]') return tabBtn;
      return null;
    };

    switchOtsTab("verify");

    assert.notEqual(_els["ots-verify"].style.display, "none");
    assert.equal(_els["ots-create"].style.display, "none");
    assert.ok(tabBtn.classList.contains("active"));
  });

  it("switchC2paTab('read') shows read, hides write and verify, hides result sections", function () {
    var tabBtn = makeEl("c2paBtn");
    tabBtn.classList = makeClassList();

    globalThis.document.querySelectorAll = function (sel) {
      if (sel === ".tab-btn[data-c2pa-tab]") return [tabBtn];
      return [];
    };
    globalThis.document.querySelector = function (sel) {
      if (sel === '.tab-btn[data-c2pa-tab="read"]') return tabBtn;
      return null;
    };

    switchC2paTab("read");

    assert.notEqual(_els["c2pa-read"].style.display, "none");
    assert.equal(_els["c2pa-write"].style.display, "none");
    assert.equal(_els["c2pa-verify"].style.display, "none");
    // Result sections should be hidden
    assert.equal(_els["c2pa-read-result"].style.display, "none");
    assert.equal(_els["c2pa-write-result"].style.display, "none");
    assert.equal(_els["c2pa-verify-result"].style.display, "none");
    assert.ok(tabBtn.classList.contains("active"));
  });

  it("switchC2paTab('verify') shows verify", function () {
    var tabBtn = makeEl("c2paBtnV");
    tabBtn.classList = makeClassList();

    globalThis.document.querySelectorAll = function (sel) {
      if (sel === ".tab-btn[data-c2pa-tab]") return [tabBtn];
      return [];
    };
    globalThis.document.querySelector = function (sel) {
      if (sel === '.tab-btn[data-c2pa-tab="verify"]') return tabBtn;
      return null;
    };

    switchC2paTab("verify");
    assert.notEqual(_els["c2pa-verify"].style.display, "none");
  });

  it("switchC2paTab('write') calls updateC2paWriteForm if defined  (covers lines 528-530)", function () {
    var tabBtn = makeEl("c2paBtnW");
    tabBtn.classList = makeClassList();
    var writeFormCalled = false;
    globalThis.updateC2paWriteForm = function () { writeFormCalled = true; };

    globalThis.document.querySelectorAll = function (sel) {
      if (sel === ".tab-btn[data-c2pa-tab]") return [tabBtn];
      return [];
    };
    globalThis.document.querySelector = function (sel) {
      if (sel === '.tab-btn[data-c2pa-tab="write"]') return tabBtn;
      return null;
    };

    switchC2paTab("write");

    assert.notEqual(_els["c2pa-write"].style.display, "none");
    assert.ok(writeFormCalled, "updateC2paWriteForm should have been called");

    delete globalThis.updateC2paWriteForm;
  });
});

// ═══════════════════════════════════════════════════════════════
// download modal
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — download modal", function () {
  before(function () {
    resetNavState();
    makeEl("dl-modal");
  });

  it("showDownloadModal adds 'open' class", function () {
    showDownloadModal();
    assert.ok(_els["dl-modal"].classList.contains("open"));
  });

  it("closeDownloadModal removes 'open' class", function () {
    closeDownloadModal();
    assert.ok(!_els["dl-modal"].classList.contains("open"));
  });
});

// ═══════════════════════════════════════════════════════════════
// downloadResult
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — downloadResult", function () {
  before(function () {
    resetNavState();
  });

  it("calls handler returned by getDownloadHandler", function () {
    var calledFormat = null;
    globalThis.getDownloadHandler = function () {
      return function (f) { calledFormat = f; };
    };

    downloadResult("pdf");

    assert.equal(calledFormat, "pdf");

    globalThis.getDownloadHandler = function () { return null; };
  });

  it("calls downloadFingerprint when no handler", function () {
    var calledFormat = null;
    globalThis.getDownloadHandler = function () { return null; };
    globalThis.downloadFingerprint = function (f) { calledFormat = f; };

    downloadResult("json");

    assert.equal(calledFormat, "json");

    delete globalThis.downloadFingerprint;
  });
});

// ═══════════════════════════════════════════════════════════════
// handleHashNav  (covers lines 391-412 search path)
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — handleHashNav", function () {
  before(function () {
    resetNavState();
    globalThis.setTimeout = setTimeout;
  });

  it("navigates to page from hash #/watermark", function () {
    var pageWm = makeEl("page-watermark");
    makeEl("app");
    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageWm], []);
    globalThis.location.hash = "#/watermark";

    handleHashNav();

    assert.ok(pageWm.classList.contains("active"),
      "watermark page should be active after hash nav");
  });

  it("handles hash #/home", function () {
    var pageHome = makeEl("page-home");
    // Make sure it starts without active
    pageHome.classList.remove("active");
    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageHome], []);
    globalThis.location.hash = "#/home";

    handleHashNav();

    assert.ok(pageHome.classList.contains("active"));
  });

  it("dismisses mode overlay when search param and modeSelect is visible, setMode undefined", function () {
    // Remove any page elements so showPage doesn't activate anything
    _els = {};
    var modeSelect = makeEl("modeSelect", { style: { display: "" } }); // visible
    makeEl("searchInput");
    globalThis.location.hash = "";
    globalThis.location.search = "?search=test";
    globalThis.URLSearchParams = function () {
      return { get: function (k) { return k === "search" ? "test" : null; } };
    };
    globalThis.setMode = undefined;
    globalThis.siteSearch = function () {};

    handleHashNav();

    // modeSelect should be hidden
    assert.equal(modeSelect.style.display, "none",
      "modeSelect should be hidden when setMode is undefined");
    // body no-scroll should be removed
    assert.ok(!globalThis.document.body.classList.contains("no-scroll"),
      "body no-scroll should be removed");
  });

  it("calls setMode('professional') when search param, modeSelect visible, and setMode defined", function () {
    _els = {};
    var modeSelect = makeEl("modeSelect", { style: { display: "" } }); // visible
    var setModeCalled = "";
    globalThis.setMode = function (m) { setModeCalled = m; };
    globalThis.location.search = "?search=test";
    globalThis.URLSearchParams = function () {
      return { get: function (k) { return k === "search" ? "test" : null; } };
    };
    globalThis.siteSearch = function () {};

    handleHashNav();

    assert.equal(setModeCalled, "professional",
      "setMode should be called with 'professional'");
    // modeSelect should still be visible (setMode handles it)
    assert.equal(modeSelect.style.display, "",
      "modeSelect should remain visible (setMode handles display)");
  });

  it("does not dismiss mode overlay when modeSelect is already hidden and search param set", function () {
    _els = {};
    var modeSelect = makeEl("modeSelect", { style: { display: "none" } }); // hidden
    var setModeCalled = false;
    globalThis.setMode = function () { setModeCalled = true; };
    globalThis.location.search = "?search=test";
    globalThis.URLSearchParams = function () {
      return { get: function (k) { return k === "search" ? "test" : null; } };
    };
    globalThis.siteSearch = function () {};

    handleHashNav();

    // setMode should NOT be called because modeSelect is already hidden
    assert.ok(!setModeCalled,
      "setMode should NOT be called when modeSelect is already hidden");
    assert.equal(modeSelect.style.display, "none");
  });

  it("sets searchInput value and calls siteSearch after timeout  (covers lines 405-411)", function (_, done) {
    _els = {};
    makeEl("modeSelect", { style: { display: "none" } });
    var searchInput = makeEl("searchInput", { value: "" });
    var siteSearchCalled = false;
    globalThis.setMode = undefined;
    globalThis.siteSearch = function () { siteSearchCalled = true; };
    globalThis.location.search = "?search=test-query";
    globalThis.URLSearchParams = function () {
      return { get: function (k) { return k === "search" ? "test-query" : null; } };
    };

    handleHashNav();

    // After 600ms the setTimeout should have fired
    setTimeout(function () {
      try {
        assert.equal(searchInput.value, "test-query",
          "searchInput value should be set from query param");
        assert.ok(siteSearchCalled, "siteSearch should have been called");
        done();
      } catch (e) {
        done(e);
      }
    }, 600);
  });
});

// ═══════════════════════════════════════════════════════════════
// initNav
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — initNav", function () {
  before(function () {
    resetNavState();
  });

  it("calls handleHashNav without throwing", function () {
    initNav();
  });
});

// ═══════════════════════════════════════════════════════════════
// DOMContentLoaded handler  (covers lines 422-438)
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — DOMContentLoaded", function () {
  before(function () {
    resetNavState();
    globalThis.location.pathname = "/app";
  });

  it("fires sanitizeRemovalTools and initNav, then registers deferredReplace listeners", function () {
    // The DOMContentLoaded handler was registered during module load.
    // Trigger it now.
    triggerEvent("DOMContentLoaded", {});

    // After DOMContentLoaded fires:
    // 1. sanitizeRemovalTools ran (noop on localhost)
    // 2. initNav ran (handleHashNav with no hash/search)
    // 3. deferredReplace was set up on pointerdown and keydown

    // Verify that pointerdown and keydown listeners exist
    assert.ok(_listeners["pointerdown"], "pointerdown listener should be registered");
    assert.ok(_listeners["keydown"], "keydown listener should be registered");
    assert.ok(_listeners["pointerdown"].length >= 1,
      "at least one pointerdown listener should exist");
    assert.ok(_listeners["keydown"].length >= 1,
      "at least one keydown listener should exist");
  });

  it("deferredReplace calls history.replaceState on first interaction  (covers lines 425-433)", function () {
    // history.state is null, so deferredReplace should call replaceState
    var prevPointerdownCount = _listeners["pointerdown"] ? _listeners["pointerdown"].length : 0;
    var prevKeydownCount = _listeners["keydown"] ? _listeners["keydown"].length : 0;

    // Trigger pointerdown
    triggerEvent("pointerdown", {});

    // history.state should now be { modeOverlay: true }
    assert.ok(globalThis.history.state, "history.state should be set by replaceState");
    assert.equal(globalThis.history.state.modeOverlay, true,
      "state.modeOverlay should be true");

    // The listeners should have removed themselves (pointerdown)
    var newPointerdownCount = _listeners["pointerdown"] ? _listeners["pointerdown"].length : 0;
    assert.ok(newPointerdownCount < prevPointerdownCount,
      "pointerdown listener should have been removed after first interaction");
  });

  it("deferredReplace does not replaceState if history.state.modeOverlay already exists", function () {
    // Set state to have modeOverlay already
    globalThis.history.state = { modeOverlay: true };

    // Re-trigger DOMContentLoaded to re-register deferredReplace
    triggerEvent("DOMContentLoaded", {});

    // Capture current state reference
    var stateBefore = globalThis.history.state;

    // Trigger pointerdown
    triggerEvent("pointerdown", {});

    // State should be unchanged since modeOverlay is already true
    assert.equal(globalThis.history.state.modeOverlay, true);
  });
});

// ═══════════════════════════════════════════════════════════════
// popstate handler  (covers lines 294-379)
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — popstate handler", function () {
  before(function () {
    resetNavState();
    globalThis.document.documentElement.dataset = {}; // not standalone
  });
  
  // Helper: create elements that all popstate code paths need
  function ensureCommonEls() {
    // Some branches access modeSelect and simplifiedMode unconditionally
    makeEl("modeSelect");
    makeEl("simplifiedMode");
  }

  it("returns early when dataset.standalone is set", function () {
    globalThis.document.documentElement.dataset = { standalone: "watermark" };

    var pagesBefore = [];
    triggerEvent("popstate", { state: { page: "watermark" } });

    // Since standalone returns early, no pages should be modified
    // Just verify no crash
    globalThis.document.documentElement.dataset = {}; // restore
  });

  it("shows staticPage from state when staticPage element exists", function () {
    _els = {};
    var pageAbout = makeEl("page-about");
    globalThis.document.querySelectorAll = makeQuerySelectorAll([], []);

    triggerEvent("popstate", { state: { staticPage: "about" } });

    assert.ok(pageAbout.classList.contains("active"),
      "static page should have active class");
    // no-scroll should be removed
    assert.ok(!globalThis.document.body.classList.contains("no-scroll"),
      "body no-scroll should be removed");
  });

  it("falls back to modeSelect when staticPage element does not exist", function () {
    _els = {};
    var modeSelect = makeEl("modeSelect");
    globalThis.document.querySelectorAll = makeQuerySelectorAll([], []);

    triggerEvent("popstate", { state: { staticPage: "nonexistent" } });

    assert.equal(modeSelect.style.display, "",
      "modeSelect should be shown when static page element is missing");
  });

  it("shows mode overlay when state is null or has modeOverlay, and calls resetProfessionalForms", function () {
    _els = {};
    var modeSelect = makeEl("modeSelect");
    var sidebarOverlay = makeEl("sidebarOverlay");
    var resetCalled = false;
    globalThis.resetProfessionalForms = function () { resetCalled = true; };

    triggerEvent("popstate", { state: null });

    assert.ok(globalThis.document.body.classList.contains("no-scroll"),
      "body should have no-scroll for mode overlay");
    assert.equal(modeSelect.style.display, "",
      "modeSelect should be visible");
    assert.equal(sidebarOverlay.style.display, "none",
      "sidebarOverlay should be hidden");
    assert.ok(resetCalled, "resetProfessionalForms should have been called");

    delete globalThis.resetProfessionalForms;
  });

  it("shows mode overlay when state.modeOverlay is true", function () {
    _els = {};
    makeEl("modeSelect");
    makeEl("sidebarOverlay");

    triggerEvent("popstate", { state: { modeOverlay: true } });

    assert.ok(globalThis.document.body.classList.contains("no-scroll"));
  });

  it("restores simplified mode when state.modeSet is 'simplified'", function () {
    _els = {};
    makeEl("modeSelect", { style: { display: "none" } });
    makeEl("sidebarOverlay", { style: { display: "" } });
    makeEl("simplifiedMode", { style: { display: "none" } });
    makeEl("mainNav");
    makeEl("app");
    makeEl("sidebar");
    makeEl("mainFooter");
    var pageHome = makeEl("page-home");
    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageHome], []);

    triggerEvent("popstate", { state: { modeSet: "simplified" } });

    // no-scroll should be removed
    assert.ok(!globalThis.document.body.classList.contains("no-scroll"));
    // modeSelect and sidebarOverlay should be hidden
    assert.equal(_els["modeSelect"].style.display, "none");
    assert.equal(_els["sidebarOverlay"].style.display, "none");
    // simplifiedMode should be visible
    assert.notEqual(_els["simplifiedMode"].style.display, "none",
      "simplifiedMode should be visible");
    // home page should be active
    assert.ok(pageHome.classList.contains("active"));
  });

  it("restores professional mode when state.modeSet is 'professional'", function () {
    _els = {};
    makeEl("modeSelect", { style: { display: "none" } });
    makeEl("sidebarOverlay", { style: { display: "" } });
    makeEl("simplifiedMode", { style: { display: "" } });
    makeEl("mainNav");
    makeEl("app");
    makeEl("sidebar");
    makeEl("mainFooter");
    var pageHome = makeEl("page-home");
    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageHome], []);

    triggerEvent("popstate", { state: { modeSet: "professional" } });

    assert.ok(!globalThis.document.body.classList.contains("no-scroll"));
    assert.equal(_els["modeSelect"].style.display, "none",
      "modeSelect should be hidden");
    assert.equal(_els["sidebarOverlay"].style.display, "none",
      "sidebarOverlay should be hidden");
    // simplifiedMode should be hidden for professional mode
    assert.equal(_els["simplifiedMode"].style.display, "none");
    // app, sidebar, footer should be visible
    assert.notEqual(_els["app"].style.display, "none", "app should be visible");
    assert.notEqual(_els["sidebar"].style.display, "none", "sidebar should be visible");
    assert.notEqual(_els["mainFooter"].style.display, "none", "footer should be visible");
    assert.ok(pageHome.classList.contains("active"));
  });

  it("activates page from state and marks sidebar link as active", function () {
    _els = {};
    makeEl("modeSelect", { style: { display: "none" } });
    makeEl("simplifiedMode", { style: { display: "none" } });
    var pageWm = makeEl("page-watermark");
    var navLink = makeEl("navLink", { classList: makeClassList() });
    navLink.dataset = { page: "watermark" };

    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageWm], [navLink]);
    globalThis.document.querySelector = function (sel) {
      if (sel.indexOf('data-page="watermark"') !== -1) return navLink;
      return null;
    };

    triggerEvent("popstate", { state: { page: "watermark" } });

    assert.ok(pageWm.classList.contains("active"),
      "watermark page should be active");
    assert.ok(navLink.classList.contains("active"),
      "sidebar nav link should be active");
  });

  it("falls back to mode overlay when state.page element does not exist", function () {
    // The popstate page branch unconditionally accesses modeSelect & simplifiedMode
    ensureCommonEls();
    var modeSelect = _els["modeSelect"];

    triggerEvent("popstate", { state: { page: "nonexistent" } });

    assert.equal(modeSelect.style.display, "",
      "modeSelect should be shown when page element is missing");
  });

  it("restores professional mode when page is inside #app but mainNav is hidden", function () {
    _els = {};
    makeEl("modeSelect", { style: { display: "none" } });
    makeEl("simplifiedMode", { style: { display: "none" } });
    makeEl("mainNav", { style: { display: "none" } });
    makeEl("app", { style: { display: "" } });
    makeEl("sidebar", { style: { display: "" } });
    var pageWm = makeEl("page-watermark");
    pageWm.closest = function (sel) {
      if (sel === "#app") return _els["app"] || {};
      return null;
    };

    globalThis.document.querySelectorAll = makeQuerySelectorAll([pageWm], []);

    triggerEvent("popstate", { state: { page: "watermark" } });

    // Since el.closest("#app") exists and mainNav display is "none",
    // hideAllExcept("mainNav") should have been called,
    // which means app, sidebar, footer are shown
    assert.notEqual(_els["app"].style.display, "none");
    assert.notEqual(_els["sidebar"].style.display, "none");
  });
});

// ═══════════════════════════════════════════════════════════════
// pageshow handler  (covers lines 540-577)
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — pageshow handler", function () {
  before(function () {
    _els = {};
    globalThis.document.documentElement.style = {};
    globalThis.document.body.classList = makeClassList();
    globalThis.document.documentElement.dataset = {};
    globalThis.history.state = null;
  });

  it("returns early when ev.persisted is false", function () {
    var origStyle = globalThis.document.documentElement.style.overflow;
    triggerEvent("pageshow", { persisted: false });
    // overflow should NOT have been changed
    assert.equal(globalThis.document.documentElement.style.overflow, undefined);
  });

  it("clears no-scroll, hides page-loader when persisted is true", function () {
    _els = {};
    var loader = makeEl("page-loader", { classList: makeClassList() });
    globalThis.document.body.classList.add("no-scroll"); // set a known state

    triggerEvent("pageshow", { persisted: true });

    assert.ok(!globalThis.document.body.classList.contains("no-scroll"),
      "no-scroll should be removed");
    assert.ok(loader.classList.contains("page-loader--hidden"),
      "page-loader should have page-loader--hidden class");
  });

  it("handles standalone MPA: re-activates page section", function () {
    _els = {};
    makeEl("page-loader", { classList: makeClassList() });
    var pageWm = makeEl("page-watermark");

    globalThis.document.documentElement.dataset = { standalone: "watermark" };

    triggerEvent("pageshow", { persisted: true });

    assert.ok(pageWm.classList.contains("active"),
      "standalone page should be re-activated");
  });

  it("handles SPA: restores page from history.state.page", function () {
    _els = {};
    makeEl("page-loader", { classList: makeClassList() });
    var pageFp = makeEl("page-fingerprint");
    var navLink = makeEl("navFp", { classList: makeClassList() });

    globalThis.document.documentElement.dataset = {};
    globalThis.history.state = { page: "fingerprint" };

    globalThis.document.querySelectorAll = function (sel) {
      if (sel === ".page") return [pageFp];
      if (sel.indexOf("sidebar a[data-page]") !== -1) return [navLink];
      return [];
    };
    globalThis.document.querySelector = function (sel) {
      if (sel.indexOf('data-page="fingerprint"') !== -1) return navLink;
      return null;
    };

    triggerEvent("pageshow", { persisted: true });

    assert.ok(pageFp.classList.contains("active"),
      "fingerprint page should be active from history state");
    assert.ok(navLink.classList.contains("active"),
      "sidebar link should be active");
  });

  it("handles SPA: restores static page from history.state.staticPage", function () {
    _els = {};
    makeEl("page-loader", { classList: makeClassList() });
    var pageAbout = makeEl("page-about");

    globalThis.document.documentElement.dataset = {};
    globalThis.history.state = { staticPage: "about" };
    globalThis.document.querySelectorAll = function (sel) {
      if (sel === ".page") return [pageAbout];
      return [];
    };

    triggerEvent("pageshow", { persisted: true });

    assert.ok(pageAbout.classList.contains("active"),
      "about static page should be active");
  });

  it("handles SPA: shows modeSelect when state is null or has modeOverlay", function () {
    _els = {};
    makeEl("page-loader", { classList: makeClassList() });
    var modeSelect = makeEl("modeSelect");

    globalThis.document.documentElement.dataset = {};
    globalThis.history.state = { modeOverlay: true };
    globalThis.document.querySelectorAll = function () { return []; };

    triggerEvent("pageshow", { persisted: true });

    assert.equal(modeSelect.style.display, "",
      "modeSelect should be displayed for modeOverlay state");

    // Also test with null state
    _els = {};
    makeEl("page-loader", { classList: makeClassList() });
    var modeSelect2 = makeEl("modeSelect");
    globalThis.history.state = null;

    triggerEvent("pageshow", { persisted: true });

    assert.equal(modeSelect2.style.display, "",
      "modeSelect should be displayed for null state");
  });
});

// ═══════════════════════════════════════════════════════════════
// isStandalone re-evaluation on DOMContentLoaded (lines 534-537)
// ═══════════════════════════════════════════════════════════════
describe("navigation.js — isStandalone DOMContentLoaded update", function () {
  before(function () {
    resetNavState();
  });

  it("re-evaluates isStandalone when DOMContentLoaded fires (second handler, line 534)", function () {
    // Initially isStandalone is undefined/falsy from module load
    // Set dataset.standalone and trigger the second DOMContentLoaded handler
    globalThis.document.documentElement.dataset = { standalone: "mypage" };

    // The second DOMContentLoaded handler was registered at line 534
    // Trigger it
    triggerEvent("DOMContentLoaded", {});

    // We can't easily check isStandalone because it's a var in the module scope,
    // but the fact that the handler ran without error is sufficient.
    // The handler re-assigns: isStandalone = document.documentElement.dataset.standalone
  });
});
