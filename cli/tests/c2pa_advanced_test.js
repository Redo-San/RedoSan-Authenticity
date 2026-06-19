const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadC2pa() {
  let src = fs.readFileSync(path.join(__dirname, "../../C2PA/c2pa.js"), "utf8");
  src = src.replace(/^import .+$/m, "var createC2pa = null;");
  src = src.replace(/\bconst\s+/g, "var ");
  if (!globalThis.window) globalThis.window = globalThis;
  globalThis.BigInt = BigInt;
  globalThis.window.__ = globalThis.window.__ || ((s, d) => d || s);
  globalThis.window.escXml = globalThis.window.escXml || ((s) => s);
  vm.runInThisContext(src, { filename: "c2pa.js" });
}

before(() => loadC2pa());

describe("C2PA — sha256Hex", () => {
  it("should hash an empty buffer", async () => {
    const h = await sha256Hex(new ArrayBuffer(0));
    assert.equal(h, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("should hash a simple string", async () => {
    const buf = new TextEncoder().encode("hello").buffer;
    const h = await sha256Hex(buf);
    assert.equal(h, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
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

  it("should use default message", async () => {
    const slow = new Promise(() => {});
    await assert.rejects(() => withTimeout(slow, 10), { message: "Operation timed out" });
  });
});

describe("C2PA — getActionLabel", () => {
  it("should return label for known actions", () => {
    const labels = {
      "c2pa.created": true,
      "c2pa.edited": true,
      "c2pa.captured": true,
      "c2pa.opened": true,
      "c2pa.converted": true,
      "c2pa.opt_out": true,
    };
    for (const key of Object.keys(labels)) {
      const label = getActionLabel(key);
      assert.ok(typeof label === "string");
      assert.ok(label.length > 0);
    }
  });

  it("should return the key itself for unknown action", () => {
    assert.equal(getActionLabel("unknown.action"), "unknown.action");
  });

  it("should handle undefined", () => {
    assert.equal(getActionLabel(undefined), undefined);
  });
});

describe("C2PA — getActionsHtml", () => {
  it("should return empty message for no actions", () => {
    const html = getActionsHtml({ assertions: [] });
    assert.ok(html.includes("No actions"));
  });

  it("should return empty message for manifest without assertions", () => {
    const html = getActionsHtml({});
    assert.ok(html.includes("No actions"));
  });

  it("should render action items", () => {
    const manifest = {
      assertions: [
        {
          label: "c2pa.actions",
          data: [{ action: "c2pa.created", description: "test creation" }],
        },
      ],
    };
    const html = getActionsHtml(manifest);
    assert.ok(html.includes("Created"));
    assert.ok(html.includes("test creation"));
  });

  it("should handle v2 actions", () => {
    const manifest = {
      assertions: [
        {
          label: "c2pa.actions.v2",
          data: { actions: [{ action: "c2pa.edited", softwareAgent: "Photoshop" }] },
        },
      ],
    };
    const html = getActionsHtml(manifest);
    assert.ok(html.includes("Edited"));
    assert.ok(html.includes("Photoshop"));
  });

  it("should render actor info", () => {
    const manifest = {
      assertions: [
        {
          label: "c2pa.actions",
          data: [{ action: "c2pa.captured", actor: { name: "Test User", identifier: "id-123" } }],
        },
      ],
    };
    const html = getActionsHtml(manifest);
    assert.ok(html.includes("Test User"));
    assert.ok(html.includes("id-123"));
  });

  it("should render digitalSourceType", () => {
    const manifest = {
      assertions: [
        {
          label: "c2pa.actions",
          data: [{ action: "c2pa.captured", digitalSourceType: "http://example.com/camera" }],
        },
      ],
    };
    const html = getActionsHtml(manifest);
    assert.ok(html.includes("camera"));
  });

  it("should render reason and parameters", () => {
    const manifest = {
      assertions: [
        {
          label: "c2pa.actions",
          data: [{ action: "c2pa.created", reason: "test reason", parameters: { key: "val" } }],
        },
      ],
    };
    const html = getActionsHtml(manifest);
    assert.ok(html.includes("test reason"));
    assert.ok(html.includes("key"));
    assert.ok(html.includes("val"));
  });
});

describe("C2PA — getAssertionsHtml", () => {
  it("should return empty message for no assertions", () => {
    const html = getAssertionsHtml({ assertions: [] });
    assert.ok(html.includes("No additional"));
  });

  it("should filter out actions and thumbnails", () => {
    const manifest = {
      assertions: [
        { label: "c2pa.actions", data: {} },
        { label: "c2pa.thumbnail", data: {} },
        { label: "c2pa.some_assertion", data: { info: "test" } },
      ],
    };
    const html = getAssertionsHtml(manifest);
    assert.ok(!html.includes("c2pa.actions"));
    assert.ok(!html.includes("c2pa.thumbnail"));
    assert.ok(html.includes("c2pa.some_assertion"));
  });

  it("should render assertion kind badge", () => {
    const manifest = {
      assertions: [{ label: "c2pa.test", kind: "ContentBinding", data: "hello" }],
    };
    const html = getAssertionsHtml(manifest);
    assert.ok(html.includes("ContentBinding"));
    assert.ok(html.includes("hello"));
  });
});

describe("C2PA — getIngredientsHtml", () => {
  it("should return empty message for no ingredients", () => {
    const html = getIngredientsHtml({ ingredients: [] });
    assert.ok(html.includes("No ingredients"));
  });

  it("should render ingredient with title", () => {
    const manifest = {
      ingredients: [{ title: "photo.jpg", format: "image/jpeg" }],
    };
    const html = getIngredientsHtml(manifest);
    assert.ok(html.includes("photo.jpg"));
    assert.ok(html.includes("image/jpeg"));
  });

  it("should render ingredient with document_id and instance_id", () => {
    const manifest = {
      ingredients: [
        {
          title: "doc.pdf",
          document_id: "doc-123",
          instance_id: "inst-456",
        },
      ],
    };
    const html = getIngredientsHtml(manifest);
    assert.ok(html.includes("doc-123"));
    assert.ok(html.includes("inst-456"));
  });

  it("should fall back to instance_id when no title", () => {
    const manifest = {
      ingredients: [{ instance_id: "inst-only", relationship: "parentOf" }],
    };
    const html = getIngredientsHtml(manifest);
    assert.ok(html.includes("inst-only"));
    assert.ok(html.includes("parentOf"));
  });
});

describe("C2PA — getSignatureInfoHtml", () => {
  it("should return empty message for no signature info", () => {
    const html = getSignatureInfoHtml({});
    assert.ok(html.includes("No signature"));
  });

  it("should render issuer and serial", () => {
    const manifest = {
      signature_info: {
        issuer: "Test CA",
        cert_serial_number: "ABC123",
      },
    };
    const html = getSignatureInfoHtml(manifest);
    assert.ok(html.includes("Test CA"));
    assert.ok(html.includes("ABC123"));
  });

  it("should render time if present", () => {
    const manifest = {
      signature_info: {
        issuer: "Test CA",
        time: "2024-01-15T00:00:00Z",
      },
    };
    const html = getSignatureInfoHtml(manifest);
    assert.ok(html.includes("Test CA"));
    assert.ok(html.includes("Signed:"));
  });
});
