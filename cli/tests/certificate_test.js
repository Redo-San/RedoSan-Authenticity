const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};
globalThis.URL.createObjectURL =
  globalThis.URL.createObjectURL || (() => "blob:stub");
globalThis.URL.revokeObjectURL = globalThis.URL.revokeObjectURL || (() => {});
if (!globalThis.document) {
  var domEls = {};
  globalThis.document = {
    getElementById: function (id) {
      return domEls[id] || null;
    },
    _setEl: function (id, el) {
      domEls[id] = el;
    },
    _resetEls: function () {
      domEls = {};
    },
    readyState: "complete",
    createElement: function (t) {
      if (t === "canvas") {
        var ctx = {
          _font: "",
          get font() {
            return this._font;
          },
          set font(v) {
            this._font = v;
          },
          measureText: function (text) {
            return { width: text.length * 10 };
          },
          fillStyle: "",
          textBaseline: "",
          fillText: function () {},
          scale: function () {},
        };
        var canvas = {
          getContext: function () {
            return ctx;
          },
          toDataURL: function () {
            return "data:image/png;base64,iVBOR";
          },
          width: 0,
          height: 0,
        };
        return canvas;
      }
      if (t === "div") {
        var escDiv = {
          _text: "",
          get textContent() {
            return this._text;
          },
          set textContent(v) {
            this._text = v;
            this.innerHTML = String(v)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#39;");
          },
          innerHTML: "",
          style: {},
        };
        return escDiv;
      }
      if (t === "script") {
        return { src: "", onload: null, onerror: null };
      }
      if (t === "select") {
        return {
          value: "",
          innerHTML: "",
          style: {},
        };
      }
      if (t === "option") {
        return { value: "", text: "", selected: false };
      }
      if (t === "a") {
        return {
          href: "",
          download: "",
          style: {},
          click: function () {},
          remove: function () {},
        };
      }
      return {};
    },
    head: {
      append: function () {},
    },
    body: {
      append: function () {},
    },
    addEventListener: function () {},
  };
}

var canvasElem = {
  getContext: function () {
    return {
      font: "",
      measureText: function () {
        return { width: 100 };
      },
      fillStyle: "",
      textBaseline: "",
      fillText: function () {},
    };
  },
  toDataURL: function () {
    return "data:image/png;base64,iVBOR";
  },
  width: 0,
  height: 0,
};

var mockQRious = function (opts) {
  opts.element.toDataURL = function () {
    return "data:image/png;base64,qr";
  };
};
globalThis.QRious = mockQRious;

globalThis.__ =
  globalThis.__ ||
  function (k, d) {
    return d || k;
  };

var imageResolve = { naturalWidth: 800, naturalHeight: 600 };
globalThis.Image = function () {
  var img = this;
  setTimeout(function () {
    if (img.onload) img.onload();
  }, 5);
};
globalThis.Image.prototype.onload = null;
globalThis.Image.prototype.onerror = null;
globalThis.Image.prototype.src = "";
globalThis.window = globalThis.window || globalThis;
globalThis.devicePixelRatio = 1;

globalThis.COUNTRY_CODES = globalThis.COUNTRY_CODES || [
  { code: "US", dial: "+1", name: "USA", len: 10 },
  { code: "GB", dial: "+44", name: "UK", len: 10 },
];

const srcUtils = fs.readFileSync(
  path.join(__dirname, "../../Certificate/certificate_utils.js"),
  "utf8",
);
const cleanUtils = srcUtils.replace(
  /^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/,
  "",
);
vm.runInThisContext(cleanUtils, {
  filename: path.resolve(__dirname, "../../Certificate/certificate_utils.js"),
});

const srcOts = fs.readFileSync(
  path.join(__dirname, "../../Certificate/certificate_ots.js"),
  "utf8",
);
const cleanOts = srcOts.replace(
  /^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/,
  "",
);
vm.runInThisContext(cleanOts, {
  filename: path.resolve(__dirname, "../../Certificate/certificate_ots.js"),
});

const srcPdf = fs.readFileSync(
  path.join(__dirname, "../../Certificate/certificate_pdf.js"),
  "utf8",
);
const cleanPdf = srcPdf.replace(
  /^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/,
  "",
);
vm.runInThisContext(cleanPdf, {
  filename: path.resolve(__dirname, "../../Certificate/certificate_pdf.js"),
});

const srcDocx = fs.readFileSync(
  path.join(__dirname, "../../Certificate/certificate_docx.js"),
  "utf8",
);
const cleanDocx = srcDocx.replace(
  /^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/,
  "",
);
vm.runInThisContext(cleanDocx, {
  filename: path.resolve(__dirname, "../../Certificate/certificate_docx.js"),
});

const srcEpub = fs.readFileSync(
  path.join(__dirname, "../../Certificate/certificate_epub.js"),
  "utf8",
);
const cleanEpub = srcEpub.replace(
  /^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/,
  "",
);
vm.runInThisContext(cleanEpub, {
  filename: path.resolve(__dirname, "../../Certificate/certificate_epub.js"),
});

const src = fs.readFileSync(
  path.join(__dirname, "../../Certificate/certificate.js"),
  "utf8",
);
const cleanSrc = src.replace(
  /^\(function\s*\(\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\)\(\s*\);/,
  "",
);
vm.runInThisContext(cleanSrc, {
  filename: path.resolve(__dirname, "../../Certificate/certificate.js"),
});

describe("Certificate — hasNonLatinChars", () => {
  it("returns false for pure ASCII", () => {
    assert.equal(hasNonLatinChars("Hello World 123"), false);
  });

  it("returns true for Arabic text", () => {
    assert.equal(hasNonLatinChars("مرحبا"), true);
  });

  it("returns true for Chinese characters", () => {
    assert.equal(hasNonLatinChars("你好"), true);
  });

  it("returns true for Japanese", () => {
    assert.equal(hasNonLatinChars("こんにちは"), true);
  });

  it("returns false for Latin-1 extended (U+00FF)", () => {
    assert.equal(hasNonLatinChars("café"), false); // é is U+00E9, within Latin-1
  });

  it("returns false for empty string", () => {
    assert.equal(hasNonLatinChars(""), false);
  });
});

describe("Certificate — bufToBase64", () => {
  it("should encode Uint8Array to base64", () => {
    const buf = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    assert.equal(bufToBase64(buf), "SGVsbG8=");
  });

  it("should encode empty buffer", () => {
    assert.equal(bufToBase64(new Uint8Array(0)), "");
  });

  it("should encode binary data", () => {
    const buf = new Uint8Array([0x00, 0x01, 0xff, 0xfe]);
    const result = bufToBase64(buf);
    assert.ok(typeof result === "string");
    assert.ok(result.length > 0);
    // decode and verify
    const decoded = Buffer.from(result, "base64");
    assert.equal(decoded[0], 0x00);
    assert.equal(decoded[3], 0xfe);
  });
});

describe("Certificate — bufToDataURL", () => {
  it("should produce a data URL with mime type", () => {
    const buf = new Uint8Array([0x48, 0x65, 0x6c]);
    const url = bufToDataURL(buf, "text/plain");
    assert.ok(url.startsWith("data:text/plain;base64,"));
    assert.ok(url.length > 20);
  });

  it("should use default mime when not provided", () => {
    const buf = new Uint8Array([0x00]);
    const url = bufToDataURL(buf);
    assert.ok(url.startsWith("data:application/octet-stream;base64,"));
  });

  it("should produce valid base64 content", () => {
    const buf = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    const url = bufToDataURL(buf, "text/plain");
    const b64 = url.split(",")[1];
    assert.equal(Buffer.from(b64, "base64").toString(), "Hello");
  });
});

describe("Certificate — makeCertDataURL", () => {
  it("should create a blob URL for given data", () => {
    // In Node, URL.createObjectURL is not available, so we need to stub it
    const originalCreateObjectURL = globalThis.URL.createObjectURL;
    globalThis.URL.createObjectURL = (blob) => "blob:test";
    try {
      const buf = new Uint8Array([0x01, 0x02]);
      const url = makeCertDataURL(buf, "image/png");
      assert.equal(url, "blob:test");
    } finally {
      globalThis.URL.createObjectURL = originalCreateObjectURL;
    }
  });
});

describe("Certificate — getFileHashSha256", () => {
  it("should compute SHA-256 of a buffer", async () => {
    const buf = new Uint8Array([0x61, 0x62, 0x63]); // "abc"
    const hash = await getFileHashSha256(buf);
    // SHA-256 of "abc"
    assert.equal(
      hash,
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("should compute hash of empty buffer", async () => {
    const hash = await getFileHashSha256(new Uint8Array(0));
    assert.equal(
      hash,
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("should return lowercase hex", async () => {
    const hash = await getFileHashSha256(new Uint8Array([0x00]));
    // SHA-256 of \x00
    assert.equal(
      hash,
      "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d",
    );
    assert.ok(/^[0-9a-f]+$/.test(hash));
  });
});

describe("Certificate — makeUUID", () => {
  it("should use crypto.randomUUID when available", () => {
    const orig = globalThis.crypto.randomUUID;
    globalThis.crypto.randomUUID = () => "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
    try {
      assert.equal(makeUUID(), "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa");
    } finally {
      globalThis.crypto.randomUUID = orig;
    }
  });

  it("should fall back when crypto.randomUUID is missing", () => {
    const orig = globalThis.crypto.randomUUID;
    delete globalThis.crypto.randomUUID;
    try {
      var id = makeUUID();
      assert.equal(id.length, 36);
      assert.equal(id[14], "4");
    } finally {
      globalThis.crypto.randomUUID = orig;
    }
  });

  it("should produce valid UUID v4 format via fallback", () => {
    const orig = globalThis.crypto.randomUUID;
    delete globalThis.crypto.randomUUID;
    try {
      var seen = {};
      for (var i = 0; i < 100; i++) {
        var id = makeUUID();
        assert.match(
          id,
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
        seen[id] = true;
      }
      assert.ok(Object.keys(seen).length > 90);
    } finally {
      globalThis.crypto.randomUUID = orig;
    }
  });
});

describe("Certificate — fmtSize", () => {
  it("should format bytes", () => {
    assert.equal(fmtSize(0), "0 B");
    assert.equal(fmtSize(512), "512 B");
    assert.equal(fmtSize(1023), "1023 B");
  });

  it("should format KB", () => {
    assert.equal(fmtSize(1024), "1.0 KB");
    assert.equal(fmtSize(1536), "1.5 KB");
  });

  it("should format MB", () => {
    assert.equal(fmtSize(1048576), "1.0 MB");
    assert.equal(fmtSize(1572864), "1.5 MB");
  });

  it("should handle large values", () => {
    assert.equal(fmtSize(1073741824), "1024.0 MB");
  });
});

describe("Certificate — stripHtml", () => {
  it("should remove HTML tags", () => {
    assert.equal(stripHtml("<p>Hello</p>"), "Hello");
  });

  it("should decode HTML entities", () => {
    assert.equal(stripHtml("&amp; &lt; &gt; &quot; &#39;"), "& < > \" '");
  });

  it("should strip nested tags", () => {
    assert.equal(stripHtml("<div><p><b>Nested</b></p></div>"), "Nested");
  });

  it("should handle empty string", () => {
    assert.equal(stripHtml(""), "");
  });

  it("should handle null/undefined", () => {
    assert.equal(stripHtml(null), "");
    assert.equal(stripHtml(undefined), "");
  });

  it("should collapse whitespace", () => {
    assert.equal(stripHtml("  Hello   World  "), "Hello World");
  });

  it("should handle unknown entities", () => {
    assert.equal(stripHtml("&unknown;test"), "test");
  });
});

describe("Certificate — escHtml", () => {
  it("should escape HTML special chars", () => {
    assert.equal(
      escHtml("<div>\"test\" & 'x'"),
      "&lt;div&gt;&quot;test&quot; &amp; &#39;x&#39;",
    );
  });

  it("should return empty string for null/undefined", () => {
    assert.equal(escHtml(null), "");
    assert.equal(escHtml(undefined), "");
  });

  it("should handle numbers", () => {
    assert.equal(escHtml(42), "42");
  });

  it("should pass through safe text", () => {
    assert.equal(escHtml("Hello World"), "Hello World");
  });
});

describe("Certificate — buildQRVerificationJSON", () => {
  var minData;
  before(function () {
    minData = {
      generator: "Test",
      generatedAt: "2024-01-01T00:00:00.000Z",
      file: {
        name: "test.jpg",
        size: 1024,
        hash: "abc123",
        width: 100,
        height: 100,
      },
      user: { name: "Tester", email: "t@t.com" },
    };
  });

  it("should produce valid JSON with required fields", () => {
    var result = JSON.parse(buildQRVerificationJSON(minData));
    assert.equal(result.v, 1);
    assert.equal(result.gen, "Test");
    assert.equal(result.file.n, "test.jpg");
    assert.equal(result.file.s, 1024);
    assert.equal(result.file.h, "abc123");
    assert.equal(result.user.n, "Tester");
    assert.equal(result.user.e, "t@t.com");
  });

  it("should include fingerprint hashes when fpResult exists", () => {
    var data = Object.assign({}, minData, {
      fpResult: {
        hashes: { "SHA-256": "abc", "SHA-384": "def", MD5: "ghi" },
      },
    });
    var result = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(result.fp["SHA-256"], "abc");
    assert.equal(result.fp["SHA-384"], "def");
    assert.equal(result.fp["MD5"], "ghi");
  });

  it("should include perceptual hashes when present", () => {
    var data = Object.assign({}, minData, {
      fpResult: {
        hashes: { "SHA-256": "abc" },
        perceptual_hashes: { dhash: "ffff", phash: "aaaa" },
      },
    });
    var result = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(result.fp.ph_dhash, "ffff");
    assert.equal(result.fp.ph_phash, "aaaa");
  });

  it("should include DID signature when didSig exists", () => {
    var data = Object.assign({}, minData, {
      didSig: {
        did: "did:key:z6MkhaXgBZDjot9W7K6ZoPwTyRnTqPZuLbSZNqJqRZpLJiTn",
        algorithm: "Ed25519",
        signature: "sig123",
      },
    });
    var result = JSON.parse(buildQRVerificationJSON(data));
    assert.ok(result.did.startsWith("did:key:z6MkhaXgBZDjot9W7K6Z"));
    assert.ok(result.sig);
  });

  it("should include DID identity (no signature) when didIdentity exists", () => {
    var data = Object.assign({}, minData, {
      didIdentity: "did:key:z6MkhaXgBZDjot9W7K6Zo",
    });
    var result = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(result.did, "did:key:z6MkhaXgBZDjot9W7K6Zo");
  });

  it("should include face biometric count when detected", () => {
    var data = Object.assign({}, minData, {
      faceBiometric: { detected: true, faceCount: 2 },
    });
    var result = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(result.fc, 2);
  });

  it("should set watermark and pixel injection flags", () => {
    var data = Object.assign({}, minData, {
      watermark: true,
      pixelInjection: true,
      timestamp: true,
    });
    var result = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(result.wm, 1);
    assert.equal(result.pi, 1);
    assert.equal(result.ts, 1);
  });

  it("should handle minimal data gracefully", () => {
    var data = {
      generator: "Test",
      generatedAt: "2024-01-01T00:00:00.000Z",
      file: { name: "", size: 0 },
      user: { name: "", email: "" },
    };
    var result = JSON.parse(buildQRVerificationJSON(data));
    assert.equal(result.file.n, "");
    assert.equal(result.user.n, "");
    assert.equal(result.dims, "");
  });
});

describe("Certificate — getDocHash", () => {
  it("should compute SHA-256 hash of a JSON string", async () => {
    var hash = await getDocHash('{"test":"data"}');
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it("should produce consistent hashes for same input", async () => {
    var h1 = await getDocHash("hello");
    var h2 = await getDocHash("hello");
    assert.equal(h1, h2);
  });
});

describe("Certificate — generateQRDataURL", () => {
  it("should produce a data URL", function () {
    var url = generateQRDataURL("test", 200);
    assert.ok(url.startsWith("data:image/png;base64,"));
  });

  it("should use default size when not provided", function () {
    var url = generateQRDataURL("test");
    assert.ok(url.startsWith("data:image/png;base64,"));
  });
});

describe("Certificate — loadImageDimensions", () => {
  it("should resolve with image dimensions on load", async () => {
    globalThis.Image = function () {
      var img = this;
      setTimeout(function () {
        img.naturalWidth = 800;
        img.naturalHeight = 600;
        if (img.onload) img.onload();
      }, 5);
    };
    globalThis.Image.prototype.onload = null;
    globalThis.Image.prototype.onerror = null;
    globalThis.Image.prototype.src = "";
    var dims = await loadImageDimensions("data:image/png;base64,");
    assert.equal(dims.width, 800);
    assert.equal(dims.height, 600);
  });

  it("should resolve with 0 dimensions on error", async () => {
    globalThis.Image = function () {
      var img = this;
      setTimeout(function () {
        if (img.onerror) img.onerror();
      }, 5);
    };
    globalThis.Image.prototype.onload = null;
    globalThis.Image.prototype.onerror = null;
    globalThis.Image.prototype.src = "";
    var dims = await loadImageDimensions("bad-url");
    assert.equal(dims.width, 0);
    assert.equal(dims.height, 0);
  });
});

describe("Certificate — addTextSafe", () => {
  it("should call doc.text for Latin text", function () {
    var called = false;
    var doc = {
      text: function (t, x, y) {
        called = true;
      },
    };
    addTextSafe(doc, "Hello", 10, 10, 100, 9);
    assert.ok(called);
  });

  it("should render non-Latin text to canvas and embed", function () {
    var addImageCalled = false;
    var doc = {
      text: function () {},
      addImage: function () {
        addImageCalled = true;
      },
    };
    addTextSafe(doc, "مرحبا", 10, 10, 100, 9);
    assert.ok(addImageCalled);
  });
});
