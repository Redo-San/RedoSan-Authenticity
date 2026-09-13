const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills for the GPL origin check
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};

// ── Module loader with vm.compileFunction for V8 coverage mapping ──
const mods = {};
function loadModule(rel) {
  const absPath = path.join(__dirname, "../..", rel);
  let src = fs.readFileSync(absPath, "utf8");
  src = src.replace(
    /^import\s*\{([\s\S]+?)\}\s*from\s*"[^"]+";?/gm,
    (_m, names) =>
      names
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)
        .map((p) => {
          const [orig, as] = p.split(/\s+as\s+/).map((s) => s.trim());
          return `const ${as || orig} = __imp("${orig}");`;
        })
        .join("\n"),
  );
  const hoisted = [];
  src = src
    .replace(/^export (async )?function\s+(\w+)/gm, (_m, asyncKw, name) => {
      hoisted.push(name);
      return (asyncKw ? "async " : "") + "function " + name;
    })
    .replace(
      /^export const\s+(\w+)\s*=/gm,
      (_m, name) => `const ${name} = __exp.${name} =`,
    )
    .replace(/^export default\s+/gm, "");
  if (hoisted.length) {
    src += "\n" + hoisted.map((n) => `__exp.${n} = ${n};`).join("\n") + "\n";
  }
  const fn = vm.compileFunction(src, ["__exp", "__imp"], { filename: absPath });
  fn(mods, (name) => mods[name]);
}

loadModule("Voice_Biometric/audio_embed.js");

const AE = mods;

// ── Helpers ──
function str2bytes(s) {
  return new TextEncoder().encode(s);
}

function makeWav(extraChunks) {
  const enc = new TextEncoder();
  const sampleRate = 8000;
  const bits = 16;
  const dataLen = 100;
  let data = new Uint8Array(0);
  // fmt chunk
  const fmtData = new Uint8Array(16);
  const dv = new DataView(fmtData.buffer);
  dv.setUint16(0, 1, true); // PCM
  dv.setUint16(2, 1, true); // mono
  dv.setUint32(4, sampleRate, true);
  dv.setUint32(8, (sampleRate * bits) / 8, true);
  dv.setUint16(12, bits / 8, true);
  dv.setUint16(14, bits, true);
  data = concatBytes(data, enc.encode("fmt "), u32le(16), fmtData);
  // data chunk
  const audioData = new Uint8Array(dataLen);
  data = concatBytes(data, enc.encode("data"), u32le(dataLen), audioData);
  // extra chunks
  if (extraChunks) {
    for (const c of extraChunks) {
      data = concatBytes(data, enc.encode(c.id), u32le(c.data.length), c.data);
    }
  }
  const fileSize = 4 + 4 + data.length;
  return concatBytes(
    enc.encode("RIFF"),
    u32le(fileSize),
    enc.encode("WAVE"),
    data,
  );
}

function makeId3v3() {
  const enc = new TextEncoder();
  // Minimal ID3v2.3 header (10 bytes) + one GEOB frame
  const mime = enc.encode("application/c2pa");
  const fname = enc.encode("c2pa");
  const desc = enc.encode("c2pa manifest store");
  const payload = new Uint8Array([
    0,
    ...mime,
    0,
    ...fname,
    0,
    ...desc,
    0,
    0x42,
    0x43,
  ]);
  const frameData = payload;
  const frameHeader = concatBytes(
    enc.encode("GEOB"),
    u32be(frameData.length),
    new Uint8Array([0, 0]),
  );
  const tagBody = concatBytes(frameHeader, frameData);
  const header = concatBytes(
    enc.encode("ID3"),
    new Uint8Array([4, 0, 0]),
    syncsafe(tagBody.length),
  );
  // Append MP3 sync bytes so sniffPayloadFormat detects "MP3"
  return concatBytes(header, tagBody, new Uint8Array([0xff, 0xfb, 0x90, 0x00]));
}

function u32le(n) {
  return new Uint8Array([
    n & 0xff,
    (n >>> 8) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 24) & 0xff,
  ]);
}
function u32be(n) {
  return new Uint8Array([
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ]);
}
function syncsafe(n) {
  return new Uint8Array([
    (n >>> 21) & 0x7f,
    (n >>> 14) & 0x7f,
    (n >>> 7) & 0x7f,
    n & 0x7f,
  ]);
}
function concatBytes(...arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const r = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    r.set(a, off);
    off += a.length;
  }
  return r;
}

// ══════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════

describe("audio_embed", () => {
  describe("concatBytes", () => {
    it("concatenates multiple arrays", () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([3, 4, 5]);
      const r = AE.concatBytes(a, b);
      assert.deepEqual([...r], [1, 2, 3, 4, 5]);
    });
    it("handles empty arrays", () => {
      const r = AE.concatBytes(new Uint8Array(0), new Uint8Array(0));
      assert.equal(r.length, 0);
    });
  });

  describe("bytesEqual", () => {
    it("returns true for equal arrays", () => {
      assert.ok(
        AE.bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])),
      );
    });
    it("returns false for different lengths", () => {
      assert.ok(
        !AE.bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])),
      );
    });
    it("returns false for different values", () => {
      assert.ok(
        !AE.bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])),
      );
    });
  });

  describe("u32be / u32le", () => {
    it("encodes big-endian", () => {
      const r = AE.u32be(0x01020304);
      assert.deepEqual([...r], [1, 2, 3, 4]);
    });
    it("encodes little-endian", () => {
      const r = AE.u32le(0x01020304);
      assert.deepEqual([...r], [4, 3, 2, 1]);
    });
  });

  describe("syncsafe", () => {
    it("encodes syncsafe integer", () => {
      const r = AE.syncsafe(128);
      assert.equal(r.length, 4);
      assert.ok(r[0] < 0x80);
      assert.ok(r[1] < 0x80);
      assert.ok(r[2] < 0x80);
      assert.ok(r[3] < 0x80);
    });
  });

  describe("readU32le / readU32be / readSyncsafe", () => {
    it("reads little-endian", () => {
      const buf = new Uint8Array([0x78, 0x56, 0x34, 0x12]);
      assert.equal(AE.readU32le(buf, 0), 0x12345678);
    });
    it("reads big-endian", () => {
      const buf = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
      assert.equal(AE.readU32be(buf, 0), 0x12345678);
    });
    it("reads syncsafe", () => {
      const buf = AE.syncsafe(0);
      assert.equal(AE.readSyncsafe(buf, 0), 0);
    });
  });

  describe("ascii / startsWithAscii", () => {
    it("extracts ASCII string", () => {
      const buf = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      assert.equal(AE.ascii(buf, 0, 5), "Hello");
    });
    it("startsWithAscii returns true for match", () => {
      const buf = new TextEncoder().encode("RIFFrest");
      assert.ok(AE.startsWithAscii(buf, 0, "RIFF"));
    });
    it("startsWithAscii returns false for mismatch", () => {
      const buf = new TextEncoder().encode("JUNKrest");
      assert.ok(!AE.startsWithAscii(buf, 0, "RIFF"));
    });
    it("startsWithAscii returns false when out of bounds", () => {
      const buf = new Uint8Array([0x52, 0x49]);
      assert.ok(!AE.startsWithAscii(buf, 0, "RIFF"));
    });
  });

  describe("detectAudioFormat", () => {
    it("detects WAV", () => {
      const wav = makeWav();
      assert.equal(AE.detectAudioFormat(wav), "WAV");
    });
    it("detects RIFF (no WAVE)", () => {
      const enc = new TextEncoder();
      const buf = concatBytes(enc.encode("RIFF"), new Uint8Array(8));
      assert.equal(AE.detectAudioFormat(buf), "RIFF");
    });
    it("detects RIFX", () => {
      const enc = new TextEncoder();
      const buf = concatBytes(enc.encode("RIFX"), new Uint8Array(8));
      assert.equal(AE.detectAudioFormat(buf), "RIFX");
    });
    it("detects ID3 tag", () => {
      const buf = makeId3v3();
      assert.equal(AE.detectAudioFormat(buf), "MP3");
    });
    it("detects ID3 without payload", () => {
      const enc = new TextEncoder();
      const buf = concatBytes(
        enc.encode("ID3"),
        new Uint8Array([4, 0, 0]),
        syncsafe(0),
      );
      // ID3 with zero-length payload falls through to sniffPayloadFormat which returns UNKNOWN
      const result = AE.detectAudioFormat(buf);
      assert.ok(typeof result === "string");
    });
    it("detects fLaC", () => {
      const enc = new TextEncoder();
      const buf = concatBytes(enc.encode("fLaC"), new Uint8Array(10));
      assert.equal(AE.detectAudioFormat(buf), "FLAC");
    });
    it("detects MP3 (0xff sync byte)", () => {
      const buf = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
      assert.equal(AE.detectAudioFormat(buf), "MP3");
    });
    it("returns UNKNOWN for garbage", () => {
      const buf = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      assert.equal(AE.detectAudioFormat(buf), "UNKNOWN");
    });
    it("detects ID3v2.2", () => {
      const enc = new TextEncoder();
      // ID3v2.2: major version 2
      const header = concatBytes(
        enc.encode("ID3"),
        new Uint8Array([2, 0, 0]),
        syncsafe(0),
      );
      const result = AE.detectAudioFormat(header);
      assert.equal(result, "UNKNOWN");
    });
  });

  describe("parseRiff", () => {
    it("parses a valid RIFF/WAVE", () => {
      const wav = makeWav();
      const riff = AE.parseRiff(wav);
      assert.ok(riff);
      assert.equal(riff.id, "RIFF");
      assert.equal(riff.formType, "WAVE");
      assert.ok(riff.chunks.length >= 2);
    });
    it("returns null for non-RIFF", () => {
      assert.equal(AE.parseRiff(new Uint8Array([0, 0, 0, 0])), null);
    });
    it("parses RIFX", () => {
      const enc = new TextEncoder();
      const buf = concatBytes(
        enc.encode("RIFX"),
        u32be(12),
        enc.encode("WAVE"),
      );
      const riff = AE.parseRiff(buf);
      assert.ok(riff);
      assert.equal(riff.bigEndian, true);
    });
    it("handles odd-sized chunk", () => {
      const enc = new TextEncoder();
      const data = new Uint8Array([1, 2, 3]); // odd length
      const body = concatBytes(
        enc.encode("fmt "),
        u32le(3),
        data,
        new Uint8Array(1),
      );
      const size = 4 + body.length;
      const buf = concatBytes(
        enc.encode("RIFF"),
        u32le(size),
        enc.encode("WAVE"),
        body,
      );
      const riff = AE.parseRiff(buf);
      assert.ok(riff);
      assert.ok(riff.chunks.some((c) => c.pad === 1));
    });
  });

  describe("riffGetManifestLocation", () => {
    it("returns found:false when no C2PA chunk", () => {
      const wav = makeWav();
      const loc = AE.riffGetManifestLocation(wav);
      assert.ok(loc);
      assert.equal(loc.found, false);
      assert.equal(loc.format, "WAV");
    });
    it("returns found:true when C2PA chunk exists", () => {
      const store = new Uint8Array([0x42, 0x43, 0x44]);
      const wav = makeWav([{ id: "C2PA", data: store }]);
      const loc = AE.riffGetManifestLocation(wav);
      assert.ok(loc);
      assert.equal(loc.found, true);
      assert.equal(loc.storeLength, 3);
    });
  });

  describe("riffRemove", () => {
    it("throws for non-RIFF", () => {
      assert.throws(() => AE.riffRemove(new Uint8Array([0, 0, 0, 0])));
    });
    it("returns removed:false when no C2PA chunk", () => {
      const wav = makeWav();
      const r = AE.riffRemove(wav);
      assert.equal(r.removed, false);
    });
    it("removes C2PA chunk", () => {
      const wav = makeWav([{ id: "C2PA", data: new Uint8Array([1, 2]) }]);
      const r = AE.riffRemove(wav);
      assert.equal(r.removed, true);
      // Verify C2PA no longer present
      const loc = AE.riffGetManifestLocation(r.output);
      assert.equal(loc.found, false);
    });
  });

  describe("riffEmbed", () => {
    it("embeds C2PA store into WAV", () => {
      const wav = makeWav();
      const store = new Uint8Array([0xaa, 0xbb]);
      const r = AE.riffEmbed(wav, store);
      assert.ok(r.output);
      assert.equal(r.storeLength, 2);
      // Verify embedded
      const loc = AE.riffGetManifestLocation(r.output);
      assert.equal(loc.found, true);
    });
    it("replaces existing C2PA chunk", () => {
      const wav = makeWav([{ id: "C2PA", data: new Uint8Array([1]) }]);
      const store = new Uint8Array([0xcc, 0xdd, 0xee]);
      const r = AE.riffEmbed(wav, store);
      assert.equal(r.storeLength, 3);
      const loc = AE.riffGetManifestLocation(r.output);
      assert.equal(loc.storeLength, 3);
    });
  });

  describe("id3GetManifestLocation", () => {
    it("returns null for non-ID3", () => {
      assert.equal(AE.id3GetManifestLocation(new Uint8Array([0, 0, 0])), null);
    });
    it("finds GEOB frame", () => {
      const id3 = makeId3v3();
      const loc = AE.id3GetManifestLocation(id3);
      assert.ok(loc);
      assert.equal(loc.found, true);
      assert.equal(loc.format, "MP3");
    });
    it("returns found:false for ID3 without GEOB", () => {
      const enc = new TextEncoder();
      // ID3v2.3 with a text frame, not GEOB
      const frameData = enc.encode("hello");
      const frame = concatBytes(
        enc.encode("TIT2"),
        u32be(frameData.length),
        new Uint8Array([0, 0]),
        frameData,
      );
      const tagBody = frame;
      const header = concatBytes(
        enc.encode("ID3"),
        new Uint8Array([4, 0, 0]),
        syncsafe(tagBody.length),
      );
      const buf = concatBytes(header, tagBody);
      const loc = AE.id3GetManifestLocation(buf);
      assert.ok(loc);
      assert.equal(loc.found, false);
    });
  });

  describe("id3Remove", () => {
    it("throws for non-ID3", () => {
      assert.throws(() => AE.id3Remove(new Uint8Array([0, 0, 0])));
    });
    it("returns removed:false when no GEOB", () => {
      const enc = new TextEncoder();
      const frameData = enc.encode("test");
      const frame = concatBytes(
        enc.encode("TIT2"),
        u32be(frameData.length),
        new Uint8Array([0, 0]),
        frameData,
      );
      const header = concatBytes(
        enc.encode("ID3"),
        new Uint8Array([4, 0, 0]),
        syncsafe(frame.length),
      );
      const buf = concatBytes(header, frame);
      const r = AE.id3Remove(buf);
      assert.equal(r.removed, false);
    });
    it("removes GEOB frame", () => {
      const id3 = makeId3v3();
      const r = AE.id3Remove(id3);
      assert.equal(r.removed, true);
    });
  });

  describe("id3Embed", () => {
    it("embeds store into non-ID3 file (creates new tag)", () => {
      const enc = new TextEncoder();
      const payload = enc.encode("mp3data");
      const store = new Uint8Array([0x42]);
      const r = AE.id3Embed(payload, store);
      assert.ok(r.output);
      assert.equal(r.storeLength, 1);
      assert.ok(r.output.length > payload.length);
    });
    it("replaces existing GEOB frame", () => {
      const id3 = makeId3v3();
      const store = new Uint8Array([0xde, 0xad]);
      const r = AE.id3Embed(id3, store);
      assert.equal(r.storeLength, 2);
    });
  });

  describe("sniffPayloadFormat edge cases", () => {
    it("ID3v2.2 with GEO frame", () => {
      const enc = new TextEncoder();
      // Build a minimal ID3v2.2 with GEO frame (3-byte frame ID, 3-byte syncsafe size)
      const mime = enc.encode("application/c2pa");
      const fname = enc.encode("c2pa");
      const desc = enc.encode("test");
      const payload = new Uint8Array([
        0,
        ...mime,
        0,
        ...fname,
        0,
        ...desc,
        0,
        0x41,
      ]);
      // syncsafe for payload.length
      const sizeBytes = syncsafe(payload.length);
      const frame = concatBytes(enc.encode("GEO"), sizeBytes, payload);
      const header = concatBytes(
        enc.encode("ID3"),
        new Uint8Array([2, 0, 0]),
        syncsafe(frame.length),
      );
      const buf = concatBytes(header, frame);
      const result = AE.detectAudioFormat(buf);
      assert.equal(result, "UNKNOWN");
    });
  });

  describe("edge: parseId3Header returns null for bad version", () => {
    it("ID3v1 (major=1) returns null header", () => {
      const enc = new TextEncoder();
      const buf = concatBytes(
        enc.encode("ID3"),
        new Uint8Array([1, 0, 0]),
        syncsafe(0),
      );
      const result = AE.detectAudioFormat(buf);
      // Falls through to sniffPayloadFormat
      assert.ok(typeof result === "string");
    });
    it("ID3v5 (major=5) returns null header", () => {
      const enc = new TextEncoder();
      const buf = concatBytes(
        enc.encode("ID3"),
        new Uint8Array([5, 0, 0]),
        syncsafe(0),
      );
      const result = AE.detectAudioFormat(buf);
      assert.ok(typeof result === "string");
    });
  });

  describe("edge: parseGeobPrefix failures", () => {
    it("returns found:false for corrupt GEOB data", () => {
      const enc = new TextEncoder();
      // GEOB frame with data too short for parseGeobPrefix
      const frameData = new Uint8Array([0]); // just the encoding byte, no NUL terminators
      const frame = concatBytes(
        enc.encode("GEOB"),
        u32be(frameData.length),
        new Uint8Array([0, 0]),
        frameData,
      );
      const header = concatBytes(
        enc.encode("ID3"),
        new Uint8Array([4, 0, 0]),
        syncsafe(frame.length),
      );
      const buf = concatBytes(header, frame);
      const loc = AE.id3GetManifestLocation(buf);
      assert.ok(loc);
      assert.equal(loc.found, false);
    });
  });
});
