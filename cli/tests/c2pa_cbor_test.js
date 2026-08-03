const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── CBOR tests ──
function loadCbor() {
  const src = fs.readFileSync(path.join(__dirname, "../../C2PA/cbor.js"), "utf8");
  const patched = src.replace(/\bexport function /g, "function ").replace(/\bexport /g, "");
  vm.runInThisContext(patched, { filename: path.resolve(__dirname, "../../C2PA/cbor.js") });
}

describe("CBOR — encodeInt", () => {
  before(() => loadCbor());

  it("should encode small positive integers inline (0-23)", () => {
    assert.deepEqual(Array.from(encodeInt(0)), [0x00]);
    assert.deepEqual(Array.from(encodeInt(1)), [0x01]);
    assert.deepEqual(Array.from(encodeInt(23)), [0x17]);
  });

  it("should encode larger positive integers with 1-byte extension", () => {
    const r = encodeInt(24);
    assert.equal(r[0], 0x18);
    assert.equal(r[1], 24);
    assert.equal(r.length, 2);
  });

  it("should encode 255 with 1-byte extension", () => {
    const r = encodeInt(255);
    assert.equal(r[0], 0x18);
    assert.equal(r[1], 255);
  });

  it("should encode 256 with 2-byte extension", () => {
    const r = encodeInt(256);
    assert.equal(r[0], 0x19);
    assert.equal(r[1], 0x01);
    assert.equal(r[2], 0x00);
    assert.equal(r.length, 3);
  });

  it("should encode large values with 4-byte extension", () => {
    const r = encodeInt(100000);
    assert.equal(r[0], 0x1a);
    assert.equal(r.length, 5);
  });

  it("should encode negative int with 2-byte extension (n <= -256)", () => {
    const r = encodeInt(-257);
    assert.equal(r[0], 0x39);
    assert.equal(r.length, 3);
  });

  it("should encode negative -1 inline (0x20)", () => {
    const r = encodeInt(-1);
    assert.equal(r[0], 0x20);
    assert.equal(r.length, 1);
  });

  it("should encode negative 1-byte extension (n -25 to -256)", () => {
    const r = encodeInt(-25);
    assert.equal(r[0], 0x38);
    assert.equal(r[1], 24);
    assert.equal(r.length, 2);
  });
});

describe("CBOR — encodeBstr / encodeTstr", () => {
  before(() => loadCbor());

  it("should encode empty byte string", () => {
    const r = encodeBstr(new Uint8Array([]));
    assert.deepEqual(Array.from(r), [0x40]);
  });

  it("should encode byte string inline", () => {
    const r = encodeBstr(new Uint8Array([1, 2, 3]));
    assert.equal(r[0], 0x43); // major 2, length 3 inline
    assert.deepEqual(Array.from(r.slice(1)), [1, 2, 3]);
  });

  it("should encode text string", () => {
    const r = encodeTstr("A");
    assert.equal(r[0], 0x61); // major 3, length 1 inline
    assert.equal(r[1], 0x41); // 'A'
  });

  it("should encode longer text string", () => {
    const r = encodeTstr("hello");
    assert.equal(r[0], 0x65); // major 3, length 5 inline
    assert.equal(new TextDecoder().decode(r.slice(1)), "hello");
  });

  it("should encode bstr with 2-byte prefix (len 24-255)", () => {
    const data = new Uint8Array(100);
    const r = encodeBstr(data);
    assert.equal(r[0], 0x58); // major 2, 1-byte length
    assert.equal(r[1], 100);
    assert.equal(r.length, 102);
  });

  it("should encode bstr with 3-byte prefix (len 256-65535)", () => {
    const data = new Uint8Array(300);
    const r = encodeBstr(data);
    assert.equal(r[0], 0x59); // major 2, 2-byte length
    assert.equal(r[1], 0x01);
    assert.equal(r[2], 0x2c);
    assert.equal(r.length, 303);
  });

  it("should encode tstr with 2-byte prefix (len 24-255)", () => {
    const str = "x".repeat(100);
    const r = encodeTstr(str);
    assert.equal(r[0], 0x78); // major 3, 1-byte length
    assert.equal(r[1], 100);
  });

  it("should encode tstr with 3-byte prefix (len 256-65535)", () => {
    const str = "x".repeat(300);
    const r = encodeTstr(str);
    assert.equal(r[0], 0x79); // major 3, 2-byte length
    assert.equal(r[1], 0x01);
    assert.equal(r[2], 0x2c);
  });
});

describe("CBOR — encodeArray / encodeMap / encodeTag", () => {
  before(() => loadCbor());

  it("should encode empty array", () => {
    const r = encodeArray([]);
    assert.deepEqual(Array.from(r), [0x80]);
  });

  it("should encode array of integers", () => {
    const r = encodeArray([encodeInt(1), encodeInt(2), encodeInt(3)]);
    assert.equal(r[0], 0x83); // major 4, length 3
  });

  it("should encode empty map", () => {
    const r = encodeMap([]);
    assert.deepEqual(Array.from(r), [0xa0]);
  });

  it("should encode map with integer keys", () => {
    const r = encodeMap([[1, encodeTstr("one")]]);
    assert.equal(r[0], 0xa1); // major 5, length 1
  });

  it("should encode tag", () => {
    const inner = encodeInt(42);
    const r = encodeTag(1, inner);
    assert.equal(r[0], 0xc1); // tag 1
  });

  it("should encode array with 2-byte header (24-255 items)", () => {
    const items = [];
    for (let i = 0; i < 24; i++) items.push(encodeInt(i));
    const r = encodeArray(items);
    assert.equal(r[0], 0x98); // major 4, 1-byte count
    assert.equal(r[1], 24);
  });

  it("should encode map with 2-byte header (24-255 entries)", () => {
    const entries = [];
    for (let i = 0; i < 24; i++) entries.push([i, encodeInt(i)]);
    const r = encodeMap(entries);
    assert.equal(r[0], 0xb8); // major 5, 1-byte count
    assert.equal(r[1], 24);
  });

  it("should encode tag with 2-byte header (tagNum 24-255)", () => {
    const r = encodeTag(24, encodeInt(0));
    assert.equal(r[0], 0xd8); // tag 24, 1-byte extension
    assert.equal(r[1], 24);
  });

  it("should encode tag with 3-byte header (tagNum 256-65535)", () => {
    const r = encodeTag(256, encodeInt(0));
    assert.equal(r[0], 0xd9); // tag 256, 2-byte extension
    assert.equal(r[1], 0x01);
    assert.equal(r[2], 0x00);
  });

  it("should encode array with 4-byte header (256+ items, line 45)", () => {
    const items = [];
    for (let i = 0; i < 256; i++) items.push(encodeInt(0));
    const r = encodeArray(items);
    assert.equal(r[0], 0x99); // major 4, 2-byte count
    assert.equal(r[1], 0x01);
    assert.equal(r[2], 0x00);
  });
});

describe("CBOR — decode", () => {
  before(() => loadCbor());

  it("should decode small positive integers", () => {
    const d = decode(new Uint8Array([0x00]), 0);
    assert.equal(d.val, 0);
    assert.equal(d.off, 1);

    const d2 = decode(new Uint8Array([0x17]), 0);
    assert.equal(d2.val, 23);
  });

  it("should decode negative integers", () => {
    const d = decode(new Uint8Array([0x20]), 0);
    assert.equal(d.val, -1);

    const d2 = decode(new Uint8Array([0x21]), 0);
    assert.equal(d2.val, -2);
  });

  it("should decode byte strings", () => {
    const enc = encodeBstr(new Uint8Array([0xde, 0xad]));
    const d = decode(enc, 0);
    assert.ok(d.val instanceof Uint8Array);
    assert.deepEqual(Array.from(d.val), [0xde, 0xad]);
  });

  it("should decode text strings", () => {
    const enc = encodeTstr("hello");
    const d = decode(enc, 0);
    assert.equal(d.val, "hello");
  });

  it("should decode arrays", () => {
    const enc = encodeArray([encodeInt(10), encodeInt(20)]);
    const d = decode(enc, 0);
    assert.ok(Array.isArray(d.val));
    assert.equal(d.val.length, 2);
    assert.equal(d.val[0], 10);
    assert.equal(d.val[1], 20);
  });

  it("should decode maps to objects", () => {
    const enc = encodeMap([
      [1, encodeTstr("a")],
      [2, encodeTstr("b")],
    ]);
    const d = decode(enc, 0);
    assert.equal(d.val["1"], "a");
    assert.equal(d.val["2"], "b");
  });

  it("should decode tagged values", () => {
    const enc = encodeTag(32, encodeInt(99));
    const d = decode(enc, 0);
    assert.ok(Array.isArray(d.val));
    assert.equal(d.val[0], 32);
    assert.equal(d.val[1], 99);
  });

  it("should throw on unsupported major type", () => {
    // major type 7 (0xE0+info) is unsupported
    assert.throws(() => decode(new Uint8Array([0xe0]), 0), /unsupported major type/);
  });

  it("should throw when offset exceeds data length", () => {
    assert.throws(() => decode(new Uint8Array([0x01]), 10), /unexpected end/);
  });
});

describe("CBOR — roundtrip", () => {
  before(() => loadCbor());

  it("should roundtrip a complex structure", () => {
    const original = {
      alg: "es256",
      sigT: 1700000000,
      payload: new Uint8Array([0xaa, 0xbb]),
    };
    const encoded = encodeMap([
      [1, encodeTstr(original.alg)],
      [6, encodeInt(original.sigT)],
      [2, encodeBstr(original.payload)],
    ]);
    const d = decode(encoded, 0);
    assert.equal(d.val["1"], original.alg);
    assert.equal(d.val["6"], original.sigT);
    assert.deepEqual(Array.from(d.val["2"]), [0xaa, 0xbb]);
  });
});

// ── C2PA utility function tests ──
function loadC2paUtils() {
  let src = fs.readFileSync(path.join(__dirname, "../../C2PA/c2pa.js"), "utf8");
  src = src.replace(/^import .+$/m, "var createC2pa = null;");
  // Use var instead of const/let to allow re-loading
  src = src.replace(/\bconst\s+/g, "var ");
  if (!globalThis.window) globalThis.window = globalThis;
  globalThis.BigInt = BigInt;
  globalThis.window.__ = globalThis.window.__ || ((s, d) => d || s);
  globalThis.escXml = globalThis.escXml || ((s) => s);
  vm.runInThisContext(src, { filename: path.resolve(__dirname, "../../C2PA/c2pa.js") });
}

// Load once before all C2PA suites
before(() => loadC2paUtils());

describe("C2PA — parsePem", () => {
  it("should parse a PEM-encoded key", () => {
    const pem = "-----BEGIN TEST-----\nAAECAw==\n-----END TEST-----";
    const buf = parsePem(pem);
    assert.ok(buf instanceof ArrayBuffer);
    const bytes = new Uint8Array(buf);
    assert.deepEqual(Array.from(bytes), [0x00, 0x01, 0x02, 0x03]);
  });
});

describe("C2PA — splitCerts", () => {
  it("should split concatenated PEM certs", () => {
    const pem1 = "-----BEGIN CERTIFICATE-----\nAAEC\n-----END CERTIFICATE-----";
    const pem2 = "-----BEGIN CERTIFICATE-----\nAwQF\n-----END CERTIFICATE-----";
    const certs = splitCerts(pem1 + "\n" + pem2);
    assert.equal(certs.length, 2);
    assert.ok(certs[0] instanceof Uint8Array);
    assert.ok(certs[1] instanceof Uint8Array);
  });

  it("should handle single cert", () => {
    const pem = "-----BEGIN CERTIFICATE-----\nAAECAwQ=\n-----END CERTIFICATE-----";
    const certs = splitCerts(pem);
    assert.equal(certs.length, 1);
  });
});

describe("C2PA — escHtml", () => {
  it("should escape HTML entities", () => {
    assert.equal(escHtml('&<>"'), "&amp;&lt;&gt;&quot;");
    assert.equal(escHtml("hello"), "hello");
    assert.equal(escHtml(""), "");
    assert.equal(escHtml(null), "");
    assert.equal(escHtml(undefined), "");
  });
});

describe("C2PA — safeUrl", () => {
  it("should allow http/https/data URLs", () => {
    assert.equal(safeUrl("http://example.com"), "http://example.com");
    assert.equal(safeUrl("https://example.com"), "https://example.com");
    assert.ok(safeUrl("data:text/plain,hello").startsWith("data:"));
  });

  it("should block javascript URLs", () => {
    assert.equal(safeUrl("javascript:alert(1)"), "");
  });
});

describe("C2PA — formatDate", () => {
  it("should format a date string", () => {
    const result = formatDate("2024-01-15T00:00:00Z");
    assert.ok(typeof result === "string");
    assert.ok(result.length > 0);
  });

  it("should return em-dash for null", () => {
    assert.equal(formatDate(null), "\u2014");
  });
});
