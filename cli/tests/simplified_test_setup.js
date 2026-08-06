const path = require("path");
const fs = require("fs");
const vm = require("vm");

var _mockElements = {};

function makeEl(id, extra) {
  if (!_mockElements[id]) {
    _mockElements[id] = Object.assign({
      style: { display: "" },
      value: "",
      files: undefined,
      textContent: "",
      innerHTML: "",
      className: "",
      checked: false,
      disabled: false,
      src: "",
      href: "",
      download: "",
      width: 0,
      height: 0,
      classList: {
        add: function () {},
        remove: function () {},
        contains: function () { return false; },
        toggle: function () {},
      },
      append: function () {},
      addEventListener: function () {},
      removeEventListener: function () {},
      dispatchEvent: function () {},
      getAttribute: function () { return null; },
      setAttribute: function () {},
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      click: function () {},
      focus: function () {},
      parentElement: {},
      parentNode: { insertBefore: function () {}, querySelector: function () { return null; } },
    }, extra || {});
  }
  return _mockElements[id];
}

var _mockGetElementById;

function setupSimplifiedGlobals() {
  var _localStorage = {};
  globalThis.localStorage = {
    getItem: function (k) { return _localStorage[k] !== undefined ? _localStorage[k] : null; },
    setItem: function (k, v) { _localStorage[k] = String(v); },
    removeItem: function (k) { delete _localStorage[k]; },
    clear: function () { _localStorage = {}; },
  };

  _mockGetElementById = function (id) { return _mockElements[id] || makeEl(id); };
  globalThis.document = {
    getElementById: _mockGetElementById,
    addEventListener: function () {},
    querySelectorAll: function (sel) {
      if (sel === ".page" || sel === '.sidebar a[data-page]') return [];
      if (sel === '#app input[type="file"]') return [];
      if (sel === '#app input[type="text"], #app input[type="password"], #app input[type="search"], #app textarea') return [];
      return [];
    },
    querySelector: function () { return null; },
    createElement: function (tag) {
      if (tag === "a") return {
        href: "", download: "", click: function () {},
        className: "", style: { cssText: "" }, textContent: "",
      };
      return { className: "", textContent: "", innerHTML: "", style: {},
        append: function () {}, addEventListener: function () {},
        classList: { add: function () {}, remove: function () {}, contains: function () { return false; } },
        parentNode: { insertBefore: function () {}, querySelector: function () { return null; } },
      };
    },
    createTextNode: function () { return {}; },
    documentElement: { dataset: {}, style: {}, getAttribute: function () { return "en"; } },
    body: { classList: { add: function () {}, remove: function () {}, contains: function () { return false; }, toggle: function () {} } },
  };

  globalThis.window = globalThis;
  globalThis.alert = function () {};
  globalThis.setTimeout = setTimeout;
  globalThis.clearTimeout = clearTimeout;
  globalThis.setInterval = setInterval;
  globalThis.clearInterval = clearInterval;
  globalThis.console = { log: function () {}, error: function () {}, warn: function () {} };
  globalThis.DataTransfer = function () {
    this.files = [];
    this.items = { add: function () {} };
  };
  globalThis.Event = function (type, opts) { this.type = type; this.bubbles = opts && opts.bubbles ? true : false; };
  globalThis.URL = { createObjectURL: function () { return "blob:test"; }, revokeObjectURL: function () {} };
  globalThis.location = { protocol: "http:", hostname: "localhost", href: "http://localhost:8080/", pathname: "/", replace: function () {} };
  globalThis.history = { pushState: function () {}, replaceState: function () {} };
  globalThis.matchMedia = function () { return { matches: false, addListener: function () {}, removeListener: function () {} }; };
  globalThis.screen = { width: 1920, height: 1080 };

  try { Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 TestAgent", configurable: true, writable: true }); } catch (e) {}
  try { Object.defineProperty(navigator, "languages", { value: ["en-US"], configurable: true, writable: true }); } catch (e) {}
  try { Object.defineProperty(navigator, "language", { value: "en", configurable: true, writable: true }); } catch (e) {}

  // i18n stub
  globalThis.i18n = { data: {} };
  globalThis.__ = function (key) {
    if (i18n && i18n.data && i18n.data[key]) return i18n.data[key];
    var fallback = { "simplified.upload": "Upload", "simplified.ai_question": "AI Question",
      "simplified.fingerprint": "Fingerprint", "simplified.did_sign": "DID Sign",
      "simplified.watermark": "Watermark", "simplified.pixel_injection": "Pixel Injection",
      "simplified.c2pa": "C2PA", "simplified.timestamp": "Timestamp", "simplified.done": "Done",
      "simplified.audio_watermark": "Audio Watermark",
      "simplified.name": "Name", "simplified.email": "Email", "simplified.phone": "Phone",
      "simplified.website": "Website", "simplified.select_file": "Select a file",
      "simplified.owner_info": "Owner Information",
    };
    return fallback[key] || key;
  };
  globalThis.escHtml = function (s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  globalThis.setResult = function () {};
  globalThis.getResult = function () {};
  globalThis.setDownloadHandler = function () {};
  globalThis.showDownloadModal = function () {};
  globalThis.downloadBlobSimple = function () {};
  globalThis.downloadBlob = function () {};

  // Watermark stubs
  globalThis.watermarkEmbed = function () { return Promise.resolve({ ok: true, data: "watermarked" }); };
  globalThis.watermarkExtract = function () {};
  globalThis.detectWatermarkAlgorithm = function () {};

  // Audio watermark stubs
  globalThis.awLoadAudio = function () { return { sampleRate: 44100, channels: 2, samples: new Int16Array(44100) }; };
  globalThis.awWriteWav = function () { return new Uint8Array(100); };
  globalThis.awFormatPayload = function () { return new Uint8Array(100); };
  globalThis.pw_key = function () { return new Uint8Array(32); };
  globalThis.aw1_embed = function () { return { data: new Int16Array(100) }; };
  globalThis.aw2_embed = function () { return { data: new Int16Array(100) }; };
  globalThis.aw3_embed = function () { return { data: new Int16Array(100) }; };
  globalThis.aw4_embed = function () { return { data: new Int16Array(100) }; };
  globalThis.aw5_embed = function () { return { data: new Int16Array(100) }; };
  globalThis.aw6_embed = function () { return { data: new Int16Array(100) }; };
  globalThis.aw7_embed = function () { return { data: new Int16Array(100) }; };
  globalThis.aw8_embed_async = function () { return Promise.resolve(new Int16Array(100)); };
  globalThis.aw2_maxBits = function () { return 100; };
  globalThis.aw3_maxBits = function () { return 200; };
  globalThis.aw4_maxBits = function () { return 300; };
  globalThis.aw6_maxBits = function () { return 400; };
  globalThis.aw7_maxBits = function () { return 500; };
  globalThis.aw8_maxBits = function () { return 600; };

  // DID stubs
  globalThis.didGenerateKeypair = function () { return Promise.resolve({ publicKey: "pub", privateKey: "priv" }); };
  globalThis.didStoreKeys = function () { return Promise.resolve(); };
  globalThis.didLoadKeys = function () { return Promise.resolve({ algo: "Ed25519", publicKey: "pub", privateKey: "priv" }); };
  globalThis.didImportSignKey = function () { return Promise.resolve({ publicKey: "pub", privateKey: "priv" }); };
  globalThis.didClearKeys = function () { return Promise.resolve(); };
  globalThis.didSign = function () { return Promise.resolve(new Uint8Array(64)); };
  globalThis.didSigToBase64 = function () { return "base64sig"; };
  globalThis.didVerify = function () { return Promise.resolve(true); };
  globalThis.didGetAlgorithmList = function () { return ["Ed25519", "P-256", "RSA-2048", "RSA-4096"]; };
  globalThis.downloadDID = function () {};

  // C2PA stubs
  globalThis.handleC2paWrite = function () { return Promise.resolve({ ok: true, url: "blob:c2pa" }); };
  globalThis._c2paSignedUrl = null;
  globalThis.handleC2paRead = function () {};
  globalThis.handleC2paVerify = function () {};

  // Fingerprint stubs
  globalThis.fastFingerprint = function (file, onStatus, onExtra) {
    return Promise.resolve({ sha256: "abc123", md5: "def456" });
  };
  globalThis.handleFingerprint = function () { return Promise.resolve({ ok: true, data: { sha256: "abc123" } }); };
  globalThis.downloadFingerprint = function () {};
  globalThis.trimFingerprintPayload = function (s, max) {
    if (!s) return "";
    return s.length > max ? s.slice(0, max) : s;
  };

  // Timestamp stubs
  globalThis.handleOtsCreate = function () { return Promise.resolve({ ok: true }); };
  globalThis.otsBuildDetached = function () {};
  globalThis.otsParse = function () {};

  // Pixel injection stubs
  globalThis.handlePixelInjection = function () { return Promise.resolve({ ok: true, url: "blob:pi" }); };
  globalThis.switchPiTab = function () {};
  globalThis.pixelInjection = {
    algorithms: { spatial: ["enhancedLSB"], frequency: ["dct"], deep_learning: ["vine"], professional: ["adaptiveLSB"] },
  };
  globalThis.AdvancedWatermarking = function () {};

  // shared_validation stubs
  globalThis.isDangerousFile = function () { return false; };
  globalThis.isEnglishFilename = function () { return true; };
  globalThis.matchesAccept = function () { return true; };
  globalThis.matchesMagicBytes = function () { return true; };
  globalThis.checkDangerousContent = function () { return { dangerous: false }; };
  globalThis.checkFileStructure = function () { return { valid: true }; };
  globalThis.clearInputFiles = function () {};

  // simplified_countries stubs (will be replaced when countries.js is loaded)
  globalThis.validateEmailInput = function () {};
  globalThis.validatePhoneInput = function () {};
  globalThis.validateUrlInput = function () {};
  globalThis.validateSocialInput = function () {};
  globalThis.validateC2paLink = function () {};
  globalThis.prefixHttps = function () {};
  globalThis.showProgress = function () {};
  globalThis.hideProgress = function () {};
  globalThis.openLightbox = function () {};
  globalThis.closeLightbox = function () {};
  globalThis.getDefaultPhoneCode = function () { return "+966"; };
  globalThis.phoneCodeOptionsHtml = function () { return "<option>test</option>"; };
  globalThis.updatePhoneMaxLength = function () {};
  globalThis.clearSimpleData = function () {};
  globalThis.COUNTRY_CODES = [];
}

function loadSimplifiedFiles() {
  var ROOT = path.resolve(__dirname, "../..");
  var files = [
    "Style/simplified_countries.js",
    "Style/simplified_helpers.js",
    "Style/simplified_renderers.js",
    "Style/simplified.js",
  ];
  for (var _i = 0; _i < files.length; _i++) {
    var fp = path.resolve(ROOT, files[_i]);
    var src = fs.readFileSync(fp, "utf8");
    vm.runInThisContext(src, { filename: fp });
  }
}

function resetSimplifiedState() {
  simpleFile = null;
  simpleBuf = null;
  simpleType = null;
  simpleIsAI = false;
  simpleStep = 0;
  simpleSteps = [];
  simpleResults = {};
  simpleStepDone = false;
  simpleUserInfo = {
    name: "", email: "", phone: "", phoneCode: "", website: "",
    social: { tiktok: "", facebook: "", instagram: "", youtube: "" },
    isArtist: false,
    music: { spotify: "", appleMusic: "", youtubeMusic: "", soundcloud: "", bandcamp: "" },
  };
  _didKp = null;
  _didSig = null;
  _mockElements = {};
  if (globalThis.document && _mockGetElementById) {
    globalThis.document.getElementById = _mockGetElementById;
  }
}

function getMockEl(id) {
  return _mockElements[id] || makeEl(id);
}

module.exports = {
  setupSimplifiedGlobals,
  loadSimplifiedFiles,
  resetSimplifiedState,
  getMockEl,
  makeEl,
};
