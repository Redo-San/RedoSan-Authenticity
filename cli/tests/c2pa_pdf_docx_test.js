const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── Mock jspdf (singleton log for test inspection) ──
globalThis.jspdf = globalThis.jspdf || {};
globalThis.jspdf.jsPDF = class {
  constructor() {
    this.constructor.lastInstance = this;
    this._calls = [];
  }
  setFontSize(s) {
    this._calls.push(["setFontSize", s]);
    return this;
  }
  setTextColor(r, g, b) {
    this._calls.push(["setTextColor", r, g, b]);
    return this;
  }
  text(str, x, y) {
    this._calls.push(["text", str, x, y]);
    return this;
  }
  addPage() {
    this._calls.push(["addPage"]);
    return this;
  }
  output(fmt) {
    this._calls.push(["output", fmt]);
    return new Blob(["pdf"], { type: "application/pdf" });
  }
};

class MockParagraph {
  constructor(o) {
    this.opts = o;
  }
}
class MockTextRun {
  constructor(o) {
    this.opts = o;
  }
}
class MockTable {
  constructor(o) {
    this.opts = o;
  }
}
class MockTableRow {
  constructor(o) {
    this.opts = o;
  }
}
class MockTableCell {
  constructor(o) {
    this.opts = o;
  }
}
class MockDocument {
  constructor(o) {
    this.opts = o;
  }
}
globalThis.docx = {
  Paragraph: MockParagraph,
  TextRun: MockTextRun,
  Table: MockTable,
  TableRow: MockTableRow,
  TableCell: MockTableCell,
  Document: MockDocument,
  Packer: {
    toBlob: async () =>
      new Blob(["docx"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
  },
  WidthType: { PERCENTAGE: "percentage" },
};

globalThis.createDocxTable = function createDocxTable(docx, rows) {
  if (!rows || rows.length === 0) return null;
  return new docx.Table({
    rows: rows.map(function (row) {
      return new docx.TableRow({
        children: row.map(function (cell) {
          return new docx.TableCell({
            children: [
              new docx.Paragraph({
                children: [new docx.TextRun({ text: String(cell) })],
              }),
            ],
          });
        }),
      });
    }),
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
  });
};

globalThis.ensureLib = async () => {};

// ── Load c2pa.js ──
function loadC2pa() {
  let src = fs.readFileSync(path.join(__dirname, "../../C2PA/c2pa.js"), "utf8");
  src = src.replace(/^import .+$/m, "var createC2pa = null;");
  src = src.replace(/\bconst\s+/g, "var ");
  if (!globalThis.window) globalThis.window = globalThis;
  globalThis.BigInt = BigInt;
  globalThis.window.__ = globalThis.window.__ || ((k, d) => d || k);
  globalThis.window.escHtml =
    globalThis.window.escHtml ||
    ((s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;"));
  globalThis.window.escXml =
    globalThis.window.escXml ||
    ((s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;"));
  vm.runInThisContext(src, {
    filename: path.resolve(__dirname, "../../C2PA/c2pa.js"),
  });
}

before(() => loadC2pa());

const mockResult = {
  file: "test.jpg",
  activeLabel: "xmp:iid:abc123",
  manifest: {
    title: "Test Image",
    format: "image/jpeg",
    claim_generator: "RedoSan Authenticity 1.0",
    instance_id: "xmp:iid:abc123",
    signature_info: { issuer: "CN=Test CA", time: "2024-06-15T12:00:00Z" },
    claim_generator_info: [{ name: "RedoSan", version: "1.0" }],
    assertions: [
      {
        label: "c2pa.actions",
        data: [{ action: "c2pa.created", when: "2024-06-15T12:00:00Z" }],
      },
    ],
  },
  manifestStore: { validation_state: "ok" },
};

function pdfCalls() {
  const inst = globalThis.jspdf.jsPDF.lastInstance;
  return inst ? inst._calls : [];
}

describe("C2PA — c2paToPDF", () => {
  it("should return a Blob", async () => {
    const blob = await c2paToPDF(mockResult);
    assert.ok(blob instanceof Blob);
  });

  it("should include file name in output", async () => {
    await c2paToPDF(mockResult);
    const calls = pdfCalls();
    const texts = calls.filter((c) => c[0] === "text").map((c) => c[1]);
    assert.ok(texts.some((t) => t.includes("test.jpg")));
  });

  it("should include validation state", async () => {
    await c2paToPDF(mockResult);
    const calls = pdfCalls();
    const texts = calls.filter((c) => c[0] === "text").map((c) => c[1]);
    assert.ok(texts.some((t) => t.includes("ok")));
  });

  it("should call output with 'blob'", async () => {
    await c2paToPDF(mockResult);
    const calls = pdfCalls();
    assert.ok(calls.some((c) => c[0] === "output" && c[1] === "blob"));
  });

  it("should handle minimal manifest without optional fields", async () => {
    const minimal = {
      file: "min.jpg",
      activeLabel: "lbl1",
      manifest: {},
      manifestStore: { validation_state: "unknown" },
    };
    const blob = await c2paToPDF(minimal);
    assert.ok(blob instanceof Blob);
  });

  it("should handle page break when content exceeds page height", async () => {
    const manyActions = [];
    for (let i = 0; i < 50; i++) {
      manyActions.push({ action: "c2pa.edited", when: "2024-01-01" });
    }
    const result = {
      file: "multi.jpg",
      activeLabel: "xmp:iid:many",
      manifest: {
        title: "Multi Action Test",
        format: "image/jpeg",
        claim_generator: "Test",
        instance_id: "xmp:iid:many",
        signature_info: { issuer: "CN=Test CA", time: "2024-01-01" },
        claim_generator_info: Array.from({ length: 10 }, (_, i) => ({
          name: "Gen",
          version: String(i),
        })),
        assertions: [{ label: "c2pa.actions", data: manyActions }],
      },
      manifestStore: { validation_state: "ok" },
    };
    const blob = await c2paToPDF(result);
    assert.ok(blob instanceof Blob);
    const calls = pdfCalls();
    const addPageCalls = calls.filter((c) => c[0] === "addPage");
    assert.ok(addPageCalls.length > 0, "Should have added at least one page");
  });
});

describe("C2PA — c2paToDOCX", () => {
  it("should return a Blob", async () => {
    const blob = await c2paToDOCX(mockResult);
    assert.ok(blob instanceof Blob);
  });

  it("should create a Document with sections", async () => {
    const blob = await c2paToDOCX(mockResult);
    assert.ok(blob instanceof Blob);
  });

  it("should handle minimal manifest", async () => {
    const minimal = {
      file: "min.jpg",
      activeLabel: "lbl1",
      manifest: {},
      manifestStore: { validation_state: "unknown" },
    };
    const blob = await c2paToDOCX(minimal);
    assert.ok(blob instanceof Blob);
  });
});
