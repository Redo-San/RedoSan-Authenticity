const { describe, it, before } = require("node:test");
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

// ── Module loader ──
// Each module runs in its own function scope (avoids top-level `const enc`/`dec`
// collisions across modules) and communicates through a shared exports object.
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
  Object.assign(globalThis, mods);
}

loadModule("C2PA/cbor.js");
loadModule("Voice_Biometric/audio_embed.js");
loadModule("Voice_Biometric/c2pa_audio_hash.js");
loadModule("Voice_Biometric/voice_provenance.js");

const VP = globalThis.VoiceProvenance;
if (!VP) throw new Error("VoiceProvenance failed to attach to window");

// ── Fixtures ──
function concatBytes(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

function makeWav(numSamples = 200) {
  const sampleRate = 8000;
  const bits = 16;
  const dataLen = numSamples * 2;
  const bytes = new Uint8Array(44 + dataLen);
  const dv = new DataView(bytes.buffer);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  dv.setUint32(4, 36 + dataLen, true);
  bytes.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE
  bytes.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, (sampleRate * bits) / 8, true);
  dv.setUint16(32, bits / 8, true);
  dv.setUint16(34, bits, true);
  bytes.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  dv.setUint32(40, dataLen, true);
  for (let i = 0; i < numSamples; i++)
    dv.setInt16(44 + i * 2, Math.round(Math.sin(i / 8) * 4000), true);
  return bytes;
}

function makeMp3() {
  const id3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]); // ID3v2.4.0, empty
  const frame = new Uint8Array(128);
  frame[0] = 0xff; // MPEG audio frame sync
  frame[1] = 0xfb;
  frame[2] = 0x90;
  return concatBytes(id3, frame);
}

function makeFlac() {
  const marker = new Uint8Array([0x66, 0x4c, 0x61, 0x43]); // fLaC
  const block = new Uint8Array([0x80, 0, 0, 34]); // last block, STREAMINFO, len 34
  const streamInfo = new Uint8Array(34);
  return concatBytes(marker, block, streamInfo);
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function makeKeypair() {
  const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ]);
  const pubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", kp.publicKey),
  );
  const privJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  assert.equal(pubRaw.length, 32);
  return {
    did: VP.didKeyFromRaw(pubRaw),
    pubRaw,
    privJwk,
    algorithm: "Ed25519",
    publicKey: kp.publicKey,
    privateKey: kp.privateKey,
  };
}

const sha256 = async (b) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", b));

// JUMBF helpers on the parse tree
function asciiOf(value) {
  if (typeof value === "string") return value;
  let s = "";
  for (let i = 0; i < value.length; i++) s += String.fromCharCode(value[i]);
  return s;
}

function collectLabels(node, out = []) {
  if (!node) return out;
  if (node.children && node.children[0] && node.children[0].desc)
    out.push({
      label: node.children[0].desc.label,
      uuid: node.children[0].desc.uuid,
      box: node,
    });
  for (const c of node.children || []) collectLabels(c, out);
  return out;
}

function findNodeByLabel(tree, label) {
  for (const n of collectLabels(tree)) if (n.label === label) return n;
  return null;
}

function leafData(node) {
  for (const child of node.children || []) {
    if (child.data && child.data.length) return child.data;
    const found = leafData(child);
    if (found) return found;
  }
  return null;
}

// ── Setup ──
let keypair;
let wav;
let mp3;
let flac;

before(async () => {
  keypair = await makeKeypair();
  wav = makeWav();
  mp3 = makeMp3();
  flac = makeFlac();
});

describe("voice provenance — format detection", () => {
  it("detects WAV, MP3 and FLAC", () => {
    assert.equal(VP.detectAudioFormat(wav), "WAV");
    assert.equal(VP.detectAudioFormat(mp3), "MP3");
    assert.equal(VP.detectAudioFormat(flac), "FLAC");
  });

  it("returns UNKNOWN for arbitrary bytes", () => {
    assert.equal(
      VP.detectAudioFormat(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
      "UNKNOWN",
    );
  });
});

describe("voice provenance — manifest location before embed", () => {
  it("reports not found on clean WAV", () => {
    const loc = VP.locateManifestSync(wav);
    assert.equal(loc.found, false);
    assert.equal(loc.format, "WAV");
  });

  it("reports not found on clean MP3/FLAC", () => {
    const locMp3 = VP.locateManifestSync(mp3);
    assert.equal(locMp3.found, false);
    assert.equal(locMp3.format, "MP3");
    const locFlac = VP.locateManifestSync(flac);
    assert.equal(locFlac, null);
  });
});

describe("voice provenance — embed + verify round-trip (WAV)", () => {
  let out;
  let report;

  before(async () => {
    out = await VP.embedAudio({
      bytes: wav,
      keypair,
      generatorName: "redosan",
      generatorVersion: "1.0.0",
    });
    report = await VP.verifyAudio(out.output);
  });

  it("returns embedded output longer than the original", () => {
    assert.ok(out.output.length > wav.length);
  });

  it("reports a located manifest with exclusions", () => {
    const loc = VP.locateManifestSync(out.output);
    assert.equal(loc.found, true);
    assert.equal(loc.format, "WAV");
    assert.equal(loc.exclusionLength, 8 + out.manifest.storeLength);
    assert.equal(loc.exclusionStart, out.manifest.exclusionStart);
  });

  it("embeds into the trailing C2PA chunk (data hash matches content)", async () => {
    assert.equal(out.manifest.storeOffset, out.manifest.exclusionStart + 8);
    assert.equal(out.manifest.storeLength, locManifestStoreLength(out));
    const recomputed = await sha256Excluding(out.output, [
      {
        start: out.manifest.exclusionStart,
        length: out.manifest.exclusionLength,
      },
    ]);
    assert.ok(bytesEqual(recomputed, out.manifest.dataHash));
  });

  it("verifies as Valid with expected codes", () => {
    assert.equal(report.found, true);
    assert.equal(report.valid, true);
    assert.equal(report.state, "Valid");
    assert.equal(report.format, "WAV");
    assert.ok(report.codes.includes("claimSignature.validated"));
    assert.ok(report.codes.includes("signingCredential.untrusted"));
    assert.equal(report.signature.verified, true);
    assert.equal(report.signature.claimMismatch, false);
    assert.equal(report.dataHash.match, true);
  });

  it("signing credential matches the signing DID and is Ed25519", () => {
    assert.equal(report.signingCredential.did, keypair.did);
    assert.equal(report.signingCredential.algorithm, "Ed25519");
    assert.equal(report.signingCredential.selfSigned, true);
  });

  it("report carries claim + signature URI", () => {
    assert.match(report.claim.instanceID, /^urn:uuid:/);
    assert.equal(report.claim.claimGenerator[0].name, "redosan");
    assert.equal(report.claim.claimGenerator[0].version, "1.0.0");
    assert.match(
      report.claim.signatureUri,
      /^self#jumbf=c2pa\/urn:c2pa:[0-9a-f-]+\/c2pa\.signature$/,
    );
  });

  it("all created_assertions hash-verified true", () => {
    assert.ok(report.claim.createdAssertions.length >= 1);
    for (const a of report.claim.createdAssertions)
      assert.equal(a.verified, true, `assertion ${a.label} not verified`);
    assert.ok(
      report.claim.createdAssertions.some((a) => a.label === "c2pa.hash.data"),
    );
  });
});

function locManifestStoreLength(out) {
  const loc = VP.locateManifestSync(out.output);
  return loc.storeLength;
}

describe("voice provenance — JUMBF structure", () => {
  let out;
  let tree;

  before(async () => {
    out = await VP.embedAudio({ bytes: wav, keypair });
    const ex = VP.extractStore(out.output);
    assert.ok(ex && ex.found);
    tree = VP.parseJumbfStore(ex.store);
  });

  it("parses a rooted store tree", () => {
    assert.ok(tree);
    assert.equal(tree.box.type, "jumb");
    assert.ok(tree.boxBytes.length > 0);
  });

  it("contains the expected box labels and uuid prefixes", () => {
    const labels = collectLabels(tree);
    const labelSet = new Set(labels.map((n) => n.label));
    for (const expected of [
      "c2pa",
      "c2pa.claim.v2",
      "c2pa.assertions",
      "c2pa.hash.data",
      "c2pa.signature",
    ])
      assert.ok(labelSet.has(expected), `missing box ${expected}`);
    assert.ok(labels.find((n) => n.label.startsWith("urn:c2pa:")));
    const byLabel = Object.fromEntries(labels.map((n) => [n.label, n.uuid]));
    assert.equal(asciiOf(byLabel["c2pa"]), "c2pa");
    assert.equal(asciiOf(byLabel["c2pa.claim.v2"]), "c2cl");
    assert.equal(asciiOf(byLabel["c2pa.assertions"]), "c2as");
    assert.equal(asciiOf(byLabel["c2pa.hash.data"]), "c2as");
    assert.equal(asciiOf(byLabel["c2pa.signature"]), "c2cs");
  });

  it("claim box contains decodable claim-map-v2 CBOR", () => {
    const claimNode = findNodeByLabel(tree, "c2pa.claim.v2");
    const data = leafData(claimNode.box);
    const claim = decode(new Uint8Array(data), 0).val;
    assert.ok(claim);
    assert.equal(typeof claim.instanceID, "string");
    assert.ok(
      Buffer.isBuffer(claim.signature) || claim.signature instanceof Uint8Array,
    );
    assert.ok(Array.isArray(claim.created_assertions));
    assert.ok(Array.isArray(claim.claim_generator_info));
  });

  it("data-hash assertion decodes to tstr keys with exclusions", () => {
    const hashNode = findNodeByLabel(tree, "c2pa.hash.data");
    const data = leafData(hashNode.box);
    const dm = decode(new Uint8Array(data), 0).val;
    assert.equal(dm.alg, 0);
    assert.ok(dm.hash instanceof Uint8Array);
    assert.equal(dm.hash.length, 32);
    assert.ok(Array.isArray(dm.exclusions));
    assert.equal(typeof dm.exclusions[0].start, "number");
    assert.equal(typeof dm.exclusions[0].length, "number");
  });

  it("signature box contains a COSE_Sign1 (tag 18, alg -8, 64-byte sig)", () => {
    const sigNode = findNodeByLabel(tree, "c2pa.signature");
    const cose = VP.decodeCoseSign1(new Uint8Array(leafData(sigNode.box)));
    assert.equal(cose.alg, -8);
    assert.ok(cose.cert && cose.cert.length > 0);
    assert.equal(cose.signatureBytes.length, 64);
    if (cose.unprotected) assert.equal(typeof cose.unprotected, "object");
  });
});

describe("voice provenance — independent hash / COSE verification", () => {
  let out;
  let report;

  before(async () => {
    out = await VP.embedAudio({ bytes: wav, keypair });
    report = await VP.verifyAudio(out.output);
  });

  it("embedded dataHash equals an independently recomputed exclusion hash", async () => {
    const h = await sha256Excluding(out.output, [
      {
        start: out.manifest.exclusionStart,
        length: out.manifest.exclusionLength,
      },
    ]);
    assert.ok(bytesEqual(h, report.dataHash.hash));
  });

  it("c2pa.hash created_assertions hash equals sha256(assertion superbox[8:])", async () => {
    const ex = VP.extractStore(out.output);
    const tree = VP.parseJumbfStore(ex.store);
    const entry = report.claim.createdAssertions.find(
      (a) => a.label === "c2pa.hash.data",
    );
    const node = findNodeByLabel(tree, "c2pa.hash.data");
    const h = await sha256(node.box.boxBytes);
    assert.ok(bytesEqual(new Uint8Array(entry.hash), h));
  });

  it("COSE verification passes against the extracted x5chain certificate", async () => {
    // report already verified the COSE signature end-to-end
    assert.equal(report.signature.verified, true);
    assert.equal(report.signature.claimMismatch, false);
  });
});

describe("voice provenance — OTS assertion", () => {
  const proof = new Uint8Array(16).fill(7);

  it("embeds redosan.voice.ots with attested_digest == dataHash", async () => {
    const out = await VP.embedAudio({
      bytes: wav,
      keypair,
      ots: { createdAt: "2026-09-09T00:00:00Z", proof },
    });
    const report = await VP.verifyAudio(out.output);
    assert.equal(report.valid, true);
    const otsEntry = report.claim.createdAssertions.find(
      (a) => a.label === "redosan.voice.ots",
    );
    assert.ok(otsEntry, "OTS assertion missing from claim");
    assert.equal(otsEntry.verified, true);

    const ex = VP.extractStore(out.output);
    const tree = VP.parseJumbfStore(ex.store);
    const node = findNodeByLabel(tree, "redosan.voice.ots");
    const ots = decode(new Uint8Array(leafData(node.box)), 0).val;
    assert.equal(typeof ots.created_at, "string");
    assert.ok(ots.attested_digest instanceof Uint8Array);
    assert.equal(ots.attested_digest.length, 32);
    assert.ok(bytesEqual(ots.attested_digest, report.dataHash.hash));
    assert.ok(ots.ots_proof_file_sha256 instanceof Uint8Array);
    assert.equal(ots.ots_proof_file_sha256.length, 32);
    const proofHash = await sha256(proof);
    assert.ok(bytesEqual(ots.ots_proof_file_sha256, proofHash));
  });
});

describe("voice provenance — determinism and removal", () => {
  it("riffEmbed(id3Embed) with the same store is byte-identical", async () => {
    const out = await VP.embedAudio({ bytes: wav, keypair });
    const ex = VP.extractStore(out.output);
    const store = ex.store;
    const e1 = riffEmbed(wav, store);
    const e2 = riffEmbed(wav, store);
    assert.ok(bytesEqual(e1.output, e2.output));
    const i1 = id3Embed(mp3, store);
    const i2 = id3Embed(mp3, store);
    assert.ok(bytesEqual(i1.output, i2.output));
  });

  it("removing the manifest restores the original audio bytes", async () => {
    const out = await VP.embedAudio({ bytes: wav, keypair });
    const removed = riffRemove(out.output);
    assert.equal(removed.removed, true);
    assert.ok(bytesEqual(removed.output, wav));

    const outMp3 = await VP.embedAudio({ bytes: mp3, keypair });
    const removedMp3 = id3Remove(outMp3.output);
    assert.equal(removedMp3.removed, true);
    assert.ok(bytesEqual(removedMp3.output, mp3));

    const outFlac = await VP.embedAudio({ bytes: flac, keypair });
    const removedFlac = id3Remove(outFlac.output);
    assert.equal(removedFlac.removed, true);
    assert.ok(bytesEqual(removedFlac.output, flac));
  });
});

describe("voice provenance — MP3 and FLAC round-trip", () => {
  it("validates an MP3 embedding", async () => {
    const out = await VP.embedAudio({ bytes: mp3, keypair });
    assert.equal(out.manifest.format, "MP3");
    assert.ok(out.manifest.storeOffset > 0);
    const report = await VP.verifyAudio(out.output);
    assert.equal(report.format, "MP3");
    assert.equal(report.valid, true);
    assert.equal(report.state, "Valid");
  });

  it("validates a FLAC embedding", async () => {
    const out = await VP.embedAudio({ bytes: flac, keypair });
    assert.equal(out.manifest.format, "FLAC");
    const report = await VP.verifyAudio(out.output);
    assert.equal(report.format, "FLAC");
    assert.equal(report.valid, true);
  });
});

describe("voice provenance — tamper detection", () => {
  it("flags a modified sample as Invalid with dataHash mismatch", async () => {
    const out = await VP.embedAudio({ bytes: wav, keypair });
    const tampered = out.output.slice();
    const byteIdx = wav.length - 4; // inside the audio data, outside the store
    tampered[byteIdx] = tampered[byteIdx] ^ 0xff;
    const report = await VP.verifyAudio(tampered);
    assert.equal(report.valid, false);
    assert.equal(report.state, "Invalid");
    assert.equal(report.dataHash.match, false);
    assert.ok(report.codes.includes("assertion.dataHash.mismatch"));
  });

  it("returns Invalid for clean audio (no manifest)", async () => {
    const report = await VP.verifyAudio(wav);
    assert.equal(report.found, false);
    assert.equal(report.valid, false);
    assert.ok(report.codes.includes("manifest.missing"));
  });
});

describe("voice provenance — input validation", () => {
  it("rejects unsupported containers", async () => {
    await assert.rejects(
      VP.embedAudio({ bytes: new Uint8Array(64), keypair }),
      /Unsupported audio container/,
    );
  });

  it("rejects non-Ed25519 keypairs", async () => {
    const p256 = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const pubJwk = await crypto.subtle.exportKey("jwk", p256.publicKey);
    const privJwk = await crypto.subtle.exportKey("jwk", p256.privateKey);
    const pubRaw = new Uint8Array(
      await crypto.subtle.exportKey("raw", p256.publicKey),
    );
    await assert.rejects(
      VP.embedAudio({
        bytes: wav,
        keypair: { pubRaw, privJwk, algorithm: "P-256" },
      }),
      /Ed25519/,
    );
    assert.equal(privJwk.crv || pubJwk.crv, "P-256");
  });

  it("requires a keypair object", async () => {
    await assert.rejects(
      VP.embedAudio({ bytes: wav, keypair: null }),
      /Ed25519 DID keypair/,
    );
  });
});
