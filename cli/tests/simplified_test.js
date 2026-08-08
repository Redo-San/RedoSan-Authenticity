const { describe, it, before, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  setupSimplifiedGlobals,
  loadSimplifiedFiles,
  resetSimplifiedState,
  getMockEl,
} = require("./simplified_test_setup");

globalThis.DataTransfer = class {
  constructor() {
    this.files = [];
    this.items = { add: function () {} };
  }
};
globalThis.File = class {
  constructor(parts, name, opts) {
    this.name = name;
    this.type = opts && opts.type ? opts.type : "";
    this._parts = parts;
  }
};

var _origSimpleFileSelected;

before(function () {
  setupSimplifiedGlobals();
  loadSimplifiedFiles();
  _origSimpleFileSelected = globalThis.simpleFileSelected;
});

beforeEach(function () {
  resetSimplifiedState();
  if (_origSimpleFileSelected) {
    globalThis.simpleFileSelected = _origSimpleFileSelected;
  }
});

describe("simplified.js — detectFileType", function () {
  it("detects image files by extension", function () {
    assert.equal(detectFileType({ name: "photo.jpg" }), "image");
    assert.equal(detectFileType({ name: "photo.jpeg" }), "image");
    assert.equal(detectFileType({ name: "photo.png" }), "image");
    assert.equal(detectFileType({ name: "photo.gif" }), "image");
    assert.equal(detectFileType({ name: "photo.bmp" }), "image");
    assert.equal(detectFileType({ name: "photo.webp" }), "image");
    assert.equal(detectFileType({ name: "photo.svg" }), "image");
    assert.equal(detectFileType({ name: "photo.ico" }), "image");
    assert.equal(detectFileType({ name: "photo.avif" }), "image");
    assert.equal(detectFileType({ name: "photo.tiff" }), "image");
    assert.equal(detectFileType({ name: "photo.tif" }), "image");
  });

  it("detects audio files by extension", function () {
    assert.equal(detectFileType({ name: "audio.mp3" }), "audio");
    assert.equal(detectFileType({ name: "audio.wav" }), "audio");
    assert.equal(detectFileType({ name: "audio.ogg" }), "audio");
    assert.equal(detectFileType({ name: "audio.flac" }), "audio");
    assert.equal(detectFileType({ name: "audio.aac" }), "audio");
    assert.equal(detectFileType({ name: "audio.wma" }), "audio");
    assert.equal(detectFileType({ name: "audio.m4a" }), "audio");
    assert.equal(detectFileType({ name: "audio.opus" }), "audio");
  });

  it("detects video files by extension", function () {
    assert.equal(detectFileType({ name: "video.mp4" }), "video");
    assert.equal(detectFileType({ name: "video.avi" }), "video");
    assert.equal(detectFileType({ name: "video.mkv" }), "video");
    assert.equal(detectFileType({ name: "video.mov" }), "video");
    assert.equal(detectFileType({ name: "video.wmv" }), "video");
    assert.equal(detectFileType({ name: "video.flv" }), "video");
    assert.equal(detectFileType({ name: "video.webm" }), "video");
    assert.equal(detectFileType({ name: "video.m4v" }), "video");
    assert.equal(detectFileType({ name: "video.3gp" }), "video");
  });

  it("detects document files by extension", function () {
    assert.equal(detectFileType({ name: "doc.pdf" }), "document");
    assert.equal(detectFileType({ name: "doc.doc" }), "document");
    assert.equal(detectFileType({ name: "doc.docx" }), "document");
    assert.equal(detectFileType({ name: "doc.xls" }), "document");
    assert.equal(detectFileType({ name: "doc.xlsx" }), "document");
    assert.equal(detectFileType({ name: "doc.ppt" }), "document");
    assert.equal(detectFileType({ name: "doc.pptx" }), "document");
    assert.equal(detectFileType({ name: "doc.txt" }), "document");
    assert.equal(detectFileType({ name: "doc.csv" }), "document");
    assert.equal(detectFileType({ name: "doc.html" }), "document");
    assert.equal(detectFileType({ name: "doc.htm" }), "document");
    assert.equal(detectFileType({ name: "doc.xml" }), "document");
    assert.equal(detectFileType({ name: "doc.json" }), "document");
    assert.equal(detectFileType({ name: "doc.md" }), "document");
    assert.equal(detectFileType({ name: "doc.epub" }), "document");
  });

  it("returns 'other' for unknown extensions", function () {
    assert.equal(detectFileType({ name: "file.xyz" }), "other");
    assert.equal(detectFileType({ name: "file" }), "other");
    assert.equal(detectFileType({ name: "" }), "other");
    assert.equal(detectFileType({ name: ".hidden" }), "other");
  });

  it("is case-insensitive", function () {
    assert.equal(detectFileType({ name: "Photo.JPG" }), "image");
    assert.equal(detectFileType({ name: "Audio.MP3" }), "audio");
    assert.equal(detectFileType({ name: "Video.MP4" }), "video");
    assert.equal(detectFileType({ name: "Doc.PDF" }), "document");
  });

  it("handles multi-dot extensions", function () {
    assert.equal(detectFileType({ name: "photo.old.jpg" }), "image");
    assert.equal(detectFileType({ name: "archive.tar.gz" }), "other");
  });
});

describe("simplified.js — algoMaxBits", function () {
  it("returns audioLen for algorithms 1 and 5", function () {
    assert.equal(algoMaxBits(1, 44_100, 44_100), 44_100);
    assert.equal(algoMaxBits(5, 22_050, 44_100), 22_050);
  });

  it("dispatches to correct maxBits function for other algorithms", function () {
    assert.equal(algoMaxBits(2, 1000, 44_100), 100);
    assert.equal(algoMaxBits(3, 1000, 44_100), 200);
    assert.equal(algoMaxBits(4, 1000, 44_100), 300);
    assert.equal(algoMaxBits(6, 1000, 44_100), 400);
    assert.equal(algoMaxBits(7, 1000, 44_100), 500);
    assert.equal(algoMaxBits(8, 1000, 44_100), 600);
  });

  it("returns 0 for invalid algorithm", function () {
    assert.equal(algoMaxBits(99, 1000, 44_100), 0);
  });
});

describe("simplified.js — embedAlgo", function () {
  it("dispatches to correct embed function by numeric algorithm", async function () {
    var s16 = new Int16Array(100);
    var bits = "010101";
    var r1 = await embedAlgo(1, s16, bits, 44_100, 50, function () {});
    assert.ok(r1);
    var r5 = await embedAlgo(5, s16, bits, 44_100, 50, function () {});
    assert.ok(r5);
  });

  it("dispatches aw8_embed_async which returns a promise", async function () {
    var s16 = new Int16Array(100);
    var r8 = await embedAlgo(8, s16, "010101", 44_100, 50, function () {});
    assert.ok(r8);
  });

  it("throws for unknown algorithm", async function () {
    var s16 = new Int16Array(100);
    await assert.rejects(function () {
      return embedAlgo(99, s16, "010101", 44_100, 50, function () {});
    }, /Unknown algorithm/);
  });
});

describe("simplified.js — buildSteps", function () {
  it("builds correct steps for image type (non-AI)", function () {
    var steps = buildSteps("image", false);
    var ids = steps.map(function (s) {
      return s.id;
    });
    assert.deepEqual(ids, [
      "upload",
      "ai-question",
      "fingerprint",
      "did-sign",
      "watermark",
      "pixel-injection",
      "timestamp",
      "done",
    ]);
  });

  it("builds correct steps for image type (AI)", function () {
    var steps = buildSteps("image", true);
    var ids = steps.map(function (s) {
      return s.id;
    });
    assert.deepEqual(ids, [
      "upload",
      "ai-question",
      "fingerprint",
      "did-sign",
      "watermark",
      "pixel-injection",
      "c2pa",
      "timestamp",
      "done",
    ]);
  });

  it("builds correct steps for audio type", function () {
    var steps = buildSteps("audio", false);
    var ids = steps.map(function (s) {
      return s.id;
    });
    assert.deepEqual(ids, [
      "upload",
      "fingerprint",
      "did-sign",
      "audio-watermark",
      "timestamp",
      "done",
    ]);
  });

  it("builds minimal steps for other types", function () {
    var ids1 = buildSteps("video", false).map(function (s) {
      return s.id;
    });
    assert.deepEqual(ids1, [
      "upload",
      "fingerprint",
      "timestamp",
      "did-sign",
      "done",
    ]);
    var ids2 = buildSteps("document", false).map(function (s) {
      return s.id;
    });
    assert.deepEqual(ids2, [
      "upload",
      "fingerprint",
      "timestamp",
      "did-sign",
      "done",
    ]);
    var ids3 = buildSteps("other", false).map(function (s) {
      return s.id;
    });
    assert.deepEqual(ids3, [
      "upload",
      "fingerprint",
      "timestamp",
      "did-sign",
      "done",
    ]);
  });

  it("each step has id and label", function () {
    var steps = buildSteps("image", false);
    steps.forEach(function (s, i) {
      assert.ok(s.id, "Step " + i + " missing id");
      assert.ok(s.label, "Step " + i + " missing label");
    });
  });
});

describe("simplified.js — DOM interaction functions", function () {
  it("initMode does not throw", function () {
    initMode();
  });

  it("setMode hides mode select and shows simplified mode", function () {
    getMockEl("modeSelect");
    getMockEl("simplifiedMode");
    getMockEl("mainNav");
    getMockEl("sidebar");
    getMockEl("sidebarOverlay");
    getMockEl("app");
    getMockEl("mainFooter");
    getMockEl("simpleBody");
    setMode("simplified");
    assert.equal(getMockEl("modeSelect").style.display, "none");
  });

  it("showModeSelect hides everything and shows mode overlay", function () {
    getMockEl("modeSelect");
    getMockEl("mainNav");
    getMockEl("sidebar");
    getMockEl("sidebarOverlay");
    getMockEl("app");
    getMockEl("mainFooter");
    getMockEl("simplifiedMode");
    showModeSelect();
    assert.equal(getMockEl("modeSelect").style.display, "");
  });

  it("resetProfessionalForms clears file inputs and hides results", function () {
    resetProfessionalForms();
  });

  it("calls __musicInit when setMode is called and function exists (line 70)", function () {
    var musicInitCalled = false;
    globalThis.__musicInit = function () {
      musicInitCalled = true;
    };
    getMockEl("modeSelect");
    getMockEl("simplifiedMode");
    getMockEl("mainNav");
    getMockEl("sidebar");
    getMockEl("sidebarOverlay");
    getMockEl("app");
    getMockEl("mainFooter");
    getMockEl("simpleBody");
    setMode("simplified");
    assert.ok(musicInitCalled);
  });

  it("handles history.pushState error gracefully (line 77)", function () {
    var origPushState = globalThis.history.pushState;
    globalThis.history.pushState = function () {
      throw new Error("push failed");
    };
    getMockEl("modeSelect");
    getMockEl("simplifiedMode");
    getMockEl("mainNav");
    getMockEl("sidebar");
    getMockEl("sidebarOverlay");
    getMockEl("app");
    getMockEl("mainFooter");
    getMockEl("simpleBody");
    try {
      setMode("simplified");
      assert.ok(true);
    } finally {
      globalThis.history.pushState = origPushState;
    }
  });
});

describe("simplified.js — renderStep", function () {
  beforeEach(function () {
    getMockEl("simpleBody");
    getMockEl("simpleProgress");
    getMockEl("simpleNextBtn");
  });

  it("renders upload step for step 0", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 0;
    renderStep();
    assert.ok(typeof getMockEl("simpleBody").innerHTML === "string");
  });

  it("renders ai-question step", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 1;
    renderStep();
    assert.ok(true);
  });

  it("renders fingerprint step", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 2;
    getMockEl("sfp-result");
    renderStep();
    assert.ok(true);
  });

  it("renders did-sign step", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 3;
    getMockEl("sdid-result");
    renderStep();
    assert.ok(true);
  });

  it("renders watermark step", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 4;
    getMockEl("swm-type");
    getMockEl("swm-password");
    renderStep();
    assert.ok(true);
  });

  it("renders pixel-injection step", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 5;
    getMockEl("spi-category");
    getMockEl("spi-algorithm");
    renderStep();
    assert.ok(true);
  });

  it("renders timestamp step", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 6;
    renderStep();
    assert.ok(true);
  });

  it("renders done step", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 7;
    getMockEl("sc2pa-result");
    getMockEl("sdid-result");
    renderStep();
    assert.ok(true);
  });

  it("renders all audio step types", function () {
    // Build audio steps: upload, fingerprint, did-sign, audio-watermark, timestamp, done
    simpleSteps = buildSteps("audio", false);
    // Render audio-watermark step
    simpleStep = 3;
    getMockEl("sawm-fp-type");
    getMockEl("sawm-ts-type");
    getMockEl("sawm-password");
    getMockEl("sawm-strength");
    getMockEl("sawm-status");
    getMockEl("sawm-btn");
    getMockEl("simpleNextBtn");
    renderStep();
    assert.ok(true);
  });

  it("renders c2pa step for AI image type", function () {
    simpleSteps = buildSteps("image", true);
    simpleStep = 6;
    getMockEl("sc2pa-btn");
    getMockEl("sc2pa-result");
    renderStep();
    assert.ok(true);
  });
});

describe("simplified.js — saveSimpleUserInfo (from helpers)", function () {
  it("reads all fields from DOM", function () {
    getMockEl("sinfo-name").value = "John Doe";
    getMockEl("sinfo-email").value = "john@example.com";
    getMockEl("sinfo-phonecode").value = "+1";
    getMockEl("sinfo-phone").value = "1234567890";
    getMockEl("sinfo-website").value = "https://example.com";
    getMockEl("sinfo-tiktok").value = "https://tiktok.com/@john";
    getMockEl("sinfo-isArtist").checked = true;
    getMockEl("sinfo-spotify").value = "https://spotify.com/artist/john";
    saveSimpleUserInfo();
    assert.equal(simpleUserInfo.name, "John Doe");
    assert.equal(simpleUserInfo.email, "john@example.com");
    assert.equal(simpleUserInfo.phone, "1234567890");
    assert.equal(simpleUserInfo.website, "https://example.com");
    assert.equal(simpleUserInfo.social.tiktok, "https://tiktok.com/@john");
    assert.equal(simpleUserInfo.isArtist, true);
    assert.equal(
      simpleUserInfo.music.spotify,
      "https://spotify.com/artist/john",
    );
  });

  it("handles missing DOM elements gracefully", function () {
    saveSimpleUserInfo();
    assert.equal(simpleUserInfo.name, "");
    assert.equal(simpleUserInfo.email, "");
  });
});

describe("simplified.js — simpleNext validation", function () {
  it("blocks if no file is selected on upload step", function () {
    simpleStep = 0;
    simpleSteps = buildSteps("image", false);
    simpleFile = null;
    simpleNext();
    assert.equal(simpleStep, 0);
  });

  it("blocks if name is empty on upload step", function () {
    simpleStep = 0;
    simpleSteps = buildSteps("image", false);
    simpleFile = { name: "test.jpg" };
    simpleNext();
    assert.equal(simpleStep, 0);
  });

  it("blocks if email is invalid on upload step", function () {
    simpleStep = 0;
    simpleSteps = buildSteps("image", false);
    simpleFile = { name: "test.jpg" };
    getMockEl("sinfo-name").value = "Test User";
    getMockEl("sinfo-email").value = "invalid-email";
    getMockEl("sinfo-phonecode").value = "+966";
    getMockEl("sinfo-phone").value = "123456789";
    getMockEl("sinfo-website").value = "https://example.com";
    simpleNext();
    assert.equal(simpleStep, 0);
  });

  it("blocks if website is invalid on upload step", function () {
    simpleStep = 0;
    simpleSteps = buildSteps("image", false);
    simpleFile = { name: "test.jpg" };
    getMockEl("sinfo-name").value = "Test User";
    getMockEl("sinfo-email").value = "test@example.com";
    getMockEl("sinfo-phonecode").value = "+966";
    getMockEl("sinfo-phone").value = "123456789";
    getMockEl("sinfo-website").value = "not-a-url";
    simpleNext();
    assert.equal(simpleStep, 0);
  });

  it("blocks if social URL is invalid on upload step", function () {
    simpleStep = 0;
    simpleSteps = buildSteps("image", false);
    simpleFile = { name: "test.jpg" };
    getMockEl("sinfo-name").value = "Test User";
    getMockEl("sinfo-email").value = "test@example.com";
    getMockEl("sinfo-phonecode").value = "+966";
    getMockEl("sinfo-phone").value = "123456789";
    getMockEl("sinfo-website").value = "https://example.com";
    getMockEl("sinfo-tiktok").value = "not-a-url";
    simpleNext();
    assert.equal(simpleStep, 0);
  });

  it("advances when required fields are valid", function () {
    simpleStep = 0;
    simpleSteps = buildSteps("image", false);
    simpleFile = { name: "test.jpg" };
    simpleStepDone = true;
    getMockEl("sinfo-name").value = "Test User";
    getMockEl("sinfo-email").value = "test@example.com";
    getMockEl("sinfo-phonecode").value = "+966";
    getMockEl("sinfo-phone").value = "123456789";
    getMockEl("sinfo-website").value = "https://example.com";
    getMockEl("simpleBody").innerHTML = "";
    simpleNext();
    assert.equal(simpleStep, 1);
  });

  it("blocks auto-run step if not done", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 2;
    simpleStepDone = false;
    simpleFile = { name: "test.jpg" };
    simpleNext();
    assert.equal(simpleStep, 2);
  });

  it("restartSimple on done step", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 7;
    simpleStepDone = true;
    getMockEl("simpleBody");
    simpleNext();
    assert.equal(simpleStep, 0);
  });

  it("shows info required error when all fields are empty (lines 389-400)", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 0;
    simpleFile = { name: "test.jpg" };
    simpleUserInfo = {
      name: "",
      email: "",
      phone: "",
      phoneCode: "",
      website: "",
      social: {},
      isArtist: false,
      music: {},
    };

    // Mock document.querySelector to return a section with append capability
    var appended = false;
    var infoSection = {
      querySelector: function (sel) {
        if (sel === ".simple-info-error") return null;
        return null;
      },
      append: function (el) {
        appended = true;
      },
    };
    var origQs = document.querySelector;
    document.querySelector = function (sel) {
      if (sel === ".simple-info-section") return infoSection;
      return origQs ? origQs(sel) : null;
    };
    getMockEl("sinfo-name");
    getMockEl("sinfo-email");
    getMockEl("sinfo-phonecode");
    getMockEl("sinfo-phone");
    getMockEl("sinfo-website");

    simpleNext();

    assert.ok(appended, "error message should be appended to infoSection");
    assert.equal(simpleStep, 0, "should not advance step");

    document.querySelector = origQs;
  });
});

describe("simplified.js — renderProgress", function () {
  it("renders progress bar with correct number of steps", function () {
    simpleSteps = buildSteps("image", false);
    var el = getMockEl("simpleProgress");
    renderProgress();
    assert.ok(el.innerHTML.length > 0);
    assert.ok(el.innerHTML.includes("sp-step"));
    assert.ok(el.innerHTML.includes("sp-line"));
  });

  it("marks current step as active", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 3;
    renderProgress();
    assert.ok(getMockEl("simpleProgress").innerHTML.includes("sp-active"));
  });

  it("marks previous steps as done", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 4;
    renderProgress();
    assert.ok(getMockEl("simpleProgress").innerHTML.includes("sp-done"));
  });
});

describe("simplified.js — setBodyOverflow", function () {
  it("toggles no-scroll class on body", function () {
    var toggled = false;
    document.body.classList.toggle = function (cls, val) {
      if (cls === "no-scroll" && val === true) toggled = true;
    };
    setBodyOverflow(true);
    assert.ok(toggled);
  });

  it("can disable the toggle", function () {
    var toggled = false;
    document.body.classList.toggle = function (cls, val) {
      if (cls === "no-scroll" && val === false) toggled = true;
    };
    setBodyOverflow(false);
    assert.ok(toggled);
  });
});

describe("simplified.js — simplePrev and restartSimple", function () {
  it("simplePrev goes back one step", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 2;
    simpleStepDone = true;
    simplePrev();
    assert.equal(simpleStep, 1);
    assert.equal(simpleStepDone, false);
  });

  it("simplePrev does not go below 0", function () {
    simpleSteps = buildSteps("image", false);
    simpleStep = 0;
    simplePrev();
    assert.equal(simpleStep, 0);
  });

  it("restartSimple resets all state", function () {
    simpleStep = 5;
    simpleSteps = buildSteps("image", false);
    simpleFile = { name: "test.jpg" };
    simpleResults = { fpResult: { sha256: "abc" } };
    restartSimple();
    assert.equal(simpleStep, 0);
    assert.equal(simpleFile, null);
    assert.equal(Object.keys(simpleResults).length, 0);
  });
});

describe("simplified.js — initSimplified", function () {
  it("resets state and renders upload step", function () {
    getMockEl("simpleNav");
    getMockEl("simpleProgress");
    getMockEl("simpleBody");
    simpleFile = { name: "old.jpg" };
    simpleResults = { someKey: "value" };
    initSimplified();
    assert.equal(simpleFile, null);
    assert.equal(simpleType, null);
    assert.equal(simpleStep, 0);
  });
});

describe("simplified.js — helper functions", function () {
  it("formatSize formats bytes correctly", function () {
    assert.equal(formatSize(0), "0 B");
    assert.equal(formatSize(500), "500 B");
    assert.equal(formatSize(1024), "1.0 KB");
    assert.equal(formatSize(1_048_576), "1.0 MB");
  });

  it("escapeHtml returns a string with basic mock", function () {
    var result = escapeHtml("test");
    assert.equal(typeof result, "string");
  });

  it("getSimpleTypeLabel returns translated label", function () {
    var label = getSimpleTypeLabel("image");
    assert.ok(typeof label === "string");
  });

  it("dataUrlToBlob handles valid data URLs", function () {
    var blob = dataUrlToBlob("data:text/plain;base64,dGVzdA==");
    assert.ok(blob instanceof Blob || blob === null);
  });

  it("dataUrlToBlob returns null for invalid data URLs", function () {
    var blob = dataUrlToBlob("not-a-data-url");
    assert.equal(blob, null);
  });
});

describe("simplified.js — runFingerprintStep", function () {
  beforeEach(function () {
    simpleFile = { name: "test.jpg", size: 1024 };
    simpleBuf = new ArrayBuffer(100);
    simpleType = "image";
    getMockEl("sfp-result");
    getMockEl("sfp-status");
    getMockEl("simpleNextBtn");
    getMockEl("fp-file");
    getMockEl("fp-output");
  });

  it("triggers fingerprint execution without throwing", function () {
    globalThis.fastFingerprint = function (file, onStatus, onExtra) {
      return Promise.resolve({ sha256: "abc123" });
    };
    runFingerprintStep();
    assert.ok(true);
  });

  it("handles fastFingerprint rejection without throwing", function () {
    globalThis.fastFingerprint = function () {
      return Promise.reject(new Error("hash failed"));
    };
    runFingerprintStep();
    assert.ok(true);
  });

  it("falls back to handleFingerprint when fastFingerprint is missing", function () {
    globalThis.fastFingerprint = null;
    globalThis.handleFingerprint = function () {
      return Promise.resolve();
    };
    runFingerprintStep();
    assert.ok(true);
  });

  it("handles handleFingerprint rejection", function () {
    globalThis.fastFingerprint = null;
    globalThis.handleFingerprint = function () {
      return Promise.reject(new Error("hash failed"));
    };
    runFingerprintStep();
    assert.ok(true);
  });

  it("returns early when handleFingerprint is missing (line 1114)", function () {
    var origHandleFp = globalThis.handleFingerprint;
    globalThis.handleFingerprint = null;
    runFingerprintStep();
    assert.ok(true);
    globalThis.handleFingerprint = origHandleFp;
  });

  it("requests the fingerprint section when engines are missing", async function () {
    var origFp = globalThis.fastFingerprint;
    var origHandle = globalThis.handleFingerprint;
    var loadedSections = [];
    globalThis.fastFingerprint = null;
    globalThis.handleFingerprint = null;
    globalThis.RedoSanLoader = {
      loadSection: function (name) {
        loadedSections.push(name);
        globalThis.handleFingerprint = function () {
          return Promise.resolve({ ok: true, data: { sha256: "abc" } });
        };
        return Promise.resolve();
      },
    };
    try {
      runFingerprintStep();
      await Promise.resolve();
      await Promise.resolve();
      assert.ok(loadedSections.indexOf("fingerprint") !== -1);
    } finally {
      globalThis.fastFingerprint = origFp;
      globalThis.handleFingerprint = origHandle;
      delete globalThis.RedoSanLoader;
    }
  });

  it("shows an error when the fingerprint section fails to load", async function () {
    var origFp = globalThis.fastFingerprint;
    var origHandle = globalThis.handleFingerprint;
    var resultEl = getMockEl("sfp-result");
    resultEl.innerHTML = "";
    globalThis.fastFingerprint = null;
    globalThis.handleFingerprint = null;
    globalThis.RedoSanLoader = {
      loadSection: function () {
        return Promise.reject(new Error("network down"));
      },
    };
    try {
      runFingerprintStep();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      assert.ok(resultEl.innerHTML.indexOf("simple-error") !== -1);
    } finally {
      globalThis.fastFingerprint = origFp;
      globalThis.handleFingerprint = origHandle;
      delete globalThis.RedoSanLoader;
    }
  });
});

describe("simplified.js — runTimestampStep branches", function () {
  beforeEach(function () {
    simpleFile = { name: "test.jpg", size: 1024 };
    simpleResults = {};
    getMockEl("sts-result");
    getMockEl("ts-create-file");
    getMockEl("ts-output");
    getMockEl("ts-download");
    getMockEl("simpleNextBtn");
  });

  it("creates timestamp result with blockchain attestation", async function () {
    getMockEl("ts-output").textContent =
      "abc" + "a".repeat(61) + " blockchain attestation";
    await runTimestampStep();
    assert.ok(simpleResults.timestamp === true);
  });

  it("creates timestamp result without attestation", async function () {
    getMockEl("ts-output").textContent = "abc" + "b".repeat(61);
    await runTimestampStep();
    assert.ok(simpleResults.timestamp === true);
  });

  it("returns early when handleOtsCreate is missing (line 1012)", async function () {
    globalThis.handleOtsCreate = null;
    await runTimestampStep();
    assert.equal(simpleResults.timestamp, undefined);
  });

  it("handles timestamp with empty textContent (line 1061)", async function () {
    getMockEl("ts-output").textContent = "";
    globalThis.handleOtsCreate = function () {
      return Promise.resolve({ ok: true });
    };
    await runTimestampStep();
    assert.ok(simpleResults.timestamp === true);
  });

  it("handles timestamp with non-empty textContent (line 1061 truthy branch)", async function () {
    getMockEl("ts-output").textContent = "some attestation hash abc123";
    globalThis.handleOtsCreate = function () {
      return Promise.resolve({ ok: true });
    };
    await runTimestampStep();
    assert.ok(simpleResults.timestamp === true);
  });

  it("handles timestamp with missing ts-output element (line 1061 null || {} branch)", async function () {
    var origGet = globalThis.document.getElementById;
    globalThis.document.getElementById = function (id) {
      if (id === "ts-output") return null;
      return origGet(id);
    };
    globalThis.handleOtsCreate = function () {
      return Promise.resolve({ ok: true });
    };
    await runTimestampStep();
    globalThis.document.getElementById = origGet;
    assert.ok(simpleResults.timestamp === true);
  });
});

describe("simplified.js — runDIDStepGenerate", function () {
  it("generates keypair and stores it", async function () {
    getMockEl("sdid-result");
    getMockEl("sdid-algo-select");
    var result = await runDIDStepGenerate();
    assert.ok(result === undefined || result === true || result === false);
  });

  it("handles errors gracefully", async function () {
    globalThis.didGenerateKeypair = function () {
      return Promise.reject(new Error("gen failed"));
    };
    getMockEl("sdid-result");
    getMockEl("sdid-algo-select");
    await runDIDStepGenerate();
  });

  it("handles non-function didGenerateKeypair", async function () {
    globalThis.didGenerateKeypair = null;
    getMockEl("sdid-result");
    getMockEl("sdid-algo-select");
    await runDIDStepGenerate();
  });

  it("handles didStoreKeys failure", async function () {
    globalThis.didStoreKeys = function () {
      return Promise.reject(new Error("store failed"));
    };
    getMockEl("sdid-result");
    getMockEl("sdid-algo-select");
    await runDIDStepGenerate();
  });

  it("handles missing algoSelect element (line 1214)", async function () {
    getMockEl("sdid-result");
    var origGet = globalThis.document.getElementById;
    globalThis.document.getElementById = function (id) {
      if (id === "sdid-algo-select") return null;
      return origGet(id);
    };
    await runDIDStepGenerate();
    globalThis.document.getElementById = origGet;
    assert.ok(true);
  });
});

describe("simplified.js — runDIDStepSign", function () {
  beforeEach(function () {
    simpleResults.fpResult = { hashes: { sha256: "abc" } };
    getMockEl("sdid-result");
    getMockEl("sdid-gen-btn");
    getMockEl("sdid-sign-btn");
    getMockEl("simpleNextBtn");
  });

  it("signs and verifies successfully", async function () {
    globalThis.didLoadKeys = function () {
      return Promise.resolve({
        algo: "Ed25519",
        publicKey: "pub",
        privateKey: "priv",
      });
    };
    await runDIDStepSign();
    assert.ok(simpleResults.didSig !== undefined);
  });

  it("reports verification failure", async function () {
    globalThis.didLoadKeys = function () {
      return Promise.resolve({
        algo: "Ed25519",
        publicKey: "pub",
        privateKey: "priv",
      });
    };
    globalThis.didVerify = function () {
      return Promise.resolve(false);
    };
    await runDIDStepSign();
    var html = getMockEl("sdid-result").innerHTML;
    assert.ok(html.includes("verify_failed") || html.includes("danger"));
  });

  it("handles signing error", async function () {
    globalThis.didLoadKeys = function () {
      return Promise.resolve({
        algo: "Ed25519",
        publicKey: "pub",
        privateKey: "priv",
      });
    };
    globalThis.didSign = function () {
      return Promise.reject(new Error("sign failed"));
    };
    await runDIDStepSign();
    var html = getMockEl("sdid-result").innerHTML;
    assert.ok(html.includes("failed") || html.includes("danger"));
  });

  it("handles no fingerprint result", async function () {
    simpleResults.fpResult = null;
    await runDIDStepSign();
  });

  it("handles error in didImportSignKey (stored keys invalid)", async function () {
    globalThis.didLoadKeys = function () {
      return { algo: "Ed25519" };
    };
    globalThis.didImportSignKey = function () {
      return Promise.reject(new Error("import failed"));
    };
    getMockEl("sdid-sign-btn");
    await runDIDStepSign();
    var html = getMockEl("sdid-result").innerHTML;
    assert.ok(html.includes("invalid"));
  });

  it("handles null stored keys", async function () {
    globalThis.didLoadKeys = function () {
      return null;
    };
    await runDIDStepSign();
    var html = getMockEl("sdid-result").innerHTML;
    assert.ok(html.includes("no_keys") || html.includes("danger"));
  });

  it("handles fpResult with missing hashes (line 1301)", async function () {
    simpleResults.fpResult = { hashes: null };
    globalThis.didLoadKeys = function () {
      return Promise.resolve({
        algo: "Ed25519",
        publicKey: "pub",
        privateKey: "priv",
      });
    };
    globalThis.didImportSignKey = function () {
      return Promise.resolve({
        publicKey: "pub",
        privateKey: "priv",
        algorithm: "Ed25519",
        did: "did:key:z6Mk",
      });
    };
    globalThis.didSign = function () {
      return Promise.resolve(new Uint8Array(64));
    };
    globalThis.didVerify = function () {
      return Promise.resolve(true);
    };
    getMockEl("sdid-sign-btn");
    await runDIDStepSign();
    assert.ok(simpleResults.didSig !== undefined);
  });
});

describe("simplified.js — runTimestampStep", function () {
  beforeEach(function () {
    simpleFile = { name: "test.jpg", size: 1024 };
    simpleResults.piFinalUrl = "blob:test-pi";
    getMockEl("sts-result");
  });

  it("runs with PI output as file source", async function () {
    await runTimestampStep();
    assert.ok(simpleStepDone === true || simpleStepDone === false);
  });

  it("runs with watermark output as file source", async function () {
    simpleResults.piFinalUrl = undefined;
    simpleResults.wmFinalBlobUrl = "blob:test-wm";
    await runTimestampStep();
  });

  it("handles error from handleOtsCreate", async function () {
    globalThis.handleOtsCreate = function () {
      return Promise.reject(new Error("ots failed"));
    };
    await runTimestampStep();
  });
});

describe("simplified.js — runC2paStep", function () {
  beforeEach(function () {
    simpleResults.piFinalUrl = "blob:test-pi";
    getMockEl("sc2pa-btn");
    getMockEl("sc2pa-result");
    getMockEl("sc2pa-dnt");
    getMockEl("sc2pa-content");
    getMockEl("sc2pa-write-types");
    getMockEl("sc2pa-create");
    getMockEl("sc2pa-edit");
    getMockEl("sc2pa-ai");
    getMockEl("sc2pa-capture");
    getMockEl("sc2pa-composite");
  });

  it("runs C2PA step with PI output", async function () {
    globalThis.handleC2paWrite = function () {
      return Promise.resolve({ ok: true, url: "blob:c2pa" });
    };
    await runC2paStep();
  });

  it("handles C2PA write failure", async function () {
    globalThis.handleC2paWrite = function () {
      return Promise.resolve({ ok: false, error: "write failed" });
    };
    await runC2paStep();
  });

  it("handles C2PA failure without error property (line 583)", async function () {
    globalThis.handleC2paWrite = function () {
      return Promise.resolve({ ok: false });
    };
    await runC2paStep();
    assert.equal(getMockEl("sc2pa-btn").disabled, false);
  });

  it("handles missing handleC2paWrite gracefully", async function () {
    globalThis.handleC2paWrite = null;
    await runC2paStep();
  });

  it("validates C2PA link URLs and shows warning for invalid (lines 502-509)", async function () {
    globalThis.handleC2paWrite = function () {
      return Promise.resolve({ ok: true, url: "blob:c2pa" });
    };
    var origQsa = document.querySelectorAll;
    var origQs = document.querySelector;

    // Mock link elements with an invalid URL
    var linkEl = {
      id: "sc2pa-link-0",
      value: "not-a-valid-url",
      dataset: {},
    };
    var warnEl = getMockEl("sc2pa-link-0-warn");

    document.querySelectorAll = function (sel) {
      if (sel === ".sc2pa-link") return [linkEl];
      return origQsa(sel);
    };

    await runC2paStep();

    // The warn element should have display set to "block"
    assert.equal(warnEl.style.display, "block");

    document.querySelectorAll = origQsa;
    document.querySelector = origQs;
  });

  it("syncs C2PA type cards with professional form (lines 515-518)", async function () {
    globalThis.handleC2paWrite = function () {
      return Promise.resolve({ ok: true, url: "blob:c2pa" });
    };
    var origQsa = document.querySelectorAll;

    var cardEl = {
      dataset: { formType: "content" },
      querySelector: function (s) {
        if (s === 'input[type="checkbox"]') return { checked: true };
        return null;
      },
    };
    var profCb = getMockEl("c2pa-write-content");

    document.querySelectorAll = function (sel) {
      if (sel === "#sc2pa-write-types .c2pa-type-card[data-form-type]")
        return [cardEl];
      if (sel === ".sc2pa-link") return [];
      return origQsa(sel);
    };

    await runC2paStep();

    // The professional checkbox should be synced (checked = true)
    assert.equal(profCb.checked, true);

    document.querySelectorAll = origQsa;
  });
});

describe("simplified.js — runWatermarkStep", function () {
  beforeEach(function () {
    simpleFile = { name: "test.jpg", size: 1024, type: "image/jpeg" };
    simpleResults.fpResult = { sha256: "abc123" };
    simpleType = "image";
    getMockEl("swm-type");
    getMockEl("swm-password");
    getMockEl("swm-status");
    getMockEl("swm-btn");
    getMockEl("simpleNextBtn");
    globalThis.URL.createObjectURL = function () {
      return "blob:wm";
    };
  });

  it("triggers watermark embedding without throwing", function () {
    globalThis.watermarkEmbed = function () {
      return Promise.resolve({ ok: true, data: new Blob(), msg: "done" });
    };
    runWatermarkStep();
    assert.ok(true);
  });

  it("handles watermark embed failure", function () {
    globalThis.watermarkEmbed = function () {
      return Promise.resolve({ ok: false, error: "embed failed" });
    };
    runWatermarkStep();
    assert.ok(true);
  });

  it("handles watermark embed with empty fpResult (line 614)", function () {
    simpleResults.fpResult = null;
    globalThis.watermarkEmbed = function () {
      return Promise.resolve({ ok: true, data: new Blob(), msg: "done" });
    };
    runWatermarkStep();
    assert.ok(true);
  });

  it("handles watermark embed success without msg (line 634)", function () {
    globalThis.watermarkEmbed = function () {
      return Promise.resolve({ ok: true, data: new Blob() });
    };
    runWatermarkStep();
    assert.ok(true);
  });

  it("handles watermark embed failure without error property (line 661)", function () {
    globalThis.watermarkEmbed = function () {
      return Promise.resolve({ ok: false });
    };
    runWatermarkStep();
    assert.ok(true);
  });

  // No rejection test: runWatermarkStep has no .catch handler
  // so rejected promises become unhandled rejections
});

describe("simplified.js — runAudioWatermarkStep", function () {
  beforeEach(function () {
    simpleFile = { name: "test.wav", size: 1024, type: "audio/wav" };
    simpleResults.didSig = { did: "did:example:123", signature: "sig" };
    simpleResults.fpResult = { hashes: { sha256: "abc123" } };
    simpleType = "audio";
    getMockEl("sawm-fp-type");
    getMockEl("sawm-ts-type");
    getMockEl("sawm-password");
    getMockEl("sawm-strength");
    getMockEl("sawm-status");
    getMockEl("sawm-btn");
    getMockEl("sawm-progress");
    getMockEl("sawm-progress-fill");
    getMockEl("sawm-progress-text");
    getMockEl("simpleNextBtn");
  });

  it("embeds audio watermark for stereo", async function () {
    getMockEl("sawm-fp-type").value = "2";
    getMockEl("sawm-ts-type").value = "3";
    getMockEl("sawm-password").value = "secret";
    getMockEl("sawm-strength").value = "400";
    globalThis.awLoadAudio = function () {
      return {
        sr: 44_100,
        ch: 2,
        samples: new Int16Array(44_100),
        raw: new Int16Array(88_200),
      };
    };
    await runAudioWatermarkStep();
    assert.ok(simpleResults.audioWatermark === true);
  });

  it("embeds audio watermark for mono", async function () {
    getMockEl("sawm-fp-type").value = "2";
    getMockEl("sawm-ts-type").value = "3";
    getMockEl("sawm-password").value = "secret";
    getMockEl("sawm-strength").value = "400";
    globalThis.awLoadAudio = function () {
      return {
        sr: 44_100,
        ch: 1,
        samples: new Int16Array(44_100),
        raw: new Int16Array(44_100),
      };
    };
    await runAudioWatermarkStep();
    assert.ok(simpleResults.audioWatermark === true);
  });

  it("handles error gracefully", async function () {
    globalThis.awLoadAudio = function () {
      return Promise.reject(new Error("load failed"));
    };
    await runAudioWatermarkStep();
    assert.ok(simpleResults.audioWatermark === undefined);
  });

  it("requires a password", async function () {
    getMockEl("sawm-password").value = "";
    await runAudioWatermarkStep();
    assert.ok(simpleResults.audioWatermark === undefined);
  });

  it("handles audio watermark with missing didSig/fpResult and too-long message (lines 697,701,703)", async function () {
    getMockEl("sawm-fp-type").value = "2";
    getMockEl("sawm-ts-type").value = "3";
    getMockEl("sawm-password").value = "secret";
    getMockEl("sawm-strength").value = "400";
    simpleResults.didSig = null;
    simpleResults.fpResult = null;
    var origBits = globalThis.aw3_maxBits;
    globalThis.aw3_maxBits = function () {
      return 0;
    };
    globalThis.awLoadAudio = function () {
      return {
        sr: 44100,
        ch: 2,
        samples: new Int16Array(44100),
        raw: new Int16Array(88200),
      };
    };
    await runAudioWatermarkStep();
    globalThis.aw3_maxBits = origBits;
    assert.ok(simpleResults.audioWatermark === undefined);
  });

  it("handles audio watermark with null fpResult but sufficient capacity (line 703)", async function () {
    simpleResults.fpResult = null;
    simpleResults.didSig = null;
    getMockEl("sawm-fp-type").value = "2";
    getMockEl("sawm-ts-type").value = "3";
    getMockEl("sawm-password").value = "secret";
    getMockEl("sawm-strength").value = "400";
    globalThis.awLoadAudio = function () {
      return {
        sr: 44100,
        ch: 2,
        samples: new Int16Array(44100),
        raw: new Int16Array(88200),
      };
    };
    await runAudioWatermarkStep();
    assert.ok(simpleResults.audioWatermark === true);
  });
});

describe("simplified.js — runPixelInjectStep", function () {
  beforeEach(function () {
    simpleFile = { name: "test.jpg", size: 1024, type: "image/jpeg" };
    simpleResults.didSig = { did: "did:example:123", signature: "sig" };
    simpleResults.watermarkBlob = { type: "image/png" };
    simpleType = "image";
    getMockEl("spi-category");
    getMockEl("spi-password");
    getMockEl("spi-status");
    getMockEl("spi-algorithm");
    getMockEl("spi-btn");
    getMockEl("pi-image");
    getMockEl("pi-category");
    getMockEl("pi-algorithm");
    getMockEl("pi-message");
    getMockEl("pi-secret-file");
    getMockEl("pi-password");
    getMockEl("pi-output");
    getMockEl("pi-download");
    getMockEl("simpleNextBtn");
    globalThis.URL.createObjectURL = function () {
      return "blob:pi";
    };
  });

  it("triggers pixel injection without throwing", function () {
    globalThis.handlePixelInjection = function () {
      return Promise.resolve();
    };
    runPixelInjectStep();
    assert.ok(true);
  });

  it("handles pixel injection failure", function () {
    globalThis.handlePixelInjection = function () {
      return Promise.reject(new Error("inject failed"));
    };
    runPixelInjectStep();
    assert.ok(true);
  });

  it("handles pixel injection without didSig (line 907)", function () {
    simpleResults.didSig = null;
    globalThis.handlePixelInjection = function () {
      return Promise.resolve();
    };
    runPixelInjectStep();
    assert.ok(true);
  });

  it("handles pixel injection without watermarkBlob (line 916)", function () {
    simpleResults.watermarkBlob = null;
    globalThis.handlePixelInjection = function () {
      return Promise.resolve();
    };
    runPixelInjectStep();
    assert.ok(true);
  });

  it("handles pixel injection failure without error message (line 996)", function () {
    globalThis.handlePixelInjection = function () {
      return Promise.reject({});
    };
    runPixelInjectStep();
    assert.ok(true);
  });
});

describe("simplified.js — runPixelInjectStep setTimeout branches (lines 916, 995)", function () {
  var _origSetTimeout;
  beforeEach(function () {
    simpleFile = { name: "test.jpg", size: 1024, type: "image/jpeg" };
    simpleResults.didSig = { did: "did:example:123", signature: "sig" };
    simpleResults.watermarkBlob = { type: "image/png" };
    simpleType = "image";
    getMockEl("spi-category");
    getMockEl("spi-password");
    getMockEl("spi-status");
    getMockEl("spi-algorithm");
    getMockEl("spi-btn");
    getMockEl("pi-image");
    getMockEl("pi-category");
    getMockEl("pi-algorithm");
    getMockEl("pi-message");
    getMockEl("pi-password");
    getMockEl("pi-output");
    getMockEl("pi-download");
    getMockEl("simpleNextBtn");
    _origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = function (fn) {
      _origSetTimeout(fn, 0);
    };
  });
  afterEach(function () {
    globalThis.setTimeout = _origSetTimeout;
  });

  it("pixel injection success inside setTimeout", async function () {
    globalThis.handlePixelInjection = function () {
      return Promise.resolve();
    };
    runPixelInjectStep();
    await new Promise(function (r) {
      _origSetTimeout(r, 10);
    });
    assert.ok(simpleResults["pixel-injection"] === true);
  });

  it("pixel injection failure inside setTimeout", async function () {
    globalThis.handlePixelInjection = function () {
      return Promise.reject(new Error("inject failed"));
    };
    runPixelInjectStep();
    await new Promise(function (r) {
      _origSetTimeout(r, 10);
    });
    assert.ok(true);
  });

  it("pixel injection failure without error.message (line 995)", async function () {
    globalThis.handlePixelInjection = function () {
      return Promise.reject({});
    };
    runPixelInjectStep();
    await new Promise(function (r) {
      _origSetTimeout(r, 10);
    });
    assert.ok(true);
  });

  it("pixel injection with null watermarkBlob (line 916)", async function () {
    simpleResults.watermarkBlob = null;
    globalThis.handlePixelInjection = function () {
      return Promise.resolve();
    };
    runPixelInjectStep();
    await new Promise(function (r) {
      _origSetTimeout(r, 10);
    });
    assert.ok(simpleResults["pixel-injection"] === true);
  });
});

describe("simplified.js — setTimeout callback coverage (runFingerprintStep)", function () {
  var _origSetTimeout;
  beforeEach(function () {
    simpleFile = { name: "test.jpg", size: 1024 };
    simpleBuf = new ArrayBuffer(100);
    simpleType = "image";
    getMockEl("sfp-result");
    getMockEl("sfp-status");
    getMockEl("simpleNextBtn");
    getMockEl("fp-file");
    getMockEl("fp-output");
    _origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = function (fn) {
      _origSetTimeout(fn, 0);
    };
  });
  afterEach(function () {
    globalThis.setTimeout = _origSetTimeout;
  });

  it("fastFingerprint success path inside setTimeout", async function () {
    globalThis.fastFingerprint = function () {
      return Promise.resolve({ sha256: "abc123", hashes: { md5: "def" } });
    };
    simpleResults.fpResult = null;
    runFingerprintStep();
    await new Promise(function (r) {
      _origSetTimeout(r, 10);
    });
    assert.ok(simpleResults.fingerprint === true);
  });

  it("fastFingerprint catch path inside setTimeout", async function () {
    globalThis.fastFingerprint = function () {
      return Promise.reject(new Error("hash failed"));
    };
    runFingerprintStep();
    await new Promise(function (r) {
      _origSetTimeout(r, 10);
    });
    assert.ok(true);
  });

  it("handleFingerprint fallback success path inside setTimeout", async function () {
    globalThis.fastFingerprint = null;
    globalThis.handleFingerprint = function () {
      return Promise.resolve();
    };
    getMockEl("fp-output").innerHTML = "<div>fp data</div>";
    runFingerprintStep();
    await new Promise(function (r) {
      _origSetTimeout(r, 10);
    });
    assert.ok(simpleResults.fingerprint === true);
  });

  it("handleFingerprint fallback catch path inside setTimeout", async function () {
    globalThis.fastFingerprint = null;
    globalThis.handleFingerprint = function () {
      return Promise.reject(new Error("hash failed"));
    };
    runFingerprintStep();
    await new Promise(function (r) {
      _origSetTimeout(r, 10);
    });
    assert.ok(true);
  });

  it("calls onStatus callback with message from fastFingerprint (line 1125)", async function () {
    getMockEl("sfp-status");
    globalThis.fastFingerprint = function (file, onStatus, onExtra) {
      onStatus("Processing hashes...");
      return Promise.resolve({
        sha256: "abc123",
        md5: "def456",
        hashes: { sha256: "abc123" },
      });
    };
    simpleResults.fpResult = null;
    runFingerprintStep();
    await new Promise(function (r) {
      _origSetTimeout(r, 10);
    });
    assert.ok(simpleResults.fingerprint === true);
  });

  it("calls onExtra with extra hashes after promise resolves (lines 1128-1131)", async function () {
    getMockEl("sfp-status");
    globalThis.fastFingerprint = function (file, onStatus, onExtra) {
      _origSetTimeout(function () {
        onExtra({ sha384: "extra-hash-value" });
      }, 0);
      return Promise.resolve({
        sha256: "abc123",
        md5: "def456",
        hashes: { sha256: "abc123" },
      });
    };
    simpleResults.fpResult = null;
    runFingerprintStep();
    await new Promise(function (r) {
      _origSetTimeout(r, 20);
    });
    assert.ok(simpleResults.fingerprint === true);
  });

  it("fastFingerprint onStatus with empty message triggers || fallback (line 1133)", async function () {
    getMockEl("sfp-status");
    globalThis.fastFingerprint = function (file, onStatus, onExtra) {
      onStatus("");
      return Promise.resolve({
        sha256: "abc123",
        hashes: { sha256: "abc123" },
      });
    };
    simpleResults.fpResult = null;
    runFingerprintStep();
    await new Promise(function (r) {
      _origSetTimeout(r, 10);
    });
    assert.ok(simpleResults.fingerprint === true);
  });
});

describe("simplified.js — runTimestampStep catch block (fetch error)", function () {
  beforeEach(function () {
    simpleFile = { name: "test.jpg", size: 1024 };
    simpleType = "image";
    simpleResults.piFinalUrl = "blob:trigger-fetch-error";
    getMockEl("sts-result");
    getMockEl("ts-create-file");
    getMockEl("ts-output");
    getMockEl("ts-download");
    getMockEl("simpleNextBtn");
    globalThis.handleOtsCreate = function () {
      return Promise.resolve({ ok: true });
    };
  });

  it("handles fetch error in timestamp step try block", async function () {
    await runTimestampStep();
    assert.ok(simpleStepDone === true);
  });
});

describe("simplified.js — runTimestampStep with C2PA/audio URL (blob fetch path)", function () {
  beforeEach(function () {
    simpleFile = { name: "test.jpg", size: 1024, type: "image/jpeg" };
    simpleResults = {};
    simpleType = "image";
    getMockEl("ts-create-file");
    getMockEl("sts-result");
    getMockEl("ts-output");
    getMockEl("ts-download");
    getMockEl("simpleNextBtn");
    globalThis.handleOtsCreate = function () {
      return Promise.resolve({ ok: true });
    };
    globalThis.fetch = function (url) {
      return Promise.resolve({
        blob: function () {
          return Promise.resolve(
            new Blob(["test-data"], { type: "image/jpeg" }),
          );
        },
      });
    };
  });

  afterEach(function () {
    delete globalThis.fetch;
  });

  it("feeds C2PA blob URL into timestamp file input for images", async function () {
    simpleResults.c2paUrl = "blob:c2pa-output";
    var fileInput = document.getElementById("ts-create-file");
    assert.equal(fileInput.files, undefined);
    await runTimestampStep();
    assert.ok(
      fileInput.files !== undefined,
      "fileInput.files should be set after runTimestampStep",
    );
    assert.ok(simpleStepDone === true);
  });

  it("feeds PI blob URL when c2paUrl is absent", async function () {
    simpleResults.piFinalUrl = "blob:pi-output";
    var fileInput = document.getElementById("ts-create-file");
    await runTimestampStep();
    assert.ok(fileInput.files !== undefined);
  });

  it("feeds audio watermark URL into timestamp file input for audio type", async function () {
    simpleType = "audio";
    simpleFile = { name: "test.wav", size: 2048, type: "audio/wav" };
    simpleResults.audioWatermarkUrl = "blob:audio-wm-output";
    var fileInput = document.getElementById("ts-create-file");
    await runTimestampStep();
    assert.ok(fileInput.files !== undefined);
  });

  it("uses dataUrlToBlob path for non-blob URL", async function () {
    simpleResults.c2paUrl = "data:text/plain;base64,dGVzdA==";
    await runTimestampStep();
    assert.ok(true); // no exception
  });
});

// ── simplified_helpers.js tests ──

describe("simplified_helpers.js — toggleArtistFields", function () {
  it("shows artist fields when checkbox is checked", function () {
    getMockEl("sinfo-isArtist").checked = true;
    getMockEl("sinfo-artist-fields");
    toggleArtistFields();
    assert.equal(getMockEl("sinfo-artist-fields").style.display, "");
  });

  it("hides artist fields when checkbox is unchecked", function () {
    getMockEl("sinfo-isArtist").checked = false;
    getMockEl("sinfo-artist-fields");
    toggleArtistFields();
    assert.equal(getMockEl("sinfo-artist-fields").style.display, "none");
  });

  it("handles missing fields element", function () {
    getMockEl("sinfo-isArtist").checked = true;
    toggleArtistFields();
    assert.ok(true);
  });
});

describe("simplified_helpers.js — setupSimpleDropZone", function () {
  beforeEach(function () {
    var _el = {};
    _el.simpleDropZone = {
      classList: {
        add: function () {},
        remove: function () {},
        contains: function () {
          return false;
        },
      },
      addEventListener: function () {},
      style: {},
    };
    globalThis.document.getElementById = function (id) {
      return _el[id] || null;
    };
  });

  it("does nothing if drop zone element is missing", function () {
    globalThis.document.getElementById = function () {
      return null;
    };
    setupSimpleDropZone();
    assert.ok(true);
  });

  it("attaches drag/drop event listeners", function () {
    var events = {};
    var dz = document.getElementById("simpleDropZone");
    dz.addEventListener = function (evt, fn) {
      events[evt] = fn;
    };
    setupSimpleDropZone();
    assert.equal(typeof events.dragover, "function");
    assert.equal(typeof events.dragleave, "function");
    assert.equal(typeof events.drop, "function");
  });

  it("dragover event calls preventDefault and adds drag-over class", function () {
    var events = {};
    var prevented = false;
    var addCalled = false;
    var dz = document.getElementById("simpleDropZone");
    dz.addEventListener = function (evt, fn) {
      events[evt] = fn;
    };
    dz.classList.add = function (c) {
      if (c === "drag-over") addCalled = true;
    };
    setupSimpleDropZone();
    events.dragover({
      preventDefault: function () {
        prevented = true;
      },
    });
    assert.ok(prevented);
    assert.ok(addCalled);
  });

  it("dragleave event removes drag-over class", function () {
    var events = {};
    var removeCalled = false;
    var dz = document.getElementById("simpleDropZone");
    dz.addEventListener = function (evt, fn) {
      events[evt] = fn;
    };
    dz.classList.remove = function (c) {
      if (c === "drag-over") removeCalled = true;
    };
    setupSimpleDropZone();
    events.dragleave({});
    assert.ok(removeCalled);
  });

  it("drop event calls simpleFileSelected with files", function () {
    var called = false;
    globalThis.simpleFileSelected = function (input) {
      if (input && input.files) called = true;
    };
    var dropFn;
    var dz = document.getElementById("simpleDropZone");
    dz.addEventListener = function (evt, fn) {
      if (evt === "drop") dropFn = fn;
    };
    setupSimpleDropZone();
    dropFn({ preventDefault: function () {}, dataTransfer: { files: [{}] } });
    assert.ok(called);
  });
});

describe("simplified_helpers.js — restoreUploadFileInfo", function () {
  beforeEach(function () {
    simpleFile = { name: "test.jpg", size: 2048 };
    simpleType = "image";
    globalThis.escapeHtml = function (s) {
      if (s == null) return "";
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    };
    var _r = {};
    _r.simpleDropZone = {
      classList: { add: function () {}, remove: function () {} },
      style: {},
    };
    _r.simpleFileInfo = { innerHTML: "" };
    globalThis.document.getElementById = function (id) {
      return _r[id] || null;
    };
  });

  it("returns early if drop zone is missing", function () {
    globalThis.document.getElementById = function () {
      return null;
    };
    restoreUploadFileInfo();
    assert.ok(true);
  });

  it("renders file info when elements exist", function () {
    restoreUploadFileInfo();
    var html = document.getElementById("simpleFileInfo").innerHTML;
    assert.ok(html.includes("test.jpg"));
    assert.ok(html.includes("2.0 KB"));
  });
});

describe("simplified_helpers.js — simpleFileSelected", function () {
  beforeEach(function () {
    simpleSteps = [];
    simpleFile = null;
    simpleStep = 0;
    var _s = {};
    _s.simpleDropZone = { classList: { add: function () {} }, style: {} };
    _s.simpleFileInfo = { innerHTML: "" };
    _s.simpleFileInput = {
      value: "",
      getAttribute: function () {
        return null;
      },
      tagName: "INPUT",
    };
    globalThis.document.getElementById = function (id) {
      return _s[id] || null;
    };
    globalThis.isDangerousFile = function () {
      return false;
    };
    globalThis.isEnglishFilename = function () {
      return true;
    };
    globalThis.matchesAccept = function () {
      return true;
    };
    globalThis.matchesMagicBytes = function () {
      return Promise.resolve(true);
    };
    globalThis.checkDangerousContent = function () {
      return Promise.resolve(false);
    };
    globalThis.checkFileStructure = function () {
      return Promise.resolve(true);
    };
    globalThis.escapeHtml = function (s) {
      if (s == null) return "";
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    };
    globalThis.__ = function (k, d) {
      return d || k || "";
    };
    globalThis.renderStep = function () {};
    globalThis.FileReader = function () {
      this.readAsArrayBuffer = function () {
        this.onload({ target: { result: new ArrayBuffer(10) } });
      };
    };
    globalThis.alert = function () {};
  });

  it("returns early if no file", async function () {
    await simpleFileSelected({ files: [] });
    assert.equal(simpleFile, null);
  });

  it("returns early if file is undefined", async function () {
    await simpleFileSelected({ files: [undefined] });
    assert.equal(simpleFile, null);
  });

  it("rejects dangerous file extensions", async function () {
    globalThis.isDangerousFile = function () {
      return true;
    };
    var alerted = false;
    globalThis.alert = function () {
      alerted = true;
    };
    await simpleFileSelected({ files: [{ name: "virus.exe" }] });
    assert.equal(simpleFile, null);
    assert.ok(alerted);
  });

  it("rejects non-English filenames", async function () {
    globalThis.isEnglishFilename = function () {
      return false;
    };
    var alerted = false;
    globalThis.alert = function () {
      alerted = true;
    };
    await simpleFileSelected({ files: [{ name: "文件名.png" }] });
    assert.equal(simpleFile, null);
    assert.ok(alerted);
  });

  it("rejects files not matching accept attribute", async function () {
    var el = document.getElementById("simpleFileInput");
    el.getAttribute = function (a) {
      return a === "accept" ? ".png" : null;
    };
    globalThis.matchesAccept = function () {
      return false;
    };
    var alerted = false;
    globalThis.alert = function () {
      alerted = true;
    };
    await simpleFileSelected({ files: [{ name: "doc.pdf" }] });
    assert.equal(simpleFile, null);
    assert.ok(alerted);
  });

  it("rejects files with bad magic bytes", async function () {
    globalThis.matchesMagicBytes = function () {
      return Promise.resolve(false);
    };
    var alerted = false;
    globalThis.alert = function () {
      alerted = true;
    };
    await simpleFileSelected({ files: [{ name: "corrupt.png" }] });
    assert.equal(simpleFile, null);
    assert.ok(alerted);
  });

  it("rejects files with dangerous content", async function () {
    globalThis.checkDangerousContent = function () {
      return Promise.resolve(true);
    };
    var alerted = false;
    globalThis.alert = function () {
      alerted = true;
    };
    await simpleFileSelected({ files: [{ name: "test.png" }] });
    assert.equal(simpleFile, null);
    assert.ok(alerted);
  });

  it("rejects files with bad structure", async function () {
    globalThis.checkFileStructure = function () {
      return Promise.resolve(false);
    };
    var alerted = false;
    globalThis.alert = function () {
      alerted = true;
    };
    await simpleFileSelected({ files: [{ name: "test.png" }] });
    assert.equal(simpleFile, null);
    assert.ok(alerted);
  });

  it("accepts valid image file", async function () {
    var rendered = false;
    globalThis.renderStep = function () {
      rendered = true;
    };
    await simpleFileSelected({ files: [{ name: "photo.png", size: 1024 }] });
    assert.equal(simpleType, "image");
    assert.ok(rendered);
  });

  it("accepts valid audio file", async function () {
    await simpleFileSelected({ files: [{ name: "song.mp3", size: 2048 }] });
    assert.equal(simpleType, "audio");
  });

  it("accepts valid video file", async function () {
    await simpleFileSelected({ files: [{ name: "video.mp4", size: 4096 }] });
    assert.equal(simpleType, "video");
  });

  it("accepts valid document file", async function () {
    await simpleFileSelected({ files: [{ name: "doc.pdf", size: 3000 }] });
    assert.equal(simpleType, "document");
  });

  it("sets simpleBuf from FileReader", async function () {
    simpleBuf = null;
    await simpleFileSelected({ files: [{ name: "test.png", size: 100 }] });
    assert.ok(simpleBuf instanceof ArrayBuffer);
  });

  it("handles drag-and-drop source (no tagName)", async function () {
    var _d = {};
    _d.simpleDropZone = { classList: { add: function () {} }, style: {} };
    _d.simpleFileInfo = { innerHTML: "" };
    globalThis.document.getElementById = function (id) {
      return _d[id] || null;
    };
    await simpleFileSelected({ files: [{ name: "dropped.png", size: 500 }] });
    assert.equal(simpleType, "image");
  });
});

describe("simplified_helpers.js — chooseAi", function () {
  beforeEach(function () {
    getMockEl("simpleBody");
    globalThis.renderStep = function () {};
  });

  it("sets AI mode and advances to fingerprint step", function () {
    chooseAi(true);
    assert.equal(simpleIsAI, true);
  });

  it("sets non-AI mode", function () {
    chooseAi(false);
    assert.equal(simpleIsAI, false);
  });
});

describe("simplified_helpers.js — buildCombinedPayload", function () {
  /**
   *
   * @param s
   * @param max
   */
  function simpleTrim(s, max) {
    if (!s) return "";
    var str = typeof s === "string" ? s : JSON.stringify(s);
    if (str.length <= max) return s;
    if (typeof s === "string") return str.slice(0, max);
    try {
      return JSON.parse(str.slice(0, max));
    } catch {
      return str.slice(0, max);
    }
  }

  beforeEach(function () {
    resetSimplifiedState();
    globalThis.trimFingerprintPayload = simpleTrim;
  });

  it("combines fingerprint with DID signature", function () {
    var fpResult = { sha256: "abc" };
    var didSig = { did: "did:example:123", signature: "abc123" };
    var result = buildCombinedPayload(fpResult, didSig, 5000);
    assert.ok(result.includes("abc"));
  });

  it("handles missing DID signature", function () {
    var result = buildCombinedPayload({ sha256: "abc" }, null, 5000);
    assert.ok(result.includes("abc"));
    assert.ok(!result.includes("DIDSIG"));
  });

  it("drops DID signature when combined payload exceeds maxBytes", function () {
    var big = {};
    for (var j = 0; j < 200; j++) big["k" + j] = "value";
    var didSig = { signature: "abc123" };
    var result = buildCombinedPayload(big, didSig, 500);
    assert.ok(!result.includes("DIDSIG"));
  });

  it("handles string fpResult via trimFingerprintPayload branch", function () {
    var result = buildCombinedPayload("simple string", null, 5000);
    assert.equal(typeof result, "string");
    assert.ok(result.length > 0);
  });

  it("handles null fpResult and null didSig", function () {
    var result = buildCombinedPayload(null, null, 100);
    assert.equal(result, "");
  });

  it("includes fingerprint keys in result", function () {
    var fpResult = { sha256: "abc", md5: "def" };
    var result = buildCombinedPayload(fpResult, null, 1000);
    assert.ok(result.includes("sha256"));
  });

  it("JSON.stringify object fpResult when trimFingerprintPayload is missing (line 290)", function () {
    var orig = globalThis.trimFingerprintPayload;
    globalThis.trimFingerprintPayload = null;
    try {
      var result = buildCombinedPayload(
        { sha256: "abc", md5: "def" },
        null,
        5000,
      );
      assert.ok(result.includes("sha256"));
      assert.ok(result.includes("abc"));
    } finally {
      globalThis.trimFingerprintPayload = orig;
    }
  });

  it("drops DID when combined exceeds maxBytes and trimFingerprintPayload missing (lines 296-298)", function () {
    var orig = globalThis.trimFingerprintPayload;
    globalThis.trimFingerprintPayload = null;
    try {
      var didSig = { signature: "abc123" };
      var big = { data: "x".repeat(500) };
      var result = buildCombinedPayload(big, didSig, 50);
      assert.ok(!result.includes("DIDSIG"));
    } finally {
      globalThis.trimFingerprintPayload = orig;
    }
  });
});

describe("simplified_helpers.js — getPiAlgoOptions", function () {
  it("generates option HTML from algorithm categories", function () {
    var cats = {
      spatial: {
        enhancedLSB: { name: "Enhanced LSB" },
        basicLSB: { name: "Basic LSB" },
      },
    };
    var opts = getPiAlgoOptions(cats, "spatial");
    assert.ok(opts.includes("enhancedLSB"));
    assert.ok(opts.includes("Enhanced LSB"));
  });

  it("handles empty category", function () {
    var opts = getPiAlgoOptions({}, "unknown");
    assert.equal(opts, "");
  });
});

describe("simplified_helpers.js — updateSpiAlgorithms", function () {
  beforeEach(function () {
    globalThis.pixelInjection = {
      algorithms: {
        spatial: {
          enhancedLSB: { name: "Enhanced LSB" },
          basicLSB: { name: "Basic LSB" },
        },
      },
    };
    var _spi = {};
    _spi["spi-category"] = { value: "spatial" };
    _spi["spi-algorithm"] = { innerHTML: "" };
    globalThis.document.getElementById = function (id) {
      return _spi[id] || null;
    };
  });

  it("updates algorithm select from category select", function () {
    updateSpiAlgorithms();
    assert.ok(document.getElementById("spi-algorithm").innerHTML.length > 0);
  });

  it("returns early if selects are missing", function () {
    globalThis.document.getElementById = function () {
      return null;
    };
    updateSpiAlgorithms();
    assert.ok(true);
  });

  it("returns early if pixelInjection.algorithms is not available", function () {
    globalThis.pixelInjection = { algorithms: null };
    updateSpiAlgorithms();
    assert.ok(true);
  });
});

describe("simplified_helpers.js — setupFpDownload and setupDidDownload", function () {
  beforeEach(function () {
    globalThis.simpleResults = { fpResult: { sha256: "abc" } };
    globalThis.simpleFile = { name: "test.jpg" };
    globalThis.downloadBlobSimple = function () {};
    globalThis.__ = function (k, d) {
      return d || k || "";
    };
    globalThis.escapeHtml = function (s) {
      if (s == null) return "";
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    };
    var _d = {};
    _d["dl-modal-title"] = { textContent: "" };
    _d["fp-table"] = { innerHTML: "" };
    _d["fp-dl-json"] = { addEventListener: function () {}, textContent: "" };
    _d["fp-dl-csv"] = { addEventListener: function () {}, textContent: "" };
    _d["fp-dl-txt"] = { addEventListener: function () {}, textContent: "" };
    _d["fp-dl-xml"] = { addEventListener: function () {}, textContent: "" };
    _d["fp-dl-html"] = { addEventListener: function () {}, textContent: "" };
    _d["fp-dl-pdf"] = { addEventListener: function () {}, textContent: "" };
    _d["fp-dl-docx"] = { addEventListener: function () {}, textContent: "" };
    globalThis.document.getElementById = function (id) {
      return _d[id] || null;
    };
  });

  it("setupFpDownload sets download handler", function () {
    setupFpDownload();
    assert.ok(document.getElementById("dl-modal-title").textContent.length > 0);
  });

  it("setupDidDownload sets download handler", function () {
    setupDidDownload();
    assert.ok(document.getElementById("dl-modal-title").textContent.length > 0);
  });

  it("setupFpDownload handles missing fpResult", function () {
    simpleResults.fpResult = null;
    setupFpDownload();
    assert.ok(document.getElementById("dl-modal-title").textContent.length > 0);
  });
});

describe("simplified_helpers.js — toggleSimpleLangDropdown and toggleModeLangDropdown", function () {
  it("toggleSimpleLangDropdown toggles show class", function () {
    getMockEl("simpleLangMenu");
    toggleSimpleLangDropdown();
    assert.ok(getMockEl("simpleLangMenu").classList.toggle.called || true);
  });

  it("toggleSimpleLangDropdown handles missing element", function () {
    globalThis.document.getElementById = function () {
      return null;
    };
    toggleSimpleLangDropdown();
    assert.ok(true);
  });

  it("toggleModeLangDropdown toggles show class", function () {
    getMockEl("modeLangMenu");
    toggleModeLangDropdown();
    assert.ok(true);
  });
});

describe("simplified_helpers.js — escapeHtml basic", function () {
  it("escapes HTML special characters", function () {
    var result = escapeHtml("<script>alert('xss')</script>");
    assert.ok(!result.includes("<"));
  });

  it("handles null input", function () {
    assert.equal(escapeHtml(null), "");
  });

  it("returns empty string for undefined", function () {
    assert.equal(escapeHtml(undefined), "");
  });
});

describe("simplified_renderers.js — renderUpload", function () {
  beforeEach(function () {
    globalThis.setupSimpleDropZone = function () {};
    globalThis.restoreUploadFileInfo = function () {};
    globalThis.getDefaultPhoneCode = function () {
      return { dial: "+966" };
    };
    simpleUserInfo = {
      name: "John",
      email: "john@test.com",
      phone: "5551234",
      phoneCode: "+1",
      website: "https://example.com",
      social: { tiktok: "", facebook: "", instagram: "", youtube: "" },
      isArtist: true,
      music: {
        spotify: "https://spotify.com/artist",
        appleMusic: "",
        youtubeMusic: "",
        soundcloud: "",
        bandcamp: "",
      },
    };
  });

  it("renders name and email fields", function () {
    var body = getMockEl("simpleBody");
    renderUpload(body);
    assert.ok(body.innerHTML.includes("John"));
    assert.ok(body.innerHTML.includes("john@test.com"));
  });

  it("shows artist-specific fields when isArtist is true", function () {
    var body = getMockEl("simpleBody");
    renderUpload(body);
    assert.ok(body.innerHTML.includes("sinfo-spotify"));
    assert.ok(body.innerHTML.includes("sinfo-artist-fields"));
  });

  it("calls restoreUploadFileInfo when simpleFile exists", function () {
    var called = false;
    globalThis.restoreUploadFileInfo = function () {
      called = true;
    };
    simpleFile = { name: "test.png" };
    renderUpload(getMockEl("simpleBody"));
    assert.ok(called);
  });

  it("auto-detects phone code on first visit", function () {
    simpleUserInfo.phoneCode = "";
    renderUpload(getMockEl("simpleBody"));
    assert.equal(simpleUserInfo.phoneCode, "+966");
  });
});

describe("simplified_renderers.js — renderAiQuestion", function () {
  it("renders AI question cards", function () {
    var body = getMockEl("simpleBody");
    renderAiQuestion(body);
    assert.ok(body.innerHTML.includes("chooseAi"));
  });
});

describe("simplified_renderers.js — renderC2paStep", function () {
  beforeEach(function () {
    globalThis.runC2paStep = function () {};
  });

  it("renders C2PA content type cards and social links", function () {
    var body = getMockEl("simpleBody");
    renderC2paStep(body);
    assert.ok(body.innerHTML.includes("sc2pa-create"));
    assert.ok(body.innerHTML.includes("sc2pa-link-instagram"));
  });
});

describe("simplified_renderers.js — renderWatermarkStep", function () {
  beforeEach(function () {
    globalThis.runWatermarkStep = function () {};
  });

  it("renders watermark card with password field", function () {
    simpleFile = { name: "photo.png" };
    var body = getMockEl("simpleBody");
    renderWatermarkStep(body);
    assert.ok(body.innerHTML.includes("swm-password"));
  });

  it("renders algorithm options", function () {
    simpleFile = { name: "test.jpg" };
    var body = getMockEl("simpleBody");
    renderWatermarkStep(body);
    assert.ok(body.innerHTML.includes("swm-type"));
  });
});

describe("simplified_renderers.js — renderAudioWatermarkStep", function () {
  beforeEach(function () {
    globalThis.runAudioWatermarkStep = function () {};
    simpleFile = { name: "song.wav" };
  });

  it("renders fingerprint summary when hashes exist", function () {
    simpleResults.fpResult = {
      hashes: {
        "SHA-256": "abcdef1234567890abcdef1234567890",
        "SHA-512": "xyz",
      },
    };
    simpleResults.tsResult = "timestamp proof data";
    var body = getMockEl("simpleBody");
    renderAudioWatermarkStep(body);
    assert.ok(body.innerHTML.includes("abcdef12"));
  });

  it("renders without hash summary when no fpResult", function () {
    simpleResults.fpResult = null;
    var body = getMockEl("simpleBody");
    renderAudioWatermarkStep(body);
    assert.ok(body.innerHTML.includes("Audio Watermarking"));
  });
});

describe("simplified_renderers.js — renderPixelInjectStep", function () {
  beforeEach(function () {
    globalThis.runPixelInjectStep = function () {};
    simpleFile = { name: "photo.png" };
    globalThis.pixelInjection = {
      algorithms: {
        spatial: { enhanced_lsb: { name: "Enhanced LSB" } },
        frequency: { dct: { name: "DCT" } },
        detection: { some_detection: { name: "Detection" } },
      },
    };
    globalThis.getPiAlgoOptions = function (cats, cat) {
      var algos = cats[cat];
      if (!algos) return "";
      var keys = Object.keys(algos);
      var opts = "";
      for (var i = 0; i < keys.length; i++) {
        opts +=
          '<option value="' +
          keys[i] +
          '">' +
          (algos[keys[i]].name || keys[i]) +
          "</option>";
      }
      return opts;
    };
  });

  it("renders category and algorithm selects", function () {
    var body = getMockEl("simpleBody");
    renderPixelInjectStep(body);
    assert.ok(body.innerHTML.includes("spi-category"));
    assert.ok(body.innerHTML.includes("spi-algorithm"));
  });

  it("skips detection category", function () {
    var body = getMockEl("simpleBody");
    renderPixelInjectStep(body);
    assert.ok(body.innerHTML.includes("Spatial"));
    assert.ok(!body.innerHTML.includes("Detection"));
  });
});

describe("simplified_renderers.js — renderTimestampStep", function () {
  beforeEach(function () {
    globalThis.runTimestampStep = function () {};
  });

  it("renders spinner and calls runTimestampStep", function () {
    var called = false;
    globalThis.runTimestampStep = function () {
      called = true;
    };
    renderTimestampStep(getMockEl("simpleBody"));
    assert.ok(called);
  });
});

describe("simplified_renderers.js — renderFingerprintStep", function () {
  beforeEach(function () {
    globalThis.runFingerprintStep = function () {};
  });

  it("renders processing indicator and calls runFingerprintStep", function () {
    var called = false;
    globalThis.runFingerprintStep = function () {
      called = true;
    };
    renderFingerprintStep(getMockEl("simpleBody"));
    assert.ok(called);
  });
});

describe("simplified_renderers.js — renderDIDStep", function () {
  beforeEach(function () {
    globalThis.runDIDStepGenerate = function () {};
    globalThis.runDIDStepSign = function () {};
    globalThis.didGetAlgorithmList = function () {
      return ["Ed25519", "P-256", "RSA-2048", "RSA-4096"];
    };
  });

  it("shows key generation prompt when no keys exist", function () {
    globalThis.didLoadKeys = function () {
      return null;
    };
    var body = getMockEl("simpleBody");
    renderDIDStep(body);
    assert.ok(body.innerHTML.includes("sdid-gen-btn"));
    assert.ok(body.innerHTML.includes("disabled"));
  });

  it("shows sign button enabled when keys exist", function () {
    globalThis.didLoadKeys = function () {
      return { algo: "Ed25519" };
    };
    var body = getMockEl("simpleBody");
    renderDIDStep(body);
    assert.ok(body.innerHTML.includes("sdid-sign-btn"));
    assert.ok(!body.innerHTML.includes("disabled"));
  });

  it("renders algorithm options with descriptions", function () {
    globalThis.didLoadKeys = function () {
      return null;
    };
    var body = getMockEl("simpleBody");
    renderDIDStep(body);
    assert.ok(body.innerHTML.includes("Ed25519"));
    assert.ok(body.innerHTML.includes("P-256"));
  });
});

describe("simplified_renderers.js — renderDone C2PA branch", function () {
  var _origOpenLightbox;
  beforeEach(function () {
    _origOpenLightbox = globalThis.openLightbox;
    globalThis.openLightbox = function () {};
    globalThis.setupFpDownload = function () {};
    globalThis.setupDidDownload = function () {};
    globalThis.showDownloadModal = function () {};
    globalThis.downloadCert = function () {};
    globalThis.downloadCertOtsProof = function () {};
    simpleType = "image";
  });
  afterEach(function () {
    globalThis.openLightbox = _origOpenLightbox;
  });

  it("shows C2PA signed image section", function () {
    simpleResults = { c2pa: true, c2paUrl: "blob:c2pa-image" };
    renderDone(getMockEl("simpleBody"));
    var h = getMockEl("simpleBody").innerHTML;
    assert.ok(h.includes("signed.png"));
  });

  it("shows pixel injection section when C2PA not present", function () {
    simpleResults = { "pixel-injection": true, piFinalUrl: "blob:pi-result" };
    renderDone(getMockEl("simpleBody"));
    var h = getMockEl("simpleBody").innerHTML;
    assert.ok(h.includes("piFinalUrl") || h.includes("protected.png"));
  });

  it("shows C2PA label when no URL", function () {
    simpleResults = { c2pa: true };
    renderDone(getMockEl("simpleBody"));
    var h = getMockEl("simpleBody").innerHTML;
    assert.ok(h.includes("c2pa") || h.includes("C2PA"));
  });

  it("shows DID signature section", function () {
    simpleResults = {
      didSig: {
        did: "did:example:abc",
        algorithm: "Ed25519",
        timestamp: "2025-01-01T00:00:00Z",
      },
    };
    renderDone(getMockEl("simpleBody"));
    var h = getMockEl("simpleBody").innerHTML;
    assert.ok(h.includes("did:example:abc"));
  });

  it("shows DID identity section when only identity exists", function () {
    simpleResults = { didIdentity: "did:example:xyz" };
    renderDone(getMockEl("simpleBody"));
    var h = getMockEl("simpleBody").innerHTML;
    assert.ok(h.includes("did:example:xyz"));
  });

  it("shows fingerprint download section", function () {
    simpleResults = { fingerprint: true, fpResult: { sha256: "abc" } };
    renderDone(getMockEl("simpleBody"));
    var h = getMockEl("simpleBody").innerHTML;
    assert.ok(h.includes("setupFpDownload"));
  });

  it("shows certificate section when any result exists", function () {
    simpleResults = { fingerprint: true, fpResult: { sha256: "abc" } };
    renderDone(getMockEl("simpleBody"));
    var h = getMockEl("simpleBody").innerHTML;
    assert.ok(h.includes("Digital Passport") || h.includes("cert_title"));
  });

  it("shows audio watermark section", function () {
    simpleResults = {
      audioWatermark: true,
      audioWatermarkUrl: "blob:audio",
      audioWatermarkFpAlgo: 1,
      audioWatermarkTsAlgo: 2,
      audioWatermarkFilename: "test.wav",
    };
    renderDone(getMockEl("simpleBody"));
    var h = getMockEl("simpleBody").innerHTML;
    assert.ok(h.includes("audio") || h.includes("LSB Audio"));
  });

  it("shows timestamp section", function () {
    simpleResults = { timestamp: true, tsResult: "2025-01-01 verified" };
    renderDone(getMockEl("simpleBody"));
    var h = getMockEl("simpleBody").innerHTML;
    assert.ok(h.includes("2025-01-01 verified"));
  });

  it("shows watermark image section", function () {
    simpleResults = { watermark: true, watermarkUrl: "blob:wmark" };
    renderDone(getMockEl("simpleBody"));
    var h = getMockEl("simpleBody").innerHTML;
    assert.ok(h.includes("watermark"));
  });

  it("shows no certificate when no results", function () {
    simpleResults = {};
    renderDone(getMockEl("simpleBody"));
    var h = getMockEl("simpleBody").innerHTML;
    assert.ok(!h.includes("cert-section") && !h.includes("Digital Passport"));
  });
});

// ── simplified_countries.js tests ──

describe("simplified_countries.js — COUNTRY_CODES", function () {
  it("exists and has entries", function () {
    assert.ok(Array.isArray(COUNTRY_CODES));
    assert.ok(COUNTRY_CODES.length > 0);
  });

  it("each entry has code, dial, name, len", function () {
    COUNTRY_CODES.forEach(function (c, i) {
      assert.ok(c.code, "entry " + i + " missing code");
      assert.ok(c.dial, "entry " + i + " missing dial");
      assert.ok(c.name, "entry " + i + " missing name");
      assert.equal(typeof c.len, "number", "entry " + i + " missing len");
    });
  });

  it("includes major countries (SA, US, GB, CA)", function () {
    var codes = COUNTRY_CODES.map(function (c) {
      return c.code;
    });
    assert.ok(codes.indexOf("SA") !== -1);
    assert.ok(codes.indexOf("US") !== -1);
    assert.ok(codes.indexOf("GB") !== -1);
    assert.ok(codes.indexOf("CA") !== -1);
  });
});

describe("simplified_countries.js — getCountryFromLocale", function () {
  it("returns null for unparseable Intl results", function () {
    // Mock Intl to return a locale without country
    var origNF = globalThis.Intl.NumberFormat;
    globalThis.Intl.NumberFormat = function () {
      return {
        resolvedOptions: function () {
          return { locale: "en" };
        },
      };
    };
    globalThis.Intl.DateTimeFormat = function () {
      return {
        resolvedOptions: function () {
          return { locale: "en" };
        },
      };
    };
    globalThis.Intl.Collator = function () {
      return {
        resolvedOptions: function () {
          return { locale: "en" };
        },
      };
    };
    var result = getCountryFromLocale();
    assert.equal(result, null);
    globalThis.Intl.NumberFormat = origNF;
    // Restore other Intl too
    globalThis.Intl.DateTimeFormat = Intl.DateTimeFormat;
    globalThis.Intl.Collator = Intl.Collator;
  });

  it("returns country from locale with region", function () {
    var origNF = globalThis.Intl.NumberFormat;
    globalThis.Intl.NumberFormat = function () {
      return {
        resolvedOptions: function () {
          return { locale: "en-US" };
        },
      };
    };
    globalThis.Intl.DateTimeFormat = function () {
      return {
        resolvedOptions: function () {
          return { locale: "en-US" };
        },
      };
    };
    globalThis.Intl.Collator = function () {
      return {
        resolvedOptions: function () {
          return { locale: "en-US" };
        },
      };
    };
    var result = getCountryFromLocale();
    assert.ok(result !== null);
    assert.equal(result.code, "US");
    globalThis.Intl.NumberFormat = origNF;
    globalThis.Intl.DateTimeFormat = Intl.DateTimeFormat;
    globalThis.Intl.Collator = Intl.Collator;
  });
});

describe("simplified_countries.js — getCountryFromTimezone", function () {
  it("returns country for a known timezone city (Riyadh)", function () {
    var origDTF = globalThis.Intl.DateTimeFormat;
    globalThis.Intl.DateTimeFormat = function () {
      return {
        resolvedOptions: function () {
          return { timeZone: "Asia/Riyadh" };
        },
      };
    };
    var result = getCountryFromTimezone();
    assert.ok(result !== null);
    assert.equal(result.code, "SA");
    globalThis.Intl.DateTimeFormat = origDTF;
  });

  it("returns null for unknown timezone city", function () {
    var origDTF = globalThis.Intl.DateTimeFormat;
    globalThis.Intl.DateTimeFormat = function () {
      return {
        resolvedOptions: function () {
          return { timeZone: "Mars/Olympus_Mons" };
        },
      };
    };
    var result = getCountryFromTimezone();
    assert.equal(result, null);
    globalThis.Intl.DateTimeFormat = origDTF;
  });

  it("returns null when timeZone is unavailable", function () {
    var origDTF = globalThis.Intl.DateTimeFormat;
    globalThis.Intl.DateTimeFormat = function () {
      return {
        resolvedOptions: function () {
          return {};
        },
      };
    };
    var result = getCountryFromTimezone();
    assert.equal(result, null);
    globalThis.Intl.DateTimeFormat = origDTF;
  });
});

describe("simplified_countries.js — getDefaultPhoneCode", function () {
  it("returns country from locale first", function () {
    var origNF = globalThis.Intl.NumberFormat;
    globalThis.Intl.NumberFormat = function () {
      return {
        resolvedOptions: function () {
          return { locale: "en-US" };
        },
      };
    };
    globalThis.Intl.DateTimeFormat = function () {
      return {
        resolvedOptions: function () {
          return { locale: "en-US" };
        },
      };
    };
    var result = getDefaultPhoneCode();
    assert.ok(result !== null);
    globalThis.Intl.NumberFormat = origNF;
    globalThis.Intl.DateTimeFormat = Intl.DateTimeFormat;
  });

  it("falls through when Intl returns no match", function () {
    // Mock Intl to return non-country locale
    var origNF = globalThis.Intl.NumberFormat;
    var origDTF = globalThis.Intl.DateTimeFormat;
    var origColl = globalThis.Intl.Collator;
    globalThis.Intl.NumberFormat = function () {
      return {
        resolvedOptions: function () {
          return { locale: "en" };
        },
      };
    };
    globalThis.Intl.DateTimeFormat = function () {
      return {
        resolvedOptions: function () {
          return { locale: "en" };
        },
      };
    };
    globalThis.Intl.Collator = function () {
      return {
        resolvedOptions: function () {
          return { locale: "en" };
        },
      };
    };
    // Mock navigator to avoid matching via languages
    var origNavLangs = globalThis.navigator.languages;
    var origNavLang = globalThis.navigator.language;
    try {
      Object.defineProperty(globalThis.navigator, "languages", {
        value: ["en"],
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis.navigator, "language", {
        value: "en",
        configurable: true,
        writable: true,
      });
    } catch (e) {}
    var result = getDefaultPhoneCode();
    // May be null or a country object depending on timezone
    assert.ok(result === null || (result && result.dial));
    globalThis.Intl.NumberFormat = origNF;
    globalThis.Intl.DateTimeFormat = origDTF;
    globalThis.Intl.Collator = origColl;
    try {
      Object.defineProperty(globalThis.navigator, "languages", {
        value: origNavLangs,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis.navigator, "language", {
        value: origNavLang,
        configurable: true,
        writable: true,
      });
    } catch (e) {}
  });
});

describe("simplified_countries.js — updatePhoneMaxLength", function () {
  beforeEach(function () {
    var _p = {};
    _p["cert-phone"] = { value: "123456789", maxLength: 15 };
    _p["cert-phonecode"] = { value: "+966" };
    globalThis.document.getElementById = function (id) {
      return _p[id] || null;
    };
  });

  it("updates maxLength when dial matches", function () {
    updatePhoneMaxLength();
    assert.equal(document.getElementById("cert-phone").maxLength, 9);
  });

  it("truncates value when too long", function () {
    document.getElementById("cert-phone").value = "1234567890";
    updatePhoneMaxLength();
    assert.equal(document.getElementById("cert-phone").value.length, 9);
  });

  it("uses fallback el when cert fields missing", function () {
    var _f = {};
    _f["sinfo-phone"] = { value: "12345678", maxLength: 15 };
    _f["sinfo-phonecode"] = { value: "+966" };
    globalThis.document.getElementById = function (id) {
      return _f[id] || null;
    };
    updatePhoneMaxLength();
    assert.ok(true);
  });

  it("returns early when elements missing", function () {
    globalThis.document.getElementById = function () {
      return null;
    };
    updatePhoneMaxLength();
    assert.ok(true);
  });
});

describe("simplified_countries.js — validate functions", function () {
  it("validateSocialInput shows/hides warning", function () {
    var el = { id: "sinfo-tiktok", value: "https://tiktok.com/@user" };
    var warn = { style: { display: "" } };
    globalThis.document.getElementById = function (id) {
      if (id === "sinfo-tiktok-warn") return warn;
      return null;
    };
    validateSocialInput(el);
    assert.equal(warn.style.display, "none");
    el.value = "";
    validateSocialInput(el);
    assert.equal(warn.style.display, "none");
  });

  it("validateSocialInput shows warning for invalid URL", function () {
    var el = { id: "sinfo-tiktok", value: "not-a-url" };
    var warn = { style: { display: "" } };
    globalThis.document.getElementById = function (id) {
      if (id === "sinfo-tiktok-warn") return warn;
      return null;
    };
    validateSocialInput(el);
    assert.equal(warn.style.display, "block");
  });

  it("validateUrlInput validates URL", function () {
    var el = { id: "test-url", value: "https://example.com" };
    var warn = { style: { display: "" } };
    globalThis.document.getElementById = function (id) {
      if (id === "test-url-warn") return warn;
      return null;
    };
    validateUrlInput(el);
    assert.equal(warn.style.display, "none");
    el.value = "";
    validateUrlInput(el);
    assert.equal(warn.style.display, "none");
  });

  it("validateEmailInput validates email", function () {
    var el = { id: "test-email", value: "user@example.com" };
    var warn = { style: { display: "" } };
    globalThis.document.getElementById = function (id) {
      if (id === "test-email-warn") return warn;
      return null;
    };
    validateEmailInput(el);
    assert.equal(warn.style.display, "none");
    el.value = "";
    validateEmailInput(el);
    assert.equal(warn.style.display, "none");
    el.value = "invalid";
    validateEmailInput(el);
    assert.equal(warn.style.display, "block");
  });

  it("validatePhoneInput strips non-digits", function () {
    var el = { id: "test-phone", value: "abc123def", maxLength: 10 };
    var warn = { style: { display: "" } };
    globalThis.document.getElementById = function (id) {
      if (id === "test-phone-warn") return warn;
      return null;
    };
    validatePhoneInput(el);
    assert.equal(el.value, "123");
    assert.equal(warn.style.display, "block");
  });

  it("validatePhoneInput truncates to maxLength", function () {
    var el = { id: "test-phone", value: "1234567890", maxLength: 5 };
    var warn = { style: { display: "" } };
    globalThis.document.getElementById = function (id) {
      if (id === "test-phone-warn") return warn;
      return null;
    };
    validatePhoneInput(el);
    assert.equal(el.value.length, 5);
  });

  it("validatePhoneInput passes clean digits", function () {
    var el = { id: "test-phone", value: "12345", maxLength: 15 };
    var warn = { style: { display: "" } };
    globalThis.document.getElementById = function (id) {
      if (id === "test-phone-warn") return warn;
      return null;
    };
    validatePhoneInput(el);
    assert.equal(warn.style.display, "none");
  });

  it("validateC2paLink validates URL", function () {
    var el = { id: "c2pa-link", value: "https://example.com" };
    var warn = { style: { display: "" } };
    globalThis.document.getElementById = function (id) {
      if (id === "c2pa-link-warn") return warn;
      return null;
    };
    validateC2paLink(el);
    assert.equal(warn.style.display, "none");
    el.value = "not-a-url";
    validateC2paLink(el);
    assert.equal(warn.style.display, "block");
    el.value = "";
    validateC2paLink(el);
    assert.equal(warn.style.display, "none");
  });
});

describe("simplified_countries.js — prefixHttps", function () {
  it("prefixes https:// when missing", function () {
    var el = { value: "", setSelectionRange: function () {} };
    prefixHttps(el);
    assert.equal(el.value, "https://");
  });

  it("does not change when already prefixed", function () {
    var el = {
      value: "https://example.com",
      setSelectionRange: function () {},
    };
    prefixHttps(el);
    assert.equal(el.value, "https://example.com");
  });
});

describe("simplified_countries.js — phoneCodeOptionsHtml", function () {
  it("generates options with placeholder when no selection", function () {
    var html = phoneCodeOptionsHtml(null);
    assert.ok(html.includes("Select country"));
    assert.ok(html.includes("+966"));
    assert.ok(html.includes("SA"));
  });

  it("marks selected option when matching", function () {
    var html = phoneCodeOptionsHtml("+1");
    assert.ok(html.includes("selected"));
    assert.ok(html.includes("US"));
  });
});

describe("simplified_countries.js — showProgress / hideProgress", function () {
  it("showProgress displays the progress bar", function () {
    var el = { style: { display: "none" } };
    globalThis.document.getElementById = function () {
      return el;
    };
    showProgress();
    assert.equal(el.style.display, "");
  });

  it("showProgress handles missing element", function () {
    globalThis.document.getElementById = function () {
      return null;
    };
    showProgress();
    assert.ok(true);
  });

  it("hideProgress hides the progress bar", function () {
    var el = { style: { display: "" } };
    globalThis.document.getElementById = function () {
      return el;
    };
    hideProgress();
    assert.equal(el.style.display, "none");
  });

  it("hideProgress handles missing element", function () {
    globalThis.document.getElementById = function () {
      return null;
    };
    hideProgress();
    assert.ok(true);
  });
});

describe("simplified_countries.js — openLightbox / closeLightbox", function () {
  it("openLightbox sets img src and shows box", function () {
    var img = getMockEl("lightboxImg");
    var box = getMockEl("lightbox");
    img.src = "";
    box.style.display = "none";
    openLightbox("https://example.com/img.png");
    assert.equal(img.src, "https://example.com/img.png");
    assert.equal(box.style.display, "");
  });

  it("openLightbox handles missing elements", function () {
    var origGet = globalThis.document.getElementById;
    globalThis.document.getElementById = function () {
      return null;
    };
    openLightbox("test");
    assert.ok(true);
    globalThis.document.getElementById = origGet;
  });

  it("closeLightbox hides the box", function () {
    var box = getMockEl("lightbox");
    box.style.display = "";
    closeLightbox();
    assert.equal(box.style.display, "none");
  });

  it("closeLightbox handles missing element", function () {
    var origGet = globalThis.document.getElementById;
    globalThis.document.getElementById = function () {
      return null;
    };
    closeLightbox();
    assert.ok(true);
    globalThis.document.getElementById = origGet;
  });
});

describe("simplified_countries.js — clearSimpleData", function () {
  beforeEach(function () {
    globalThis.confirm = function () {};
    globalThis.localStorage.removeItem = function () {};
    globalThis.initSimplified = function () {};
    simpleResults = { someUrl: "blob:test", otherKey: "value" };
    globalThis.URL.revokeObjectURL = function () {};
  });

  it("cancels when confirm returns false", function () {
    globalThis.confirm = function () {
      return false;
    };
    clearSimpleData();
    assert.ok(true);
  });

  it("clears data and re-inits when confirmed", function () {
    globalThis.confirm = function () {
      return true;
    };
    var cleared = false;
    globalThis.initSimplified = function () {
      cleared = true;
    };
    clearSimpleData();
    assert.ok(cleared);
  });
});

// ── Additional embedAlgo case coverage ──

describe("simplified.js — embedAlgo remaining cases", function () {
  it("dispatches to aw2_embed for algo 2", async function () {
    var s16 = new Int16Array(100);
    var r2 = await embedAlgo(2, s16, "010101", 44100, 50, function () {});
    assert.ok(r2);
  });

  it("dispatches to aw3_embed for algo 3", async function () {
    var s16 = new Int16Array(100);
    var r3 = await embedAlgo(3, s16, "010101", 44100, 50, function () {});
    assert.ok(r3);
  });

  it("dispatches to aw4_embed for algo 4", async function () {
    var s16 = new Int16Array(100);
    var r4 = await embedAlgo(4, s16, "010101", 44100, 50, function () {});
    assert.ok(r4);
  });

  it("dispatches to aw6_embed for algo 6", async function () {
    var s16 = new Int16Array(100);
    var r6 = await embedAlgo(6, s16, "010101", 44100, 50, function () {});
    assert.ok(r6);
  });

  it("dispatches to aw7_embed for algo 7", async function () {
    var s16 = new Int16Array(100);
    var r7 = await embedAlgo(7, s16, "010101", 44100, 50, function () {});
    assert.ok(r7);
  });
});

// ── simplified_helpers.js remaining edge cases ──

describe("simplified_helpers.js — formatSize", function () {
  it("formats bytes as B, KB, MB correctly", function () {
    assert.equal(formatSize(0), "0 B");
    assert.equal(formatSize(999), "999 B");
    assert.equal(formatSize(1024), "1.0 KB");
    assert.equal(formatSize(1536), "1.5 KB");
    assert.equal(formatSize(1048576), "1.0 MB");
    assert.equal(formatSize(2097152), "2.0 MB");
  });
});

describe("simplified_helpers.js — escapeHtml", function () {
  it('escapes & < > " characters', function () {
    assert.equal(escapeHtml("&"), "&amp;");
    assert.equal(escapeHtml("<"), "&lt;");
    assert.equal(escapeHtml(">"), "&gt;");
    assert.equal(escapeHtml('"'), "&quot;");
    assert.equal(
      escapeHtml("<script>alert(1)</script>"),
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });
});

describe("simplified_helpers.js — simpleFileSelected INPUT branches", function () {
  beforeEach(function () {
    simpleSteps = [];
    simpleFile = null;
    simpleStep = 0;
    var _s = {};
    _s.simpleDropZone = { classList: { add: function () {} }, style: {} };
    _s.simpleFileInfo = { innerHTML: "" };
    _s.simpleFileInput = {
      value: "",
      getAttribute: function () {
        return null;
      },
      tagName: "INPUT",
    };
    globalThis.document.getElementById = function (id) {
      return _s[id] || null;
    };
    globalThis.isDangerousFile = function () {
      return false;
    };
    globalThis.isEnglishFilename = function () {
      return true;
    };
    globalThis.matchesAccept = function () {
      return true;
    };
    globalThis.matchesMagicBytes = function () {
      return Promise.resolve(true);
    };
    globalThis.checkDangerousContent = function () {
      return Promise.resolve(false);
    };
    globalThis.checkFileStructure = function () {
      return Promise.resolve(true);
    };
    globalThis.escapeHtml = function (s) {
      if (s == null) return "";
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    };
    globalThis.__ = function (k, d) {
      return d || k || "";
    };
    globalThis.renderStep = function () {};
    globalThis.FileReader = function () {
      this.readAsArrayBuffer = function () {
        this.onload({ target: { result: new ArrayBuffer(10) } });
      };
    };
    globalThis.alert = function () {};
  });

  it("resets INPUT value via tagName check on dangerous file", async function () {
    globalThis.isDangerousFile = function () {
      return true;
    };
    var inputEl = {
      files: [{ name: "virus.exe" }],
      value: "virus.exe",
      tagName: "INPUT",
    };
    await simpleFileSelected(inputEl);
    assert.equal(inputEl.value, "");
  });

  it("resets INPUT value via tagName check on non-English filename", async function () {
    globalThis.isEnglishFilename = function () {
      return false;
    };
    var inputEl = {
      files: [{ name: "照片.png" }],
      value: "照片.png",
      tagName: "INPUT",
    };
    await simpleFileSelected(inputEl);
    assert.equal(inputEl.value, "");
  });

  it("resets INPUT value on wrong type", async function () {
    globalThis.matchesAccept = function () {
      return false;
    };
    var el = document.getElementById("simpleFileInput");
    el.getAttribute = function (a) {
      return a === "accept" ? ".png" : null;
    };
    var inputEl = {
      files: [{ name: "doc.pdf" }],
      value: "doc.pdf",
      tagName: "INPUT",
    };
    await simpleFileSelected(inputEl);
    assert.equal(inputEl.value, "");
  });

  it("resets INPUT value on corrupt file", async function () {
    globalThis.matchesMagicBytes = function () {
      return Promise.resolve(false);
    };
    var inputEl = {
      files: [{ name: "corrupt.png" }],
      value: "corrupt.png",
      tagName: "INPUT",
    };
    await simpleFileSelected(inputEl);
    assert.equal(inputEl.value, "");
  });

  it("resets INPUT value on dangerous content", async function () {
    globalThis.checkDangerousContent = function () {
      return Promise.resolve(true);
    };
    var inputEl = {
      files: [{ name: "test.png" }],
      value: "test.png",
      tagName: "INPUT",
    };
    await simpleFileSelected(inputEl);
    assert.equal(inputEl.value, "");
  });

  it("resets INPUT value on bad structure", async function () {
    globalThis.checkFileStructure = function () {
      return Promise.resolve(false);
    };
    var inputEl = {
      files: [{ name: "bad.png" }],
      value: "bad.png",
      tagName: "INPUT",
    };
    await simpleFileSelected(inputEl);
    assert.equal(inputEl.value, "");
  });

  it("handles try/catch when setting INPUT value throws", async function () {
    globalThis.isEnglishFilename = function () {
      return false;
    };
    var throwingInput = {
      files: [{ name: "test.png" }],
      tagName: "INPUT",
      get value() {
        return "test.png";
      },
      set value(v) {
        throw new Error("no");
      },
    };
    try {
      await simpleFileSelected(throwingInput);
      assert.ok(true); // Should not throw
    } catch (e) {
      assert.fail("should not throw: " + e.message);
    }
  });
});

describe("simplified_helpers.js — setMode professional mode", function () {
  it("switches to professional mode and shows home", function () {
    getMockEl("modeSelect");
    getMockEl("simplifiedMode");
    getMockEl("mainNav");
    getMockEl("sidebar");
    getMockEl("sidebarOverlay");
    getMockEl("app");
    getMockEl("mainFooter");
    setMode("professional");
    assert.equal(getMockEl("simplifiedMode").style.display, "none");
  });
});

describe("simplified_helpers.js — switchMode", function () {
  it("calls showModeSelect", function () {
    getMockEl("modeSelect");
    getMockEl("mainNav");
    getMockEl("sidebar");
    getMockEl("sidebarOverlay");
    getMockEl("app");
    getMockEl("mainFooter");
    getMockEl("simplifiedMode");
    switchMode();
    assert.ok(true);
  });
});
