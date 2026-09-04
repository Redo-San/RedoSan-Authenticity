const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createCanvas, ImageData } = require("canvas");

var _els = {};

function makeEl(id, extra) {
  if (!_els[id]) {
    _els[id] = Object.assign(
      {
        style: { display: "" },
        value: "",
        textContent: "",
        innerHTML: "",
        className: "",
        _children: [],
        classList: {
          add: function () {},
          remove: function () {},
          contains: function () {
            return false;
          },
          toggle: function () {},
        },
        append: function (child) {
          this._children.push(child);
          if (typeof child === "object" && child.textContent)
            this.innerHTML += child.textContent;
        },
        appendChild: function (child) {
          this._children.push(child);
          if (typeof child === "object" && child.textContent)
            this.innerHTML += child.textContent;
        },
        remove: function () {},
        addEventListener: function () {},
        dispatchEvent: function () {},
        getAttribute: function (a) {
          return this[a] || null;
        },
        setAttribute: function (a, v) {
          this[a] = v;
        },
        click: function () {},
        focus: function () {},
        files: undefined,
        disabled: false,
        href: "",
        download: "",
        src: "",
        querySelector: function () {
          return null;
        },
        querySelectorAll: function () {
          return [];
        },
        parentElement: {},
        parentNode: {
          insertBefore: function () {},
          removeChild: function () {},
          querySelector: function () {
            return null;
          },
        },
      },
      extra || {},
    );
  }
  return _els[id];
}

function makeMockCanvas(w, h) {
  var c = createCanvas(w || 1, h || 1);
  c.style = {};
  c.toBlob = function (cb, mime, quality) {
    cb(
      new Blob([c.toBuffer(mime || "image/png")], {
        type: mime || "image/png",
      }),
    );
  };
  return c;
}

before(function () {
  // Make the canvas package's ImageData available in vm context
  globalThis.ImageData = ImageData;
  globalThis.document = {
    getElementById: function (id) {
      return _els[id] || null;
    },
    createElement: function (tag) {
      if (tag === "canvas") return makeMockCanvas();
      if (tag === "div" || tag === "span") return makeEl("created-" + tag);
      var el = makeEl("created-" + tag, { tagName: tag });
      return el;
    },
    createTextNode: function () {
      return {};
    },
    querySelector: function () {
      return null;
    },
    querySelectorAll: function () {
      return [];
    },
    addEventListener: function () {},
    documentElement: { dataset: {} },
    title: "test",
  };
  globalThis.window = globalThis;
  globalThis.location = {
    protocol: "file:",
    hostname: "localhost",
    href: "file:///test/",
    search: "",
  };
  globalThis.URL = {
    createObjectURL: function () {
      return "blob:mock-url";
    },
    revokeObjectURL: function () {},
  };
  globalThis.Blob = function (parts, opts) {
    this.parts = parts;
    this.type = (opts && opts.type) || "";
  };
  globalThis.File = function (parts, name, opts) {
    this.parts = parts;
    this.name = name;
    this.type = (opts && opts.type) || "";
    this.size = parts.reduce(function (a, b) {
      return a + (b.length || 0);
    }, 0);
    this.arrayBuffer = function () {
      var bufs = parts.map(function (p) {
        return Buffer.isBuffer(p) ? p : Buffer.from(p);
      });
      return Promise.resolve(new Uint8Array(Buffer.concat(bufs)));
    };
  };

  _els = {};
  makeEl("forensic-file");
  makeEl("forensic-btn");
  makeEl("forensic-result", { style: { display: "none" } });
  makeEl("forensic-output");
  makeEl("forensic-download");
  makeEl("forensic-spinner");
  makeEl("forensic-ela-map");
  makeEl("forensic-noise-map");
  makeEl("forensic-copy-map");

  globalThis.setTimeout = setTimeout;
  globalThis.setResult = function (k, v) {
    globalThis._results = globalThis._results || {};
    globalThis._results[k] = v;
  };
  globalThis.getResult = function (k) {
    return globalThis._results ? globalThis._results[k] : undefined;
  };
  globalThis.setText = function (id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  globalThis.spinner = function (id, on) {
    var el = document.getElementById(id);
    if (el) el.style.display = on ? "" : "none";
  };
  globalThis.escHtml = function (s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };
  globalThis.getFile = function (inputId) {
    var el = document.getElementById(inputId);
    return el && el.files && el.files[0] ? el.files[0] : null;
  };
  globalThis.loadImage = async function (file) {
    var c = createCanvas(64, 64);
    var ctx = c.getContext("2d");
    var d = ctx.createImageData(64, 64);
    d.w = 64;
    d.h = 64;
    return { canvas: c, ctx: ctx, imgData: d, w: 64, h: 64 };
  };

  var coreSrc = fs.readFileSync(
    path.join(__dirname, "../../Forensic/forensic_core.js"),
    "utf8",
  );
  vm.runInThisContext(coreSrc, {
    filename: path.resolve(__dirname, "../../Forensic/forensic_core.js"),
  });

  var src = fs.readFileSync(
    path.join(__dirname, "../../Forensic/forensic.js"),
    "utf8",
  );
  vm.runInThisContext(src, {
    filename: path.resolve(__dirname, "../../Forensic/forensic.js"),
  });
});

describe("Forensic UI — forensicCanvasFromImageData", function () {
  it("should create a canvas from ImageData", function () {
    var data = new ImageData(new Uint8ClampedArray(64 * 64 * 4), 64, 64);
    var canvas = forensicCanvasFromImageData(data);
    assert.ok(canvas);
    assert.equal(canvas.width, 64);
    assert.equal(canvas.height, 64);
  });
});

describe("Forensic UI — forensicBlobFromCanvas", function () {
  it("should create a blob from canvas", async function () {
    var canvas = makeMockCanvas(16, 16);
    var blob = await forensicBlobFromCanvas(canvas, "image/png", 0.9);
    assert.ok(blob);
    assert.equal(blob.type, "image/png");
  });
});

describe("Forensic UI — forensicDiffImageData", function () {
  it("should return 0 differences for identical images", function () {
    var len = 16 * 16 * 4;
    var fill = function (arr) {
      for (var i = 0; i < len; i += 4) {
        arr[i] = 128;
        arr[i + 1] = 128;
        arr[i + 2] = 128;
        arr[i + 3] = 255;
      }
      return arr;
    };
    var aData = fill(new Uint8ClampedArray(len));
    var bData = fill(new Uint8ClampedArray(len));
    var a = new ImageData(aData, 16, 16);
    var b = new ImageData(bData, 16, 16);
    var result = forensicDiffImageData(a, b);
    assert.ok(result.imageData && result.imageData.data);
    assert.ok(result.mean_difference >= 0);
    assert.ok(result.max_difference >= 0);
    assert.ok(result.suspicion >= 0);
  });

  it("should detect differences between distinct images", function () {
    var aData = new Uint8ClampedArray(16 * 16 * 4);
    var bData = new Uint8ClampedArray(16 * 16 * 4);
    for (var i = 0; i < aData.length; i += 4) {
      aData[i] = 128;
      aData[i + 1] = 128;
      aData[i + 2] = 128;
      aData[i + 3] = 255;
      bData[i] = 0;
      bData[i + 1] = 0;
      bData[i + 2] = 0;
      bData[i + 3] = 255;
    }
    var a = new ImageData(aData, 16, 16);
    var b = new ImageData(bData, 16, 16);
    var result = forensicDiffImageData(a, b);
    assert.ok(result.mean_difference > 0);
    assert.ok(result.max_difference > 0);
    assert.ok(result.suspicion > 0);
  });

  it("should handle width/height props", function () {
    var data = new Uint8ClampedArray(8 * 8 * 4);
    var a = { data: data, w: 8, h: 8 };
    var b = { data: data, w: 8, h: 8 };
    var result = forensicDiffImageData(a, b);
    assert.ok(result.imageData && result.imageData.data);
    assert.equal(result.mean_difference, 0);
  });
});

describe("Forensic UI — forensicNoiseHeatmap", function () {
  it("should generate a heatmap with suspicious tiles highlighted", function () {
    var data = new Uint8ClampedArray(32 * 32 * 4);
    for (var i = 0; i < data.length; i += 4) {
      data[i] = 100;
      data[i + 1] = 100;
      data[i + 2] = 100;
      data[i + 3] = 255;
    }
    var imgData = new ImageData(data, 32, 32);
    var noise = {
      suspicious_tiles: [
        { x: 0, y: 0, w: 8, h: 8, score: 200 },
        { x: 16, y: 16, w: 8, h: 8, score: 50 },
      ],
      high_residual: 200,
      mean_residual: 10,
      stddev_residual: 5,
      suspicion: 0.3,
    };
    var result = forensicNoiseHeatmap(imgData, noise);
    assert.ok(result && result.data);
    assert.equal(result.width, 32);
    assert.equal(result.height, 32);
  });

  it("should handle empty suspicious_tiles", function () {
    var data = new Uint8ClampedArray(16 * 16 * 4);
    var imgData = new ImageData(data, 16, 16);
    var noise = {
      suspicious_tiles: [],
      high_residual: 0,
      mean_residual: 0,
      stddev_residual: 0,
      suspicion: 0,
    };
    var result = forensicNoiseHeatmap(imgData, noise);
    assert.ok(result && result.data);
    assert.equal(result.width, 16);
    assert.equal(result.height, 16);
  });
});

describe("Forensic UI — forensicRiskBadge", function () {
  it("should return danger badge for high level", function () {
    var html = forensicRiskBadge("high", 85);
    assert.ok(html.includes("HIGH"));
    assert.ok(html.includes("85"));
    assert.ok(html.includes("danger") || html.includes("var(--danger)"));
  });

  it("should return warning badge for medium level", function () {
    var html = forensicRiskBadge("medium", 50);
    assert.ok(html.includes("MEDIUM"));
    assert.ok(html.includes("50"));
  });

  it("should return success badge for low level", function () {
    var html = forensicRiskBadge("low", 15);
    assert.ok(html.includes("LOW"));
    assert.ok(html.includes("15"));
  });

  it("should escape HTML in level", function () {
    var html = forensicRiskBadge("<script>", 0);
    assert.ok(html.includes("&lt;SCRIPT&gt;"));
  });
});

describe("Forensic UI — forensicRenderCanvas", function () {
  it("should render canvas into DOM element", function () {
    var targetId = "forensic-ela-map";
    var data = new Uint8ClampedArray(16 * 16 * 4);
    var imgData = new ImageData(data, 16, 16);
    forensicRenderCanvas(targetId, imgData, "Test Label");
    var el = document.getElementById(targetId);
    assert.ok(el);
    assert.ok(el.innerHTML.length > 0);
    assert.ok(el.innerHTML.includes("Test Label"));
  });

  it("should do nothing if target element not found", function () {
    forensicRenderCanvas("non-existent-id", null, "Label");
  });
});

describe("Forensic UI — renderForensicResult", function () {
  function makeVis(w, h) {
    return new ImageData(new Uint8ClampedArray(w * h * 4), w, h);
  }

  it("should render a complete forensic result", function () {
    var result = {
      file: { name: "test.png", size: 1024, type: "image/png" },
      image: { width: 64, height: 64 },
      risk_score: 25,
      risk_level: "low",
      signals: ["No strong tamper signal found"],
      ela: {
        mean_difference: 0.5,
        max_difference: 2.0,
        hot_pixel_ratio: 0.01,
        suspicion: 0.02,
      },
      noise: {
        mean_residual: 3.0,
        stddev_residual: 1.5,
        suspicion: 0.1,
        high_residual: 10,
        suspicious_tiles: [],
      },
      copy_move: { match_count: 0, matches: [], suspicion: 0 },
      metadata: { suspicion: 0.05, jpeg: { is_jpeg: false }, signals: [] },
      _visuals: {
        source: makeVis(64, 64),
        ela: makeVis(64, 64),
        noise: makeVis(64, 64),
      },
    };
    renderForensicResult(result);
    var output = document.getElementById("forensic-output");
    assert.ok(output);
    assert.ok(output.innerHTML.length > 0);
    assert.ok(output.innerHTML.includes("test.png"));
    assert.ok(output.innerHTML.includes("Forensic Risk"));
  });

  it("should render with JPEG metadata", function () {
    var result = {
      file: { name: "photo.jpg", size: 2048, type: "image/jpeg" },
      image: { width: 100, height: 100 },
      risk_score: 75,
      risk_level: "high",
      signals: ["High ELA suspicion", "Noise inconsistency detected"],
      ela: {
        mean_difference: 15.2,
        max_difference: 90.0,
        hot_pixel_ratio: 0.15,
        suspicion: 0.7,
      },
      noise: {
        mean_residual: 12.0,
        stddev_residual: 8.0,
        suspicion: 0.6,
        high_residual: 50,
        suspicious_tiles: [],
      },
      copy_move: {
        match_count: 5,
        matches: [{ x1: 0, y1: 0, x2: 16, y2: 16 }],
        suspicion: 0.4,
      },
      metadata: {
        suspicion: 0.3,
        jpeg: { is_jpeg: true, app_segments: ["APP1", "APP2"] },
        signals: ["EXIF data found"],
      },
      _visuals: {
        source: makeVis(100, 100),
        ela: makeVis(100, 100),
        noise: makeVis(100, 100),
      },
    };
    renderForensicResult(result);
    var output = document.getElementById("forensic-output");
    assert.ok(output.innerHTML.includes("JPEG"));
    assert.ok(output.innerHTML.includes("APP1"));
    assert.ok(output.innerHTML.includes("High ELA suspicion"));
  });
});

describe("Forensic UI — analyzeForensics", function () {
  it("should analyze image and return forensic result", async function () {
    var c = createCanvas(64, 64);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, 64, 64);
    var buf = c.toBuffer("image/png");
    var file = new File([buf], "test.png", { type: "image/png" });
    var result = await analyzeForensics(file);
    assert.ok(result);
    assert.equal(result.file.name, "test.png");
    assert.ok(result.image.width > 0);
    assert.ok(typeof result.risk_score === "number");
    assert.ok(["low", "medium", "high"].includes(result.risk_level));
    assert.ok(Array.isArray(result.signals));
  });

  it("should reject oversized images", async function () {
    var bigBuf = Buffer.alloc(1);
    var file = new File([bigBuf], "huge.png", { type: "image/png" });
    var origMax = globalThis.FORENSIC_MAX_DIMENSION;
    globalThis.FORENSIC_MAX_DIMENSION = 0;
    try {
      await assert.rejects(function () {
        return analyzeForensics(file);
      });
    } finally {
      globalThis.FORENSIC_MAX_DIMENSION = origMax;
    }
  });
});

describe("Forensic UI — handleForensicAnalyze", function () {
  it("should show message when no file selected", async function () {
    var outputEl = document.getElementById("forensic-output");
    var resultDiv = document.getElementById("forensic-result");
    outputEl.textContent = "";
    resultDiv.style.display = "none";
    // Ensure no file is set
    var fileEl = document.getElementById("forensic-file");
    fileEl.files = undefined;

    await handleForensicAnalyze();

    assert.equal(resultDiv.style.display, "block");
    assert.ok(outputEl.textContent.includes("Please select an image first"));
  });

  it("should analyze a file and render results", async function () {
    var c = createCanvas(64, 64);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, 64, 64);
    var buf = c.toBuffer("image/png");
    var file = new File([buf], "test.png", { type: "image/png" });

    var fileEl = document.getElementById("forensic-file");
    fileEl.files = [file];

    var resultDiv = document.getElementById("forensic-result");
    resultDiv.style.display = "none";
    var outputEl = document.getElementById("forensic-output");
    outputEl.textContent = "";
    var dlEl = document.getElementById("forensic-download");
    dlEl.innerHTML = "";
    var btn = document.getElementById("forensic-btn");
    btn.disabled = false;

    await handleForensicAnalyze();

    assert.equal(resultDiv.style.display, "block");
    assert.ok(outputEl.innerHTML.length > 0);
    assert.ok(
      outputEl.innerHTML.includes("Forensic Risk"),
      "Output should contain 'Forensic Risk'",
    );
    assert.ok(dlEl.innerHTML.includes("Download"));
    assert.equal(btn.disabled, false);
    assert.ok(globalThis.forensicLastResult !== null);
  });

  it("should handle errors during analysis", async function () {
    var fileEl = document.getElementById("forensic-file");
    var smallFile = new File([Buffer.alloc(100)], "test.png", {
      type: "image/png",
    });
    fileEl.files = [smallFile];

    var outputEl = document.getElementById("forensic-output");
    outputEl.textContent = "";
    var btn = document.getElementById("forensic-btn");
    btn.disabled = false;

    // Simulate error by setting max dimension to 0 (any image will be oversized)
    var origMax = globalThis.FORENSIC_MAX_DIMENSION;
    try {
      globalThis.FORENSIC_MAX_DIMENSION = 0;
      await handleForensicAnalyze();
      assert.ok(
        outputEl.innerHTML.includes("Error") ||
          outputEl.innerHTML.includes("error"),
      );
    } finally {
      globalThis.FORENSIC_MAX_DIMENSION = origMax;
    }
    assert.equal(btn.disabled, false);
  });
});
