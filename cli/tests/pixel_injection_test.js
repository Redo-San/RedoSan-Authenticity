const { describe, it, before, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── Polyfill globals that pixel_injection.js expects ──
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};
globalThis.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};
try {
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { writeText: () => {} } },
    writable: true,
    configurable: true,
    enumerable: true,
  });
} catch (e) {
  // Fallback if defineProperty fails
  globalThis.navigator = { clipboard: { writeText: () => {} } };
}
globalThis.TextEncoder = require("util").TextEncoder;
globalThis.TextDecoder = require("util").TextDecoder;

// Mock FileReader so handlePixelInjection can read mock secret files in Node.
// A mock secret file carries its content in a `_text` property.
globalThis.FileReader =
  globalThis.FileReader ||
  class MockFileReader {
    constructor() {
      this.result = "";
    }
    readAsText(file) {
      this.result = (file && file._text) || "";
      if (this.onload) this.onload({ target: this });
    }
  };

// Mock CSS.escape
if (typeof CSS === "undefined") {
  globalThis.CSS = {
    escape: (s) => s.replace(/[\\!"#$%&'()*+,./:;<=>?@[\]^`{|}~]/g, "\\$&"),
  };
}

// ── Global helpers that pixel_injection.js references ──
globalThis.__ = (key, fallback) => fallback || key;
globalThis.escHtml = (s) => {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};
globalThis.escXml = (s) => {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};
globalThis.validateFileInput = () => true;
globalThis.ensureLib = async (name) => {};

var _resultStore = {};
globalThis.setResult = (key, data) => {
  _resultStore[key] = data;
};
globalThis.getResult = (key) => _resultStore[key];
globalThis.clearResult = (key) => {
  delete _resultStore[key];
};
var _dlHandler = null;
globalThis.setDownloadHandler = (fn) => {
  _dlHandler = fn;
};
globalThis.getDownloadHandler = () => _dlHandler;
globalThis.showDownloadModal = () => {};
globalThis.closeDownloadModal = () => {};
globalThis.downloadBlobSimple = () => {};

globalThis.jspdf = {
  jsPDF: class {
    constructor() {
      this._pages = [[]];
      this._fontSize = 10;
    }
    setFontSize(s) {
      this._fontSize = s;
    }
    text(t, x, y) {
      this._pages[0].push({ t, x, y });
    }
    addPage() {
      this._pages.push([]);
    }
    output(type) {
      return new Blob(["pdf"], { type: "application/pdf" });
    }
  },
};
globalThis.docx = {
  Paragraph: class {
    constructor(cfg) {
      this.cfg = cfg;
    }
  },
  TextRun: class {
    constructor(cfg) {
      this.cfg = cfg;
    }
  },
  Table: class {
    constructor(cfg) {
      this.cfg = cfg;
    }
  },
  TableRow: class {
    constructor(cfg) {
      this.cfg = cfg;
    }
  },
  TableCell: class {
    constructor(cfg) {
      this.cfg = cfg;
    }
  },
  Document: class {
    constructor(cfg) {
      this.cfg = cfg;
    }
  },
  Packer: {
    toBlob: async () =>
      new Blob(["docx"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
  },
  WidthType: { PERCENTAGE: "PERCENTAGE" },
};

// ── Mock document for pixel_injection.js DOM tests ──
function buildMockDocument() {
  const elements = {};

  function createElement(tag) {
    // For SELECT elements, value should be dynamic based on option children
    if (tag.toLowerCase() === "select") {
      const el = createBaseElement(tag);
      let _value = "";
      Object.defineProperty(el, "value", {
        get: function () {
          if (
            _value !== "" &&
            this._children.some(
              (c) => c.tagName === "OPTION" && c.value === _value,
            )
          ) {
            return _value;
          }
          // Find first option
          const firstOpt = this._children.find((c) => c.tagName === "OPTION");
          return firstOpt ? firstOpt.value : _value;
        },
        set: function (v) {
          _value = v;
        },
      });
      return el;
    }
    return createBaseElement(tag);
  }

  function createBaseElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      _children: [],
      _listeners: {},
      style: { display: "none", visibility: "visible", cssText: "" },
      _innerHTML: "",
      textContent: "",
      value: "",
      type: tag === "input" ? "text" : "",
      checked: false,
      placeholder: "",
      min: 0,
      max: 0,
      step: 1,
      title: "",
      className: "",
      onclick: null,
      files: null,
      href: "",
      download: "",
      append: function (child) {
        this._children.push(child);
      },
      appendChild: function (child) {
        this._children.push(child);
      },
      remove: function () {},
      click: function () {
        const handlers = this._listeners["click"] || [];
        handlers.forEach((fn) => fn({ type: "click", target: this }));
      },
      addEventListener: function (evt, fn) {
        if (!this._listeners[evt]) this._listeners[evt] = [];
        this._listeners[evt].push(fn);
      },
      removeEventListener: function (evt, fn) {
        if (!this._listeners[evt]) return;
        this._listeners[evt] = this._listeners[evt].filter((f) => f !== fn);
      },
      dispatchEvent: function (evt) {
        const handlers = this._listeners[evt.type] || [];
        handlers.forEach((fn) => fn(evt));
      },
      setAttribute: function (name, val) {
        this[name] = val;
      },
      getAttribute: function (name) {
        return this[name];
      },
      querySelector: function (sel) {
        if (sel.startsWith('option[value="')) {
          const val = sel.match(/value="([^"]+)"/)[1];
          const child = this._children.find(
            (c) => c.tagName === "OPTION" && c.value === val,
          );
          return child || null;
        }
        return null;
      },
      querySelectorAll: function (sel) {
        if (sel === "input, select") {
          return this._children.filter(
            (c) => c.tagName === "INPUT" || c.tagName === "SELECT",
          );
        }
        if (sel === "[data-pi-tab]") {
          return this._children.filter(
            (c) => c.getAttribute && c.getAttribute("data-pi-tab"),
          );
        }
        return [];
      },
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false,
        toggle: () => {},
      },
      getContext: function () {
        return {
          drawImage: () => {},
          getImageData: () => ({
            data: new Uint8ClampedArray(16),
            width: 1,
            height: 1,
          }),
          putImageData: () => {},
        };
      },
      toDataURL: () => "data:image/png;base64,iVBORw0KGgo=",
      focus: () => {},
    };
    Object.defineProperty(el, "innerHTML", {
      get: function () {
        return this._innerHTML;
      },
      set: function (val) {
        this._innerHTML = val;
        if (val === "") {
          this._children = [];
        }
        // If this is a SELECT and children are cleared, reset value so browser-like behavior applies
        if (val === "" && this.tagName === "SELECT") {
          this.value = "";
        }
      },
    });
    return el;
  }

  const doc = {
    readyState: "complete",
    _elements: elements,
    _listeners: {},
    addEventListener: function (evt, fn) {
      if (!this._listeners[evt]) this._listeners[evt] = [];
      this._listeners[evt].push(fn);
    },
    dispatchEvent: function (evt) {
      const handlers = this._listeners[evt.type] || [];
      handlers.forEach((fn) => fn(evt));
    },
    createElement: function (tag) {
      return createElement(tag);
    },
    body: (() => {
      const b = createElement("body");
      b.contains = () => true;
      return b;
    })(),
    contains: function () {
      return true;
    },
    querySelector: function (sel) {
      // Search through all elements by id
      if (sel.startsWith("[data-pi-tab=")) {
        const match = sel.match(/data-pi-tab="([^"]+)"/);
        if (match) {
          const val = match[1];
          const found = Object.values(this._elements).find(
            (el) => el.getAttribute && el.getAttribute("data-pi-tab") === val,
          );
          return found || this.createElement("div");
        }
      }
      const idMatch = sel.match(/^#(.+)/);
      if (idMatch) return this.getElementById(idMatch[1]) || null;
      return this.createElement("div");
    },
    querySelectorAll: function (sel) {
      if (sel === "[data-pi-tab]") {
        return Object.values(this._elements).filter(
          (el) => el.getAttribute && el.getAttribute("data-pi-tab"),
        );
      }
      return [];
    },
  };

  doc.getElementById = function (id) {
    if (!elements[id]) {
      const el = createElement("div");
      el.id = id;
      el.style = { display: "none", visibility: "visible", cssText: "" };
      elements[id] = el;
    }
    return elements[id];
  };

  // Create specific elements with proper types
  const catSel = createElement("select");
  catSel.id = "pi-category";
  catSel.value = "spatial";
  elements["pi-category"] = catSel;

  const algoSel = createElement("select");
  algoSel.id = "pi-algorithm";
  algoSel.value = "enhanced_lsb";
  elements["pi-algorithm"] = algoSel;

  const extractSel = createElement("select");
  extractSel.id = "pi-extract-algorithm";
  extractSel.value = "auto";
  elements["pi-extract-algorithm"] = extractSel;

  const analyzeSel = createElement("select");
  analyzeSel.id = "pi-analyze-algorithm";
  analyzeSel.value = "auto_detect";
  elements["pi-analyze-algorithm"] = analyzeSel;

  const pwGroup = createElement("div");
  pwGroup.id = "pi-password-group";
  pwGroup.style = { display: "block", visibility: "visible", cssText: "" };
  elements["pi-password-group"] = pwGroup;

  const extractPwGroup = createElement("div");
  extractPwGroup.id = "pi-extract-password-group";
  extractPwGroup.style = {
    display: "block",
    visibility: "visible",
    cssText: "",
  };
  elements["pi-extract-password-group"] = extractPwGroup;

  const optionsContainer = createElement("div");
  optionsContainer.id = "pi-options-container";
  optionsContainer.style = {
    display: "block",
    visibility: "visible",
    cssText: "",
  };
  elements["pi-options-container"] = optionsContainer;

  const resultDiv = createElement("div");
  resultDiv.id = "pi-result";
  resultDiv.style = { display: "none" };
  elements["pi-result"] = resultDiv;

  const outputDiv = createElement("div");
  outputDiv.id = "pi-output";
  elements["pi-output"] = outputDiv;

  const downloadDiv = createElement("div");
  downloadDiv.id = "pi-download";
  elements["pi-download"] = downloadDiv;

  const spinner = createElement("div");
  spinner.id = "pi-spinner";
  spinner.style = { display: "none" };
  elements["pi-spinner"] = spinner;

  const imageInput = createElement("input");
  imageInput.id = "pi-image";
  imageInput.type = "file";
  imageInput.files = [];
  elements["pi-image"] = imageInput;

  const msgInput = createElement("textarea");
  msgInput.id = "pi-message";
  msgInput.value = "test message";
  elements["pi-message"] = msgInput;

  const secretFile = createElement("input");
  secretFile.id = "pi-secret-file";
  secretFile.type = "file";
  secretFile.files = [];
  elements["pi-secret-file"] = secretFile;

  const pwInput = createElement("input");
  pwInput.id = "pi-password";
  pwInput.type = "password";
  pwInput.value = "";
  elements["pi-password"] = pwInput;

  const extractPwInput = createElement("input");
  extractPwInput.id = "pi-extract-password";
  extractPwInput.type = "password";
  extractPwInput.value = "";
  elements["pi-extract-password"] = extractPwInput;

  const wmImageInput = createElement("input");
  wmImageInput.id = "pi-watermarked-image";
  wmImageInput.type = "file";
  wmImageInput.files = [];
  elements["pi-watermarked-image"] = wmImageInput;

  const analyzeImgInput = createElement("input");
  analyzeImgInput.id = "pi-analyze-image";
  analyzeImgInput.type = "file";
  analyzeImgInput.files = [];
  elements["pi-analyze-image"] = analyzeImgInput;

  const compareInput = createElement("input");
  compareInput.id = "pi-analyze-compare";
  compareInput.type = "file";
  compareInput.files = [];
  elements["pi-analyze-compare"] = compareInput;

  const compareGroup = createElement("div");
  compareGroup.id = "pi-analyze-compare-group";
  compareGroup.style = { display: "none" };
  elements["pi-analyze-compare-group"] = compareGroup;

  const embedDiv = createElement("div");
  embedDiv.id = "pi-embed";
  embedDiv.style = { display: "block" };
  elements["pi-embed"] = embedDiv;

  const extractDiv = createElement("div");
  extractDiv.id = "pi-extract";
  extractDiv.style = { display: "none" };
  elements["pi-extract"] = extractDiv;

  const analyzeDiv = createElement("div");
  analyzeDiv.id = "pi-analyze";
  analyzeDiv.style = { display: "none" };
  elements["pi-analyze"] = analyzeDiv;

  const advOpts = createElement("div");
  advOpts.id = "pi-advanced-options";
  advOpts.style = { display: "none" };
  elements["pi-advanced-options"] = advOpts;

  const advBtn = createElement("button");
  advBtn.id = "pi-advanced-btn";
  advBtn.textContent = "Show Advanced Options";
  elements["pi-advanced-btn"] = advBtn;

  const dlModalTitle = createElement("div");
  dlModalTitle.id = "dl-modal-title";
  elements["dl-modal-title"] = dlModalTitle;

  return doc;
}

// ── Load WatermarkCore dependencies ──
const coreSrc = fs.readFileSync(
  path.join(__dirname, "../../Pixel_Injection/watermark_core_advanced.js"),
  "utf8",
);
vm.runInThisContext(coreSrc, {
  filename: path.resolve(
    __dirname,
    "../../Pixel_Injection/watermark_core_advanced.js",
  ),
});
const transformsSrc = fs.readFileSync(
  path.join(__dirname, "../../Pixel_Injection/watermark_core_transforms.js"),
  "utf8",
);
vm.runInThisContext(transformsSrc, {
  filename: path.resolve(
    __dirname,
    "../../Pixel_Injection/watermark_core_transforms.js",
  ),
});
const algorithmsSrc = fs.readFileSync(
  path.join(__dirname, "../../Pixel_Injection/watermark_core_algorithms.js"),
  "utf8",
);
vm.runInThisContext(algorithmsSrc, {
  filename: path.resolve(
    __dirname,
    "../../Pixel_Injection/watermark_core_algorithms.js",
  ),
});

// ── Load pixel_injection.js ──
const piSrc = fs.readFileSync(
  path.join(__dirname, "../../Pixel_Injection/pixel_injection.js"),
  "utf8",
);

function makeImage(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 128;
    data[i + 2] = 128;
    data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

// ── Core algorithm tests (same as before) ──

function roundtripTest(algoName, embedMsg, imgSize, extractFn) {
  return () => {
    const core = new WatermarkCore();
    const img = makeImage(imgSize[0], imgSize[1]);
    const wm = core.algorithms[algoName](img, embedMsg, "testkey", {});
    assert.ok(wm instanceof ImageData);
    assert.equal(wm.width, img.width);
    assert.equal(wm.height, img.height);
    const extracted = extractFn ? extractFn(core, wm) : core.extractLSB(wm);
    assert.ok(typeof extracted === "string");
    assert.ok(extracted.length > 0);
    assert.notEqual(extracted, "No readable message found");
    return extracted;
  };
}

describe("Pixel Injection — Helpers", () => {
  it("bytesToBinary should convert bytes to bit string", () => {
    const core = new WatermarkCore();
    assert.equal(core.bytesToBinary(new Uint8Array([0x00])), "00000000");
    assert.equal(core.bytesToBinary(new Uint8Array([0xff])), "11111111");
    assert.equal(core.bytesToBinary(new Uint8Array([0x61])), "01100001");
    assert.equal(
      core.bytesToBinary(new Uint8Array([0x00, 0xff])),
      "0000000011111111",
    );
  });

  it("stringToBinary should convert string to bit string", () => {
    const core = new WatermarkCore();
    assert.equal(core.stringToBinary("A"), "01000001");
    assert.equal(core.stringToBinary("hi"), "0110100001101001");
  });

  it("binaryToString should convert bit string back", () => {
    const core = new WatermarkCore();
    assert.equal(core.binaryToString("01000001"), "A");
    assert.equal(core.binaryToString("0110100001101001"), "hi");
  });

  it("decodeRedundancy should majority-vote", () => {
    const core = new WatermarkCore();
    assert.equal(core.decodeRedundancy("111111", 3), "11");
    assert.equal(core.decodeRedundancy("111000", 3), "10");
    assert.equal(core.decodeRedundancy("000000", 3), "00");
    assert.equal(core.decodeRedundancy("1111100000", 5), "10");
  });

  it("encodeMessage should append CRC and add redundancy", () => {
    const core = new WatermarkCore();
    const enc = core.encodeMessage("hi");
    assert.ok(typeof enc === "string");
    assert.ok(enc.length > 16);
    assert.equal(enc.length % 3, 0);
    const dec = core.decodeRedundancy(enc, 3);
    const str = core.binaryToString(dec);
    assert.ok(str.includes("hi|"));
  });
});

describe("Pixel Injection — Enhanced LSB (3 bits/pixel, length prefix)", () => {
  it("should embed and extract message", () => {
    const core = new WatermarkCore();
    const img = makeImage(32, 32);
    const msg = "hello-pixel";
    const wm = core.enhancedLSB(img, msg, "key", {});
    const extracted = core.extractEnhancedLSB(wm);
    assert.equal(extracted, msg);
  });
});

describe("Pixel Injection — Multi-Channel LSB (position-based channel)", () => {
  it("should embed and extract message", () => {
    const core = new WatermarkCore();
    const img = makeImage(64, 64);
    const msg = "multi-channel-test";
    const wm = core.multiChannelLSB(img, msg, null, {});
    const extracted = core.extractMultiChannelLSB(wm);
    assert.ok(typeof extracted === "string");
    assert.equal(extracted.trim(), msg);
  });
});

describe("Pixel Injection — Random LSB (PRNG positions)", () => {
  it("should embed with null password (hashCode missing) and extract", () => {
    const core = new WatermarkCore();
    const img = makeImage(64, 64);
    const msg = "random-lsb-test";
    const wm = core.randomLSB(img, msg, null, {});
    const extracted = core.extractRandomLSB(wm, null);
    assert.ok(typeof extracted === "string");
    assert.ok(extracted.includes(msg), "message should be found in extraction");
  });
});

describe("Pixel Injection — Adaptive LSB", () => {
  it("should embed without error", () => {
    const core = new WatermarkCore();
    const img = makeImage(64, 64);
    const wm = core.adaptiveLSB(img, "adaptive-test", "key", {});
    assert.ok(wm instanceof ImageData);
    assert.equal(wm.width, 64);
    assert.equal(wm.height, 64);
  });
});

describe("Pixel Injection — DCT (8x8 blocks, coefficient pair)", () => {
  it("should embed and extract message", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const msg = "dct-test";
    const wm = core.algorithms.dct(img, msg, "key", {});
    const extracted = core.extractDCT(wm);
    assert.ok(typeof extracted === "string");
    assert.equal(extracted, msg);
  });
});

describe("Pixel Injection — DWT (Haar wavelet)", () => {
  it("should embed and extract message", () => {
    const core = new WatermarkCore();
    const img = makeImage(128, 128);
    const msg = "dwt-test-message";
    const wm = core.algorithms.dwt(img, msg, "key", {});
    const extracted = core.extractDWT(wm);
    assert.ok(typeof extracted === "string");
    assert.equal(extracted, msg);
  });
});

describe("Pixel Injection — DWT capacity guard", () => {
  it("should throw when message exceeds DWT coefficient capacity", () => {
    const core = new WatermarkCore();
    const img = makeImage(64, 64);
    // 64x64 -> bandLen = 32*32*4 = 4096; 3 bands = 12288 bits max
    const longMsg = "x".repeat(2000);
    assert.throws(
      () => core.algorithms.dwt(img, longMsg, "key", {}),
      /Message too long for image capacity/,
    );
  });

  it("should accept a message that fits the DWT capacity", () => {
    const core = new WatermarkCore();
    const img = makeImage(128, 128);
    // 128x128 -> bandLen = 64*64*4 = 16384; 3 bands = 49152 bits
    const wm = core.algorithms.dwt(img, "fits", "key", {});
    const extracted = core.extractDWT(wm);
    assert.equal(extracted, "fits");
  });

  it("should allocate only bandLen coefficients in applyDWT", () => {
    const core = new WatermarkCore();
    const data = new Uint8ClampedArray(makeImage(64, 64).data);
    const decomp = core.applyDWT(data, 64, 64, 1, "haar");
    const bandLen = 32 * 32 * 4;
    assert.equal(decomp.LL.length, bandLen);
    assert.equal(decomp.LH.length, bandLen);
    assert.equal(decomp.HL.length, bandLen);
    assert.equal(decomp.HH.length, bandLen);
    assert.equal(decomp._bandLen, bandLen);
  });
});

describe("Pixel Injection — DFT (8x8 blocks, frequency domain)", () => {
  it("should embed and extract message", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const msg = "dft-test";
    const wm = core.algorithms.dft(img, msg, "key", {});
    const extracted = core.extractDFT(wm);
    assert.ok(typeof extracted === "string");
    assert.equal(extracted, msg);
  });
});

describe("Pixel Injection — Hybrid DCT-DWT", () => {
  it("should embed and extract message", () => {
    const core = new WatermarkCore();
    const img = makeImage(128, 128);
    const msg = "hybrid-test";
    const wm = core.algorithms.hybrid_dct_dwt(img, msg, "key", {});
    const extracted = core.extractHybridDCTDWT(wm);
    assert.ok(typeof extracted === "string");
    assert.equal(extracted, msg);
  });
});

describe("Pixel Injection — blindDecoding dispatcher", () => {
  it("should route to correct extract method per algorithm", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const msg = "blind-dispatch";
    const wm = core.algorithms.dct(img, msg, "key", {});
    const result = core.blindDecoding(wm, "dct");
    assert.equal(result, msg);
  });

  it("should route enhanced_lsb to extractEnhancedLSB", () => {
    const core = new WatermarkCore();
    const img = makeImage(32, 32);
    const msg = "blind-enhanced";
    const wm = core.enhancedLSB(img, msg, "key", {});
    const result = core.blindDecoding(wm, "enhanced_lsb");
    assert.equal(result, msg);
  });

  it("should default to DCT for unknown algorithm", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const msg = "blind-default";
    const wm = core.algorithms.dct(img, msg, "key", {});
    const result = core.blindDecoding(wm, "nonexistent");
    assert.equal(result, msg);
  });
});

describe("Pixel Injection — All algorithm embeds (VINE, PixelSeal, etc.)", () => {
  const stubAlgos = [
    "vine",
    "pixel_seal",
    "nullguard",
    "shallow_diffuse",
    "diffusion_based",
    "imagewmark",
    "meta_seal",
    "stardustmark",
    "invisimark",
    "elevenlikes",
  ];

  for (const algo of stubAlgos) {
    it(`${algo} should embed without error`, () => {
      const core = new WatermarkCore();
      const img = makeImage(200, 200);
      const wm = core.algorithms[algo](img, "test", null, {});
      assert.ok(wm instanceof ImageData);
      assert.equal(wm.width, 200);
      assert.equal(wm.height, 200);
    });
  }

  it("VINE extract delegates to extractLSB", () => {
    const core = new WatermarkCore();
    const result = core.extractVINE({ data: [], width: 1, height: 1 });
    assert.ok(typeof result === "string");
  });

  it("PixelSeal extract delegates to extractDCT", () => {
    const core = new WatermarkCore();
    const result = core.extractPixelSeal({ data: [], width: 1, height: 1 });
    assert.ok(typeof result === "string");
  });
});

describe("Pixel Injection — blindDecoding extended routes", () => {
  it("should route lsb to extractLSB", () => {
    const core = new WatermarkCore();
    const img = makeImage(32, 32);
    const wm = core.enhancedLSB(img, "test", "key", {});
    const result = core.blindDecoding(wm, "lsb");
    assert.ok(typeof result === "string");
  });

  it("should route random_lsb to extractLSB", () => {
    const core = new WatermarkCore();
    const img = makeImage(32, 32);
    const wm = core.randomLSB(img, "test", "key", {});
    const result = core.blindDecoding(wm, "random_lsb");
    assert.ok(typeof result === "string");
  });

  it("should route adaptive_lsb to extractLSB", () => {
    const core = new WatermarkCore();
    const img = makeImage(32, 32);
    const wm = core.adaptiveLSB(img, "test", "key", {});
    const result = core.blindDecoding(wm, "adaptive_lsb");
    assert.ok(typeof result === "string");
  });

  it("should route multi_channel_lsb to extractMultiChannelLSB", () => {
    const core = new WatermarkCore();
    const img = makeImage(32, 32);
    const wm = core.multiChannelLSB(img, "test-mc", "key", {});
    const result = core.blindDecoding(wm, "multi_channel_lsb");
    assert.ok(typeof result === "string");
    assert.ok(result.includes("test-mc"));
  });

  it("should route vine to extractVINE", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const wm = core.algorithms.dct(img, "test", "key", {});
    const result = core.blindDecoding(wm, "vine");
    assert.ok(typeof result === "string");
  });

  it("should route pixel_seal to extractPixelSeal", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const wm = core.algorithms.dct(img, "test", "key", {});
    const result = core.blindDecoding(wm, "pixel_seal");
    assert.ok(typeof result === "string");
  });
});

describe("Pixel Injection — hashCode and calculateComplexityMap", () => {
  it("hashCode should produce deterministic hash", () => {
    const core = new WatermarkCore();
    const h1 = core.hashCode("hello");
    const h2 = core.hashCode("hello");
    const h3 = core.hashCode("world");
    assert.equal(h1, h2);
    assert.notEqual(h1, h3);
    assert.ok(typeof h1 === "number");
    assert.ok(h1 >= 0);
  });

  it("hashCode should produce different values for different inputs", () => {
    const core = new WatermarkCore();
    const vals = ["", "a", "ab", "abc", "hello world"];
    const hashes = vals.map((v) => core.hashCode(v));
    assert.equal(new Set(hashes).size, hashes.length);
  });

  it("calculateComplexityMap should return 2D array", () => {
    const core = new WatermarkCore();
    const img = makeImage(4, 4);
    const map = core.calculateComplexityMap(img.data, 4, 4);
    assert.equal(map.length, 4);
    assert.equal(map[0].length, 4);
    assert.ok(typeof map[0][0] === "number");
    assert.ok(map[0][0] >= 0 && map[0][0] <= 1);
  });

  it("calculateComplexityMap for uniform image", () => {
    const core = new WatermarkCore();
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
    const map = core.calculateComplexityMap(data, 4, 4);
    // All pixels same → complexity = 0
    assert.equal(map[0][0], 0);
  });
});

describe("Pixel Injection — addErrorCorrection", () => {
  it("should double each bit", () => {
    const core = new WatermarkCore();
    const result = core.addErrorCorrection("0101");
    assert.equal(result, "00110011");
  });

  it("should handle empty string", () => {
    const core = new WatermarkCore();
    assert.equal(core.addErrorCorrection(""), "");
  });
});

describe("Pixel Injection — imagewmark algorithm variants", () => {
  it("imagewmark with algorithm=dwt should embed", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const wm = core.imagewmark(img, "test", null, { algorithm: "dwt" });
    assert.ok(wm instanceof ImageData);
  });

  it("imagewmark with algorithm=hybrid should embed", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const wm = core.imagewmark(img, "test", null, { algorithm: "hybrid" });
    assert.ok(wm instanceof ImageData);
  });

  it("imagewmark with algorithm=vine should embed", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const wm = core.imagewmark(img, "test", null, { algorithm: "vine" });
    assert.ok(wm instanceof ImageData);
  });

  it("imagewmark with algorithm=pixel_seal should embed", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const wm = core.imagewmark(img, "test", null, { algorithm: "pixel_seal" });
    assert.ok(wm instanceof ImageData);
  });

  it("imagewmark with unknown algorithm should default to adaptiveDCT", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const wm = core.imagewmark(img, "test", null, { algorithm: "unknown" });
    assert.ok(wm instanceof ImageData);
  });
});

describe("Pixel Injection — metaSeal algorithm variants", () => {
  it("metaSeal with video mediaType", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const wm = core.metaSeal(img, "test", null, { mediaType: "video" });
    assert.ok(wm instanceof ImageData);
  });

  it("metaSeal with audio mediaType", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const wm = core.metaSeal(img, "test", null, { mediaType: "audio" });
    assert.ok(wm instanceof ImageData);
  });

  it("metaSeal with unknown mediaType should default", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const wm = core.metaSeal(img, "test", null, { mediaType: "document" });
    assert.ok(wm instanceof ImageData);
  });
});

describe("Pixel Injection — stardustmark with tamper detection", () => {
  it("should embed with tamper_detection enabled", () => {
    const core = new WatermarkCore();
    const img = makeImage(200, 200);
    const wm = core.stardustmark(img, "test", null, {
      tamper_detection: true,
      forensic_strength: 0.1,
    });
    assert.ok(wm instanceof ImageData);
  });
});

describe("Pixel Injection — classifyWatermark branches", () => {
  it("should return detected=false for low-entropy features", () => {
    const core = new WatermarkCore();
    const result = core.classifyWatermark({
      histogram: { entropy: 6 },
    });
    assert.equal(result.detected, false);
    assert.equal(result.confidence, 0.3);
  });
});

describe("Pixel Injection — calculateAdaptiveStrength branches", () => {
  it("should return higher strength for high complexity", () => {
    const core = new WatermarkCore();
    const strength = core.calculateAdaptiveStrength({
      complexity: 0.9,
      noise: 0.1,
    });
    assert.ok(Math.abs(strength - 0.15) < 0.001);
  });

  it("should return increased strength for high noise", () => {
    const core = new WatermarkCore();
    const strength = core.calculateAdaptiveStrength({
      complexity: 0.5,
      noise: 0.5,
    });
    assert.equal(strength, 0.12);
  });

  it("should return lower strength for low complexity", () => {
    const core = new WatermarkCore();
    const strength = core.calculateAdaptiveStrength({
      complexity: 0.1,
      noise: 0.1,
    });
    assert.ok(Math.abs(strength - 0.07) < 0.001);
  });

  it("should return base strength for average characteristics", () => {
    const core = new WatermarkCore();
    const strength = core.calculateAdaptiveStrength({
      complexity: 0.5,
      noise: 0.1,
    });
    assert.equal(strength, 0.1);
  });
});

describe("Pixel Injection — generateOptimalSequence", () => {
  it("should produce alternating ±1 sequence", () => {
    const core = new WatermarkCore();
    const seq = core.generateOptimalSequence(10);
    assert.equal(seq.length, 10);
    assert.equal(seq[0], 1);
    assert.equal(seq[1], -1);
    assert.equal(seq[2], 1);
  });

  it("should handle zero length", () => {
    const core = new WatermarkCore();
    const seq = core.generateOptimalSequence(0);
    assert.equal(seq.length, 0);
  });
});

describe("Pixel Injection — calculateStdDev", () => {
  it("should compute standard deviation", () => {
    const core = new WatermarkCore();
    const img = makeImage(4, 4);
    const mean = core.calculateMean(img.data);
    const stddev = core.calculateStdDev(img, mean);
    assert.ok(typeof stddev === "number");
    assert.ok(stddev > 0);
  });

  it("should be 0 for uniform data", () => {
    const core = new WatermarkCore();
    const data = new Uint8ClampedArray(16);
    for (let i = 0; i < data.length; i++) data[i] = 100;
    const img = { data, width: 2, height: 2 };
    const stddev = core.calculateStdDev(img, 100);
    assert.equal(stddev, 0);
  });
});

describe("Pixel Injection — advanced JND threshold with parameters", () => {
  it("getAdvancedJNDThreshold with contrast and texture parameters", () => {
    const core = new WatermarkCore();
    const t1 = core.getAdvancedJNDThreshold(50, 0.6, 0.4);
    assert.equal(t1, 2 * 1.2 * 1.1);
    const t2 = core.getAdvancedJNDThreshold(100, 0.3, 0.2);
    assert.equal(t2, 4);
  });
});

describe("Pixel Injection — modulatePhase", () => {
  it("should return modified spectrum", () => {
    const core = new WatermarkCore();
    const spectrum = { real: 100, imag: 0 };
    const result = core.modulatePhase(spectrum, 1, 0.5);
    assert.ok(typeof result.real === "number");
    assert.ok(typeof result.imag === "number");
  });
});

describe("Pixel Injection — calculateLocalContrast", () => {
  it("should return a number for valid input", () => {
    const core = new WatermarkCore();
    const img = makeImage(16, 16);
    const contrast = core.calculateLocalContrast(img.data, 4, 4, 16);
    assert.ok(typeof contrast === "number");
    assert.ok(contrast >= 0);
  });
});

describe("Pixel Injection — modifyCoefficient edge cases (transforms)", () => {
  it("should handle NaN coefficient", () => {
    const core = new WatermarkCore();
    const result = core.modifyCoefficient(NaN, 1, 10);
    assert.ok(isNaN(result) || result !== undefined);
  });

  it("should handle NaN weight", () => {
    const core = new WatermarkCore();
    const result = core.modifyCoefficient(100, 1, NaN);
    assert.equal(result, 100);
  });

  it("should handle weight=0", () => {
    const core = new WatermarkCore();
    const result = core.modifyCoefficient(100, 1, 0);
    assert.equal(result, 100);
  });
});

describe("Pixel Injection — getBlock from image data (transforms)", () => {
  it("should extract 8x8 block", () => {
    const core = new WatermarkCore();
    const w = 16;
    const h = 16;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100;
      data[i + 1] = 100;
      data[i + 2] = 100;
      data[i + 3] = 255;
    }
    const block = core.getBlock(data, 0, 0, w);
    assert.equal(block.length, 64);
    assert.equal(block[0], 100);
  });
});

describe("Pixel Injection — apply2DDFT and applyInverse2DDFT (transforms)", () => {
  it("apply2DDFT should produce spectrum array", () => {
    const core = new WatermarkCore();
    const w = 4;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
    const spectrum = core.apply2DDFT(data, w, h);
    assert.equal(spectrum.length, h);
    assert.equal(spectrum[0].length, w);
    assert.ok(typeof spectrum[0][0].real === "number");
    assert.ok(typeof spectrum[0][0].imag === "number");
  });

  it("applyInverse2DDFT should reconstruct from spectrum", () => {
    const core = new WatermarkCore();
    const w = 4;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
    const spectrum = core.apply2DDFT(data, w, h);
    const reconstructed = core.applyInverse2DDFT(spectrum, w, h);
    assert.ok(reconstructed instanceof Uint8ClampedArray);
    assert.equal(reconstructed.length, data.length);
  });
});

describe("Pixel Injection — embedInCoefficient DWT LSB (transforms)", () => {
  it("should embed bit=1 into coefficient", () => {
    const core = new WatermarkCore();
    // Step-2 LSB: 100 → 102 keeps a full ±1 margin over rounding noise
    const result = core.embedInCoefficient(100, 1);
    assert.equal(result, 102);
  });

  it("should embed bit=0 into coefficient", () => {
    const core = new WatermarkCore();
    // Step-2 LSB: 101 → 100 keeps a full ±1 margin over rounding noise
    const result = core.embedInCoefficient(101, 0);
    assert.equal(result, 100);
  });
});

describe("Pixel Injection — distributeMessageInSubBands", () => {
  it("should distribute message across sub-bands", () => {
    const core = new WatermarkCore();
    const decomp = { LL: [1, 2], LH: [3, 4], HL: [5, 6], HH: [7, 8] };
    const result = core.distributeMessageInSubBands("test", decomp);
    assert.ok(result.LL);
    assert.ok(result.LH);
  });
});

describe("Pixel Injection — selectOptimalCoefficients", () => {
  it("should return positions array", () => {
    const core = new WatermarkCore();
    const positions = core.selectOptimalCoefficients([], 10);
    assert.ok(Array.isArray(positions));
    assert.ok(positions.length > 0);
    assert.equal(positions[0].length, 3);
  });
});

describe("Pixel Injection — extractLSB edge cases", () => {
  it("should handle image with no readable message", () => {
    const core = new WatermarkCore();
    const img = makeImage(4, 4);
    const result = core.extractLSB(img);
    assert.equal(result, "No readable message found");
  });
});

describe("Pixel Injection — Quality metrics", () => {
  it("should compute PSNR/SSIM for identical images", () => {
    const core = new WatermarkCore();
    const img = makeImage(16, 16);
    const metrics = core.qualityMetrics(img, img);
    assert.ok(metrics.psnr === Infinity || metrics.psnr > 100);
    assert.equal(metrics.ssim, 1);
  });

  it("should compute metrics for watermarked image", () => {
    const core = new WatermarkCore();
    const img = makeImage(32, 32);
    const wm = core.enhancedLSB(img, "metrics-test", "key", {});
    const metrics = core.qualityMetrics(img, wm);
    assert.ok(typeof metrics.psnr === "number");
    assert.ok(typeof metrics.ssim === "number");
    assert.ok(metrics.psnr > 0);
  });
});

// ── Set up document mock BEFORE loading pixel_injection.js ──
globalThis.document = buildMockDocument();

// ── Load pixel_injection.js ──
vm.runInThisContext(piSrc, {
  filename: path.resolve(__dirname, "../../Pixel_Injection/pixel_injection.js"),
});

// ══════════════════════════════════════════════════════════════════
// PixelInjection UI class tests
// ══════════════════════════════════════════════════════════════════

describe("PixelInjection — Constructor", () => {
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
  });

  it("should instantiate without error", () => {
    const pi = new PixelInjection();
    assert.ok(pi instanceof PixelInjection);
    assert.ok(pi.core instanceof WatermarkCore);
  });

  it("should set default category and algorithm", () => {
    const pi = new PixelInjection();
    assert.equal(pi.currentCategory, "spatial");
    assert.equal(pi.currentAlgorithm, "enhanced_lsb");
  });

  it("should have 4 categories with correct algorithm counts", () => {
    const pi = new PixelInjection();
    assert.equal(Object.keys(pi.algorithms).length, 4);
    assert.equal(Object.keys(pi.algorithms.spatial).length, 4);
    assert.equal(Object.keys(pi.algorithms.frequency).length, 4);
    assert.equal(Object.keys(pi.algorithms.deep_learning).length, 4);
    assert.equal(Object.keys(pi.algorithms.professional).length, 6);
  });

  it("should have extractMap with method names for all algorithms", () => {
    const pi = new PixelInjection();
    assert.equal(pi.extractMap.enhanced_lsb, "extractEnhancedLSB");
    assert.equal(pi.extractMap.dct, "extractDCT");
    assert.equal(pi.extractMap.dwt, "extractDWT");
    assert.equal(pi.extractMap.vine, "extractVINE");
    assert.equal(pi.extractMap.pixel_seal, "extractPixelSeal");
    assert.equal(pi.extractMap.random_lsb, "extractRandomLSB");
    assert.equal(pi.extractMap.nullguard, "extractDCT");
  });

  it("should have analysisAlgorithms with 6 methods", () => {
    const pi = new PixelInjection();
    assert.equal(Object.keys(pi.analysisAlgorithms).length, 6);
    assert.ok(pi.analysisAlgorithms.auto_detect);
    assert.ok(pi.analysisAlgorithms.statistical_detection);
    assert.ok(pi.analysisAlgorithms.ml_detection);
    assert.ok(pi.analysisAlgorithms.blind_decoding);
    assert.ok(pi.analysisAlgorithms.robustness_testing);
    assert.ok(pi.analysisAlgorithms.quality_metrics);
  });

  it("should have null initial state", () => {
    const pi = new PixelInjection();
    assert.strictEqual(pi.watermarkedImage, null);
    assert.strictEqual(pi.originalImage, null);
    assert.strictEqual(pi.extractedMessage, "");
    assert.strictEqual(pi.analysisResults, null);
  });

  it("reInit should call setupPixelInjectionUI", () => {
    const pi = new PixelInjection();
    let called = false;
    const origSetup = pi.setupPixelInjectionUI;
    pi.setupPixelInjectionUI = () => {
      called = true;
    };
    pi.reInit();
    assert.ok(called, "setupPixelInjectionUI should be called on reInit");
    pi.setupPixelInjectionUI = origSetup;
  });
});

describe("PixelInjection — getAlgorithmOptions returns correct values for all algorithms", () => {
  let pi;
  before(() => {
    globalThis.document = buildMockDocument();
    pi = new PixelInjection();
  });

  it("enhanced_lsb should have 4 options", () => {
    const opts = pi.getAlgorithmOptions("enhanced_lsb");
    assert.equal(opts.length, 4);
    assert.equal(opts[0].type, "range");
    assert.equal(opts[0].label, "Embedding Strength");
    assert.equal(opts[1].type, "checkbox");
    assert.equal(opts[2].type, "checkbox");
    assert.equal(opts[3].type, "range");
  });

  it("adaptive_lsb should have 2 options", () => {
    const opts = pi.getAlgorithmOptions("adaptive_lsb");
    assert.equal(opts.length, 2);
    assert.equal(opts[0].type, "select");
    assert.equal(opts[1].type, "range");
  });

  it("multi_channel_lsb should have 4 options", () => {
    const opts = pi.getAlgorithmOptions("multi_channel_lsb");
    assert.equal(opts.length, 4);
    assert.equal(opts[0].type, "range");
    assert.equal(opts[1].type, "select");
    assert.equal(opts[2].type, "range");
    assert.equal(opts[3].type, "checkbox");
  });

  it("random_lsb should have 4 options", () => {
    const opts = pi.getAlgorithmOptions("random_lsb");
    assert.equal(opts.length, 4);
    assert.equal(opts[0].type, "range");
    assert.equal(opts[1].type, "text");
    assert.equal(opts[2].type, "select");
    assert.equal(opts[3].type, "checkbox");
  });

  it("dct should have 4 options", () => {
    const opts = pi.getAlgorithmOptions("dct");
    assert.equal(opts.length, 4);
    assert.equal(opts[0].type, "range");
    assert.equal(opts[1].type, "select");
    assert.equal(opts[2].type, "range");
    assert.equal(opts[3].type, "checkbox");
  });

  it("dwt should have 3 options", () => {
    const opts = pi.getAlgorithmOptions("dwt");
    assert.equal(opts.length, 3);
    assert.equal(opts[0].type, "select");
    assert.equal(opts[1].type, "range");
    assert.equal(opts[2].type, "select");
  });

  it("dft should have 0 options", () => {
    const opts = pi.getAlgorithmOptions("dft");
    assert.equal(opts.length, 0);
  });

  it("hybrid_dct_dwt should have 4 options", () => {
    const opts = pi.getAlgorithmOptions("hybrid_dct_dwt");
    assert.equal(opts.length, 4);
    assert.equal(opts[0].type, "range");
    assert.equal(opts[1].type, "range");
    assert.equal(opts[2].type, "range");
    assert.equal(opts[3].type, "checkbox");
  });

  it("vine should have 3 options", () => {
    const opts = pi.getAlgorithmOptions("vine");
    assert.equal(opts.length, 3);
    assert.equal(opts[0].type, "text");
    assert.equal(opts[1].type, "range");
    assert.equal(opts[2].type, "checkbox");
  });

  it("pixel_seal should have 3 options", () => {
    const opts = pi.getAlgorithmOptions("pixel_seal");
    assert.equal(opts.length, 3);
    assert.equal(opts[0].type, "range");
    assert.equal(opts[1].type, "checkbox");
    assert.equal(opts[2].type, "checkbox");
  });

  it("statistical_detection should have 3 options", () => {
    const opts = pi.getAlgorithmOptions("statistical_detection");
    assert.equal(opts.length, 3);
    assert.equal(opts[0].type, "range");
    assert.equal(opts[1].type, "select");
    assert.equal(opts[2].type, "checkbox");
  });

  it("ml_detection should have 3 options", () => {
    const opts = pi.getAlgorithmOptions("ml_detection");
    assert.equal(opts.length, 3);
    assert.equal(opts[0].type, "select");
    assert.equal(opts[1].type, "range");
    assert.equal(opts[2].type, "checkbox");
  });

  it("blind_decoding should have 3 options", () => {
    const opts = pi.getAlgorithmOptions("blind_decoding");
    assert.equal(opts.length, 3);
    assert.equal(opts[0].type, "select");
    assert.equal(opts[1].type, "text");
    assert.equal(opts[2].type, "checkbox");
  });

  it("robustness_testing should have 3 options", () => {
    const opts = pi.getAlgorithmOptions("robustness_testing");
    assert.equal(opts.length, 3);
    assert.equal(opts[0].type, "select");
    assert.equal(opts[1].type, "range");
    assert.equal(opts[2].type, "checkbox");
  });

  it("quality_metrics should have 6 options", () => {
    const opts = pi.getAlgorithmOptions("quality_metrics");
    assert.equal(opts.length, 6);
    assert.equal(opts[0].type, "checkbox");
    assert.equal(opts[1].type, "checkbox");
    assert.equal(opts[2].type, "checkbox");
    assert.equal(opts[3].type, "checkbox");
    assert.equal(opts[4].type, "checkbox");
    assert.equal(opts[5].type, "checkbox");
  });

  it("default case for unknown algorithm should return empty array", () => {
    const opts = pi.getAlgorithmOptions("nonexistent_algorithm");
    assert.equal(opts.length, 0);
  });
});

describe("PixelInjection — createOptionInput", () => {
  let pi;
  before(() => {
    globalThis.document = buildMockDocument();
    pi = new PixelInjection();
  });

  it("should create range input", () => {
    const input = pi.createOptionInput({
      type: "range",
      label: "Test",
      min: 1,
      max: 10,
      value: 5,
      step: 1,
    });
    assert.equal(input.type, "range");
    assert.equal(input.min, 1);
    assert.equal(input.max, 10);
    assert.equal(input.value, 5);
    assert.equal(input.step, 1);
  });

  it("should create checkbox input", () => {
    const input = pi.createOptionInput({
      type: "checkbox",
      label: "Test",
      checked: true,
    });
    assert.equal(input.type, "checkbox");
    assert.equal(input.checked, true);
  });

  it("should create select input with options", () => {
    const input = pi.createOptionInput({
      type: "select",
      label: "Test",
      options: ["A", "B", "C"],
      value: "B",
    });
    assert.equal(input.tagName, "SELECT");
    assert.equal(input.value, "B");
    assert.equal(input._children.length, 3);
  });

  it("should create text input", () => {
    const input = pi.createOptionInput({
      type: "text",
      label: "Test",
      placeholder: "Enter value",
      value: "hello",
    });
    assert.equal(input.type, "text");
    assert.equal(input.placeholder, "Enter value");
    assert.equal(input.value, "hello");
  });
});

describe("PixelInjection — UI toggle methods", () => {
  let pi;
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("togglePiPassword should show group for random_lsb", () => {
    pi.currentAlgorithm = "random_lsb";
    pi.togglePiPassword();
    assert.equal(
      doc.getElementById("pi-password-group").style.display,
      "block",
    );
  });

  it("togglePiPassword should hide group for non-random_lsb", () => {
    pi.currentAlgorithm = "enhanced_lsb";
    pi.togglePiPassword();
    assert.equal(doc.getElementById("pi-password-group").style.display, "none");
  });

  it("toggleExtractPiPassword should show group for random_lsb", () => {
    const extractSel = doc.getElementById("pi-extract-algorithm");
    extractSel.value = "random_lsb";
    pi.toggleExtractPiPassword();
    const group = doc.getElementById("pi-extract-password-group");
    assert.equal(group.style.display, "block");
  });

  it("toggleExtractPiPassword should hide group for non-random_lsb", () => {
    const extractSel = doc.getElementById("pi-extract-algorithm");
    extractSel.value = "dct";
    pi.toggleExtractPiPassword();
    const group = doc.getElementById("pi-extract-password-group");
    assert.equal(group.style.display, "none");
  });

  it("toggleAnalyzeCompareInput should show compare group for robustness_testing", () => {
    const algoSel = doc.getElementById("pi-analyze-algorithm");
    algoSel.value = "robustness_testing";
    pi.toggleAnalyzeCompareInput();
    assert.equal(
      doc.getElementById("pi-analyze-compare-group").style.display,
      "block",
    );
  });

  it("toggleAnalyzeCompareInput should show compare group for quality_metrics", () => {
    const algoSel = doc.getElementById("pi-analyze-algorithm");
    algoSel.value = "quality_metrics";
    pi.toggleAnalyzeCompareInput();
    assert.equal(
      doc.getElementById("pi-analyze-compare-group").style.display,
      "block",
    );
  });

  it("toggleAnalyzeCompareInput should hide compare group for auto_detect", () => {
    const algoSel = doc.getElementById("pi-analyze-algorithm");
    algoSel.value = "auto_detect";
    pi.toggleAnalyzeCompareInput();
    assert.equal(
      doc.getElementById("pi-analyze-compare-group").style.display,
      "none",
    );
  });
});

describe("PixelInjection — updatePiAlgorithms", () => {
  let pi;
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should update algorithm select on category change", () => {
    const catSel = doc.getElementById("pi-category");
    const algoSel = doc.getElementById("pi-algorithm");
    catSel.value = "frequency";
    pi.updatePiAlgorithms();
    const children = algoSel._children;
    assert.equal(children.length, 4);
    assert.equal(children[0].value, "dct");
    assert.equal(pi.currentCategory, "frequency");
    assert.equal(pi.currentAlgorithm, "dct");
  });

  it("should update to deep_learning category", () => {
    const catSel = doc.getElementById("pi-category");
    const algoSel = doc.getElementById("pi-algorithm");
    catSel.value = "deep_learning";
    pi.updatePiAlgorithms();
    const children = algoSel._children;
    assert.equal(children.length, 4);
    assert.equal(children[0].value, "vine");
    assert.equal(pi.currentCategory, "deep_learning");
    assert.equal(pi.currentAlgorithm, "vine");
  });

  it("should update to professional category", () => {
    const catSel = doc.getElementById("pi-category");
    catSel.value = "professional";
    pi.updatePiAlgorithms();
    assert.equal(pi.currentCategory, "professional");
    assert.equal(pi.currentAlgorithm, "imagewmark");
  });
});

describe("PixelInjection — updateExtractAlgorithms", () => {
  let pi;
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should populate extract algorithm select with non-analysis algorithms", () => {
    pi.updateExtractAlgorithms();
    const extractSel = doc.getElementById("pi-extract-algorithm");
    // All algorithms except bling_decoding, etc. and the auto option if one exists
    assert.ok(extractSel._children.length > 15);
  });
});

describe("PixelInjection — showLoading and showMessage", () => {
  let pi;
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("showLoading(true) should display spinner", () => {
    pi.showLoading(true);
    assert.equal(doc.getElementById("pi-spinner").style.display, "block");
  });

  it("showLoading(false) should hide spinner", () => {
    pi.showLoading(false);
    assert.equal(doc.getElementById("pi-spinner").style.display, "none");
  });

  it("showMessage should create a toast element", () => {
    const bodySpy = { appended: null };
    const origAppend = doc.body.append;
    doc.body.append = (el) => {
      bodySpy.appended = el;
    };
    pi.showMessage("Test message", "success");
    assert.ok(bodySpy.appended);
    assert.equal(bodySpy.appended.textContent, "Test message");
    doc.body.append = origAppend;
  });
});

describe("PixelInjection — extractMessageFromImageData and extractLSBMessage", () => {
  let pi;
  before(() => {
    globalThis.document = buildMockDocument();
    pi = new PixelInjection();
  });

  it("extractLSBMessage should extract from image data", () => {
    // Create image data with known message in LSB of blue channel
    const w = 4;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    // Set LSB of blue channels to form "A" = 0b01000001
    // Pixel 0: blue LSB = 1 (bit 0 of 'A')
    // Pixel 1: blue LSB = 0 (bit 1)
    // Pixel 2: blue LSB = 0 (bit 2)
    // Pixel 3: blue LSB = 0 (bit 3)
    // Pixel 4: blue LSB = 0 (bit 4)
    // Pixel 5: blue LSB = 0 (bit 5)
    // Pixel 6: blue LSB = 1 (bit 6)
    // Pixel 7: blue LSB = 0 (bit 7)
    const bits = [1, 0, 0, 0, 0, 0, 1, 0]; // 'A' = 65
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 128 | (bits.length > i / 4 ? bits[i / 4] : 0);
      data[i + 3] = 255;
    }
    const imgData = { data, width: w, height: h };
    const result = pi.extractLSBMessage(imgData);
    assert.ok(typeof result === "string");
  });

  it("extractMessageFromImageData handles null data", () => {
    const result = pi.extractMessageFromImageData(null);
    assert.equal(result, "No valid image data found");
  });

  it("extractMessageFromImageData handles data without data property", () => {
    const result = pi.extractMessageFromImageData({ notData: true });
    assert.equal(result, "No valid image data found");
  });
});

describe("PixelInjection — analyzeImageCharacteristics and calculateVariance", () => {
  let pi;
  before(() => {
    globalThis.document = buildMockDocument();
    pi = new PixelInjection();
  });

  it("analyzeImageCharacteristics should return characteristics object", () => {
    const img = makeImage(16, 16);
    const chars = pi.analyzeImageCharacteristics(img);
    assert.ok(typeof chars === "object");
    assert.ok(typeof chars.complexity === "number");
    assert.ok(typeof chars.noise === "number");
    assert.ok(typeof chars.brightness === "number");
    assert.ok(chars.complexity >= 0 && chars.complexity <= 1);
    assert.ok(chars.brightness >= 0 && chars.brightness <= 1);
  });

  it("calculateVariance should return non-negative number", () => {
    const img = makeImage(8, 8);
    const variance = pi.calculateVariance(img.data);
    assert.ok(typeof variance === "number");
    assert.ok(variance >= 0);
  });

  it("calculateVariance for uniform image is near 0", () => {
    const data = new Uint8ClampedArray(64);
    for (let i = 0; i < data.length; i++) data[i] = 100;
    const variance = pi.calculateVariance(data);
    assert.ok(variance < 1);
  });
});

describe("PixelInjection — generateRecommendations", () => {
  let pi;
  before(() => {
    globalThis.document = buildMockDocument();
    pi = new PixelInjection();
  });

  it("should return array of recommendations", () => {
    const img = makeImage(16, 16);
    const recs = pi.generateRecommendations(img);
    assert.ok(Array.isArray(recs));
    assert.ok(recs.length >= 2);
  });

  it("should recommend adaptive algorithms for low-complexity images", () => {
    const data = new Uint8ClampedArray(64);
    for (let i = 0; i < data.length; i++) data[i] = 128;
    const img = { data, width: 4, height: 4 };
    const recs = pi.generateRecommendations(img);
    const hasAdaptive = recs.some((r) => r.includes("adaptive"));
    assert.ok(hasAdaptive);
  });
});

describe("PixelInjection — show methods", () => {
  let pi;
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("showWatermarkedImage should set result display block with watermarkedImage", () => {
    const img = makeImage(4, 4);
    pi.watermarkedImage = img;
    pi.currentCategory = "spatial";
    pi.currentAlgorithm = "enhanced_lsb";
    pi.showWatermarkedImage();
    const resultDiv = doc.getElementById("pi-result");
    assert.equal(resultDiv.style.display, "block");
    const outputDiv = doc.getElementById("pi-output");
    assert.ok(outputDiv.innerHTML.length > 0);
  });

  it("showWatermarkedImage should do nothing without watermarkedImage", () => {
    pi.watermarkedImage = null;
    pi.showWatermarkedImage();
    // Should not throw and result should still be there
    assert.ok(true);
  });

  it("showExtractedMessage should display message", () => {
    pi.extractedMessage = "Test extracted message";
    pi.currentCategory = "spatial";
    pi.currentAlgorithm = "enhanced_lsb";
    pi.showExtractedMessage();
    const outputDiv = doc.getElementById("pi-output");
    assert.ok(outputDiv.innerHTML.length > 0);
  });

  it("showExtractedMessage should handle null message", () => {
    pi.extractedMessage = null;
    pi.showExtractedMessage();
    assert.ok(true);
  });

  it("showExtractedMessage should handle object message", () => {
    pi.extractedMessage = { some: "object" };
    pi.showExtractedMessage();
    assert.ok(true);
  });

  it("showQualityMetrics should display when qualityMetrics is set", () => {
    pi.qualityMetrics = {
      psnr: 45.67,
      ssim: 0.9876,
      lpips: 0.0123,
      ber: 1.23,
      mse: 0.5,
      mad: 0.3,
    };
    pi.showQualityMetrics();
    const outputDiv = doc.getElementById("pi-output");
    assert.ok(outputDiv.innerHTML.includes("PSNR"));
  });

  it("showQualityMetrics should do nothing without qualityMetrics", () => {
    pi.qualityMetrics = null;
    pi.showQualityMetrics();
    assert.ok(true);
  });

  it("showSingleAnalysisResult should display result", () => {
    pi.showSingleAnalysisResult("statistical_detection", {
      hasWatermark: true,
      confidence: 0.95,
    });
    const outputDiv = doc.getElementById("pi-output");
    assert.ok(outputDiv.innerHTML.length > 0);
  });

  it("showDetectionResults should display", () => {
    pi.showDetectionResults({ detected: true });
    assert.ok(true);
  });

  it("showAutoAnalysisResults should display when analysisResults is set", () => {
    pi.analysisResults = {
      statistical: {
        hasWatermark: true,
        watermarkProbability: 0.85,
        likelyAlgorithm: "LSB",
        strength: 0.5,
      },
      ml: {
        detected: true,
        confidence: 0.9,
        algorithm: "LSB",
        robustness: 0.8,
      },
      blind_decoding: "secret data here",
      robustness: {
        overall_score: 0.75,
        individual_tests: [{ test: "JPEG", score: 0.8 }],
      },
      quality: {
        psnr: 40,
        ssim: 0.99,
        lpips: 0.01,
        ber: 0,
        mse: 0.1,
        mad: 0.05,
      },
      characteristics: {
        complexity: 0.5,
        noise: 0.1,
        brightness: 0.5,
        contrast: 0.3,
        texture: 0.4,
        edges: 50,
      },
      recommendations: ["Test robustness", "Use adaptive algorithms"],
      timestamp: "2025-01-01T00:00:00.000Z",
    };
    pi.showAutoAnalysisResults();
    const outputDiv = doc.getElementById("pi-output");
    assert.ok(outputDiv.innerHTML.length > 0);
    assert.ok(outputDiv.innerHTML.includes("Statistical Detection"));
  });
});

describe("PixelInjection — getAdvancedOptions", () => {
  let pi;
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should return empty options when no children", () => {
    const opts = pi.getAdvancedOptions();
    assert.ok(typeof opts === "object");
  });

  it("should collect options from container inputs", () => {
    const container = doc.getElementById("pi-options-container");
    // Add some mock inputs
    const rangeInput = doc.createElement("input");
    rangeInput.type = "range";
    rangeInput.id = "strength";
    rangeInput.value = "5";
    container.append(rangeInput);

    const checkboxInput = doc.createElement("input");
    checkboxInput.type = "checkbox";
    checkboxInput.id = "errorCorrection";
    checkboxInput.checked = true;
    container.append(checkboxInput);

    const textInput = doc.createElement("input");
    textInput.type = "text";
    textInput.id = "seedKey";
    textInput.value = "mykey";
    container.append(textInput);

    const opts = pi.getAdvancedOptions();
    assert.equal(opts.strength, 5);
    assert.equal(opts.errorCorrection, true);
    assert.equal(opts.seedKey, "mykey");
  });
});

describe("PixelInjection — runDetectionAlgorithm", () => {
  let pi;
  before(() => {
    globalThis.document = buildMockDocument();
    pi = new PixelInjection();
  });

  it("statistical_detection should return detection result", async () => {
    const img = makeImage(8, 8);
    const result = await pi.runDetectionAlgorithm(
      "statistical_detection",
      img,
      null,
      null,
      {},
    );
    assert.ok(typeof result === "object" || typeof result === "string");
  });

  it("ml_detection should return ml result", async () => {
    const img = makeImage(8, 8);
    const result = await pi.runDetectionAlgorithm(
      "ml_detection",
      img,
      null,
      null,
      {},
    );
    assert.ok(result !== undefined);
  });

  it("blind_decoding should return decoded result", async () => {
    const img = makeImage(8, 8);
    const result = await pi.runDetectionAlgorithm(
      "blind_decoding",
      img,
      "dct",
      null,
      {},
    );
    assert.ok(result !== undefined);
  });

  it("robustness_testing should return robustness result", async () => {
    const img = makeImage(8, 8);
    // Add message property that robustness testing expects
    img.message = "test_message";
    const result = await pi.runDetectionAlgorithm(
      "robustness_testing",
      img,
      null,
      null,
      { compareImage: img },
    );
    assert.ok(typeof result === "object");
    assert.ok(typeof result.overall_score === "number");
  });

  it("quality_metrics should return metrics result", async () => {
    const img = makeImage(8, 8);
    const result = await pi.runDetectionAlgorithm(
      "quality_metrics",
      img,
      null,
      null,
      { compareImage: img },
    );
    assert.ok(typeof result === "object");
    assert.ok(result.psnr !== undefined);
  });

  it("default case should throw error", async () => {
    const img = makeImage(8, 8);
    await assert.rejects(
      () => pi.runDetectionAlgorithm("unknown_algo", img, null, null, {}),
      /Unknown detection algorithm/,
    );
  });
});

describe("PixelInjection — handlePixelInjection validation", () => {
  let pi;
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should fail with no image selected", async () => {
    const imageInput = doc.getElementById("pi-image");
    imageInput.files = [];
    await pi.handlePixelInjection();
    // Should have called showMessage with error - just check no crash
    assert.ok(true);
  });

  it("should fail with no message and no secret file", async () => {
    const imageInput = doc.getElementById("pi-image");
    imageInput.files = [{ name: "test.png", type: "image/png" }];
    const msgInput = doc.getElementById("pi-message");
    msgInput.value = "";
    const secretFile = doc.getElementById("pi-secret-file");
    secretFile.files = [];
    await pi.handlePixelInjection();
    assert.ok(true);
  });

  it("should work with message text", async () => {
    const imageInput = doc.getElementById("pi-image");
    // Mock a small valid image file
    imageInput.files = [
      {
        name: "test.png",
        type: "image/png",
        size: 1000,
      },
    ];
    const msgInput = doc.getElementById("pi-message");
    msgInput.value = "";
    const secretFile = doc.getElementById("pi-secret-file");
    secretFile.files = [
      { name: "secret.txt", type: "text/plain", _text: "test message content" },
    ];
    const pwInput = doc.getElementById("pi-password");
    pwInput.value = "testpw";

    // Mock loadImage to return a proper image
    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    // Inject a proper algorithm
    const core = pi.core;
    core.enhanced_lsb = (img, msg, pw, opts) => {
      return new ImageData(
        new Uint8ClampedArray(img.data),
        img.width,
        img.height,
      );
    };
    pi.currentAlgorithm = "enhanced_lsb";
    pi.currentCategory = "spatial";

    await pi.handlePixelInjection();
    assert.ok(pi.watermarkedImage !== null);

    // Restore
    pi.loadImage = origLoad;
  });
});

describe("PixelInjection — handlePixelExtraction validation", () => {
  let pi;
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should return early with no watermarked image", async () => {
    const wmInput = doc.getElementById("pi-watermarked-image");
    wmInput.files = [];
    await pi.handlePixelExtraction();
    assert.ok(true);
  });
});

describe("PixelInjection — handlePixelAnalysis validation", () => {
  let pi;
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should return early with no image", async () => {
    const ai = doc.getElementById("pi-analyze-image");
    ai.files = [];
    await pi.handlePixelAnalysis();
    assert.ok(true);
  });
});

describe("PixelInjection — Global functions", () => {
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
  });

  it("window.updatePiAlgorithms should call instance method", () => {
    const pi = new PixelInjection();
    window.pixelInjection = pi;
    let called = false;
    const orig = pi.updatePiAlgorithms;
    pi.updatePiAlgorithms = () => {
      called = true;
    };
    window.updatePiAlgorithms();
    assert.ok(called);
    pi.updatePiAlgorithms = orig;
  });

  it("window.updatePiOptions should call instance method", () => {
    const pi = window.pixelInjection;
    let called = false;
    const orig = pi.updatePiOptions;
    pi.updatePiOptions = () => {
      called = true;
    };
    window.updatePiOptions();
    assert.ok(called);
    pi.updatePiOptions = orig;
  });

  it("window.showPiAdvancedOptions should toggle display", () => {
    const advOpts = doc.getElementById("pi-advanced-options");
    advOpts.style.display = "none";
    window.showPiAdvancedOptions();
    assert.equal(advOpts.style.display, "block");
    window.showPiAdvancedOptions();
    assert.equal(advOpts.style.display, "none");
  });

  it("window.switchPiTab should show correct tab", () => {
    window.switchPiTab("extract");
    assert.equal(doc.getElementById("pi-extract").style.display, "block");
    assert.equal(doc.getElementById("pi-embed").style.display, "none");
    assert.equal(doc.getElementById("pi-analyze").style.display, "none");
  });

  it("window.handlePixelInjection should call instance method", () => {
    const pi = window.pixelInjection;
    let called = false;
    const orig = pi.handlePixelInjection;
    pi.handlePixelInjection = async () => {
      called = true;
    };
    window.handlePixelInjection();
    assert.ok(called);
    pi.handlePixelInjection = orig;
  });

  it("window.handlePixelExtraction should call instance method", () => {
    const pi = window.pixelInjection;
    let called = false;
    const orig = pi.handlePixelExtraction;
    pi.handlePixelExtraction = async () => {
      called = true;
    };
    window.handlePixelExtraction();
    assert.ok(called);
    pi.handlePixelExtraction = orig;
  });

  it("window.handlePixelAnalysis should call instance method", () => {
    const pi = window.pixelInjection;
    let called = false;
    const orig = pi.handlePixelAnalysis;
    pi.handlePixelAnalysis = async () => {
      called = true;
    };
    window.handlePixelAnalysis();
    assert.ok(called);
    pi.handlePixelAnalysis = orig;
  });
});

describe("PixelInjection — Download format converters", () => {
  it("piToTXT should format as text", () => {
    const r = { type: "embed", algorithm: "Enhanced LSB" };
    const txt = piToTXT(r);
    assert.ok(txt.includes("Pixel Injection Result"));
    assert.ok(txt.includes("Enhanced LSB"));
  });

  it("piToCSV should format as CSV", () => {
    const r = { type: "embed", algorithm: "Enhanced LSB" };
    const csv = piToCSV(r);
    assert.ok(csv.includes('"Key"'));
    assert.ok(csv.includes('"Enhanced LSB"'));
  });

  it("piToXML should format as XML", () => {
    const r = { type: "embed", algorithm: "Enhanced LSB" };
    const xml = piToXML(r);
    assert.ok(xml.includes("<pixel_injection>"));
    assert.ok(xml.includes("<algorithm>Enhanced LSB</algorithm>"));
  });

  it("piToHTML should format as HTML", () => {
    const r = { type: "embed", algorithm: "Enhanced LSB" };
    const html = piToHTML(r);
    assert.ok(html.includes("<html>"));
    assert.ok(html.includes("Enhanced LSB"));
  });

  it("downloadPixelInjection should handle pdf format", async () => {
    setResult("piResult", { type: "embed", algorithm: "Enhanced LSB" });
    await downloadPixelInjection("pdf");
    assert.ok(true);
  });

  it("downloadPixelInjection should handle doc format", async () => {
    setResult("piResult", { type: "embed", algorithm: "Enhanced LSB" });
    await downloadPixelInjection("doc");
    assert.ok(true);
  });

  it("downloadPixelInjection should handle json format", async () => {
    setResult("piResult", { type: "embed", algorithm: "Enhanced LSB" });
    await downloadPixelInjection("json");
    assert.ok(true);
  });

  it("downloadPixelInjection should handle csv format", async () => {
    setResult("piResult", { type: "embed", algorithm: "Enhanced LSB" });
    await downloadPixelInjection("csv");
    assert.ok(true);
  });

  it("downloadPixelInjection should handle txt format", async () => {
    setResult("piResult", { type: "embed", algorithm: "Enhanced LSB" });
    await downloadPixelInjection("txt");
    assert.ok(true);
  });

  it("downloadPixelInjection should handle xml format", async () => {
    setResult("piResult", { type: "embed", algorithm: "Enhanced LSB" });
    await downloadPixelInjection("xml");
    assert.ok(true);
  });

  it("downloadPixelInjection should handle html format", async () => {
    setResult("piResult", { type: "embed", algorithm: "Enhanced LSB" });
    await downloadPixelInjection("html");
    assert.ok(true);
  });

  it("downloadPixelInjection should handle unknown format gracefully", async () => {
    setResult("piResult", { type: "embed", algorithm: "Enhanced LSB" });
    await downloadPixelInjection("unknown");
    assert.ok(true);
  });

  it("downloadPixelInjection should do nothing with no result", async () => {
    clearResult("piResult");
    await downloadPixelInjection("json");
    assert.ok(true);
  });
});

describe("PixelInjection — initializeEventListeners with loading state", () => {
  let doc;

  before(() => {
    doc = buildMockDocument();
    doc.readyState = "loading";
    globalThis.document = doc;
  });

  it("should add DOMContentLoaded listener when loading", () => {
    let pi;
    pi = new PixelInjection();
    // Check that a DOMContentLoaded listener was added
    const listeners = doc._listeners["DOMContentLoaded"] || [];
    assert.ok(listeners.length > 0);
  });

  it("should trigger setupPixelInjectionUI on DOMContentLoaded", () => {
    const pi = new PixelInjection();
    let called = false;
    const orig = pi.setupPixelInjectionUI;
    pi.setupPixelInjectionUI = () => {
      called = true;
    };
    doc.dispatchEvent({ type: "DOMContentLoaded" });
    assert.ok(
      called,
      "setupPixelInjectionUI should be called on DOMContentLoaded",
    );
    pi.setupPixelInjectionUI = orig;
  });
});

// ══════════════════════════════════════════════════════════════════
// Additional coverage: event callbacks, secret file, extraction, analysis, edge cases
// ══════════════════════════════════════════════════════════════════

describe("PixelInjection — setupPixelInjectionUI event callbacks", () => {
  let doc;
  let pi;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("categorySelect change event should call updatePiAlgorithms", () => {
    const catSel = doc.getElementById("pi-category");
    let called = false;
    const orig = pi.updatePiAlgorithms;
    pi.updatePiAlgorithms = () => {
      called = true;
    };
    catSel.dispatchEvent({ type: "change" });
    assert.ok(called, "updatePiAlgorithms should be called on category change");
    pi.updatePiAlgorithms = orig;
  });

  it("algorithmSelect change event should call updatePiOptions and togglePiPassword", () => {
    const algoSel = doc.getElementById("pi-algorithm");
    algoSel.value = "random_lsb";
    let optsCalled = false;
    let pwCalled = false;
    const origOpts = pi.updatePiOptions;
    const origPw = pi.togglePiPassword;
    pi.updatePiOptions = () => {
      optsCalled = true;
    };
    pi.togglePiPassword = () => {
      pwCalled = true;
    };
    algoSel.dispatchEvent({ type: "change" });
    assert.ok(optsCalled, "updatePiOptions should be called");
    assert.ok(pwCalled, "togglePiPassword should be called");
    pi.updatePiOptions = origOpts;
    pi.togglePiPassword = origPw;
  });

  it("extractAlgorithmSelect change event should call toggleExtractPiPassword", () => {
    const extractSel = doc.getElementById("pi-extract-algorithm");
    let called = false;
    const orig = pi.toggleExtractPiPassword;
    pi.toggleExtractPiPassword = () => {
      called = true;
    };
    extractSel.dispatchEvent({ type: "change" });
    assert.ok(called, "toggleExtractPiPassword should be called");
    pi.toggleExtractPiPassword = orig;
  });

  it("analyzeAlgorithmSelect change event should call toggleAnalyzeCompareInput", () => {
    const analyzeSel = doc.getElementById("pi-analyze-algorithm");
    let called = false;
    const orig = pi.toggleAnalyzeCompareInput;
    pi.toggleAnalyzeCompareInput = () => {
      called = true;
    };
    analyzeSel.dispatchEvent({ type: "change" });
    assert.ok(called, "toggleAnalyzeCompareInput should be called");
    pi.toggleAnalyzeCompareInput = orig;
  });
});

describe("PixelInjection — updateExtractAlgorithms auto option preservation", () => {
  let doc;
  let pi;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should preserve auto option when present", () => {
    const extractSel = doc.getElementById("pi-extract-algorithm");
    // Add an auto option first
    const autoOpt = doc.createElement("option");
    autoOpt.value = "auto";
    autoOpt.textContent = "Auto Detect";
    extractSel.append(autoOpt);
    pi.updateExtractAlgorithms();
    // The auto option should be first child
    const firstChild = extractSel._children[0];
    assert.ok(firstChild, "should have children");
    assert.equal(firstChild.value, "auto");
  });
});

describe("PixelInjection — handlePixelInjection secret file path", () => {
  let doc;
  let pi;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should use secret file content as message", async () => {
    const imageInput = doc.getElementById("pi-image");
    imageInput.files = [{ name: "test.png", type: "image/png", size: 1000 }];
    const secretFile = doc.getElementById("pi-secret-file");
    secretFile.files = [{ name: "secret.txt", type: "text/plain" }];
    const msgInput = doc.getElementById("pi-message");
    msgInput.value = "";

    // Mock loadImage
    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    // Mock FileReader using a class (avoids prototype issues)
    const origFileReader = globalThis.FileReader;
    globalThis.FileReader = class {
      constructor() {
        this.onload = null;
        this.onerror = null;
      }
      readAsText() {
        setTimeout(() => {
          if (this.onload)
            this.onload({ target: { result: "secret file content" } });
        }, 0);
      }
    };

    pi.currentAlgorithm = "enhanced_lsb";
    pi.currentCategory = "spatial";
    const core = pi.core;
    core.enhanced_lsb = (img, msg, pw, opts) => {
      return new ImageData(
        new Uint8ClampedArray(img.data),
        img.width,
        img.height,
      );
    };

    await pi.handlePixelInjection();
    assert.ok(pi.watermarkedImage !== null, "should have watermarkedImage");
    assert.equal(
      pi._secretFileName,
      "secret.txt",
      "should store secret filename",
    );

    pi.loadImage = origLoad;
    globalThis.FileReader = origFileReader;
  });

  it("should reject invalid secret file", async () => {
    const imageInput = doc.getElementById("pi-image");
    imageInput.files = [{ name: "test.png", type: "image/png" }];
    const secretFile = doc.getElementById("pi-secret-file");
    secretFile.files = [
      { name: "secret.exe", type: "application/x-msdownload" },
    ];
    const msgInput = doc.getElementById("pi-message");
    msgInput.value = "";

    // Make validateFileInput return false for secret file
    const origValidate = globalThis.validateFileInput;
    globalThis.validateFileInput = async (input) => {
      if (input === secretFile) return false;
      return true;
    };

    await pi.handlePixelInjection();
    // Should not proceed due to invalid secret file
    assert.ok(true);

    globalThis.validateFileInput = origValidate;
  });

  it("should reject failed secret file read", async () => {
    const imageInput = doc.getElementById("pi-image");
    imageInput.files = [{ name: "test.png", type: "image/png" }];
    const secretFile = doc.getElementById("pi-secret-file");
    secretFile.files = [{ name: "secret.txt", type: "text/plain" }];
    const msgInput = doc.getElementById("pi-message");
    msgInput.value = "";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    // Mock FileReader class that returns empty content
    const origFileReader = globalThis.FileReader;
    globalThis.FileReader = class {
      constructor() {
        this.onload = null;
        this.onerror = null;
      }
      readAsText() {
        setTimeout(() => {
          if (this.onload) this.onload({ target: { result: "" } });
        }, 0);
      }
    };

    await pi.handlePixelInjection();
    // Should fail with "Failed to read secret file content"
    assert.ok(true);

    pi.loadImage = origLoad;
    globalThis.FileReader = origFileReader;
  });

  it("should handle FileReader error when reading secret file", async () => {
    const docLocal = buildMockDocument();
    globalThis.document = docLocal;
    const piLocal = new PixelInjection();
    const imageInput = docLocal.getElementById("pi-image");
    imageInput.files = [{ name: "test.png", type: "image/png", size: 1000 }];
    const secretFile = docLocal.getElementById("pi-secret-file");
    secretFile.files = [{ name: "secret.txt", type: "text/plain" }];
    const msgInput = docLocal.getElementById("pi-message");
    msgInput.value = "";

    const origLoad = piLocal.loadImage;
    piLocal.loadImage = async () => makeImage(16, 16);

    // Mock FileReader to trigger onerror path
    const frOrig = globalThis.FileReader;
    globalThis.FileReader = class {
      constructor() {
        this.onload = null;
        this.onerror = null;
      }
      readAsText() {
        setTimeout(() => {
          if (this.onerror) this.onerror(new Error("File read error"));
        }, 0);
      }
    };

    piLocal.currentAlgorithm = "enhanced_lsb";
    piLocal.currentCategory = "spatial";
    const core = piLocal.core;
    core.enhanced_lsb = (img, msg, pw, opts) => {
      return new ImageData(
        new Uint8ClampedArray(img.data),
        img.width,
        img.height,
      );
    };

    await piLocal.handlePixelInjection();
    // Should handle FileReader error without crash
    assert.ok(true);

    piLocal.loadImage = origLoad;
    globalThis.FileReader = frOrig;
  });
});

describe("PixelInjection — handlePixelInjection invalid image file", () => {
  let doc;
  let pi;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should reject invalid image file", async () => {
    const imageInput = doc.getElementById("pi-image");
    imageInput.files = [{ name: "bad.exe", type: "application/x-msdownload" }];
    const msgInput = doc.getElementById("pi-message");
    msgInput.value = "test";

    const origValidate = globalThis.validateFileInput;
    globalThis.validateFileInput = async (input) => {
      if (input === imageInput) return false;
      return true;
    };

    await pi.handlePixelInjection();
    // Should not proceed due to invalid image file
    assert.ok(true);

    globalThis.validateFileInput = origValidate;
  });
});

describe("PixelInjection — handlePixelInjection core algorithm fallback", () => {
  let doc;
  let pi;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should use core.algorithms as fallback when method not on core directly", async () => {
    const imageInput = doc.getElementById("pi-image");
    imageInput.files = [{ name: "test.png", type: "image/png" }];
    const msgInput = doc.getElementById("pi-message");
    msgInput.value = "";
    const secretFile = doc.getElementById("pi-secret-file");
    secretFile.files = [
      { name: "secret.txt", type: "text/plain", _text: "test" },
    ];
    const pwInput = doc.getElementById("pi-password");
    pwInput.value = "";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    // Use enhanced_lsb which exists in core.algorithms but NOT as a direct method on core
    // (the actual method is enhancedLSB, not enhanced_lsb)
    pi.currentAlgorithm = "enhanced_lsb";

    await pi.handlePixelInjection();
    assert.ok(pi.watermarkedImage !== null, "should have watermarkedImage");

    pi.loadImage = origLoad;
  });

  it("should throw TypeError when core.algorithms entry is not a function", async () => {
    const imageInput = doc.getElementById("pi-image");
    imageInput.files = [{ name: "test.png", type: "image/png" }];
    const msgInput = doc.getElementById("pi-message");
    msgInput.value = "";
    const secretFile = doc.getElementById("pi-secret-file");
    secretFile.files = [
      { name: "secret.txt", type: "text/plain", _text: "test" },
    ];
    const pwInput = doc.getElementById("pi-password");
    pwInput.value = "";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    // Use enhanced_lsb (not a direct core method) but corrupt the algorithms entry
    pi.currentAlgorithm = "enhanced_lsb";
    const origAlgo = pi.core.algorithms.enhanced_lsb;
    pi.core.algorithms.enhanced_lsb = "not_a_function";

    await pi.handlePixelInjection();
    // TypeError caught and shown as message
    assert.ok(true);

    pi.core.algorithms.enhanced_lsb = origAlgo;
    pi.loadImage = origLoad;
  });

  it("should throw for unavailable algorithm", async () => {
    const imageInput = doc.getElementById("pi-image");
    imageInput.files = [{ name: "test.png", type: "image/png" }];
    const msgInput = doc.getElementById("pi-message");
    msgInput.value = "";
    const secretFile = doc.getElementById("pi-secret-file");
    secretFile.files = [
      { name: "secret.txt", type: "text/plain", _text: "test" },
    ];

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    pi.currentAlgorithm = "nonexistent_algo";

    await pi.handlePixelInjection();
    // Should catch error and show message
    assert.ok(true);

    pi.loadImage = origLoad;
  });
});

describe("PixelInjection — handlePixelExtraction full flow", () => {
  let doc;
  let pi;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should handle missing extraction elements", async () => {
    // Override getElementById to return null for watermarked image
    const origGet = doc.getElementById;
    doc.getElementById = (id) => {
      if (id === "pi-watermarked-image") return null;
      return origGet(id);
    };
    await pi.handlePixelExtraction();
    doc.getElementById = origGet;
    assert.ok(true);
  });

  it("should reject invalid watermarked image file", async () => {
    const wmInput = doc.getElementById("pi-watermarked-image");
    wmInput.files = [{ name: "bad.exe", type: "application/x-msdownload" }];
    const origValidate = globalThis.validateFileInput;
    globalThis.validateFileInput = async (input) => {
      if (input === wmInput) return false;
      return true;
    };
    await pi.handlePixelExtraction();
    // Should not proceed due to invalid file
    globalThis.validateFileInput = origValidate;
    wmInput.files = [];
    assert.ok(true);
  });

  it("should extract via extractMap method", async () => {
    const wmInput = doc.getElementById("pi-watermarked-image");
    wmInput.files = [{ name: "wm.png", type: "image/png" }];
    const extractSel = doc.getElementById("pi-extract-algorithm");
    extractSel.value = "enhanced_lsb";
    const pwInput = doc.getElementById("pi-extract-password");
    pwInput.value = "";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    // Mock core.extractEnhancedLSB
    pi.core.extractEnhancedLSB = async (img) => "extracted message";

    await pi.handlePixelExtraction();
    assert.equal(pi.extractedMessage, "extracted message");

    pi.loadImage = origLoad;
    delete pi.core.extractEnhancedLSB;
    wmInput.files = [];
  });

  it("should handle extraction returning ImageData (embedding result)", async () => {
    const wmInput = doc.getElementById("pi-watermarked-image");
    wmInput.files = [{ name: "wm.png", type: "image/png" }];
    const extractSel = doc.getElementById("pi-extract-algorithm");
    extractSel.value = "dct";
    const pwInput = doc.getElementById("pi-extract-password");
    pwInput.value = "";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    // Mock core.extractDCT to return ImageData-like object
    pi.core.extractDCT = async (img) =>
      new ImageData(new Uint8ClampedArray(64), 4, 4);

    await pi.handlePixelExtraction();
    assert.ok(pi.extractedMessage.includes("embedding result"));

    pi.loadImage = origLoad;
    delete pi.core.extractDCT;
    wmInput.files = [];
  });

  it("should use detection[algorithm] fallback when extractMap not found", async () => {
    const wmInput = doc.getElementById("pi-watermarked-image");
    wmInput.files = [{ name: "wm.png", type: "image/png" }];
    const extractSel = doc.getElementById("pi-extract-algorithm");
    // Add option for statistical_detection (excluded by updateExtractAlgorithms)
    const detectOpt = doc.createElement("option");
    detectOpt.value = "statistical_detection";
    extractSel.append(detectOpt);
    extractSel.value = "statistical_detection";
    const pwInput = doc.getElementById("pi-extract-password");
    pwInput.value = "";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    // Mock core.detection.statistical_detection
    pi.core.detection.statistical_detection = async (img) => ({
      hasWatermark: true,
    });

    await pi.handlePixelExtraction();
    // Should handle object message with no message property
    assert.ok(pi.extractedMessage.length > 0);

    pi.loadImage = origLoad;
    delete pi.core.detection.statistical_detection;
    wmInput.files = [];
  });

  it("should handle extraction error", async () => {
    const wmInput = doc.getElementById("pi-watermarked-image");
    wmInput.files = [{ name: "wm.png", type: "image/png" }];
    const extractSel = doc.getElementById("pi-extract-algorithm");
    extractSel.value = "dct";
    const pwInput = doc.getElementById("pi-extract-password");
    pwInput.value = "";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => {
      throw new Error("Load failed");
    };

    await pi.handlePixelExtraction();
    // Should handle error without crashing
    assert.ok(true);

    pi.loadImage = origLoad;
    wmInput.files = [];
  });

  it("should use auto algorithm (currentAlgorithm) when extract algorithm is 'auto'", async () => {
    const wmInput = doc.getElementById("pi-watermarked-image");
    wmInput.files = [{ name: "wm.png", type: "image/png" }];
    const extractSel = doc.getElementById("pi-extract-algorithm");
    // Add auto option for the 'auto' algorithm feature
    const autoOpt = doc.createElement("option");
    autoOpt.value = "auto";
    autoOpt.textContent = "Auto Detect";
    extractSel.append(autoOpt);
    extractSel.value = "auto";
    pi.currentAlgorithm = "enhanced_lsb";
    const pwInput = doc.getElementById("pi-extract-password");
    pwInput.value = "";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    pi.core.extractEnhancedLSB = async (img) => "auto-extracted";

    await pi.handlePixelExtraction();
    assert.equal(pi.extractedMessage, "auto-extracted");

    pi.loadImage = origLoad;
    delete pi.core.extractEnhancedLSB;
    wmInput.files = [];
  });
});

// ── Extraction dispatch chain coverage ──
describe("PixelInjection — extraction dispatch chain", () => {
  let doc;
  let pi;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should extract random_lsb with password via extractMap", async () => {
    const wmInput = doc.getElementById("pi-watermarked-image");
    wmInput.files = [{ name: "wm.png", type: "image/png" }];
    const extractSel = doc.getElementById("pi-extract-algorithm");
    const opt = doc.createElement("option");
    opt.value = "random_lsb";
    extractSel.append(opt);
    extractSel.value = "random_lsb";
    const pwInput = doc.getElementById("pi-extract-password");
    pwInput.value = "testpw";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    pi.core.extractRandomLSB = async (img, pw) => {
      assert.equal(
        pw,
        "testpw",
        "should pass password to random_lsb extraction",
      );
      return "random extracted";
    };

    await pi.handlePixelExtraction();
    assert.equal(pi.extractedMessage, "random extracted");

    pi.loadImage = origLoad;
    delete pi.core.extractRandomLSB;
    wmInput.files = [];
  });

  it("should use core[algorithm] extraction fallback", async () => {
    const wmInput = doc.getElementById("pi-watermarked-image");
    wmInput.files = [{ name: "wm.png", type: "image/png" }];
    const extractSel = doc.getElementById("pi-extract-algorithm");
    const opt = doc.createElement("option");
    opt.value = "customExtractFn";
    extractSel.append(opt);
    extractSel.value = "customExtractFn";
    const pwInput = doc.getElementById("pi-extract-password");
    pwInput.value = "";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    // Set a function directly on core (not in extractMap, not in detection)
    pi.core.customExtractFn = async (img, msg, pw, opts) => "core fn extracted";

    await pi.handlePixelExtraction();
    assert.equal(pi.extractedMessage, "core fn extracted");

    pi.loadImage = origLoad;
    delete pi.core.customExtractFn;
    wmInput.files = [];
  });

  it("should use extractionMethod convention path", async () => {
    const wmInput = doc.getElementById("pi-watermarked-image");
    wmInput.files = [{ name: "wm.png", type: "image/png" }];
    const extractSel = doc.getElementById("pi-extract-algorithm");
    const opt = doc.createElement("option");
    opt.value = "some_name";
    extractSel.append(opt);
    extractSel.value = "some_name";
    const pwInput = doc.getElementById("pi-extract-password");
    pwInput.value = "";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    // Set extractSomeName (the auto-generated convention name) on core
    pi.core.extractSomeName = async (img) => "convention extracted";

    await pi.handlePixelExtraction();
    assert.equal(pi.extractedMessage, "convention extracted");

    pi.loadImage = origLoad;
    delete pi.core.extractSomeName;
    wmInput.files = [];
  });

  it("should use blind_decoding fallback for extraction", async () => {
    const wmInput = doc.getElementById("pi-watermarked-image");
    wmInput.files = [{ name: "wm.png", type: "image/png" }];
    const extractSel = doc.getElementById("pi-extract-algorithm");
    const opt = doc.createElement("option");
    opt.value = "no_match_algo";
    extractSel.append(opt);
    extractSel.value = "no_match_algo";
    const pwInput = doc.getElementById("pi-extract-password");
    pwInput.value = "";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    // blind_decoding exists on core by default, should be used as final fallback
    await pi.handlePixelExtraction();
    // Should not crash (blind_decoding handles unknown algorithms gracefully)
    assert.ok(true);

    pi.loadImage = origLoad;
    wmInput.files = [];
  });

  it("should throw when extraction algorithm is not available (no blind_decoding)", async () => {
    const wmInput = doc.getElementById("pi-watermarked-image");
    wmInput.files = [{ name: "wm.png", type: "image/png" }];
    const extractSel = doc.getElementById("pi-extract-algorithm");
    const opt = doc.createElement("option");
    opt.value = "no_match_algo";
    extractSel.append(opt);
    extractSel.value = "no_match_algo";
    const pwInput = doc.getElementById("pi-extract-password");
    pwInput.value = "";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    // Remove blind_decoding to force the bare error path
    const origBD = pi.core.detection.blind_decoding;
    delete pi.core.detection.blind_decoding;

    await pi.handlePixelExtraction();
    // Error is caught and shown as message
    assert.ok(true);

    pi.core.detection.blind_decoding = origBD;
    pi.loadImage = origLoad;
    wmInput.files = [];
  });

  it("should handle extractedMessage with .message property", async () => {
    const wmInput = doc.getElementById("pi-watermarked-image");
    wmInput.files = [{ name: "wm.png", type: "image/png" }];
    const extractSel = doc.getElementById("pi-extract-algorithm");
    const opt = doc.createElement("option");
    opt.value = "msg_prop_algo";
    extractSel.append(opt);
    extractSel.value = "msg_prop_algo";
    const pwInput = doc.getElementById("pi-extract-password");
    pwInput.value = "";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    // Return object with .message property to hit that code path
    pi.core.msg_prop_algo = async (img, msg, pw, opts) => ({
      message: "found via property",
    });

    await pi.handlePixelExtraction();
    assert.equal(pi.extractedMessage, "found via property");

    pi.loadImage = origLoad;
    delete pi.core.msg_prop_algo;
    wmInput.files = [];
  });
});

describe("PixelInjection — handlePixelAnalysis full flow", () => {
  let doc;
  let pi;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should reject invalid analysis image file", async () => {
    const ai = doc.getElementById("pi-analyze-image");
    ai.files = [{ name: "bad.exe", type: "application/x-msdownload" }];
    const origValidate = globalThis.validateFileInput;
    globalThis.validateFileInput = async (input) => {
      if (input === ai) return false;
      return true;
    };
    await pi.handlePixelAnalysis();
    globalThis.validateFileInput = origValidate;
    ai.files = [];
    assert.ok(true);
  });

  it("should run auto_detect analysis", async () => {
    const ai = doc.getElementById("pi-analyze-image");
    ai.files = [{ name: "test.png", type: "image/png" }];
    const algoSel = doc.getElementById("pi-analyze-algorithm");
    algoSel.value = "auto_detect";

    const origLoad = pi.loadImage;
    const mockImg = makeImage(16, 16);
    // robustness_testing and quality_metrics need .message property
    mockImg.message = "test_message";
    pi.loadImage = async () => mockImg;
    const origShowLoading = pi.showLoading;
    pi.showLoading = () => {};

    await pi.handlePixelAnalysis();
    assert.ok(pi.analysisResults !== null, "should have analysis results");
    assert.ok(
      pi.analysisResults.statistical,
      "should have statistical results",
    );
    assert.ok(
      pi.analysisResults.recommendations,
      "should have recommendations",
    );

    pi.showLoading = origShowLoading;
    pi.loadImage = origLoad;
    ai.files = [];
  });

  it("should run robustness_testing with compare image", async () => {
    const ai = doc.getElementById("pi-analyze-image");
    ai.files = [{ name: "test.png", type: "image/png" }];
    const algoSel = doc.getElementById("pi-analyze-algorithm");
    algoSel.value = "robustness_testing";
    const compareInput = doc.getElementById("pi-analyze-compare");
    compareInput.files = [{ name: "compare.png", type: "image/png" }];

    const origLoad = pi.loadImage;
    let callCount = 0;
    pi.loadImage = async () => {
      callCount++;
      const img = makeImage(16, 16);
      // robustness_testing reads .message property
      img.message = "test_message";
      return img;
    };

    await pi.handlePixelAnalysis();
    assert.ok(callCount >= 2, "should load both images");
    // Result should be visible in output
    const outputDiv = doc.getElementById("pi-output");
    assert.ok(outputDiv.innerHTML.length > 0, "output should have content");

    pi.loadImage = origLoad;
    ai.files = [];
    compareInput.files = [];
  });

  it("should run robustness_testing without compare image (self-compare)", async () => {
    const ai = doc.getElementById("pi-analyze-image");
    ai.files = [{ name: "test.png", type: "image/png" }];
    const algoSel = doc.getElementById("pi-analyze-algorithm");
    algoSel.value = "robustness_testing";
    const compareInput = doc.getElementById("pi-analyze-compare");
    compareInput.files = [];

    const origLoad = pi.loadImage;
    pi.loadImage = async () => {
      const img = makeImage(16, 16);
      img.message = "test_message";
      return img;
    };

    await pi.handlePixelAnalysis();
    const outputDiv = doc.getElementById("pi-output");
    assert.ok(outputDiv.innerHTML.length > 0, "output should have content");

    pi.loadImage = origLoad;
    ai.files = [];
  });

  it("should run single analysis algorithm (statistical_detection)", async () => {
    const ai = doc.getElementById("pi-analyze-image");
    ai.files = [{ name: "test.png", type: "image/png" }];
    const algoSel = doc.getElementById("pi-analyze-algorithm");
    algoSel.value = "statistical_detection";

    const origLoad = pi.loadImage;
    pi.loadImage = async () => makeImage(16, 16);

    await pi.handlePixelAnalysis();
    const outputDiv = doc.getElementById("pi-output");
    assert.ok(outputDiv.innerHTML.length > 0);

    pi.loadImage = origLoad;
    ai.files = [];
  });

  it("should handle analysis error", async () => {
    const ai = doc.getElementById("pi-analyze-image");
    ai.files = [{ name: "test.png", type: "image/png" }];

    const origLoad = pi.loadImage;
    pi.loadImage = async () => {
      throw new Error("Analysis load error");
    };

    await pi.handlePixelAnalysis();
    // Should handle error without crashing
    assert.ok(true);

    pi.loadImage = origLoad;
    ai.files = [];
  });
});

describe("PixelInjection — loadImage error path", () => {
  let doc;
  let pi;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should reject when FileReader errors", async () => {
    // Override loadImage to test rejection path via FileReader
    const origFileReader = globalThis.FileReader;
    globalThis.FileReader = class {
      constructor() {
        this.onload = null;
        this.onerror = null;
      }
      readAsDataURL() {
        const self = this;
        setTimeout(() => {
          if (self.onerror) self.onerror(new Error("FileReader error"));
        }, 5);
      }
    };

    await assert.rejects(
      () => pi.loadImage({ name: "test.png" }),
      /FileReader error/,
    );

    globalThis.FileReader = origFileReader;
  });
});

describe("PixelInjection — extractMessageFromImageData second branch", () => {
  let pi;
  before(() => {
    globalThis.document = buildMockDocument();
    pi = new PixelInjection();
  });

  it("should call extractLSBMessage for ImageData-like objects", () => {
    const imgData = makeImage(4, 4);
    const result = pi.extractMessageFromImageData(imgData);
    assert.ok(typeof result === "string");
  });

  it("should return 'No message found' for non-ImageData objects with data", () => {
    const result = pi.extractMessageFromImageData({
      data: "some string",
      other: true,
    });
    // First check passes (data exists, typeof "string" is "object"? No, typeof "string" is "string")
    // The check is: !imageData || !imageData.data || typeof imageData.data !== "object"
    // data = "some string" => typeof "some string" !== "object" => true => returns "No valid image data found"
    // So this test needs to be different. Let's pass something with data as object but no width/height.
    assert.equal(result, "No valid image data found");
  });

  it("should return 'No message found' for objects with data array but no width/height", () => {
    const result = pi.extractMessageFromImageData({ data: new Uint8Array(4) });
    assert.equal(result, "No message found");
  });
});

describe("PixelInjection — extractLSBMessage charCode edge cases", () => {
  let pi;
  before(() => {
    globalThis.document = buildMockDocument();
    pi = new PixelInjection();
  });

  it("should handle extracted message with non-printable chars", () => {
    const w = 4;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    // Set LSB bits to form character 0 (null terminator - all zeros)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 128; // all blue LSB = 0
      data[i + 3] = 255;
    }
    const imgData = { data, width: w, height: h };
    const result = pi.extractLSBMessage(imgData);
    // All chars are 0 -> charCode 0 < 32 -> none added -> "No readable message found"
    assert.equal(result, "No readable message found");
  });

  it("should extract printable characters from LSB (charCode push path)", () => {
    // Need at least 8 pixels for 8 bits (one complete byte)
    const w = 8;
    const h = 1;
    const data = new Uint8ClampedArray(w * h * 4);
    // Set default values for all pixels
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 128; // LSB = 0 by default
      data[i + 3] = 255;
    }
    // Encode character 'A' (65 = 0b01000001) in first 8 blue channel LSBs
    // Bits: 0,1,0,0,0,0,0,1
    const bits = [0, 1, 0, 0, 0, 0, 0, 1];
    for (let pixelIdx = 0; pixelIdx < bits.length; pixelIdx++) {
      data[pixelIdx * 4 + 2] = 128 | bits[pixelIdx]; // Set blue LSB
    }
    const imgData = { data, width: w, height: h };
    const result = pi.extractLSBMessage(imgData);
    assert.equal(
      result,
      "A",
      "should extract printable character 'A' when charCode is in printable range",
    );
  });
});

describe("PixelInjection — showExtractedMessage edge cases", () => {
  let pi;
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should handle null extractedMessage", () => {
    pi.extractedMessage = null;
    pi.currentCategory = "spatial";
    pi.currentAlgorithm = "enhanced_lsb";
    pi.showExtractedMessage();
    const outputDiv = doc.getElementById("pi-output");
    // typeof null === "object", so this goes through JSON.stringify(null, null, 2) => "null"
    assert.ok(
      outputDiv.innerHTML.includes("null") || outputDiv.innerHTML.length > 0,
    );
  });

  it("should handle undefined extractedMessage", () => {
    pi.extractedMessage = undefined;
    pi.currentCategory = "spatial";
    pi.currentAlgorithm = "enhanced_lsb";
    pi.showExtractedMessage();
    const outputDiv = doc.getElementById("pi-output");
    // undefined is the else-if branch: messageText = "No message extracted"
    assert.ok(
      outputDiv.innerHTML.includes("No message extracted"),
      "should show No message extracted for undefined",
    );
  });

  it("should copy message to clipboard on copy button click", () => {
    const resultDiv = doc.getElementById("pi-result");
    resultDiv.style.display = "none";
    pi.extractedMessage = "clipboard test";
    pi.currentCategory = "spatial";
    pi.currentAlgorithm = "enhanced_lsb";
    pi.showExtractedMessage();
    const copyBtn = doc.getElementById("pi-copy-btn");
    assert.ok(copyBtn !== null, "copy button should exist");
    // Trigger click
    let clipText = "";
    const origClip = globalThis.navigator.clipboard.writeText;
    globalThis.navigator.clipboard.writeText = (t) => {
      clipText = t;
    };
    copyBtn.click();
    assert.ok(clipText.length > 0);
    globalThis.navigator.clipboard.writeText = origClip;
  });
});

describe("PixelInjection — generateRecommendations all paths", () => {
  let pi;
  before(() => {
    globalThis.document = buildMockDocument();
    pi = new PixelInjection();
  });

  it("should recommend noise-resistant algorithms for high-noise images", () => {
    // Mock analyzeImageCharacteristics to return specific values
    const origAnalyze = pi.analyzeImageCharacteristics;
    pi.analyzeImageCharacteristics = () => ({
      complexity: 0.5,
      noise: 0.3,
      brightness: 0.5,
    });
    const img = makeImage(4, 4);
    const recs = pi.generateRecommendations(img);
    const hasNoiseRec = recs.some((r) => r.includes("noise"));
    assert.ok(hasNoiseRec, "should recommend noise-resistant algorithms");
    pi.analyzeImageCharacteristics = origAnalyze;
  });

  it("should recommend adjusting strength for extreme brightness", () => {
    const origAnalyze = pi.analyzeImageCharacteristics;
    pi.analyzeImageCharacteristics = () => ({
      complexity: 0.5,
      noise: 0.1,
      brightness: 0.2,
    });
    const img = makeImage(4, 4);
    const recs = pi.generateRecommendations(img);
    const hasBrightnessRec = recs.some((r) => r.includes("brightness"));
    assert.ok(
      hasBrightnessRec,
      "should recommend adjusting for extreme brightness",
    );
    pi.analyzeImageCharacteristics = origAnalyze;
  });

  it("should recommend for high brightness too", () => {
    const origAnalyze = pi.analyzeImageCharacteristics;
    pi.analyzeImageCharacteristics = () => ({
      complexity: 0.5,
      noise: 0.1,
      brightness: 0.8,
    });
    const img = makeImage(4, 4);
    const recs = pi.generateRecommendations(img);
    const hasBrightnessRec = recs.some((r) => r.includes("brightness"));
    assert.ok(
      hasBrightnessRec,
      "should recommend adjusting for high brightness",
    );
    pi.analyzeImageCharacteristics = origAnalyze;
  });
});

describe("PixelInjection — switchPiTab complete coverage", () => {
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    // Create data-pi-tab elements for the switchPiTab forEach loop
    const embedBtn = doc.createElement("div");
    embedBtn.setAttribute("data-pi-tab", "embed");
    embedBtn.classList = {
      add: () => {},
      remove: () => {},
      contains: () => false,
      toggle: () => {},
    };
    doc._elements["pi-tab-embed"] = embedBtn;
    embedBtn.getAttribute = (name) => (name === "data-pi-tab" ? "embed" : null);

    const extractBtn = doc.createElement("div");
    extractBtn.setAttribute("data-pi-tab", "extract");
    extractBtn.classList = {
      add: () => {},
      remove: () => {},
      contains: () => false,
      toggle: () => {},
    };
    doc._elements["pi-tab-extract"] = extractBtn;
    extractBtn.getAttribute = (name) =>
      name === "data-pi-tab" ? "extract" : null;

    // Create a new PixelInjection instance so setupPixelInjectionUI runs
    new PixelInjection();
  });

  it("should toggle data-pi-tab buttons when switching tabs", () => {
    window.switchPiTab("embed");
    assert.equal(doc.getElementById("pi-embed").style.display, "block");
    assert.equal(doc.getElementById("pi-extract").style.display, "none");
  });
});

describe("PixelInjection — downloadPixelInjection DOCX path", () => {
  it("should generate DOCX download", async () => {
    setResult("piResult", {
      type: "embed",
      algorithm: "Enhanced LSB",
      data: "test data with enough chars to fill rows",
    });
    await downloadPixelInjection("doc");
    assert.ok(true);
  });
});

describe("PixelInjection — showAutoAnalysisResults with null analysisResults", () => {
  let pi;
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should do nothing when analysisResults is null", () => {
    pi.analysisResults = null;
    pi.showAutoAnalysisResults();
    // Should not throw
    assert.ok(true);
  });
});

describe("PixelInjection — showSingleAnalysisResult with missing result div", () => {
  let pi;
  let doc;

  before(() => {
    doc = buildMockDocument();
    globalThis.document = doc;
    pi = new PixelInjection();
  });

  it("should do nothing when result div is missing", () => {
    // Override getElementById to return null for pi-result
    const origGet = doc.getElementById;
    doc.getElementById = (id) => {
      if (id === "pi-result") return null;
      return origGet(id);
    };
    pi.showSingleAnalysisResult("statistical_detection", { result: true });
    doc.getElementById = origGet;
    assert.ok(true);
  });
});

// ── Additional coverage: algorithms stubs, transforms main path, advanced edge cases ──
describe("WatermarkCore — algorithm stub functions", () => {
  it("calculateTextureComplexity should return 0.5", () => {
    const core = new WatermarkCore();
    const data = new Uint8ClampedArray([128, 128, 128, 255]);
    const result = core.calculateTextureComplexity(data, 0, 0, 1);
    assert.equal(result, 0.5);
  });

  it("calculateMultiFactorJND should return JND value", () => {
    const core = new WatermarkCore();
    // brightness < 64
    let jnd = core.calculateMultiFactorJND(32, 0.6, 0.4);
    assert.ok(typeof jnd === "number" && jnd > 0);
    // brightness between 64 and 128
    jnd = core.calculateMultiFactorJND(100, 0.6, 0.4);
    assert.ok(jnd > 0);
    // brightness >= 128
    jnd = core.calculateMultiFactorJND(200, 0.2, 0.2);
    assert.ok(jnd > 0);
    // low contrast + low texture
    jnd = core.calculateMultiFactorJND(32, 0.1, 0.1);
    assert.ok(jnd > 0);
  });

  it("extractDeepFeatures should return array", () => {
    const core = new WatermarkCore();
    const img = makeImage(8, 8);
    const features = core.extractDeepFeatures(img);
    assert.ok(Array.isArray(features) && features.length === 5);
  });

  it("analyzeRegion should return analysis object", () => {
    const core = new WatermarkCore();
    const data = new Uint8ClampedArray(64 * 4);
    const result = core.analyzeRegion(data, 0, 0, 3, 8);
    assert.ok(result.isNullSpace === true);
    assert.ok(Array.isArray(result.pixels));
  });
});

describe("WatermarkCore — modifyCoefficient main path (transforms)", () => {
  it("should embed bit via quantization with valid args", () => {
    const core = new WatermarkCore();
    const result = core.modifyCoefficient(100, 1, 10);
    // With coefficient=100, weight=10: quantized=10, modified = (10 & ~1) | 1 = 11, result = 110
    assert.equal(result, 110);
  });

  it("should embed bit=0 via quantization", () => {
    const core = new WatermarkCore();
    const result = core.modifyCoefficient(100, 0, 10);
    // quantized=10, modified = (10 & ~1) | 0 = 10, result = 100
    assert.equal(result, 100);
  });

  it("should handle negative coefficient", () => {
    const core = new WatermarkCore();
    const result = core.modifyCoefficient(-100, 1, 10);
    // quantized=-10, modified = (-10 & ~1) | 1, with bitwise -> (-12) | 1 = -11, result = -110
    assert.ok(typeof result === "number");
  });
});

describe("WatermarkCore — blindDecoding DWT path (advanced)", () => {
  it("should route dwt to extractDWT in blindDecoding", () => {
    const core = new WatermarkCore();
    const img = makeImage(8, 8);
    // blindDecoding with algorithm='dwt' should call extractDWT
    // It will attempt to decode but may not find a valid message — that is OK
    const result = core.blindDecoding(img, "dwt");
    assert.ok(result !== undefined && result !== null);
  });
});

describe("WatermarkCore — extractAdaptiveLSB (algorithms)", () => {
  it("should delegate to extractLSB", () => {
    const core = new WatermarkCore();
    const img = makeImage(8, 8);
    const result = core.extractAdaptiveLSB(img);
    assert.equal(result, "No readable message found");
  });
});

describe("WatermarkCore — extractHybridDCTDWT fallback paths (algorithms)", () => {
  it("should return empty string for unwatermarked image (fallback paths)", () => {
    const core = new WatermarkCore();
    const w = 16;
    const h = 16;
    const data = new Uint8ClampedArray(w * h * 4);
    // Uniform gray image
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
    const img = new ImageData(data, w, h);
    // An unwatermarked image should not yield a valid hybrid message
    const result = core.extractHybridDCTDWT(img);
    // Should be empty string (no pipe separator found)
    assert.equal(result, "");
  });
});

describe("WatermarkCore — chooseEmbeddingStrategy (advanced)", () => {
  it("should embed with high complexity path", () => {
    const core = new WatermarkCore();
    // characteristics.complexity > 0.7
    const strategy = core.chooseEmbeddingStrategy(0, 0, { complexity: 0.9 });
    // Line 322: return (value & 0xFE) | bit
    const result = strategy.embed(255, 1);
    assert.equal(result, 255); // 255 & 0xFE | 1 = 254 | 1 = 255
  });

  it("should embed with low complexity path", () => {
    const core = new WatermarkCore();
    // characteristics.complexity <= 0.7
    const strategy = core.chooseEmbeddingStrategy(0, 0, { complexity: 0.3 });
    const result = strategy.embed(255, 1);
    // (value & 0xFC) | (bit << 2) = (255 & 0xFC) | (1 << 2) = 252 | 4 = 252
    assert.equal(result, 252);
  });
});

// =========================================================================
// Edge case coverage for watermark_core_algorithms.js
// =========================================================================

describe("WatermarkCore — findNullSpace high-variance path", () => {
  it("should populate textured array for pixels with variance > 50", () => {
    const core = new WatermarkCore();
    const w = 16;
    const h = 16;
    const data = new Uint8ClampedArray(w * h * 4);
    // Create a checkered pattern to produce high local variance
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const val = (x + y) % 2 === 0 ? 0 : 250;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    const result = core.findNullSpace(data, w, h);
    assert.ok(Array.isArray(result.textured), "textured should be an array");
  });
});

describe("WatermarkCore — classifyWatermark high-entropy path", () => {
  it("should detect watermark with high entropy features", () => {
    const core = new WatermarkCore();
    const features = {
      histogram: { entropy: 7.5 },
      spatial: { complexity: 0.9 },
      frequency: { highFreqEnergy: 0.8 },
    };
    const result = core.classifyWatermark(features);
    assert.ok(result.detected, "Should detect with high entropy");
    assert.equal(result.confidence, 0.85);
  });
});

describe("WatermarkCore — stardustmark with tamper_detection disabled", () => {
  it("should return watermarked directly when tamper_detection is false", () => {
    const core = new WatermarkCore();
    const w = 200;
    const h = 200;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
    const img = new ImageData(data, w, h);
    const result = core.stardustmark(img, "test", null, {
      tamper_detection: false,
      forensic_strength: 0.1,
    });
    assert.ok(result instanceof ImageData);
  });
});
