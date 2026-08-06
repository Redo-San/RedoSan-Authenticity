const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── Global mocks ──
globalThis.window = globalThis;
globalThis.location = { protocol: "file:", href: "file:///test/", hostname: "localhost", origin: "null" };
globalThis.__ = (k, d) => d || k;
globalThis.setText = () => {};
globalThis.setStatus = () => {};
globalThis.spinner = () => {};
globalThis.downloadBlobSimple = () => {};
globalThis.setDownloadHandler = () => {};
globalThis.showDownloadModal = () => {};
globalThis.closeDownloadModal = () => {};
globalThis.escHtml = (s) => {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};
globalThis.escXml = (s) => {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};
globalThis.createDocxTable = () => {};

// Mock jsPDF
globalThis.jspdf = {
  jsPDF: function () {
    let pages = 1;
    return {
      _pages: 1,
      setFontSize: () => {},
      setTextColor: () => {},
      text: () => {},
      addPage: () => { pages++; },
      output: (type) => {
        if (type === "blob") return new Blob(["pdf"], { type: "application/pdf" });
        return "";
      },
    };
  },
};

// Mock docx
const docxMock = {
  Document: class {
    constructor(opts) { this.sections = opts.sections; }
  },
  Packer: {
    toBlob: async (doc) => new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
  },
  Paragraph: class {
    constructor(opts) { this.opts = opts; this.children = opts.children || []; }
  },
  TextRun: class {
    constructor(opts) { this.opts = opts; }
  },
  Table: class { constructor(opts) { this.opts = opts; } },
  TableRow: class { constructor(opts) { this.opts = opts; } },
  TableCell: class { constructor(opts) { this.opts = opts; } },
};
globalThis.docx = docxMock;

// ── Load cbor.js (replace 'export function' with 'function') ──
const cborSrc = fs.readFileSync(path.join(__dirname, "../../C2PA/cbor.js"), "utf8");
const cborClean = cborSrc
  .replace(/export function /g, "function ")
  .replace(/export function /g, "function ");
vm.runInThisContext(cborClean, { filename: path.resolve(__dirname, "../../C2PA/cbor.js") });

// ── Load c2pa.js (replace import line) ──
const c2paSrc = fs.readFileSync(path.join(__dirname, "../../C2PA/c2pa.js"), "utf8");
const c2paClean = c2paSrc
  .replace(
    /import \{ createC2pa \} from 'https:\/\/cdn\.jsdelivr\.net\/npm\/@contentauth\/c2pa-web@0\.8\.1\/\+esm';/,
    "var createC2pa = null;"
  );
vm.runInThisContext(c2paClean, { filename: path.resolve(__dirname, "../../C2PA/c2pa.js") });

// ── Helpers ──
function makeManifestStore(overrides) {
  return {
    manifests: {
      "urn:uuid:abc123": {
        title: "Test Image",
        format: "image/jpeg",
        claim_generator: "RedoSan",
        instance_id: "urn:uuid:def456",
        claim_version: 1,
        assertions: [],
        ingredients: [],
        signature_info: null,
        ...overrides,
      },
    },
    active_manifest: "urn:uuid:abc123",
    validation_state: "ok",
    validation_status: [],
    validation_results: {},
    ...overrides,
  };
}

function makeReadResult(overrides) {
  return {
    file: "test.jpg",
    activeLabel: "urn:uuid:abc123",
    manifestStore: makeManifestStore(),
    manifest: makeManifestStore().manifests["urn:uuid:abc123"],
    ...overrides,
  };
}

// ── Tests ──

describe("C2PA — escHtml", () => {
  it("should escape HTML special characters", () => {
    const result = escHtml("<script>\"alert\" & notify");
    assert.equal(result, "&lt;script&gt;&quot;alert&quot; &amp; notify");
  });

  it("should return empty string for null/undefined", () => {
    assert.equal(escHtml(null), "");
    assert.equal(escHtml(undefined), "");
  });

  it("should handle non-string input", () => {
    assert.equal(escHtml(42), "42");
    assert.equal(escHtml(true), "true");
  });
});

describe("C2PA — safeUrl", () => {
  it("should allow http, https, and data URLs", () => {
    assert.equal(safeUrl("http://example.com"), "http://example.com");
    assert.equal(safeUrl("https://example.com"), "https://example.com");
    assert.equal(safeUrl("data:image/png;base64,abc"), "data:image/png;base64,abc");
  });

  it("should reject non-http(s)/data URLs", () => {
    assert.equal(safeUrl("ftp://example.com"), "");
    assert.equal(safeUrl("javascript:alert(1)"), "");
    assert.equal(safeUrl("file:///etc/passwd"), "");
  });

  it("should return empty for falsy input", () => {
    assert.equal(safeUrl(null), "");
    assert.equal(safeUrl(""), "");
    assert.equal(safeUrl(undefined), "");
  });
});

describe("C2PA — formatDate", () => {
  it("should format a valid date", () => {
    const result = formatDate("2024-01-15T10:30:00Z");
    assert.ok(typeof result === "string");
    assert.ok(result.length > 0);
    assert.notEqual(result, "—");
  });

  it("should return dash for null/undefined", () => {
    assert.equal(formatDate(null), "—");
    assert.equal(formatDate(undefined), "—");
  });

  it("should return the input string if date parsing fails", () => {
    const result = formatDate("not-a-date");
    assert.ok(typeof result === "string");
  });
});

describe("C2PA — parsePem", () => {
  // Minimal EC private key PEM (TEST prefix so secret scanners treat it as a fixture)
  const TEST_PEM = `-----BEGIN TEST PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgfNJBsaRLSeHizv0m
GL+gcn78QmtfLSm+n+qG9veC2W2hRANCAAQPaL6RkAkYkKU4+IryBSYxJM3h77sF
iMrbvbI8fG7w2Bbl9otNG/cch3DAw5rGAPV7NWkyl3QGuV/wt0MrAPDo
-----END TEST PRIVATE KEY-----`;

  it("should decode PEM to ArrayBuffer", () => {
    const result = parsePem(TEST_PEM);
    assert.ok(result instanceof ArrayBuffer);
    assert.ok(result.byteLength > 0);
  });

  it("should produce consistent output for same input", () => {
    const r1 = parsePem(TEST_PEM);
    const r2 = parsePem(TEST_PEM);
    assert.equal(r1.byteLength, r2.byteLength);
  });

  it("should handle PEM with different header", () => {
    const certPem = TEST_PEM.replace("PRIVATE KEY", "CERTIFICATE");
    const result = parsePem(certPem);
    assert.ok(result instanceof ArrayBuffer);
  });
});

describe("C2PA — splitCerts", () => {
  const SINGLE_CERT = `-----BEGIN CERTIFICATE-----
MIIChzCCAi6gAwIBAgIUcCTmJHYF8dZfG0d1UdT6/LXtkeYwCgYIKoZIzj0EAwIw
gYwxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTESMBAGA1UEBwwJU29tZXdoZXJl
-----END CERTIFICATE-----`;

  const DOUBLE_CERT = `-----BEGIN CERTIFICATE-----
MIIChzCCAi6gAwIBAgIUcCTmJHYF8dZfG0d1UdT6/LXtkeYwCgYIKoZIzj0EAwIw
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICajCCAg+gAwIBAgIUfXDXHH+6GtA2QEBX2IvJ2YnGMnUwCgYIKoZIzj0EAwIw
-----END CERTIFICATE-----`;

  it("should return one cert from single PEM", () => {
    const certs = splitCerts(SINGLE_CERT);
    assert.equal(certs.length, 1);
    assert.ok(certs[0] instanceof Uint8Array);
  });

  it("should return two certs from multi-PEM", () => {
    const certs = splitCerts(DOUBLE_CERT);
    assert.equal(certs.length, 2);
  });

  it("should return empty array for non-PEM input", () => {
    const certs = splitCerts("no cert data here");
    assert.equal(certs.length, 0);
  });
});

describe("C2PA — getActionLabel", () => {
  it("should return friendly name for known actions", () => {
    assert.ok(getActionLabel("c2pa.created").length > 0);
    assert.ok(getActionLabel("c2pa.edited").length > 0);
    assert.ok(getActionLabel("c2pa.captured").length > 0);
    assert.ok(getActionLabel("c2pa.opened").length > 0);
    assert.ok(getActionLabel("c2pa.converted").length > 0);
    assert.ok(getActionLabel("c2pa.opt_out").length > 0);
  });

  it("should return the action key for unknown actions", () => {
    assert.equal(getActionLabel("unknown.action"), "unknown.action");
  });
});

describe("C2PA — getActionsHtml", () => {
  it("should return empty message for no assertions", () => {
    const manifest = { assertions: [] };
    const html = getActionsHtml(manifest);
    assert.ok(html.includes("No actions"));
  });

  it("should return empty message when no assertions array", () => {
    const html = getActionsHtml({});
    assert.ok(html.includes("No actions"));
  });

  it("should render action entries", () => {
    const manifest = {
      assertions: [
        {
          label: "c2pa.actions",
          data: [
            { action: "c2pa.created", when: "2024-01-01", description: "Created in test" },
          ],
        },
      ],
    };
    const html = getActionsHtml(manifest);
    assert.ok(html.includes("Created"));
    assert.ok(html.includes("Created in test"));
    // The when field is formatted via formatDate() which uses locale-specific digits
    // Check that it was rendered (the action-when span exists)
    assert.ok(html.includes("c2pa-action-when"));
  });

  it("should handle actions as single object (not array)", () => {
    const manifest = {
      assertions: [
        {
          label: "c2pa.actions",
          data: { actions: [{ action: "c2pa.edited" }] },
        },
      ],
    };
    const html = getActionsHtml(manifest);
    assert.ok(html.includes("Edited"));
  });

  it("should render entries with softwareAgent, actor, reason, parameters", () => {
    const manifest = {
      assertions: [
        {
          label: "c2pa.actions",
          data: [
            {
              action: "c2pa.created",
              softwareAgent: "TestApp/1.0",
              actor: { name: "Tester", identifier: "test@example.com" },
              reason: "Testing",
              parameters: { key: "val" },
              digitalSourceType: "http://ns.adobe.com/xap/1.0/g/img/type/photographic",
            },
          ],
        },
      ],
    };
    const html = getActionsHtml(manifest);
    assert.ok(html.includes("TestApp/1.0"));
    assert.ok(html.includes("Tester"));
    assert.ok(html.includes("test@example.com"));
    assert.ok(html.includes("Testing"));
    assert.ok(html.includes("key"));
    assert.ok(html.includes("val"));
    assert.ok(html.includes("photographic")); // from digitalSourceType
  });
});

describe("C2PA — getAssertionsHtml", () => {
  it("should return empty message for no assertions", () => {
    const manifest = { assertions: [] };
    const html = getAssertionsHtml(manifest);
    assert.ok(html.includes("No additional"));
  });

  it("should render data assertions", () => {
    const manifest = {
      assertions: [
        { label: "c2pa.test", data: { key: "value" }, kind: "TestKind" },
      ],
    };
    const html = getAssertionsHtml(manifest);
    assert.ok(html.includes("c2pa.test"));
    assert.ok(html.includes("TestKind"));
    // escHtml converts " to &quot; so JSON.stringify("key") becomes &quot;key&quot;
    assert.ok(html.includes("&quot;key&quot;") || html.includes('"key"'));
  });

  it("should skip thumbnail actions", () => {
    const manifest = {
      assertions: [
        { label: "c2pa.thumbnail", data: "thumb" },
        { label: "c2pa.actions", data: [] },
      ],
    };
    const html = getAssertionsHtml(manifest);
    assert.ok(html.includes("No additional"));
  });

  it("should handle string data", () => {
    const manifest = {
      assertions: [
        { label: "c2pa.simple", data: "plain text" },
      ],
    };
    const html = getAssertionsHtml(manifest);
    assert.ok(html.includes("plain text"));
  });
});

describe("C2PA — getIngredientsHtml", () => {
  it("should return empty message for no ingredients", () => {
    const manifest = { ingredients: [] };
    const html = getIngredientsHtml(manifest);
    assert.ok(html.includes("No ingredients"));
  });

  it("should render ingredients with all fields", () => {
    const manifest = {
      ingredients: [
        {
          title: "Background",
          format: "image/png",
          relationship: "parentOf",
          document_id: "doc:123",
          instance_id: "inst:456",
        },
      ],
    };
    const html = getIngredientsHtml(manifest);
    assert.ok(html.includes("Background"));
    assert.ok(html.includes("image/png"));
    assert.ok(html.includes("parentOf"));
    assert.ok(html.includes("doc:123"));
    assert.ok(html.includes("inst:456"));
  });

  it("should use instance_id as fallback title", () => {
    const manifest = {
      ingredients: [{ instance_id: "inst:fallback" }],
    };
    const html = getIngredientsHtml(manifest);
    assert.ok(html.includes("inst:fallback"));
  });
});

describe("C2PA — getSignatureInfoHtml", () => {
  it("should return empty for missing signature info", () => {
    const manifest = {};
    const html = getSignatureInfoHtml(manifest);
    assert.ok(html.includes("No signature"));
  });

  it("should render signature issuer, serial, and time", () => {
    const manifest = {
      signature_info: {
        issuer: "CN=Test CA",
        cert_serial_number: "12345",
        time: "2024-01-01T00:00:00Z",
      },
    };
    const html = getSignatureInfoHtml(manifest);
    assert.ok(html.includes("Test CA"));
    assert.ok(html.includes("12345"));
  });
});

describe("C2PA — getValidationHtml", () => {
  it("should show valid state with success badge", () => {
    const ms = makeManifestStore({ validation_state: "ok" });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("Valid") || html.includes("badge-success"));
  });

  it("should show trusted state with success badge", () => {
    const ms = makeManifestStore({ validation_state: "Trusted" });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("Trusted") || html.includes("badge-success"));
  });

  it("should show warning state", () => {
    const ms = makeManifestStore({ validation_state: "warning" });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("badge-warning"));
  });

  it("should show unknown state", () => {
    const ms = makeManifestStore({ validation_state: "error" });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("badge-muted"));
  });

  it("should render validation results with activeManifest", () => {
    const ms = makeManifestStore({
      validation_state: "ok",
      validation_results: {
        activeManifest: {
          success: [{ code: "pass1", explanation: "All good" }],
          failure: [{ code: "fail1", explanation: "Something wrong" }],
          informational: [{ code: "info1" }],
        },
      },
    });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("pass1"));
    assert.ok(html.includes("fail1"));
    assert.ok(html.includes("info1"));
  });

  it("should render legacy validation_status format", () => {
    const ms = makeManifestStore({
      validation_state: "warning",
      validation_results: {},
      validation_status: [{ code: "legacy.warning" }],
    });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("legacy.warning"));
  });

  it("should handle validation_status as string array", () => {
    const ms = makeManifestStore({
      validation_state: "warning",
      validation_results: {},
      validation_status: ["simple.warning"],
    });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("simple.warning"));
  });

  it("should handle legacy validation_status with explanations", () => {
    const ms = makeManifestStore({
      validation_state: "warning",
      validation_results: {},
      validation_status: [{ code: "test.failure", explanation: "Detailed explanation here" }],
    });
    const html = getValidationHtml(ms);
    assert.ok(html.includes("test.failure"));
    assert.ok(html.includes("Detailed explanation here"));
  });
});

describe("C2PA — c2paToCSV", () => {
  it("should produce CSV with header and data rows", () => {
    const r = makeReadResult();
    const csv = c2paToCSV(r);
    // CSV wraps all values in quotes: "Key","Value"
    assert.ok(csv.includes('"Key","Value"'));
    assert.ok(csv.includes("test.jpg"));
    assert.ok(csv.includes("RedoSan"));
  });

  it("should include signature info when present", () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        signature_info: { issuer: "CN=Test", time: "2024-01-01" },
      },
    });
    const csv = c2paToCSV(r);
    assert.ok(csv.includes("CN=Test"));
  });

  it("should include actions", () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        assertions: [{ label: "c2pa.actions", data: [{ action: "c2pa.created" }] }],
      },
    });
    const csv = c2paToCSV(r);
    assert.ok(csv.includes("c2pa.created"));
  });

  it("should escape quotes in CSV values", () => {
    const r = makeReadResult({ file: 'test"file.jpg' });
    const csv = c2paToCSV(r);
    assert.ok(csv.includes('"test""file.jpg"'));
  });
});

describe("C2PA — c2paToTXT", () => {
  it("should produce formatted text report", () => {
    const r = makeReadResult();
    const txt = c2paToTXT(r);
    assert.ok(txt.includes("RedoSan Authenticity"));
    assert.ok(txt.includes("test.jpg"));
    assert.ok(txt.includes("RedoSan"));
  });

  it("should include generator info section", () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        claim_generator_info: [{ name: "TestGen", version: "1.0" }],
      },
    });
    const txt = c2paToTXT(r);
    assert.ok(txt.includes("TestGen"));
  });

  it("should include actions section", () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        assertions: [{ label: "c2pa.actions", data: [{ action: "c2pa.created", when: "2024-01-01" }] }],
      },
    });
    const txt = c2paToTXT(r);
    assert.ok(txt.includes("c2pa.created"));
    assert.ok(txt.includes("2024-01-01"));
  });

  it("should include signature section", () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        signature_info: { issuer: "CN=Test" },
      },
    });
    const txt = c2paToTXT(r);
    assert.ok(txt.includes("CN=Test"));
  });

  it("should include ingredients section", () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        ingredients: [{ title: "Layer", relationship: "parentOf" }],
      },
    });
    const txt = c2paToTXT(r);
    assert.ok(txt.includes("Layer"));
    assert.ok(txt.includes("parentOf"));
  });
});

describe("C2PA — c2paToXML", () => {
  it("should produce valid XML structure", () => {
    const r = makeReadResult();
    const xml = c2paToXML(r);
    assert.ok(xml.includes('<?xml version="1.0"'));
    assert.ok(xml.includes("<c2pa_report>"));
    assert.ok(xml.includes("</c2pa_report>"));
    assert.ok(xml.includes("<file>test.jpg</file>"));
  });

  it("should include generator info", () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        claim_generator_info: [{ name: "Gen", version: "2.0" }],
      },
    });
    const xml = c2paToXML(r);
    assert.ok(xml.includes('name="Gen"'));
    assert.ok(xml.includes('version="2.0"'));
  });

  it("should include actions with attributes", () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        assertions: [{ label: "c2pa.actions", data: [{ action: "c2pa.edited", when: "2024-06-01", digitalSourceType: "http://ns.adobe.com/xap/1.0/g/img/type/photographic" }] }],
      },
    });
    const xml = c2paToXML(r);
    assert.ok(xml.includes('name="c2pa.edited"'));
    assert.ok(xml.includes('when="2024-06-01"'));
    assert.ok(xml.includes('digitalSourceType'));
  });

  it("should include signature and ingredients", () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        signature_info: { issuer: "CN=Test CA" },
        ingredients: [{ title: "bg.png", relationship: "parentOf" }],
      },
    });
    const xml = c2paToXML(r);
    assert.ok(xml.includes("CN=Test CA"));
    assert.ok(xml.includes('title="bg.png"'));
  });

  it("should escape XML special chars", () => {
    const r = makeReadResult({ file: "test&file.jpg" });
    const xml = c2paToXML(r);
    assert.ok(xml.includes("test&amp;file.jpg"));
  });
});

describe("C2PA — c2paToHTML", () => {
  it("should produce valid HTML document", () => {
    const r = makeReadResult();
    const html = c2paToHTML(r);
    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(html.includes("</html>"));
    assert.ok(html.includes("<title>C2PA Report"));
    assert.ok(html.includes("test.jpg"));
    assert.ok(html.includes("RedoSan Authenticity"));
  });

  it("should include generator info section", () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        claim_generator_info: [{ name: "TestGen", version: "3.0" }],
      },
    });
    const html = c2paToHTML(r);
    assert.ok(html.includes("TestGen"));
    assert.ok(html.includes("3.0"));
  });

  it("should include actions table", () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        assertions: [{ label: "c2pa.actions", data: [{ action: "c2pa.captured", when: "2024-01-01" }] }],
      },
    });
    const html = c2paToHTML(r);
    assert.ok(html.includes("c2pa.captured"));
  });

  it("should include signature and ingredients", () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        signature_info: { issuer: "CN=Test" },
        ingredients: [{ title: "layer1", relationship: "parentOf" }],
      },
    });
    const html = c2paToHTML(r);
    assert.ok(html.includes("CN=Test"));
    assert.ok(html.includes("layer1"));
  });
});

describe("C2PA — downloadC2pa", () => {
  let capturedBlob, capturedName;

  before(() => {
    globalThis.downloadBlobSimple = (blob, name) => {
      capturedBlob = blob;
      capturedName = name;
    };
    window._c2paReadResult = makeReadResult();
  });

  after(() => {
    delete window._c2paReadResult;
    capturedBlob = null;
    capturedName = null;
  });

  it("should generate CSV download", async () => {
    await window.downloadC2pa("csv");
    assert.ok(capturedName.endsWith(".csv"));
    assert.ok(capturedBlob instanceof Blob);
  });

  it("should generate TXT download", async () => {
    await window.downloadC2pa("txt");
    assert.ok(capturedName.endsWith(".txt"));
  });

  it("should generate JSON download", async () => {
    await window.downloadC2pa("json");
    assert.ok(capturedName.endsWith(".json"));
  });

  it("should generate XML download", async () => {
    await window.downloadC2pa("xml");
    assert.ok(capturedName.endsWith(".xml"));
  });

  it("should generate HTML download", async () => {
    await window.downloadC2pa("html");
    assert.ok(capturedName.endsWith(".html"));
  });

  it("should generate PDF download", async () => {
    await window.downloadC2pa("pdf");
    assert.ok(capturedName.endsWith(".pdf"));
  });

  it("should generate DOCX download", async () => {
    await window.downloadC2pa("doc");
    assert.ok(capturedName.endsWith(".docx"));
  });

  it("should do nothing when no read result", async () => {
    delete window._c2paReadResult;
    capturedBlob = null;
    await window.downloadC2pa("json");
    assert.equal(capturedBlob, null);
    // Restore
    window._c2paReadResult = makeReadResult();
  });
});

describe("C2PA — withTimeout", () => {
  it("should resolve a fast promise", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 1000, "timeout");
    assert.equal(result, "ok");
  });

  it("should reject on timeout", async () => {
    const slow = new Promise(() => {});
    await assert.rejects(() => withTimeout(slow, 10, "custom timeout msg"), { message: "custom timeout msg" });
  });

  it("should use default message when no msg provided", async () => {
    const slow = new Promise(() => {});
    await assert.rejects(() => withTimeout(slow, 10), { message: "Operation timed out" });
  });
});

describe("C2PA — sha256Hex (crypto.subtle)", () => {
  it("should compute SHA-256 for known input", async () => {
    const enc = new TextEncoder();
    const result = await sha256Hex(enc.encode("hello").buffer);
    assert.equal(result, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("should produce 64-char hex string", async () => {
    const result = await sha256Hex(new Uint8Array([0x00, 0x01, 0x02]).buffer);
    assert.equal(result.length, 64);
    assert.match(result, /^[0-9a-f]{64}$/);
  });
});

describe("C2PA — c2paToPDF", () => {
  it("should generate PDF blob with report content", () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        claim_generator_info: [{ name: "TestGen", version: "1.0" }],
        assertions: [{ label: "c2pa.actions", data: [{ action: "c2pa.created", when: "2024-01-01" }] }],
        signature_info: { issuer: "CN=Test", time: "2024-01-01" },
      },
    });
    const blob = c2paToPDF(r);
    assert.ok(blob instanceof Blob);
  });

  it("should handle manifest without optional fields", () => {
    const r = makeReadResult({
      manifest: { title: null, format: null, claim_generator: null, instance_id: null, assertions: [], signature_info: null, claim_generator_info: null },
    });
    const blob = c2paToPDF(r);
    assert.ok(blob instanceof Blob);
  });
});

describe("C2PA — c2paToDOCX", () => {
  it("should generate DOCX blob with report content", async () => {
    const r = makeReadResult({
      manifest: {
        ...makeReadResult().manifest,
        claim_generator_info: [{ name: "TestGen", version: "1.0" }],
        assertions: [{ label: "c2pa.actions", data: [{ action: "c2pa.created" }] }],
        signature_info: { issuer: "CN=Test" },
      },
    });
    const blob = await c2paToDOCX(r);
    assert.ok(blob instanceof Blob);
  });
});

describe("C2PA — C2PA_FORM_CONFIG", () => {
  it("should have all defined form types", () => {
    const types = ["create", "edit", "ai", "capture", "composite"];
    for (const t of types) {
      assert.ok(C2PA_FORM_CONFIG[t], `Missing config for ${t}`);
      assert.ok(C2PA_FORM_CONFIG[t].action);
    }
  });
});

describe("C2PA — createBrowserSigner", () => {
  it("should return an object with alg, reserveSize, sign, certs", async () => {
    const signer = await createBrowserSigner();
    assert.ok(signer, "signer should exist");
    assert.equal(signer.alg, "es256");
    assert.equal(typeof signer.reserveSize, "function");
    assert.equal(typeof signer.sign, "function");
    assert.equal(typeof signer.certs, "function");
  });

  it("reserveSize should return 5000", async () => {
    const signer = await createBrowserSigner();
    const size = await signer.reserveSize();
    assert.equal(size, 5000);
  });

  it("certs should return an array with one Uint8Array certificate", async () => {
    const signer = await createBrowserSigner();
    const certs = await signer.certs();
    assert.ok(Array.isArray(certs));
    assert.equal(certs.length, 1);
    assert.ok(certs[0] instanceof Uint8Array);
    assert.ok(certs[0].length > 0);
  });

  it("sign should return a 64-byte Uint8Array signature", async () => {
    const signer = await createBrowserSigner();
    const data = new TextEncoder().encode("test data to sign").buffer;
    const sig = await signer.sign(data);
    assert.ok(sig instanceof Uint8Array);
    assert.equal(sig.length, 64, "ECDSA P-256 signature should be 64 bytes");
  });

  it("sign should produce deterministic-like output (same input produces valid signature)", async () => {
    const signer = await createBrowserSigner();
    const data = new TextEncoder().encode("hello c2pa").buffer;
    const sig1 = await signer.sign(data);
    const sig2 = await signer.sign(data);
    assert.equal(sig1.length, 64);
    assert.equal(sig2.length, 64);
    // Both must be non-zero
    assert.ok(sig1.some(b => b !== 0), "signature should not be all zeros");
    assert.ok(sig2.some(b => b !== 0), "signature should not be all zeros");
  });
});

describe("C2PA — addIngredientFromFile", () => {
  it("should call builder.addIngredientFromBlob with correct arguments", async () => {
    let capturedTitle, capturedMime, capturedBlob;
    const mockBuilder = {
      addIngredientFromBlob: async (meta, mime, blob) => {
        capturedTitle = meta;
        capturedMime = mime;
        capturedBlob = blob;
      }
    };
    const mockFile = {
      name: "test_asset.png",
      type: "image/png",
      arrayBuffer: async () => new TextEncoder().encode("mock file content").buffer
    };

    await addIngredientFromFile(mockBuilder, mockFile, "parentOf");

    assert.deepEqual(capturedTitle, { title: "test_asset.png", relationship: "parentOf" });
    assert.equal(capturedMime, "image/png");
    assert.ok(capturedBlob instanceof Blob);
  });

  it("should use default relationship when not provided", async () => {
    let capturedTitle;
    const mockBuilder = {
      addIngredientFromBlob: async (meta) => {
        capturedTitle = meta;
      }
    };
    const mockFile = {
      name: "asset.jpg",
      type: "image/jpeg",
      arrayBuffer: async () => new TextEncoder().encode("data").buffer
    };

    await addIngredientFromFile(mockBuilder, mockFile);
    assert.equal(capturedTitle.relationship, "parentOf");
  });

  it("should fall back to image/jpeg when file has no type", async () => {
    let capturedMime;
    const mockBuilder = {
      addIngredientFromBlob: async (meta, mime) => {
        capturedMime = mime;
      }
    };
    const mockFile = {
      name: "asset.bin",
      type: "",
      arrayBuffer: async () => new TextEncoder().encode("data").buffer
    };

    await addIngredientFromFile(mockBuilder, mockFile, "parentOf");
    assert.equal(capturedMime, "image/jpeg");
  });
});
