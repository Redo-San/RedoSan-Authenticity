// Regression tests for the PNG side of `redosan c2pa`.
//
// The command used to write its manifest into a chunk typed "c2pa". PNG (3rd
// ed. 5.3) restricts every chunk-type byte to A-Z/a-z, so that chunk made the
// file invalid, and C2PA readers look for "caBX" (C2PA 2.2, Annex A.3) and
// therefore never saw the manifest. These tests drive the real CLI and parse
// the bytes it produces.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const CLI = path.join(ROOT, "cli", "index.js");
const FIXTURE = path.join(__dirname, "fixtures", "testimg_64x64.png");
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/**
 * Run the CLI and return its stdout.
 *
 * @param {string[]} args
 * @returns {string}
 */
function runCli(args) {
  return execFileSync(process.execPath, [CLI, ...args], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Same CRC-32 the PNG spec requires (Annex D).
 *
 * @param {Buffer} buf
 * @returns {number}
 */
function crc32(buf) {
  let crc = 0xff_ff_ff_ff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xed_b8_83_20 : 0);
    }
  }
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

/**
 * Walk a PNG datastream.
 *
 * @param {Buffer} buf
 * @returns {Array<{type: string, offset: number, length: number, crcOk: boolean}>}
 */
function pngChunks(buf) {
  assert.ok(buf.subarray(0, 8).equals(PNG_SIGNATURE), "PNG signature");
  const chunks = [];
  let i = 8;
  while (i + 12 <= buf.length) {
    const length = buf.readUInt32BE(i);
    const type = buf.toString("ascii", i + 4, i + 8);
    const crcOffset = i + 8 + length;
    assert.ok(crcOffset + 4 <= buf.length, `chunk ${type} fits in the file`);
    chunks.push({
      type,
      offset: i,
      length,
      crcOk:
        buf.readUInt32BE(crcOffset) === crc32(buf.subarray(i + 4, crcOffset)),
    });
    i = crcOffset + 4;
    if (type === "IEND") break;
  }
  return chunks;
}

/**
 * Build a PNG with one extra chunk inserted before the first IDAT.
 *
 * @param {Buffer} base
 * @param {string} type
 * @param {Buffer} payload
 * @returns {Buffer}
 */
function insertChunk(base, type, payload) {
  const chunks = pngChunks(base);
  const idat = chunks.find((chunk) => chunk.type === "IDAT");
  const typeBuf = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + payload.length);
  chunk.writeUInt32BE(payload.length, 0);
  typeBuf.copy(chunk, 4);
  payload.copy(chunk, 8);
  chunk.writeUInt32BE(
    crc32(Buffer.concat([typeBuf, payload])),
    8 + payload.length,
  );
  return Buffer.concat([
    base.subarray(0, idat.offset),
    chunk,
    base.subarray(idat.offset),
  ]);
}

describe("c2pa CLI — PNG container", () => {
  let dir;
  let signed;

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "redosan-c2pa-"));
    signed = path.join(dir, "signed.png");
    fs.copyFileSync(FIXTURE, signed);
    runCli(["c2pa", "sign", signed, "--claim", "regression test"]);
  });

  after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("writes a caBX chunk before IDAT and keeps the PNG structurally valid", () => {
    const buf = fs.readFileSync(signed);
    const chunks = pngChunks(buf);
    const types = chunks.map((chunk) => chunk.type);

    const caBX = chunks.find((chunk) => chunk.type === "caBX");
    const idat = chunks.find((chunk) => chunk.type === "IDAT");
    assert.ok(caBX, "caBX chunk present");
    assert.ok(idat, "IDAT chunk present");
    assert.ok(
      caBX.offset < idat.offset,
      "caBX is recommended before the IDAT chunks",
    );
    // PNG 3rd ed. 5.3: every chunk-type byte is an ASCII letter.
    for (const chunk of chunks) {
      assert.match(chunk.type, /^[A-Za-z]{4}$/, `legal type: ${chunk.type}`);
      assert.ok(chunk.crcOk, `CRC valid for ${chunk.type}`);
    }
    assert.ok(!types.includes("c2pa"), "no non-standard c2pa chunk");
    assert.equal(types.at(-1), "IEND");
  });

  it("carries the signed manifest inside the chunk", () => {
    const buf = fs.readFileSync(signed);
    const caBX = pngChunks(buf).find((chunk) => chunk.type === "caBX");
    const payload = buf
      .subarray(caBX.offset + 8, caBX.offset + 8 + caBX.length)
      .toString("utf-8");
    const manifest = JSON.parse(
      payload.slice(payload.indexOf("{"), payload.lastIndexOf("}") + 1),
    );
    assert.equal(manifest.claim_generator, "RedoSan Authenticity CLI v1.0");
    assert.equal(
      manifest.assertions.find((a) => a.label === "c2pa.claimed").data.value,
      "regression test",
    );
    assert.ok(manifest.signature.value);
  });

  it("read reports the standard container", () => {
    const out = path.join(dir, "read-cabx.json");
    runCli(["c2pa", "read", signed, "--output", out]);
    const report = JSON.parse(fs.readFileSync(out, "utf-8"));
    assert.deepEqual(report.container, { chunk_type: "caBX", standard: true });
    assert.equal(report.c2pa.file.name, "signed.png");
  });

  it("read still accepts the legacy c2pa chunk it used to write", () => {
    const legacy = path.join(dir, "legacy.png");
    const payload = Buffer.from(
      '{"version":1,"claim_generator":"legacy"}',
      "utf-8",
    );
    fs.writeFileSync(
      legacy,
      insertChunk(fs.readFileSync(FIXTURE), "c2pa", payload),
    );

    const out = path.join(dir, "read-legacy.json");
    runCli(["c2pa", "read", legacy, "--output", out]);
    const report = JSON.parse(fs.readFileSync(out, "utf-8"));
    assert.deepEqual(report.container, { chunk_type: "c2pa", standard: false });
    assert.equal(report.c2pa.version, 1);
  });

  it("prefers caBX when a file carries both chunks", () => {
    const mixed = path.join(dir, "mixed.png");
    const withLegacy = insertChunk(
      fs.readFileSync(FIXTURE),
      "c2pa",
      Buffer.from('{"version":1,"claim_generator":"legacy"}', "utf-8"),
    );
    fs.writeFileSync(
      mixed,
      insertChunk(withLegacy, "caBX", Buffer.from('{"version":2}', "utf-8")),
    );

    const out = path.join(dir, "read-mixed.json");
    runCli(["c2pa", "read", mixed, "--output", out]);
    const report = JSON.parse(fs.readFileSync(out, "utf-8"));
    assert.equal(report.container.chunk_type, "caBX");
    assert.equal(report.c2pa.version, 2);
  });
});
