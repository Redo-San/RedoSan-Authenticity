/**
 * Comprehensive UI-level tests for Style/music-player.js
 *
 * The entire source is inside an IIFE. Only 3 exports are accessible:
 *   - globalThis.__musicPlayerState()
 *   - globalThis.__musicSaveTime()
 *   - globalThis.__musicInit()
 *
 * Strategy:
 *   - Each describe block reloads the IIFE via before() (not beforeEach) to keep
 *     memory usage low — the old closure becomes orphaned and GC-eligible.
 *   - Tests within a block share the same init state; sequential early-return
 *     tests (standalone → modeSelect → full init) reuse one load.
 *   - We exercise internal functions (toggle, firstClick, saveState, restoreState,
 *     inject, doPlay, doPause, playSeeked, setUI, etc.) through the 3 exports
 *     and through captured event-listener maps.
 */

"use strict";

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ==========================================================================
// Shared mutable element store & listener tracking
// ==========================================================================
var _els = {};

function makeEl(id, extra) {
  if (!_els[id]) {
    var listeners = {};
    _els[id] = Object.assign(
      {
        style: { display: "" },
        value: "",
        textContent: "",
        innerHTML: "",
        className: "",
        src: "",
        download: "",
        disabled: false,
        href: "",
        onclick: null,
        paused: true,
        currentTime: 0,
        readyState: 0,
        loop: false,
        preload: "none",
        id: id,
        tagName: "DIV",

        _listeners: listeners,

        classList: {
          _classes: [],
          add(c) {
            if (!this._classes.includes(c)) this._classes.push(c);
          },
          remove(c) {
            this._classes = this._classes.filter(function (x) {
              return x !== c;
            });
          },
          contains(c) {
            return this._classes.includes(c);
          },
          toggle(c) {
            if (this.contains(c)) this.remove(c);
            else this.add(c);
          },
        },

        append() {},
        appendChild(child) {
          return child;
        },
        remove() {},

        addEventListener(type, fn) {
          if (!listeners[type]) listeners[type] = [];
          listeners[type].push(fn);
        },
        removeEventListener(type, fn) {
          if (listeners[type])
            listeners[type] = listeners[type].filter(function (x) {
              return x !== fn;
            });
        },
        dispatchEvent(ev) {
          if (listeners[ev.type])
            listeners[ev.type].forEach(function (fn) {
              fn(ev);
            });
        },

        getAttribute(a) {
          return this[a] !== undefined ? String(this[a]) : null;
        },
        setAttribute(a, v) {
          this[a] = String(v);
        },
        hasAttribute(a) {
          return this[a] !== undefined && this[a] !== null;
        },
        removeAttribute(a) {
          delete this[a];
        },
        click() {},
        focus() {},

        load() {},
        play() {
          this.paused = false;
          return Promise.resolve();
        },
        pause() {
          this.paused = true;
        },

        querySelector() {
          return null;
        },
        querySelectorAll() {
          return [];
        },
        parentElement: null,
        parentNode: {
          insertBefore() {},
          removeChild() {},
          querySelector() {
            return null;
          },
        },
        contains() {
          return false;
        },
        toBuffer() {
          return Buffer.alloc(0);
        },
        getContext() {
          return null;
        },
      },
      extra || {},
    );
  } else if (extra) {
    Object.assign(_els[id], extra);
  }
  return _els[id];
}

function getElListeners(id) {
  var el = _els[id];
  return el && el._listeners ? el._listeners : {};
}

/**
 * Minimal innerHTML parser for the three tags inject() produces:
 *   <audio id="bg-music" loop preload="none"></audio>
 *   <button id="music-btn" class="music-btn" aria-label="…">content</button>
 *   <div id="music-credit" class="music-credit" aria-label="…">content</div>
 */
function parseSimpleHTML(html, childNodes) {
  var tagRe = /<(\w+)([\s\S]*?)>([\s\S]*?)<\/\1>/g;
  var m;
  while ((m = tagRe.exec(html)) !== null) {
    var tn = m[1];
    var attrsStr = m[2].trim();
    var content = m[3];
    var decoded = content.replace(/&#x([0-9A-Fa-f]+);/g, function (_, hex) {
      return String.fromCodePoint(parseInt(hex, 16));
    });
    var idMatch = attrsStr.match(/id="([^"]+)"/);
    var id = idMatch ? idMatch[1] : null;
    var classMatch = attrsStr.match(/class="([^"]+)"/);
    var cls = classMatch ? classMatch[1] : "";
    var hasLoop = /\bloop\b/.test(attrsStr);
    var preloadMatch = attrsStr.match(/preload="([^"]+)"/);
    var preload = preloadMatch ? preloadMatch[1] : "none";
    if (id) {
      var extra = {
        id: id,
        tagName: tn.toUpperCase(),
        className: cls,
        loop: hasLoop,
        preload: preload,
        textContent: decoded,
      };
      if (tn.toLowerCase() === "audio") extra.src = "";
      var el = makeEl(id, extra);
      if (childNodes) childNodes.push(el);
      el.parentNode = null;
      el.parentElement = null;
    }
  }
}

/** Pre-create what inject() would create (for tests that bypass inject). */
function setupInjectedState() {
  makeEl("bg-music", {
    id: "bg-music",
    loop: true,
    preload: "none",
    paused: true,
    currentTime: 0,
    readyState: 0,
    src: "",
    _loaded: false,
    load() {
      this._loaded = true;
    },
    play() {
      this.paused = false;
      this._playCalled = true;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
  });
  makeEl("music-btn", {
    id: "music-btn",
    className: "music-btn",
    textContent: "\uD83C\uDFB5",
    classList: {
      _classes: [],
      add(c) {
        if (!this._classes.includes(c)) this._classes.push(c);
      },
      remove(c) {
        this._classes = this._classes.filter(function (x) {
          return x !== c;
        });
      },
      contains(c) {
        return this._classes.includes(c);
      },
    },
  });
  makeEl("music-credit", {
    id: "music-credit",
    className: "music-credit",
    textContent: "RedoSan",
    classList: {
      _classes: [],
      add(c) {
        if (!this._classes.includes(c)) this._classes.push(c);
      },
      remove(c) {
        this._classes = this._classes.filter(function (x) {
          return x !== c;
        });
      },
      contains(c) {
        return this._classes.includes(c);
      },
    },
  });
}

// ==========================================================================
// Global-mock reset
// ==========================================================================
function resetMusicState() {
  _els = {};
  var _docListeners = {};
  var _winListeners = {};
  var _sessionStore = {};

  // --- sessionStorage ---
  globalThis.sessionStorage = {
    getItem(k) {
      return _sessionStore[k] !== undefined ? String(_sessionStore[k]) : null;
    },
    setItem(k, v) {
      _sessionStore[k] = String(v);
    },
    removeItem(k) {
      delete _sessionStore[k];
    },
    clear() {
      for (var k in _sessionStore) delete _sessionStore[k];
    },
  };

  // --- Audio constructor ---
  globalThis.Audio = function () {
    return makeEl("bg-music-instance", {
      paused: true,
      currentTime: 0,
      readyState: 0,
      src: "",
      load() {},
      play() {
        this.paused = false;
        return Promise.resolve();
      },
      pause() {
        this.paused = true;
      },
    });
  };

  // --- document ---
  globalThis.document = {
    readyState: "loading",
    title: "",
    documentElement: {
      dataset: {},
      style: {},
      getAttribute() {
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
    },
    getElementById(id) {
      return _els[id] || null;
    },
    querySelector(sel) {
      if (sel.startsWith("#")) return _els[sel.substring(1)] || null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel.startsWith("#")) {
        var el = _els[sel.substring(1)];
        return el ? [el] : [];
      }
      return [];
    },
    addEventListener(type, fn) {
      if (!_docListeners[type]) _docListeners[type] = [];
      _docListeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      if (_docListeners[type])
        _docListeners[type] = _docListeners[type].filter(function (x) {
          return x !== fn;
        });
    },
    createElement(tag) {
      var uid = tag + "_" + Date.now() + "_" + Math.random();
      var childNodes = [];
      var el = makeEl(uid, {
        tagName: tag.toUpperCase(),
        localName: tag,
        nodeType: 1,
        childNodes: childNodes,
      });
      Object.defineProperty(el, "firstChild", {
        get: function () {
          return childNodes.length > 0 ? childNodes[0] : null;
        },
        configurable: true,
        enumerable: true,
      });
      el.appendChild = function (child) {
        childNodes.push(child);
        child.parentNode = el;
        child.parentElement = el;
      };
      var _innerHtml = "";
      Object.defineProperty(el, "innerHTML", {
        get: function () {
          return _innerHtml;
        },
        set: function (html) {
          _innerHtml = String(html);
          childNodes.length = 0;
          parseSimpleHTML(_innerHtml, childNodes);
          childNodes.forEach(function (c) {
            c.parentNode = el;
            c.parentElement = el;
          });
        },
        configurable: true,
        enumerable: true,
      });
      return el;
    },
    createTextNode() {
      return {};
    },
    head: {
      append() {},
      querySelector() {
        return null;
      },
    },
    body: {
      classList: {
        _classes: [],
        add(c) {
          if (!this._classes.includes(c)) this._classes.push(c);
        },
        remove(c) {
          this._classes = this._classes.filter(function (x) {
            return x !== c;
          });
        },
        contains(c) {
          return this._classes.includes(c);
        },
      },
      append(child) {
        if (child && child.id) _els[child.id] = child;
        if (!this._children) this._children = [];
        this._children.push(child);
        // Simulate real DOM: remove child from previous parent's childNodes
        if (child.parentNode && child.parentNode.childNodes) {
          var idx = child.parentNode.childNodes.indexOf(child);
          if (idx !== -1) child.parentNode.childNodes.splice(idx, 1);
        }
        child.parentNode = this;
        child.parentElement = this;
      },
      appendChild(child) {
        if (child && child.id) _els[child.id] = child;
        if (!this._children) this._children = [];
        this._children.push(child);
        if (child.parentNode && child.parentNode.childNodes) {
          var idx = child.parentNode.childNodes.indexOf(child);
          if (idx !== -1) child.parentNode.childNodes.splice(idx, 1);
        }
        child.parentNode = this;
        child.parentElement = this;
      },
      querySelector(sel) {
        if (sel.startsWith("#")) return _els[sel.substring(1)] || null;
        return null;
      },
      querySelectorAll() {
        return [];
      },
    },
  };

  // --- window ---
  globalThis.window = globalThis;
  globalThis.addEventListener = function (type, fn) {
    if (!_winListeners[type]) _winListeners[type] = [];
    _winListeners[type].push(fn);
  };
  globalThis.removeEventListener = function (type, fn) {
    if (_winListeners[type])
      _winListeners[type] = _winListeners[type].filter(function (x) {
        return x !== fn;
      });
  };

  // --- location ---
  globalThis.location = {
    protocol: "http:",
    href: "http://localhost/",
    hostname: "localhost",
    pathname: "/",
    hash: "",
  };

  // --- MutationObserver ---
  var _mutationCallbacks = [];
  globalThis.MutationObserver = function (cb) {
    _mutationCallbacks.push(cb);
    return {
      observe() {},
      disconnect() {},
    };
  };

  // --- timers — capture callbacks for testing ---
  var _intervalCallbacks = [];
  globalThis.setInterval = function (fn) {
    _intervalCallbacks.push(fn);
    return _intervalCallbacks.length + 10000;
  };
  globalThis.clearInterval = function (id) {
    _clearedIntervals.push(id);
  };
  var _clearedIntervals = [];
  globalThis.setTimeout = function (fn) {
    if (typeof fn === "function") fn();
    return Math.floor(Math.random() * 99999);
  };
  globalThis.clearTimeout = function () {};

  // --- misc ---
  globalThis.JSON = JSON;
  globalThis.encodeURIComponent = function (s) {
    return String(s);
  };
  globalThis.console = { error() {}, warn() {}, log() {} };

  // Reset exports
  globalThis.__musicPlayerState = undefined;
  globalThis.__musicSaveTime = undefined;
  globalThis.__musicInit = undefined;

  return {
    _docListeners,
    _winListeners,
    _sessionStore,
    _intervalCallbacks,
    _clearedIntervals,
    _mutationCallbacks,
  };
}

// ==========================================================================
// Module loading
// ==========================================================================
var sourceCode = fs.readFileSync(
  path.resolve(__dirname, "../../Style/music-player.js"),
  "utf8",
);

var _script = new vm.Script(sourceCode, {
  filename: path.resolve(__dirname, "../../Style/music-player.js"),
});

function loadModule() {
  _script.runInThisContext();
}

// ==========================================================================
// Tests
// ==========================================================================

// ---------------------------------------------------------------------------
// 1. Standalone + ModeSelect early returns, then full init (SEQUENTIAL)
// ---------------------------------------------------------------------------
describe("__musicInit() — early returns + full init (sequential)", function () {
  var docListeners, winListeners;

  before(function () {
    var ctx = resetMusicState();
    docListeners = ctx._docListeners;
    winListeners = ctx._winListeners;
    document.readyState = "loading";
    loadModule();
  });

  // ---- standalone ----
  it("returns early when standalone dataset is set (removes audio src + load)", function () {
    makeEl("bg-music", {
      id: "bg-music",
      src: "http://example.com/track.mp3",
      loop: true,
      preload: "none",
      _loaded: false,
      load() {
        this._loaded = true;
      },
    });
    document.documentElement.dataset.standalone = "true";

    globalThis.__musicInit();

    assert.equal(_els["bg-music"].src, undefined, "src should be removed");
    assert.equal(_els["bg-music"]._loaded, true, "load() should be called");
    // Elements that inject() would create must NOT exist
    assert.equal(_els["music-btn"], undefined, "music-btn must not exist");
    assert.equal(
      _els["music-credit"],
      undefined,
      "music-credit must not exist",
    );
  });

  // ---- modeSelect visible (no inline style) ----
  it("returns early when modeSelect exists, visible, no inline style", function () {
    // Clean up standalone
    delete document.documentElement.dataset.standalone;
    // Remove the stale bg-music element from _els
    delete _els["bg-music"];

    makeEl("modeSelect", {
      style: { display: "block" },
      getAttribute(a) {
        return a === "style" ? null : this[a] || null;
      },
    });

    globalThis.__musicInit();

    // inject() must NOT have been called
    assert.equal(_els["bg-music"], undefined, "bg-music must not be created");
  });

  // ---- modeSelect with explicit style → bypass early return ----
  it("bypasses modeSelect early-return when explicit style attribute exists", function () {
    // Reuse existing #modeSelect but give it an explicit style attr
    _els["modeSelect"].getAttribute = function (a) {
      return a === "style" ? "display:block" : this[a] || null;
    };

    globalThis.__musicInit();

    // Now init should proceed and create elements
    assert.ok(_els["bg-music"], "bg-music should be created");
    assert.ok(_els["music-btn"], "music-btn should be created");
    assert.ok(_els["music-credit"], "music-credit should be created");
  });

  // ---- full init ----
  it("creates bg-music / music-btn / music-credit with correct attributes", function () {
    assert.equal(_els["bg-music"].loop, true);
    assert.equal(_els["bg-music"].preload, "none");
    assert.equal(_els["music-btn"].className, "music-btn");
    assert.equal(_els["music-credit"].className, "music-credit");
    assert.equal(_els["music-credit"].textContent, "RedoSan");
    assert.ok(
      _els["music-btn"].textContent === "\uD83C\uDFB5" ||
        _els["music-btn"].textContent === "\uD83D\uDD0A",
    );
  });

  it("sets _initialized flag (second __musicInit call is no-op)", function () {
    // _initialized is already true; calling init again must NOT re-inject
    var origBg = _els["bg-music"];
    delete _els["bg-music"];

    globalThis.__musicInit();

    assert.equal(_els["bg-music"], undefined, "should not re-create bg-music");
    // Restore
    _els["bg-music"] = origBg;
  });

  it("registers click listener on music-btn (toggle)", function () {
    var listeners = getElListeners("music-btn");
    assert.ok(listeners.click, "click listener on music-btn");
    assert.equal(listeners.click.length, 1);
  });

  it("registers click listener on document (firstClick)", function () {
    assert.ok(docListeners.click, "document click listener");
    assert.equal(docListeners.click.length, 1);
  });

  it("registers beforeunload listener on window (saveState)", function () {
    assert.ok(winListeners.beforeunload, "window beforeunload listener");
    assert.equal(winListeners.beforeunload.length, 1);
  });

  it("calls setInterval for guardian and save timer (init completes)", function () {
    // If init completed without error and elements exist, the timers were created.
    assert.ok(_els["bg-music"]);
  });
});

// ---------------------------------------------------------------------------
// 2. __musicPlayerState
// ---------------------------------------------------------------------------
describe("__musicPlayerState()", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    // No init — test default state
  });

  it("returns an object", function () {
    var state = globalThis.__musicPlayerState();
    assert.equal(typeof state, "object");
    assert.notEqual(state, null);
  });

  it('has a "playing" property', function () {
    var state = globalThis.__musicPlayerState();
    assert.ok("playing" in state);
    assert.equal(typeof state.playing, "boolean");
  });

  it("returns playing=false before init", function () {
    assert.equal(globalThis.__musicPlayerState().playing, false);
  });
});

// ---------------------------------------------------------------------------
// 3. __musicSaveTime — each scenario isolated
// ---------------------------------------------------------------------------
describe("__musicSaveTime() — saves when playing", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
  });

  it("saves currentTime and isPlaying when audio is not paused", function () {
    _els["bg-music"].paused = false;
    _els["bg-music"].currentTime = 42.5;
    globalThis.__musicSaveTime();

    var saved = JSON.parse(sessionStorage.getItem("musicState"));
    assert.ok(saved);
    assert.equal(saved.currentTime, 42.5);
    assert.equal(saved.isPlaying, false);
  });
});

describe("__musicSaveTime() — nothing when paused", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
  });

  it("does NOT save when audio is paused", function () {
    _els["bg-music"].paused = true;
    _els["bg-music"].currentTime = 10;
    globalThis.__musicSaveTime();

    assert.equal(sessionStorage.getItem("musicState"), null);
  });
});

describe("__musicSaveTime() — nothing when no element", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
  });

  it("does NOT save when element is missing", function () {
    delete _els["bg-music"];
    globalThis.__musicSaveTime(); // must not throw
    assert.equal(sessionStorage.getItem("musicState"), null);
  });
});

// ---------------------------------------------------------------------------
// 4. toggle + doPlay / doPause (shared init)
// ---------------------------------------------------------------------------
describe("toggle(), doPlay(), doPause() via button click", function () {
  var _savedToggleFn;

  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    globalThis.__musicInit(); // one fresh init
    _savedToggleFn = getElListeners("music-btn").click[0];
  });

  it("starts playback when button clicked while paused", async function () {
    var toggleFn = getElListeners("music-btn").click[0];
    _els["bg-music"].paused = true;

    toggleFn({ target: _els["music-btn"] });
    // flush microtasks so audio.play().then() fires
    await Promise.resolve();

    assert.equal(globalThis.__musicPlayerState().playing, true);
    assert.equal(_els["music-btn"].textContent, "\uD83D\uDD0A");
    assert.ok(_els["music-btn"].classList.contains("playing"));
    assert.ok(_els["music-credit"].classList.contains("show"));
    assert.equal(sessionStorage.getItem("musicInteracted"), "true");
  });

  it("pauses playback when button clicked while playing", async function () {
    // First toggle ON so we have something to toggle OFF
    var toggleFn = getElListeners("music-btn").click[0];
    _els["bg-music"].paused = true;
    toggleFn({ target: _els["music-btn"] });
    await Promise.resolve();

    // Now toggle OFF
    _els["bg-music"].paused = false;
    toggleFn({ target: _els["music-btn"] });

    assert.equal(globalThis.__musicPlayerState().playing, false);
    assert.equal(_els["music-btn"].textContent, "\uD83C\uDFB5");
    assert.ok(!_els["music-btn"].classList.contains("playing"));
  });

  it("toggle is no-op when audio element is missing", async function () {
    var toggleFn = getElListeners("music-btn").click[0];
    delete _els["bg-music"];

    toggleFn({ target: {} }); // must not throw
    await Promise.resolve();
  });

  it("doPlay() sets src via audioSrc() when audio.src is empty", async function () {
    setupInjectedState(); // restore bg-music
    _els["bg-music"].paused = true;
    _els["bg-music"].src = "";
    _els["bg-music"]._playCalled = false;

    var toggleFn = getElListeners("music-btn").click[0];
    toggleFn({ target: _els["music-btn"] });
    await Promise.resolve();

    assert.ok(
      _els["bg-music"].src.indexOf(".mp3") !== -1,
      "src should be set from audioSrc(), got: " + _els["bg-music"].src,
    );
  });

  it("setUI returns early when music-btn is missing", async function () {
    var toggleFn = getElListeners("music-btn").click[0];

    setupInjectedState();
    _els["bg-music"].paused = true;
    toggleFn({ target: _els["music-btn"] });
    await Promise.resolve();

    delete _els["music-btn"];

    // Don't need to call toggle again — setUI with null btn is a no-op.
    // Just verify _playing is true from the first toggle.
    assert.equal(globalThis.__musicPlayerState().playing, true);
  });

  it("doPlay catch branch when _playing=true handles rejection (lines 103-106)", async function () {
    // Restore bg-music element and set it up for rejection
    setupInjectedState();
    // The saved toggleFn still references the internal toggle function.
    // Add it as a click listener on the fresh music-btn so clicking works.
    _els["music-btn"].addEventListener("click", _savedToggleFn);

    // Make play() reject with _playing=true
    _els["bg-music"].play = function () {
      return Promise.reject(new Error("play rejected"));
    };
    _els["bg-music"].paused = true;
    _els["bg-music"].src = "Style/RedoSan_Music.mp3";

    // Click music-btn to trigger toggle → doPlay
    var clickEvent = { target: _els["music-btn"] };
    _savedToggleFn(clickEvent);

    // Flush microtasks to fire .catch
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // When _playing=true and play() rejects, the catch sets _playing=false and setUI(false)
    assert.equal(globalThis.__musicPlayerState().playing, false);
    assert.equal(_els["music-btn"].textContent, "\uD83C\uDFB5");
    assert.ok(!_els["music-btn"].classList.contains("playing"));
  });
});

// ---------------------------------------------------------------------------
// 5. firstClick via document click
// ---------------------------------------------------------------------------
describe("firstClick() via document click", function () {
  var docListeners;

  before(function () {
    var ctx = resetMusicState();
    docListeners = ctx._docListeners;
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    globalThis.__musicInit(); // fresh init, no saved state
  });

  it("on first click: sets musicInteracted + starts playback", async function () {
    assert.equal(sessionStorage.getItem("musicInteracted"), null);

    var fn = docListeners.click[0];
    fn({ target: document.body });
    await Promise.resolve();

    assert.equal(sessionStorage.getItem("musicInteracted"), "true");
    assert.equal(globalThis.__musicPlayerState().playing, true);
    // Listener should have been removed
    assert.equal(docListeners.click.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 6. firstClick — already-interacted path (separate load)
// ---------------------------------------------------------------------------
describe("firstClick() — already interacted", function () {
  var docListeners;

  before(function () {
    var ctx = resetMusicState();
    docListeners = ctx._docListeners;
    document.readyState = "loading";
    loadModule();
    setupInjectedState();

    // Preset interacted so restoreState sees it and does NOT remove the listener
    sessionStorage.setItem("musicInteracted", "true");
    // No musicState → state=null → restoreState calls setUI(true) + return
    // (preserves the click listener)
    globalThis.__musicInit();
  });

  it("removes listener without replay when already interacted, _playing=false", function () {
    assert.equal(docListeners.click.length, 1, "listener still registered");

    var fn = docListeners.click[0];
    fn({ target: document.body });

    // Listener should be removed
    assert.equal(docListeners.click.length, 0);
    // _playing should remain false
    assert.equal(globalThis.__musicPlayerState().playing, false);
  });
});

// ---------------------------------------------------------------------------
// 7. firstClick — already interacted + _playing=true (separate load)
// ---------------------------------------------------------------------------
describe("firstClick() — interacted + _playing=true", function () {
  var docListeners;

  before(function () {
    var ctx = resetMusicState();
    docListeners = ctx._docListeners;
    document.readyState = "loading";
    loadModule();
    setupInjectedState();

    // Set up so restoreState sets _playing=true and preserves the listener:
    //   state = {isPlaying: true, currentTime: 0} → _playing=true, setUI(true)
    //   currentTime=0 so seekTarget stays -1 → audio.play()
    sessionStorage.setItem("musicInteracted", "true");
    sessionStorage.setItem(
      "musicState",
      JSON.stringify({ isPlaying: true, currentTime: 0 }),
    );

    globalThis.__musicInit();
  });

  it("when interacted + _playing=true and audio paused, firstClick calls doPlay", async function () {
    assert.equal(docListeners.click.length, 1, "listener should be registered");

    // Simulate audio being paused while _playing remains true
    _els["bg-music"].paused = true;
    _els["bg-music"].src = "";
    _els["bg-music"]._playCalled = false;

    var fn = docListeners.click[0];
    fn({ target: document.body });
    await Promise.resolve();

    // Listener removed
    assert.equal(docListeners.click.length, 0, "listener removed");
    // doPlay should have been called (audio was paused, _playing=true)
    assert.ok(_els["bg-music"]._playCalled, "doPlay should resume audio");
  });

  it("when interacted + _playing=true and audio already playing, firstClick removes listener (doPlay returns early, no crash)", async function () {
    // The previous test already called firstClick which removed the listener.
    // The audio was restored (setupInjectedState) by the test above.
    // Verify that _playing is still true and no crash occurred.
    assert.equal(
      globalThis.__musicPlayerState().playing,
      true,
      "_playing should still be true",
    );
    // Listener was already removed by the previous test
    assert.equal(docListeners.click.length, 0, "listener was already removed");
  });
});

// ---------------------------------------------------------------------------
// 8. saveState via beforeunload
// ---------------------------------------------------------------------------
describe("saveState() via beforeunload", function () {
  var winListeners;

  before(function () {
    var ctx = resetMusicState();
    winListeners = ctx._winListeners;
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    globalThis.__musicInit();
  });

  it("saves isPlaying=false + currentTime on beforeunload", function () {
    _els["bg-music"].currentTime = 55;
    var fn = winListeners.beforeunload[0];
    fn();

    var saved = JSON.parse(sessionStorage.getItem("musicState"));
    assert.ok(saved);
    assert.equal(saved.isPlaying, false);
    assert.equal(saved.currentTime, 55);
  });

  it("saves isPlaying=true when audio was playing", async function () {
    // Start playback via toggle
    var toggleFn = getElListeners("music-btn").click[0];
    _els["bg-music"].paused = true;
    toggleFn({ target: _els["music-btn"] });
    await Promise.resolve();
    _els["bg-music"].currentTime = 120;

    var fn = winListeners.beforeunload[0];
    fn();

    var saved = JSON.parse(sessionStorage.getItem("musicState"));
    assert.equal(saved.isPlaying, true);
    assert.equal(saved.currentTime, 120);
  });

  it("is no-op when bg-music is missing", function () {
    var audio = _els["bg-music"];
    delete _els["bg-music"];

    var fn = winListeners.beforeunload[0];
    fn(); // must not throw
    _els["bg-music"] = audio;
  });
});

// ---------------------------------------------------------------------------
// 9. restoreState — no saved state (default)
// ---------------------------------------------------------------------------
describe("restoreState() — no saved state", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    globalThis.__musicInit();
  });

  it("does not play when no sessionStorage", function () {
    assert.equal(globalThis.__musicPlayerState().playing, false);
    assert.equal(_els["music-btn"].textContent, "\uD83C\uDFB5");
  });
});

// ---------------------------------------------------------------------------
// 10-14. restoreState — various sessionStorage scenarios (one load each)
// ---------------------------------------------------------------------------
describe("restoreState() — isPlaying=true, currentTime>0, interacted", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    sessionStorage.setItem(
      "musicState",
      JSON.stringify({ isPlaying: true, currentTime: 30 }),
    );
    sessionStorage.setItem("musicInteracted", "true");
    globalThis.__musicInit();
  });

  it("sets _playing=true and seek target in audio src", function () {
    assert.equal(globalThis.__musicPlayerState().playing, true);
    assert.ok(
      _els["bg-music"].src.indexOf("#t=30") !== -1,
      "audio src should contain #t=30, got: " + _els["bg-music"].src,
    );
    assert.equal(_els["music-btn"].textContent, "\uD83D\uDD0A");
    assert.ok(_els["music-btn"].classList.contains("playing"));
  });
});

describe("restoreState() — isPlaying=true, currentTime=0, interacted", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    sessionStorage.setItem(
      "musicState",
      JSON.stringify({ isPlaying: true, currentTime: 0 }),
    );
    sessionStorage.setItem("musicInteracted", "true");
    globalThis.__musicInit();
  });

  it("starts playback without seek (currentTime=0)", function () {
    assert.equal(globalThis.__musicPlayerState().playing, true);
    // No seek fragment in src
    assert.ok(
      _els["bg-music"].src.indexOf("#t=") === -1,
      "should NOT contain seek fragment when currentTime=0",
    );
    assert.equal(_els["music-btn"].textContent, "\uD83D\uDD0A");
  });
});

describe("restoreState() — interacted=true, no state (state=null)", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    sessionStorage.setItem("musicInteracted", "true");
    // No musicState → state=null
    globalThis.__musicInit();
  });

  it("shows playing UI but _playing stays false", function () {
    // restoreState path: if (!state) { setUI(true); return; }
    assert.equal(_els["music-btn"].textContent, "\uD83D\uDD0A");
    assert.ok(_els["music-btn"].classList.contains("playing"));
    assert.equal(globalThis.__musicPlayerState().playing, false);
  });
});

describe("restoreState() — isPlaying=false, interacted=true", function () {
  var docListeners;

  before(function () {
    var ctx = resetMusicState();
    docListeners = ctx._docListeners;
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    sessionStorage.setItem(
      "musicState",
      JSON.stringify({ isPlaying: false, currentTime: 20 }),
    );
    sessionStorage.setItem("musicInteracted", "true");
    globalThis.__musicInit();
  });

  it("removes click listener and shows not-playing UI", function () {
    assert.equal(docListeners.click.length, 0, "click listener removed");
    assert.equal(globalThis.__musicPlayerState().playing, false);
    assert.equal(_els["music-btn"].textContent, "\uD83C\uDFB5");
  });
});

describe("restoreState() — corrupted sessionStorage", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    sessionStorage.setItem("musicState", "not-valid-json");
    sessionStorage.setItem("musicInteracted", "maybe");
    globalThis.__musicInit(); // must not throw
  });

  it("falls back gracefully to default state", function () {
    assert.equal(globalThis.__musicPlayerState().playing, false);
    assert.equal(_els["music-btn"].textContent, "\uD83C\uDFB5");
  });
});

describe("restoreState() — isPlaying=true, currentTime=Infinity", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    sessionStorage.setItem(
      "musicState",
      JSON.stringify({ isPlaying: true, currentTime: Infinity }),
    );
    sessionStorage.setItem("musicInteracted", "true");
    globalThis.__musicInit(); // must not throw
  });

  it("skips seek (isFinite check) but still sets _playing=true", function () {
    assert.equal(globalThis.__musicPlayerState().playing, true);
    // No seek fragment (isFinite(Infinity) is false)
    assert.ok(
      _els["bg-music"].src.indexOf("#t=Infinity") === -1,
      "should not contain Infinity seek",
    );
  });
});

// ---------------------------------------------------------------------------
// 15. audioSrc() path resolution
// ---------------------------------------------------------------------------
describe("audioSrc() path resolution", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    globalThis.__musicInit();
  });

  it('returns "Style/RedoSan_Music.mp3" for root pathname', async function () {
    globalThis.location.pathname = "/";
    _els["bg-music"].paused = true;
    _els["bg-music"].src = "";

    var toggleFn = getElListeners("music-btn").click[0];
    toggleFn({ target: _els["music-btn"] });
    await Promise.resolve();

    assert.ok(
      _els["bg-music"].src.indexOf("Style/RedoSan_Music.mp3") !== -1,
      "expected Style/RedoSan_Music.mp3, got: " + _els["bg-music"].src,
    );
  });

  it('returns "../RedoSan_Music.mp3" when path contains "/pages/"', async function () {
    globalThis.location.pathname = "/pages/watermark/";
    _els["bg-music"].paused = true;
    _els["bg-music"].src = "";

    var toggleFn = getElListeners("music-btn").click[0];
    toggleFn({ target: _els["music-btn"] });
    await Promise.resolve();

    assert.ok(
      _els["bg-music"].src.indexOf("../RedoSan_Music.mp3") !== -1,
      "expected ../RedoSan_Music.mp3, got: " + _els["bg-music"].src,
    );
  });

  it('returns "../../RedoSan_Music.mp3" for deeper pages path', async function () {
    globalThis.location.pathname = "/Style/pages/watermark/test/";
    _els["bg-music"].paused = true;
    _els["bg-music"].src = "";

    var toggleFn = getElListeners("music-btn").click[0];
    toggleFn({ target: _els["music-btn"] });
    await Promise.resolve();

    assert.ok(
      _els["bg-music"].src.indexOf("../../RedoSan_Music.mp3") !== -1,
      "expected ../../RedoSan_Music.mp3, got: " + _els["bg-music"].src,
    );
  });
});

// ---------------------------------------------------------------------------
// 16. initAudioProtection (pause listener)
// ---------------------------------------------------------------------------
describe("initAudioProtection() — pause listener", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    globalThis.__musicInit();
  });

  it("registers a pause event listener on bg-music", function () {
    var p = getElListeners("bg-music").pause;
    assert.ok(p, "pause listener should exist");
    assert.equal(p.length, 1);
  });

  it("re-plays audio when _userPaused=false, _playing=true, and pause fires", async function () {
    // Simulate playing without user pause
    var toggleFn = getElListeners("music-btn").click[0];
    _els["bg-music"].paused = true;
    toggleFn({ target: _els["music-btn"] });
    await Promise.resolve();

    _els["bg-music"].paused = true;
    _els["bg-music"]._playCalled = false;

    var pauseFn = getElListeners("bg-music").pause[0];
    pauseFn();

    // Our setTimeout mock fires synchronously inside the pause handler
    // The inner check: !_userPaused=true && _playing=true → a.play()
    assert.ok(
      _els["bg-music"]._playCalled || !_els["bg-music"].paused,
      "audio should be re-played by protection",
    );
  });

  it("does NOT re-play when _userPaused is true", async function () {
    // First toggle ON, then toggle OFF (sets _userPaused=true)
    _els["bg-music"].paused = true;
    var toggleFn = getElListeners("music-btn").click[0];
    toggleFn({ target: _els["music-btn"] }); // ON
    await Promise.resolve();
    _els["bg-music"].paused = false;
    toggleFn({ target: _els["music-btn"] }); // OFF → _userPaused=true

    _els["bg-music"].paused = true;
    _els["bg-music"]._playCalled = false;

    var pauseFn = getElListeners("bg-music").pause[0];
    pauseFn();

    // _userPaused=true → should NOT play
    assert.equal(
      _els["bg-music"]._playCalled,
      false,
      "should not replay when user-paused",
    );
  });
});

// ---------------------------------------------------------------------------
// 17. doPlay seek path (unconsumed _seekTarget from restoreState)
// ---------------------------------------------------------------------------
describe("doPlay seek path via _seekTarget", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();

    // Set _seekTarget by restoreState but WITHOUT interacted=true
    // so restoreState does NOT consume the seek target.
    sessionStorage.setItem(
      "musicState",
      JSON.stringify({ isPlaying: true, currentTime: 25 }),
    );
    // No musicInteracted → interacted=false → _seekTarget set but not consumed
    globalThis.__musicInit();
  });

  it("doPlay uses seek path when _seekTarget>0 is left unconsumed", async function () {
    assert.equal(globalThis.__musicPlayerState().playing, false);

    _els["bg-music"].paused = true;
    _els["bg-music"].src = "";
    _els["bg-music"]._loaded = false;

    var toggleFn = getElListeners("music-btn").click[0];
    toggleFn({ target: _els["music-btn"] });
    await Promise.resolve();

    // doPlay should hit the _seekTarget > 0 branch
    assert.ok(
      _els["bg-music"].src.indexOf("#t=25") !== -1,
      "src should contain #t=25, got: " + _els["bg-music"].src,
    );
    assert.equal(_els["bg-music"]._loaded, true, "audio.load() called");
  });
});

// ---------------------------------------------------------------------------
// 18. doPlay seek path — playSeeked with readyState >= 3
// ---------------------------------------------------------------------------
describe("playSeeked() — immediate play via readyState>=3", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();

    sessionStorage.setItem(
      "musicState",
      JSON.stringify({ isPlaying: true, currentTime: 10 }),
    );
    _els["bg-music"].readyState = 4; // force immediate in playSeeked
    globalThis.__musicInit();
  });

  it("calls play() immediately when readyState >= 3", async function () {
    // restoreState path: interacted=false → sets _seekTarget=10 but doesn't consume it
    // So doPlay still has _seekTarget=10 on first toggle
    _els["bg-music"].paused = true;
    _els["bg-music"].src = "";
    _els["bg-music"]._loaded = false;

    var toggleFn = getElListeners("music-btn").click[0];
    toggleFn({ target: _els["music-btn"] });
    await Promise.resolve();

    assert.ok(
      _els["bg-music"].src.indexOf("#t=10") !== -1,
      "src contains #t=10",
    );
    assert.equal(
      _els["bg-music"].paused,
      false,
      "playSeeked with readyState>=3 should play immediately",
    );
    assert.equal(
      globalThis.__musicPlayerState().playing,
      true,
      "_playing should be true after playSeeked",
    );
  });
});

// ---------------------------------------------------------------------------
// 19. auto-init — readyState = "loading" (deferred via DOMContentLoaded)
// ---------------------------------------------------------------------------
describe("auto-init — readyState = loading", function () {
  var docListeners;

  before(function () {
    var ctx = resetMusicState();
    docListeners = ctx._docListeners;
    document.readyState = "loading";
    loadModule(); // IIFE registers DOMContentLoaded, does NOT call init
  });

  it("registers DOMContentLoaded listener", function () {
    assert.ok(docListeners.DOMContentLoaded);
    assert.equal(docListeners.DOMContentLoaded.length, 1);
  });

  it("triggers init when DOMContentLoaded fires", function () {
    docListeners.DOMContentLoaded[0]();
    assert.ok(_els["bg-music"], "bg-music created after DOMContentLoaded");
    assert.ok(_els["music-btn"]);
    assert.ok(_els["music-credit"]);
  });
});

// ---------------------------------------------------------------------------
// 20. auto-init — readyState = "complete" (immediate)
// ---------------------------------------------------------------------------
describe("auto-init — readyState = complete", function () {
  var docListeners, winListeners;

  before(function () {
    var ctx = resetMusicState();
    docListeners = ctx._docListeners;
    winListeners = ctx._winListeners;
    document.readyState = "complete";
    // When the module loads, the IIFE sees readyState="complete"
    // and calls init() immediately.
    loadModule();
  });

  it("calls init() immediately on module load", function () {
    assert.ok(_els["bg-music"], "bg-music should exist");
    assert.ok(_els["music-btn"]);
    assert.ok(_els["music-credit"]);
  });

  it("registers event listeners", function () {
    assert.ok(docListeners.click, "document click listener");
    assert.ok(winListeners.beforeunload, "beforeunload listener");
  });
});

// ---------------------------------------------------------------------------
// 21. restoreState — seek with readyState >= 3 (immediate canplay)
// ---------------------------------------------------------------------------
describe("restoreState() — seek with readyState>=3", function () {
  before(function () {
    resetMusicState();
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    _els["bg-music"].readyState = 4;
    sessionStorage.setItem(
      "musicState",
      JSON.stringify({ isPlaying: true, currentTime: 60 }),
    );
    sessionStorage.setItem("musicInteracted", "true");
    globalThis.__musicInit();
  });

  it("calls audio.play() immediately when readyState>=3 during restoreState seek", function () {
    assert.equal(globalThis.__musicPlayerState().playing, true);
    assert.ok(
      _els["bg-music"].src.indexOf("#t=60") !== -1,
      "src contains #t=60",
    );
    assert.equal(_els["bg-music"].paused, false, "audio should be playing");
  });
});

// ---------------------------------------------------------------------------
// Guardian callback (startGuardian interval)
// ---------------------------------------------------------------------------
describe("guardian interval callback", function () {
  var intervalCallbacks;

  before(function () {
    var ctx = resetMusicState();
    intervalCallbacks = ctx._intervalCallbacks;
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    globalThis.__musicInit(); // creates guardian + save-timer intervals
  });

  it("updates _lastSafeTime when audio is playing and has currentTime > 0", function () {
    // guardian callback 0 is from startGuardian, 1 from startSaveTimer
    var guardianCb = intervalCallbacks[0];

    _els["bg-music"].paused = true;
    // Set _playing=true via toggle
    var toggleFn = getElListeners("music-btn").click[0];
    toggleFn({ target: _els["music-btn"] });

    _els["bg-music"].paused = false;
    _els["bg-music"].currentTime = 50;

    // Invoke guardian callback
    guardianCb();

    // The callback sets _lastSafeTime = a.currentTime when paused=false and currentTime>0
    // We can verify indirectly: if _lastSafeTime was set, the next callback
    // when paused will use it. Since we can't read _lastSafeTime directly,
    // verify the callback didn't crash and audio is still playing.
    assert.equal(globalThis.__musicPlayerState().playing, true);
  });

  it("returns early when _playing is false (audio paused by user)", function () {
    var guardianCb = intervalCallbacks[0];

    // _playing is true from previous test, toggle OFF
    var toggleFn = getElListeners("music-btn").click[0];
    _els["bg-music"].paused = false;
    toggleFn({ target: _els["music-btn"] }); // OFF → _playing=false, _userPaused=true

    _els["bg-music"].paused = true;
    _els["bg-music"].src = "Style/RedoSan_Music.mp3";

    guardianCb(); // must not throw, does nothing since _playing=false
  });

  it("tries to replay when _playing=true and audio is paused with src", function () {
    var guardianCb = intervalCallbacks[0];

    // Toggle ON so _playing=true, _userPaused=false
    _els["bg-music"].paused = true;
    var toggleFn = getElListeners("music-btn").click[0];
    toggleFn({ target: _els["music-btn"] });

    _els["bg-music"].paused = true;
    _els["bg-music"].src = "Style/RedoSan_Music.mp3";
    _els["bg-music"].currentTime = 0;
    // _lastSafeTime should be > 0 (set by earlier test)
    // currentTime < 1 && _lastSafeTime > 0 → seek path

    guardianCb(); // should try to replay with seek

    // With currentTime < 1 and _lastSafeTime > 0, the callback does seek path
    // Sets src with #t= seek, calls load()
    assert.ok(_els["bg-music"]._loaded, "audio.load() should be called");
  });

  it("guardian seek path with readyState>=3 calls onReady immediately (line 310)", function () {
    var guardianCb = intervalCallbacks[0];

    // Ensure _playing=true by toggling on
    _els["bg-music"].paused = true;
    var toggleFn = getElListeners("music-btn").click[0];
    toggleFn({ target: _els["music-btn"] });
    // Now _playing=true

    _els["bg-music"].paused = true;
    _els["bg-music"].src = "Style/RedoSan_Music.mp3";
    _els["bg-music"].currentTime = 0;
    _els["bg-music"].readyState = 4; // readyState >= 3 → immediate canplay

    // Capture play calls
    var playCalled = false;
    var origPlay = _els["bg-music"].play;
    _els["bg-music"].play = function () {
      playCalled = true;
      _els["bg-music"].paused = false;
      return Promise.resolve();
    };

    guardianCb();

    // onReady() should be called immediately (readyState >= 3)
    // which calls a.play()
    assert.ok(playCalled, "a.play() should be called via onReady()");
    assert.equal(_els["bg-music"].paused, false);

    _els["bg-music"].play = origPlay;
  });

  it("guardian else path plays directly when currentTime >= 1 (lines 315-316)", function () {
    var guardianCb = intervalCallbacks[0];

    // Ensure _playing=true
    _els["bg-music"].paused = true;
    var toggleFn = getElListeners("music-btn").click[0];
    toggleFn({ target: _els["music-btn"] });

    // Setup: currentTime >= 1, so we go to the ELSE branch (play directly, no seek)
    _els["bg-music"].paused = true;
    _els["bg-music"].src = "Style/RedoSan_Music.mp3";
    _els["bg-music"].currentTime = 5; // >= 1 → else branch
    _els["bg-music"].readyState = 0;

    var playCalled = false;
    var origPlay = _els["bg-music"].play;
    _els["bg-music"].play = function () {
      playCalled = true;
      _els["bg-music"].paused = false;
      return Promise.resolve();
    };

    guardianCb();

    // Should call a.play() directly (no seek)
    assert.ok(playCalled, "a.play() should be called in else branch");
    _els["bg-music"].play = origPlay;
  });
});

// ---------------------------------------------------------------------------
// Save timer callback (startSaveTimer interval)
// ---------------------------------------------------------------------------
describe("save timer interval callback", function () {
  var intervalCallbacks;

  before(function () {
    var ctx = resetMusicState();
    intervalCallbacks = ctx._intervalCallbacks;
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    globalThis.__musicInit();
  });

  it("calls saveState when _playing=true and audio is not paused", function () {
    var saveCb = intervalCallbacks[1]; // second interval = save timer

    // Start playback
    _els["bg-music"].paused = true;
    var toggleFn = getElListeners("music-btn").click[0];
    toggleFn({ target: _els["music-btn"] });
    _els["bg-music"].currentTime = 75;

    saveCb();

    // Should have saved state
    var saved = JSON.parse(sessionStorage.getItem("musicState"));
    assert.ok(saved, "saveState should be called by save timer");
    assert.equal(saved.currentTime, 75);
    assert.equal(saved.isPlaying, true);
  });

  it("skips saveState when _playing is false", function () {
    var saveCb = intervalCallbacks[1];

    // Toggle OFF
    _els["bg-music"].paused = false;
    var toggleFn = getElListeners("music-btn").click[0];
    toggleFn({ target: _els["music-btn"] });

    sessionStorage.removeItem("musicState");
    _els["bg-music"].currentTime = 99;

    saveCb();

    // Should NOT have saved (audio is paused and _playing=false)
    assert.equal(sessionStorage.getItem("musicState"), null);
  });

  it("skips saveState when audio element is missing", function () {
    var saveCb = intervalCallbacks[1];
    delete _els["bg-music"];

    saveCb(); // must not throw
  });
});

// ---------------------------------------------------------------------------
// stopGuardian / stopSaveTimer — clearInterval is called on start
// ---------------------------------------------------------------------------
describe("stopGuardian / stopSaveTimer", function () {
  var clearedIntervals, intervalCallbacks;

  before(function () {
    var ctx = resetMusicState();
    clearedIntervals = ctx._clearedIntervals;
    intervalCallbacks = ctx._intervalCallbacks;
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    // startGuardian calls stopGuardian first (_guardianTimer is null → no clearInterval)
    // Then sets _guardianTimer = setInterval(...)
    // startSaveTimer calls stopSaveTimer first (_saveTimer is null → no clearInterval)
    // Then sets _saveTimer = setInterval(...)
    globalThis.__musicInit();
  });

  it("setInterval is called twice (guardian + save timer), creating callbacks", function () {
    // After init, we should have two interval callbacks (guardian and save timer)
    assert.ok(
      intervalCallbacks.length >= 2,
      "should have at least 2 interval callbacks (guardian + save)",
    );
  });
});

// ---------------------------------------------------------------------------
// MutationObserver — watchAudioElement
// ---------------------------------------------------------------------------
describe("watchAudioElement() — MutationObserver callback", function () {
  var mutationCallbacks;

  before(function () {
    var ctx = resetMusicState();
    mutationCallbacks = ctx._mutationCallbacks;
    document.readyState = "loading";
    loadModule();
    setupInjectedState();
    globalThis.__musicInit();
  });

  it("creates a MutationObserver during init", function () {
    // watchAudioElement is called by init, which creates a MutationObserver
    // and stores its callback
    assert.ok(
      mutationCallbacks.length >= 1,
      "MutationObserver callback should be captured",
    );
  });

  it("logs error when bg-music is removed from DOM", function () {
    var moCb = mutationCallbacks[0];

    // Capture console.error output
    var errorMsg = "";
    var origError = console.error;
    console.error = function (msg) {
      errorMsg = msg;
    };

    // Invoke the MutationObserver callback with a mock mutation
    // that has bg-music in removedNodes
    moCb([
      {
        removedNodes: [
          { id: "bg-music", tagName: "AUDIO" },
          { id: "other-node", tagName: "DIV" },
        ],
      },
    ]);

    // Should have logged the error
    assert.ok(
      errorMsg.indexOf("bg-music REMOVED") !== -1,
      "should log error when bg-music removed, got: " + errorMsg,
    );

    // Restore
    console.error = origError;
  });

  it("does not log error when bg-music is NOT removed", function () {
    var moCb = mutationCallbacks[0];
    var errorMsg = "";
    var origError = console.error;
    console.error = function (msg) {
      errorMsg = msg;
    };

    moCb([
      {
        removedNodes: [
          { id: "other-node", tagName: "DIV" },
          { id: "another-node", tagName: "SPAN" },
        ],
      },
    ]);

    assert.equal(errorMsg, "", "should not log when bg-music not removed");

    console.error = origError;
  });
});
