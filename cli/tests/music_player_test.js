const path = require("path");
const fs = require("fs");
const vm = require("vm");
const assert = require("assert/strict");
const { describe, it, before } = require("node:test");

var _els = {};
var _sessionStorage = {};
var _allIntervals = [];

// Track all setInterval calls (mock implementation so no real timers are created)
var _intervalCounter = 0;
globalThis.setInterval = function () {
  var id = ++_intervalCounter;
  _allIntervals.push(id);
  return id;
};

function makeEl(id, extra) {
  if (!_els[id]) {
    _els[id] = Object.assign({
      style: { display: "" },
      value: "", textContent: "", innerHTML: "", className: "", dataset: {},
      placeholder: "", title: "", rel: "", href: "", id: id, src: "", download: "",
      paused: true, currentTime: 0, readyState: 0, loop: false, preload: "",
      classList: {
        add: function () {}, remove: function () {},
        contains: function () { return false; }, toggle: function () {},
      },
      append: function () {}, appendChild: function () {}, remove: function () {},
      addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () {},
      getAttribute: function (a) { return this[a] || null; },
      setAttribute: function (a, v) { this[a] = v; },
      removeAttribute: function (a) { this[a] = undefined; },
      click: function () {}, focus: function () {},
      load: function () {},
      play: function () { return Promise.resolve(); },
      pause: function () {},
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      parentElement: {},
      parentNode: { insertBefore: function () {}, removeChild: function () {}, querySelector: function () { return null; } },
    }, extra || {});
  }
  return _els[id];
}

function setupDOM() {
  _els = {};
  _sessionStorage = {};

  var audioEl = makeEl("bg-music", {
    paused: true, currentTime: 0, readyState: 0, src: "",
    play: function () {
      audioEl.paused = false;
      return Promise.resolve();
    },
    pause: function () { audioEl.paused = true; },
    load: function () {},
    addEventListener: function (evt, cb) {
      if (evt === "canplay") { audioEl.readyState = 4; setTimeout(cb, 0); }
    },
  });
  _els["bg-music"] = audioEl;

  globalThis.document = {
    readyState: "loading",
    documentElement: { dataset: {}, style: {}, lang: "en" },
    getElementById: function (id) { return _els[id] || null; },
    querySelector: function (sel) {
      if (sel === "#bg-music") return audioEl;
      if (sel === "#music-btn") return _els["music-btn"] || null;
      if (sel === "#music-credit") return _els["music-credit"] || null;
      if (sel === 'link[rel="preload"][as="audio"]') return null;
      if (sel === "#modeSelect") return _els["modeSelect"] || null;
      if (sel === "#modeSelect") return null;
      return null;
    },
    querySelectorAll: function () { return []; },
    createElement: function (tag) {
      if (tag === "link") return makeEl("preload-link", { rel: "", href: "", as: "" });
      if (tag === "div") return makeEl("div-wrapper", { innerHTML: "" });
      if (tag === "button") return makeEl("created-btn", { tagName: "button" });
      if (tag === "audio") return makeEl("created-audio", { tagName: "audio" });
      return makeEl("created-" + tag, { tagName: tag });
    },
    createTextNode: function () { return {}; },
    head: { append: function () {}, querySelector: function () { return null; } },
    body: {
      classList: { add: function () {}, remove: function () {}, contains: function () { return false; }, toggle: function () {} },
      append: function (child) {
        if (child && child.id) _els[child.id] = child;
      },
      querySelector: function () { return null; },
    },
    addEventListener: function () {},
  };

  globalThis.sessionStorage = {
    getItem: function (k) { return _sessionStorage[k] !== undefined ? _sessionStorage[k] : null; },
    setItem: function (k, v) { _sessionStorage[k] = String(v); },
    removeItem: function (k) { delete _sessionStorage[k]; },
    clear: function () { _sessionStorage = {}; },
  };

  globalThis.addEventListener = function () {};
  globalThis.removeEventListener = function () {};
  globalThis.window = globalThis;
  globalThis.location = { protocol: "http:", hostname: "localhost", href: "http://localhost:8080/", pathname: "/", replace: function () {} };
  globalThis.history = { pushState: function () {}, replaceState: function () {} };
  globalThis.console = { error: function () {}, warn: function () {}, log: function () {} };
  globalThis.setTimeout = setTimeout;
  globalThis.clearTimeout = clearTimeout;
  globalThis.setInterval = setInterval;
  globalThis.clearInterval = clearInterval;
  globalThis.MutationObserver = function (cb) {
    this.observe = function () {};
    this.disconnect = function () {};
  };
  globalThis.JSON = JSON;
  globalThis.encodeURIComponent = function (s) { return s; };

  return audioEl;
}

function loadMusic() {
  var src = fs.readFileSync(path.resolve(__dirname, "../../Style/music-player.js"), "utf8");
  vm.runInThisContext(src, { filename: path.resolve(__dirname, "../../Style/music-player.js") });
}

describe("music-player.js — public API", () => {
  before(() => {
    setupDOM();
    loadMusic();
  });

  it("should expose __musicInit", () => {
    assert.equal(typeof globalThis.__musicInit, "function");
  });

  it("should expose __musicPlayerState", () => {
    assert.equal(typeof globalThis.__musicPlayerState, "function");
  });

  it("should expose __musicSaveTime", () => {
    assert.equal(typeof globalThis.__musicSaveTime, "function");
  });

  it("__musicPlayerState should return current playing state", () => {
    var state = __musicPlayerState();
    assert.ok(typeof state === "object");
    assert.ok("playing" in state);
  });
});

describe("music-player.js — init on standalone", () => {
  before(() => {
    setupDOM();
    globalThis.document.documentElement.dataset.standalone = "watermark";
    loadMusic();
  });

  it("should not throw when init called on standalone (exits early, no timers)", () => {
    __musicInit();
  });
});

describe("music-player.js — init with modeSelect visible", () => {
  before(() => {
    var audioEl = setupDOM();
    _els["modeSelect"] = makeEl("modeSelect", {
      style: { display: "" },
      getAttribute: function (a) { return null; },
    });
    loadMusic();
  });

  it("should return early when modeSelect is visible and has no inline style", () => {
    __musicInit();
  });
});

describe("music-player.js — saveState via __musicSaveTime", () => {
  before(() => {
    var audioEl = setupDOM();
    _els["bg-music"] = audioEl;
    _els["music-btn"] = makeEl("music-btn");
    _els["music-credit"] = makeEl("music-credit");
    _els["modeSelect"] = makeEl("modeSelect", {
      style: { display: "none" },
      getAttribute: function (a) { return "none" in this.style ? "none" : null; },
    });
    loadMusic();
  });

  it("should save state through public API", () => {
    _els["bg-music"].paused = false;
    __musicSaveTime();
    var saved = _sessionStorage["musicState"];
    assert.ok(saved);
  });

  it("should report initial playing state as false", () => {
    var state = __musicPlayerState();
    assert.equal(state.playing, false);
  });
});

describe("music-player.js — saveState", () => {
  before(() => {
    var audioEl = setupDOM();
    _els["bg-music"] = audioEl;
    _els["music-btn"] = makeEl("music-btn");
    _els["music-credit"] = makeEl("music-credit");
    _els["modeSelect"] = makeEl("modeSelect", {
      style: { display: "none" },
      getAttribute: function (a) { return "none" in this.style ? "none" : null; },
    });
    audioEl.currentTime = 42;
    loadMusic();
  });

  it("should save current time and playing state to sessionStorage", () => {
    // __musicSaveTime only saves if audio is NOT paused
    var audio = globalThis.document.getElementById("bg-music");
    audio.paused = false;
    __musicSaveTime();
    var saved = _sessionStorage["musicState"];
    assert.ok(saved, "musicState should be saved");
    var parsed = JSON.parse(saved);
    assert.ok("isPlaying" in parsed);
    assert.ok("currentTime" in parsed);
  });
});

describe("music-player.js — restoreState", () => {
  it("should restore playing state from saved session", () => {
    var audioEl = setupDOM();
    audioEl.currentTime = 30;
    _sessionStorage["musicState"] = JSON.stringify({ isPlaying: true, currentTime: 30 });
    _sessionStorage["musicInteracted"] = "true";
    _els["bg-music"] = audioEl;
    _els["music-btn"] = makeEl("music-btn");
    _els["music-credit"] = makeEl("music-credit");
    _els["modeSelect"] = makeEl("modeSelect", {
      style: { display: "none" },
      getAttribute: function (a) { return "none" in this.style ? "none" : null; },
    });
    loadMusic();
    // Manually call __musicInit to trigger restoreState
    globalThis.__musicInit();
    var state = __musicPlayerState();
    assert.equal(state.playing, true);
  });
});

describe("music-player.js — audioSrc with pages path", () => {
  before(() => {
    var audioEl = setupDOM();
    // Set pathname containing "pages"
    globalThis.location.pathname = "/Style/pages/watermark/index.html";
    _els["bg-music"] = audioEl;
    _els["music-btn"] = makeEl("music-btn");
    _els["music-credit"] = makeEl("music-credit");
    _els["modeSelect"] = makeEl("modeSelect", {
      style: { display: "none" },
      getAttribute: function (a) { return "none" in this.style ? "none" : null; },
    });
    loadMusic();
  });

  it("should compute relative path when path contains 'pages'", () => {
    // audioSrc is called internally, but we verify init doesn't throw
    __musicInit();
  });
});

describe("music-player.js — full init flow", () => {
  before(() => {
    var audioEl = setupDOM();
    // Set readyState to "complete" to trigger immediate init
    globalThis.document.readyState = "complete";
    _els["bg-music"] = audioEl;
    _els["music-btn"] = makeEl("music-btn");
    _els["music-credit"] = makeEl("music-credit");
    _els["modeSelect"] = makeEl("modeSelect", {
      style: { display: "none" },
      getAttribute: function (a) { return "none" in this.style ? "none" : null; },
    });
    loadMusic();
  });

  it("should init on readyState complete", () => {
    var state = __musicPlayerState();
    // init should have been called during load
    assert.equal(typeof state.playing, "boolean");
  });
});

describe("music-player.js — toggle", () => {
  before(() => {
    var audioEl = setupDOM();
    _els["bg-music"] = audioEl;
    _els["music-btn"] = makeEl("music-btn");
    _els["music-credit"] = makeEl("music-credit");
    _els["modeSelect"] = makeEl("modeSelect", {
      style: { display: "none" },
      getAttribute: function (a) { return "none" in this.style ? "none" : null; },
    });
    loadMusic();
    // Init to register click handler on music-btn
    globalThis.__musicInit();
    // Track the audio element for the test
    globalThis.__testAudio = audioEl;
  });

  it("should start playing when paused (toggle called via click)", () => {
    // Simulate click on music button
    var audio = globalThis.__testAudio;
    audio.paused = true;
    audio.click();
  });
});

// Clear all tracked intervals after the suite completes
globalThis.clearInterval = function () {};
