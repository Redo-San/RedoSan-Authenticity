const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadC2pa() {
  let src = fs.readFileSync(path.join(__dirname, "../../C2PA/c2pa.js"), "utf8");
  src = src.replace(/^import .+$/m, "var createC2pa = null;");
  src = src.replace(/\bconst\s+/g, "var ");
  if (!globalThis.window) globalThis.window = globalThis;
  globalThis.BigInt = BigInt;
  globalThis.window.__ = globalThis.window.__ || ((key, fallback) => fallback || key);
  globalThis.window.escHtml = globalThis.window.escHtml || ((s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
  globalThis.window.escXml = globalThis.window.escXml || ((s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
  vm.runInThisContext(src, { filename: path.resolve(__dirname, "../../C2PA/c2pa.js") });
}

before(() => loadC2pa());

const mockManifestStore = (overrides) => ({
  validation_state: "ok",
  validation_status: [],
  validation_results: {},
  ...overrides
});

const mockManifest = (overrides) => ({
  title: "Test Image",
  format: "image/jpeg",
  claim_generator: "RedoSan Authenticity",
  instance_id: "xmp:iid:12345",
  assertions: [
    { label: "c2pa.actions", data: [{ action: "c2pa.created", when: "2024-01-15T00:00:00Z" }] }
  ],
  signature_info: { issuer: "CN=Test", time: "2024-01-15T00:00:00Z" },
  ingredients: [
    { title: "photo.jpg", relationship: "parentOf" }
  ],
  claim_generator_info: [
    { name: "RedoSan Authenticity", version: "1.0.0" }
  ],
  ...overrides
});

describe("C2PA — getValidationHtml", () => {
  it("should render valid state badge", () => {
    const ms = mockManifestStore({ validation_state: "ok" });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("badge-success"));
    assert.ok(html.includes("Valid"));
  });

  it("should render trusted state badge", () => {
    const ms = mockManifestStore({ validation_state: "Trusted" });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("badge-success"));
    assert.ok(html.includes("Trusted"));
  });

  it("should render warning state badge", () => {
    const ms = mockManifestStore({ validation_state: "warning" });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("badge-warning"));
  });

  it("should render unknown state badge", () => {
    const ms = mockManifestStore({ validation_state: "bogus" });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("badge-muted"));
  });

  it("should render validation results with activeManifest categories", () => {
    const ms = mockManifestStore({
      validation_results: {
        activeManifest: {
          success: [
            { code: "c2pa.signed", explanation: "Signature verified" },
            { code: "c2pa.valid", explanation: "Manifest valid" }
          ],
          failure: [
            { code: "c2pa.missing", explanation: "Missing field" }
          ]
        }
      }
    });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("success"));
    assert.ok(html.includes("failure"));
    assert.ok(html.includes("c2pa.signed"));
  });

  it("should handle empty activeManifest categories", () => {
    const ms = mockManifestStore({ validation_results: { activeManifest: { success: [] } } });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("badge"));
  });

  it("should handle legacy validation_status format", () => {
    const ms = mockManifestStore({
      validation_results: {},
      validation_status: [{ code: "c2pa.legacy", explanation: "Legacy check" }]
    });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("c2pa.legacy"));
  });

  it("should return badge-only html when no results or status", () => {
    const ms = mockManifestStore({ validation_results: {}, validation_status: [] });
    const html = getValidationHtml(ms);
    assert.ok(html.startsWith("<span"));
    assert.ok(html.endsWith("</span>"));
  });

  it("should handle validation_status as plain strings", () => {
    const ms = mockManifestStore({
      validation_results: {},
      validation_status: ["c2pa.warning"]
    });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("c2pa.warning"));
  });

  it("should escape HTML in validation results", () => {
    const ms = mockManifestStore({
      validation_results: {
        activeManifest: {
          success: [{ code: "<script>alert('xss')</script>" }]
        }
      }
    });
    const html = getValidationHtml(ms);
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
  });
});

describe("C2PA — c2paToCSV", () => {
  const result = {
    file: "test.jpg",
    activeLabel: "xmp:iid:12345",
    manifest: mockManifest(),
    manifestStore: mockManifestStore()
  };

  it("should include CSV header", () => {
    const csv = c2paToCSV(result);
    assert.ok(csv.startsWith('"Key","Value"'));
  });

  it("should include file and active manifest", () => {
    const csv = c2paToCSV(result);
    assert.ok(csv.includes("test.jpg"));
    assert.ok(csv.includes("xmp:iid:12345"));
  });

  it("should include manifest fields", () => {
    const csv = c2paToCSV(result);
    assert.ok(csv.includes("Test Image"));
    assert.ok(csv.includes("image/jpeg"));
    assert.ok(csv.includes("RedoSan Authenticity"));
  });

  it("should include validation state", () => {
    const csv = c2paToCSV(result);
    assert.ok(csv.includes("ok"));
  });

  it("should include actions from assertions", () => {
    const csv = c2paToCSV(result);
    assert.ok(csv.includes("c2pa.created"));
  });

  it("should handle missing optional fields", () => {
    const minimal = {
      file: "test.jpg",
      activeLabel: "label1",
      manifest: { assertions: [] },
      manifestStore: mockManifestStore()
    };
    const csv = c2paToCSV(minimal);
    assert.ok(csv.includes("test.jpg"));
    assert.ok(!csv.includes("undefined"));
  });

  it("should quote commas in values", () => {
    const resultWithComma = {
      file: "test.jpg",
      activeLabel: "label1",
      manifest: { title: "Test, Image", assertions: [] },
      manifestStore: mockManifestStore()
    };
    const csv = c2paToCSV(resultWithComma);
    assert.ok(csv.includes('"Test, Image"'));
  });
});

describe("C2PA — c2paToTXT", () => {
  const result = {
    file: "test.jpg",
    activeLabel: "xmp:iid:12345",
    manifest: mockManifest(),
    manifestStore: mockManifestStore()
  };

  it("should include header", () => {
    const txt = c2paToTXT(result);
    assert.ok(txt.includes("C2PA Report"));
  });

  it("should include all manifest fields", () => {
    const txt = c2paToTXT(result);
    assert.ok(txt.includes("Test Image"));
    assert.ok(txt.includes("image/jpeg"));
    assert.ok(txt.includes("xmp:iid:12345"));
  });

  it("should include signature info", () => {
    const txt = c2paToTXT(result);
    assert.ok(txt.includes("CN=Test"));
    assert.ok(txt.includes("2024-01-15"));
  });

  it("should include actions section", () => {
    const txt = c2paToTXT(result);
    assert.ok(txt.includes("c2pa.created"));
  });

  it("should include ingredients section", () => {
    const txt = c2paToTXT(result);
    assert.ok(txt.includes("photo.jpg"));
    assert.ok(txt.includes("parentOf"));
  });

  it("should include generator info section", () => {
    const txt = c2paToTXT(result);
    assert.ok(txt.includes("RedoSan Authenticity"));
    assert.ok(txt.includes("1.0.0"));
  });

  it("should handle minimal manifest", () => {
    const minimal = {
      file: "test.jpg",
      activeLabel: "label1",
      manifest: {},
      manifestStore: mockManifestStore()
    };
    const txt = c2paToTXT(minimal);
    assert.ok(txt.includes("test.jpg"));
  });
});

describe("C2PA — c2paToXML", () => {
  const result = {
    file: "test.jpg",
    activeLabel: "xmp:iid:12345",
    manifest: mockManifest(),
    manifestStore: mockManifestStore()
  };

  it("should produce valid XML header", () => {
    const xml = c2paToXML(result);
    assert.ok(xml.startsWith('<?xml version="1.0"'));
  });

  it("should include root c2pa_report element", () => {
    const xml = c2paToXML(result);
    assert.ok(xml.includes("<c2pa_report>"));
    assert.ok(xml.includes("</c2pa_report>"));
  });

  it("should include all manifest fields", () => {
    const xml = c2paToXML(result);
    assert.ok(xml.includes("<file>test.jpg</file>"));
    assert.ok(xml.includes("<title>Test Image</title>"));
    assert.ok(xml.includes("<format>image/jpeg</format>"));
  });

  it("should include actions", () => {
    const xml = c2paToXML(result);
    assert.ok(xml.includes('action name="c2pa.created"'));
  });

  it("should include signature info", () => {
    const xml = c2paToXML(result);
    assert.ok(xml.includes("<issuer>CN=Test</issuer>"));
    assert.ok(xml.includes("<time>2024-01-15T00:00:00Z</time>"));
  });

  it("should include ingredients", () => {
    const xml = c2paToXML(result);
    assert.ok(xml.includes('ingredient title="photo.jpg"'));
    assert.ok(xml.includes('relationship="parentOf"'));
  });

  it("should include generator info", () => {
    const xml = c2paToXML(result);
    const genInfoRegex = /generator name="RedoSan Authenticity"/;
    assert.ok(genInfoRegex.test(xml));
  });

  it("should escape XML special chars in values", () => {
    const resultWithChars = {
      file: "test.jpg",
      activeLabel: "label1",
      manifest: { title: '<Test & "Image">', assertions: [] },
      manifestStore: mockManifestStore()
    };
    const xml = c2paToXML(resultWithChars);
    assert.ok(!xml.includes("<Test"));
    assert.ok(xml.includes("&lt;Test"));
    assert.ok(xml.includes("&amp;"));
  });

  it("should handle minimal manifest", () => {
    const minimal = {
      file: "test.jpg",
      activeLabel: "label1",
      manifest: {},
      manifestStore: mockManifestStore()
    };
    const xml = c2paToXML(minimal);
    assert.ok(xml.includes("<file>test.jpg</file>"));
    assert.ok(xml.includes("<active_manifest>label1</active_manifest>"));
  });

  it("should handle actions with digitalSourceType", () => {
    const resultWithSrc = {
      file: "test.jpg",
      activeLabel: "label1",
      manifest: {
        assertions: [
          { label: "c2pa.actions", data: [{ action: "c2pa.created", digitalSourceType: "http://ns.adobe.com/xap/1.0/g/img/digitalSourceType/digitalCameraCapture" }] }
        ]
      },
      manifestStore: mockManifestStore()
    };
    const xml = c2paToXML(resultWithSrc);
    assert.ok(xml.includes("digitalSourceType"));
  });
});

describe("C2PA — c2paToHTML", () => {
  const result = {
    file: "test.jpg",
    activeLabel: "xmp:iid:12345",
    manifest: mockManifest(),
    manifestStore: mockManifestStore()
  };

  it("should produce full HTML page", () => {
    const html = c2paToHTML(result);
    assert.ok(html.startsWith("<!DOCTYPE html>"));
    assert.ok(html.includes("</html>"));
  });

  it("should include title and file name", () => {
    const html = c2paToHTML(result);
    assert.ok(html.includes("Test Image"));
    assert.ok(html.includes("test.jpg"));
  });

  it("should include all manifest fields in table", () => {
    const html = c2paToHTML(result);
    assert.ok(html.includes("image/jpeg"));
    assert.ok(html.includes("RedoSan Authenticity"));
  });

  it("should include actions section", () => {
    const html = c2paToHTML(result);
    assert.ok(html.includes("c2pa.created"));
  });

  it("should include signature section", () => {
    const html = c2paToHTML(result);
    assert.ok(html.includes("CN=Test"));
  });

  it("should include ingredients section", () => {
    const html = c2paToHTML(result);
    assert.ok(html.includes("photo.jpg"));
  });

  it("should include generator info section", () => {
    const html = c2paToHTML(result);
    assert.ok(html.includes("RedoSan Authenticity"));
  });

  it("should escape HTML in values", () => {
    const resultWithXss = {
      file: "test.jpg",
      activeLabel: "label1",
      manifest: { title: "<script>alert(1)</script>", assertions: [] },
      manifestStore: mockManifestStore()
    };
    const html = c2paToHTML(resultWithXss);
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
  });

  it("should handle minimal manifest", () => {
    const minimal = {
      file: "test.jpg",
      activeLabel: "label1",
      manifest: {},
      manifestStore: mockManifestStore()
    };
    const html = c2paToHTML(minimal);
    assert.ok(html.includes("test.jpg"));
    assert.ok(html.includes("RedoSan Authenticity"));
  });
});
