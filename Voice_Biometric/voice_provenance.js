/* c8 ignore start */
(function () {
  if (
    typeof window != "undefined" &&
    window.location &&
    window.location.protocol !== "file:" &&
    !/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(
      window.location.href,
    )
  )
    throw new Error(
      "RedoSan Authenticity: This script is protected by GPL license.",
    );
})();
/* c8 ignore stop */

import { concatBytes, bytesEqual, u32be, ascii } from "./audio_embed.js";
import {
  detectAudioFormat,
  riffGetManifestLocation,
  riffEmbed,
  id3GetManifestLocation,
  id3Embed,
} from "./audio_embed.js";
import {
  buildDataHashMapDeterministic,
  sha256Excluding,
} from "./c2pa_audio_hash.js";
import {
  encodeInt,
  encodeBstr,
  encodeTstr,
  encodeArray,
  encodeMap,
  encodeTag,
  decode as cborDecode,
} from "../C2PA/cbor.js";

const enc = new TextEncoder();
const dec = new TextDecoder();

export const SHA256_ALG_ID = 0;
export const DATA_HASH_LABEL = "c2pa.hash.data";
export const OTS_LABEL = "redosan.voice.ots";
export const SIGNATURE_LABEL = "c2pa.signature";
export const CLAIM_LABEL = "c2pa.claim.v2";
export const ASSERTIONS_LABEL = "c2pa.assertions";
export const STORE_LABEL = "c2pa";
export const CERT_CN = "RedoSan Voice Provenance";

const UUID_TAIL = new Uint8Array([
  0x00, 0x11, 0x00, 0x10, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71,
]);

function contentDescUuid(prefix) {
  return concatBytes(enc.encode(prefix), UUID_TAIL);
}

export const UUID_C2PA = contentDescUuid("c2pa");
export const UUID_C2MA = contentDescUuid("c2ma");
export const UUID_C2AS = contentDescUuid("c2as");
export const UUID_C2CL = contentDescUuid("c2cl");
export const UUID_C2CS = contentDescUuid("c2cs");
export const UUID_CBOR = contentDescUuid("cbor");

const OID_ED25519 = new Uint8Array([0x2b, 0x65, 0x70]);
const OID_CN = new Uint8Array([0x55, 0x04, 0x03]);
const OID_KEY_USAGE = new Uint8Array([0x55, 0x1d, 0x0f]);

const ZBASE32 = "ybndrfg8ejkmcpqxot1uwisza345h769";

export function uuidV4() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return (
    h.slice(0, 8) +
    "-" +
    h.slice(8, 12) +
    "-" +
    h.slice(12, 16) +
    "-" +
    h.slice(16, 20) +
    "-" +
    h.slice(20)
  );
}

async function sha256(bytes) {
  const out = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(out);
}

export function zbase32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ZBASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ZBASE32[(value << (5 - bits)) & 31];
  return out;
}

export function didKeyFromRaw(raw) {
  return (
    "did:key:z" + zbase32Encode(concatBytes(Uint8Array.from([0xed, 0x01]), raw))
  );
}

// ---- JUMBF box primitives ----

function jumdBox(uuid, label) {
  const body = concatBytes(
    Uint8Array.from(uuid),
    new Uint8Array([3]),
    enc.encode(label),
    new Uint8Array([0]),
  );
  return concatBytes(u32be(8 + body.length), enc.encode("jumb"), body);
}

function jumbSuperBox(children) {
  const body = concatBytes(...children);
  return concatBytes(u32be(8 + body.length), enc.encode("jumb"), body);
}

function cborContentBox(cborBytes) {
  return jumbSuperBox([jumdBox(UUID_CBOR, "cbor"), cborBytes]);
}

export function buildAssertionSuperBox(label, contentCbor) {
  return jumbSuperBox([jumdBox(UUID_C2AS, label), cborContentBox(contentCbor)]);
}

function buildAssertionsBox(assertionSuperBoxes) {
  return jumbSuperBox([
    jumdBox(UUID_C2AS, ASSERTIONS_LABEL),
    ...assertionSuperBoxes,
  ]);
}

function buildClaimSuperBox(claimBytes) {
  return jumbSuperBox([
    jumdBox(UUID_C2CL, CLAIM_LABEL),
    cborContentBox(claimBytes),
  ]);
}

function buildSignatureSuperBox(coseMessage) {
  return jumbSuperBox([
    jumdBox(UUID_C2CS, SIGNATURE_LABEL),
    cborContentBox(coseMessage),
  ]);
}

export function buildManifestStore({
  manifestLabel,
  claimBytes,
  assertionBoxes,
  signatureBoxBytes,
}) {
  return jumbSuperBox([
    jumdBox(UUID_C2PA, STORE_LABEL),
    jumbSuperBox([
      jumdBox(UUID_C2MA, manifestLabel),
      buildClaimSuperBox(claimBytes),
      buildAssertionsBox(assertionBoxes),
      signatureBoxBytes,
    ]),
  ]);
}

// ---- JUMBF parser ----

function readU32be(bytes, off) {
  return (
    ((bytes[off] << 24) |
      (bytes[off + 1] << 16) |
      (bytes[off + 2] << 8) |
      bytes[off + 3]) >>>
    0
  );
}

function parseDescBox(bytes, box) {
  const uuid = ascii(bytes, box.contentStart, 4);
  const toggles = bytes[box.contentStart + 16];
  const label = dec
    .decode(bytes.subarray(box.contentStart + 17, box.contentEnd))
    .replace(/\0+$/, "");
  return { uuid, toggles, label };
}

function looksLikeDesc(bytes, box) {
  if (box.contentEnd - box.contentStart < 21) return false;
  // A superbox body starts with a nested jumb box: [u32 size]["jumb"].
  // A description box body starts with the 16-byte box-uuid (e.g. "c2pa").
  return ascii(bytes, box.contentStart + 4, 4) !== "jumb";
}

function parseRegion(bytes, start, end) {
  const node = {
    box: null,
    desc: null,
    children: [],
    data: null,
    boxBytes: null,
  };
  let off = start;
  while (off < end) {
    if (off + 8 > end) {
      node.data = bytes.slice(off, end);
      break;
    }
    const size = readU32be(bytes, off);
    const type = ascii(bytes, off + 4, 4);
    if (type !== "jumb" || size < 8 || off + size > end) {
      node.data = bytes.slice(off, end);
      break;
    }
    const box = {
      type,
      size,
      offset: off,
      contentStart: off + 8,
      contentEnd: off + size,
    };
    if (looksLikeDesc(bytes, box)) {
      const descNode = {
        box,
        desc: parseDescBox(bytes, box),
        children: [],
        data: null,
        boxBytes: bytes.slice(box.contentStart, box.contentEnd),
      };
      node.children.push(descNode);
    } else {
      const child = parseRegion(bytes, box.contentStart, box.contentEnd);
      child.box = box;
      child.boxBytes = bytes.slice(box.contentStart, box.contentEnd);
      node.children.push(child);
    }
    off = box.contentEnd;
  }
  return node;
}

export function parseJumbfStore(storeBytes) {
  const tree = parseRegion(storeBytes, 0, storeBytes.length);
  if (tree.children.length === 1) return tree.children[0];
  return tree;
}

function findNodeByLabel(node, label) {
  const hdr = node.children && node.children[0];
  if (hdr && hdr.desc && hdr.desc.label === label) return node;
  for (const child of node.children || []) {
    const found = findNodeByLabel(child, label);
    if (found) return found;
  }
  return null;
}

function findNodeByLabelPrefix(node, prefix) {
  const hdr = node.children && node.children[0];
  if (hdr && hdr.desc && hdr.desc.label && hdr.desc.label.startsWith(prefix))
    return node;
  for (const child of node.children || []) {
    const found = findNodeByLabelPrefix(child, prefix);
    if (found) return found;
  }
  return null;
}

function contentData(node) {
  for (const child of node.children || []) {
    if (child.data && child.data.length) return child.data;
    if (child.children && child.children.length) {
      const found = contentData(child);
      if (found) return found;
    }
  }
  return null;
}

// ---- X.509 DER (self-signed Ed25519) ----

function derLength(n) {
  if (n < 0x80) return new Uint8Array([n]);
  const bytes = [];
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function derTlv(tag, body) {
  return concatBytes(new Uint8Array([tag]), derLength(body.length), body);
}

function derSeq(...parts) {
  return derTlv(0x30, concatBytes(...parts));
}

function derSet(...parts) {
  return derTlv(0x31, concatBytes(...parts));
}

function derOid(bytes) {
  return derTlv(0x06, bytes);
}

function derName() {
  const attr = derSeq(derOid(OID_CN), derTlv(0x13, enc.encode(CERT_CN)));
  return derSeq(derSet(attr));
}

function derUtcTime(s) {
  return new Uint8Array([0x17, s.length, ...enc.encode(s)]);
}

export async function buildX509Cert({ rawPub, privateKey }) {
  const serial = Uint8Array.from([
    0x01,
    ...crypto.getRandomValues(new Uint8Array(19)),
  ]);
  const tbs = derSeq(
    derTlv(0xa0, new Uint8Array([0x02, 0x01, 0x02])),
    derTlv(0x02, serial),
    derSeq(derOid(OID_ED25519)),
    derName(),
    derUtcTime("240101000000Z"),
    derUtcTime("991231235959Z"),
    derName(),
    derSeq(
      derSeq(derOid(OID_ED25519)),
      derTlv(0x03, concatBytes(new Uint8Array([0]), rawPub)),
    ),
    derTlv(
      0xa3,
      derSeq(
        derSeq(
          derOid(OID_KEY_USAGE),
          new Uint8Array([0x01, 0x01, 0xff]),
          derTlv(0x04, new Uint8Array([0x03, 0x02, 0x07, 0x80])),
        ),
      ),
    ),
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "Ed25519" }, privateKey, tbs),
  );
  return derSeq(
    tbs,
    derSeq(derOid(OID_ED25519)),
    derTlv(0x03, concatBytes(new Uint8Array([0]), sig)),
  );
}

function derTlvAt(bytes, off) {
  let o = off;
  const tag = bytes[o++];
  let len = bytes[o++];
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | bytes[o++];
  }
  return { tag, contentStart: o, contentEnd: o + len, end: o + len };
}

function derSpkiPublicKeyBytes(certDer) {
  const cert = derTlvAt(certDer, 0);
  if (cert.tag !== 0x30) throw new Error("Not an X.509 certificate");
  const tbs = derTlvAt(certDer, cert.contentStart);
  const items = [];
  let o = tbs.contentStart;
  while (o < tbs.contentEnd) {
    const item = derTlvAt(certDer, o);
    items.push(item);
    o = item.end;
  }
  const spki = items.find((it) => {
    if (it.tag !== 0x30 || it.contentEnd > tbs.contentEnd) return false;
    const inner = derTlvAt(certDer, it.contentStart);
    if (inner.tag !== 0x30) return false;
    const bit = derTlvAt(certDer, inner.end);
    return bit.tag === 0x03;
  });
  if (!spki) throw new Error("Certificate missing SubjectPublicKeyInfo");
  const algSeq = derTlvAt(certDer, spki.contentStart);
  const algOidTlv = derTlvAt(certDer, algSeq.contentStart);
  const bitString = derTlvAt(certDer, algSeq.end);
  return {
    raw: Uint8Array.from(
      certDer.slice(bitString.contentStart + 1, bitString.contentEnd),
    ),
    algOid: Uint8Array.from(
      certDer.slice(algOidTlv.contentStart, algOidTlv.contentEnd),
    ),
  };
}

async function importCertPublicKey(certDer) {
  const { raw, algOid } = derSpkiPublicKeyBytes(certDer);
  if (!bytesEqual(algOid, OID_ED25519))
    throw new Error(
      "Unsupported certificate algorithm" +
        " algOid=" +
        Array.from(algOid).join(",") +
        " expected=" +
        Array.from(OID_ED25519).join(","),
    );
  return {
    raw,
    key: await crypto.subtle.importKey("raw", raw, { name: "Ed25519" }, false, [
      "verify",
    ]),
  };
}

// ---- COSE Sign1 (RFC 9052) ----

function buildProtectedHeaders(certDer) {
  return encodeMap([
    [1, encodeInt(-8)],
    [33, encodeArray([encodeBstr(certDer)])],
  ]);
}

export function buildSigStructure(protectedRaw, aad, payload) {
  return encodeArray([
    encodeTstr("Signature1"),
    encodeBstr(protectedRaw),
    encodeBstr(aad),
    encodeBstr(payload),
  ]);
}

export async function buildCoseSign1({
  protectedRaw,
  claimBytes,
  signaturePayload,
  privateKey,
}) {
  const payload = signaturePayload || claimBytes;
  const sigStructure = buildSigStructure(
    protectedRaw,
    new Uint8Array(0),
    payload,
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "Ed25519" }, privateKey, sigStructure),
  );
  const message = encodeTag(
    18,
    encodeArray([
      encodeBstr(protectedRaw),
      encodeMap([]),
      encodeBstr(claimBytes),
      encodeBstr(signature),
    ]),
  );
  return { message, sigStructure, signature, protectedRaw };
}

function buildCoseMessagePlaceholder({ protectedRaw, claimBytes }) {
  return encodeTag(
    18,
    encodeArray([
      encodeBstr(protectedRaw),
      encodeMap([]),
      encodeBstr(claimBytes),
      encodeBstr(new Uint8Array(64)),
    ]),
  );
}

export function decodeCoseSign1(bytes) {
  const top = cborDecode(bytes, 0).val;
  const [tagNumber, inner] = top;
  if (tagNumber !== 18 || !Array.isArray(inner) || inner.length !== 4)
    throw new Error("Not a COSE_Sign1 message");
  const protectedMapBytes = inner[0];
  const unprotected = inner[1];
  const payloadBytes = inner[2];
  const signatureBytes = inner[3];
  const headers = cborDecode(protectedMapBytes, 0).val;
  const x5chain = headers["33"];
  const cert = x5chain && x5chain.length ? x5chain[0] : null;
  return {
    protectedMapBytes,
    headers,
    unprotected,
    payloadBytes,
    signatureBytes,
    cert,
    alg: headers["1"],
  };
}

// ---- claim (claim-map-v2) ----

export function buildClaimBytes({
  instanceID,
  generatorName,
  generatorVersion,
  assertionUrls,
  assertionHashes,
  signatureBytes,
}) {
  const created = assertionUrls.map((url, i) =>
    encodeMap([
      [encodeTstr("url"), encodeTstr(url)],
      [
        encodeTstr("hash"),
        encodeBstr(assertionHashes[i] || new Uint8Array(32)),
      ],
    ]),
  );
  const entries = [];
  if (signatureBytes && signatureBytes.length)
    entries.push([encodeTstr("signature"), encodeBstr(signatureBytes)]);
  entries.push(
    [encodeTstr("instanceID"), encodeTstr(instanceID)],
    [encodeTstr("created_assertions"), encodeArray(created)],
    [
      encodeTstr("claim_generator_info"),
      encodeArray([
        encodeMap([
          [encodeTstr("name"), encodeTstr(generatorName)],
          [encodeTstr("version"), encodeTstr(generatorVersion)],
        ]),
      ]),
    ],
  );
  return encodeMap(entries);
}

// Re-encode a decoded claim map WITHOUT its signature field, so the value is
// byte-identical to the claim payload that was signed at embed time.
export function buildClaimPayloadBytes(claim) {
  const created = (claim.created_assertions || []).map((c) =>
    encodeMap([
      [encodeTstr("url"), encodeTstr(String(c.url))],
      [encodeTstr("hash"), encodeBstr(Uint8Array.from(c.hash || []))],
    ]),
  );
  const genInfo = (claim.claim_generator_info || []).map((g) =>
    encodeMap([
      [encodeTstr("name"), encodeTstr(String(g.name))],
      [encodeTstr("version"), encodeTstr(String(g.version))],
    ]),
  );
  return encodeMap([
    [encodeTstr("instanceID"), encodeTstr(String(claim.instanceID))],
    [encodeTstr("created_assertions"), encodeArray(created)],
    [encodeTstr("claim_generator_info"), encodeArray(genInfo)],
  ]);
}

export function buildOtsAssertionCbor(createdAt, attestedDigest, proofHash) {
  return encodeMap([
    [encodeTstr("created_at"), encodeTstr(createdAt)],
    [encodeTstr("attested_digest"), encodeBstr(attestedDigest)],
    [encodeTstr("ots_proof_file_sha256"), encodeBstr(proofHash)],
  ]);
}

// ---- manifest location ----

export function locateManifestSync(bytes) {
  const format = detectAudioFormat(bytes);
  if (format === "WAV" || format === "RIFX" || format === "RIFF")
    return riffGetManifestLocation(bytes);
  return id3GetManifestLocation(bytes);
}

export async function locateManifest(bytes) {
  return locateManifestSync(bytes);
}

export function extractStore(bytes) {
  const loc = locateManifestSync(bytes);
  if (!loc || !loc.found) return null;
  return {
    store: bytes.slice(loc.storeOffset, loc.storeOffset + loc.storeLength),
    ...loc,
  };
}

// ---- embed ----

async function buildStoreHelper({
  manifestLabel,
  instanceID,
  generatorName,
  generatorVersion,
  exclusionStart,
  exclusionLength,
  hashBytes,
  ots,
  otsProofHash,
  sign,
  rawPub,
  privateKey,
}) {
  const exclusions = [{ start: exclusionStart, length: exclusionLength }];
  const dataHashMap = buildDataHashMapDeterministic(
    SHA256_ALG_ID,
    new Uint8Array(0),
    hashBytes,
    exclusions,
  );

  const labels = [DATA_HASH_LABEL, ...(ots ? [OTS_LABEL] : [])];
  const cborContents = [
    dataHashMap,
    ...(ots
      ? [buildOtsAssertionCbor(ots.createdAt, hashBytes, otsProofHash)]
      : []),
  ];
  const assertionUrls = labels.map(
    (l) => `self#jumbf=c2pa/${manifestLabel}/c2pa.assertions/${l}`,
  );
  const assertionBoxes = labels.map((l, i) =>
    buildAssertionSuperBox(l, cborContents[i]),
  );
  // created_assertions hash = SHA-256 over the assertion superbox minus its 8-byte header.
  const assertionHashes = await Promise.all(
    assertionBoxes.map((b) => sha256(b.subarray(8))),
  );
  const protectedRaw = buildProtectedHeaders(
    await buildX509Cert({ rawPub, privateKey }),
  );

  // Fixed-point is avoided by construction: the claim's signature field holds
  // the Sig_structure whose payload is the claim WITHOUT the signature field,
  // so payload length is constant and the ciphertext-free structure closes.
  const payloadBytes = buildClaimBytes({
    instanceID,
    generatorName,
    generatorVersion,
    assertionUrls,
    assertionHashes,
    signatureBytes: new Uint8Array(0),
  });
  const sigStructure = buildSigStructure(
    protectedRaw,
    new Uint8Array(0),
    payloadBytes,
  );
  const claimBytes = buildClaimBytes({
    instanceID,
    generatorName,
    generatorVersion,
    assertionUrls,
    assertionHashes,
    signatureBytes: sigStructure,
  });

  const signatureBox = sign
    ? buildSignatureSuperBox(
        (
          await buildCoseSign1({
            protectedRaw,
            claimBytes,
            signaturePayload: payloadBytes,
            privateKey,
          })
        ).message,
      )
    : buildSignatureSuperBox(
        buildCoseMessagePlaceholder({ protectedRaw, claimBytes }),
      );

  const store = buildManifestStore({
    manifestLabel,
    claimBytes,
    assertionBoxes,
    signatureBoxBytes: signatureBox,
  });
  return { store, claimBytes, assertionBoxes, assertionUrls, labels };
}

export async function embedAudio({
  bytes,
  keypair,
  generatorName,
  generatorVersion,
  ots,
}) {
  if (!keypair || !keypair.pubRaw || !keypair.privJwk)
    throw new Error("embedAudio requires an Ed25519 DID keypair");
  const format = detectAudioFormat(bytes);
  const isRiff = format === "WAV" || format === "RIFX";
  if (format === "UNKNOWN")
    throw new Error("Unsupported audio container: " + format);

  let privateKey;
  try {
    privateKey = await crypto.subtle.importKey(
      "jwk",
      keypair.privJwk,
      { name: "Ed25519" },
      false,
      ["sign"],
    );
  } catch {
    throw new Error(
      "embedAudio requires an Ed25519 keypair (got " +
        (keypair.algorithm || "unsupported") +
        ")",
    );
  }
  const rawPub = keypair.pubRaw;

  const manifestLabel = "urn:c2pa:" + uuidV4();
  const instanceID = "urn:uuid:" + uuidV4();
  const gName = generatorName || "redosan";
  const gVersion = generatorVersion || "1.0.0";

  let otsProofHash = null;
  if (ots) {
    if (!ots.proof) throw new Error("ots.proof bytes required");
    otsProofHash = await sha256(ots.proof);
  }

  // Convergence: exclusionStart/length depend on the store length via the
  // varint encoding of the data-hash-map values, which feeds back into the
  // store bytes. Embed a placeholder store until the range stops moving.
  let exclusionStart = -1;
  let exclusionLength = -1;
  let placeholderStoreLen = -1;
  let embedded0 = null;
  for (let i = 0; i < 32; i++) {
    const placeholder = await buildStoreHelper({
      manifestLabel,
      instanceID,
      generatorName: gName,
      generatorVersion: gVersion,
      exclusionStart,
      exclusionLength,
      hashBytes: new Uint8Array(32),
      ots,
      otsProofHash,
      sign: false,
      rawPub,
      privateKey,
    });
    placeholderStoreLen = placeholder.store.length;
    const emb = isRiff
      ? riffEmbed(bytes, placeholder.store)
      : id3Embed(bytes, placeholder.store);
    const wantLength = isRiff
      ? placeholder.store.length + 8
      : placeholder.store.length;
    const stable =
      emb.exclusionStart === exclusionStart &&
      emb.exclusionLength === wantLength;
    exclusionStart = emb.exclusionStart;
    exclusionLength = emb.exclusionLength;
    embedded0 = emb;
    if (stable) break;
  }
  if (!embedded0) throw new Error("Failed to converge C2PA manifest placement");

  const exclusions = [
    { start: embedded0.exclusionStart, length: embedded0.exclusionLength },
  ];
  // The OTS attestation covers the content digest (same exclusion ranges as
  // c2pa.hash.data) so embedding stays non-circular.
  const dataHash = await sha256Excluding(embedded0.output, exclusions);

  const final = await buildStoreHelper({
    manifestLabel,
    instanceID,
    generatorName: gName,
    generatorVersion: gVersion,
    exclusionStart,
    exclusionLength,
    hashBytes: dataHash,
    ots,
    otsProofHash,
    sign: true,
    rawPub,
    privateKey,
  });

  if (final.store.length !== placeholderStoreLen)
    throw new Error(
      "C2PA manifest store length changed between placeholder and final build",
    );

  const embedded = isRiff
    ? riffEmbed(bytes, final.store)
    : id3Embed(bytes, final.store);
  if (
    embedded.exclusionStart !== exclusionStart ||
    embedded.exclusionLength !== exclusionLength
  )
    throw new Error(
      "C2PA exclusion range changed between placeholder and final embed",
    );

  return {
    output: embedded.output,
    manifest: {
      format,
      storeOffset: embedded.storeOffset,
      storeLength: final.store.length,
      exclusionStart,
      exclusionLength,
      manifestLabel,
      instanceID,
      assertionLabels: final.labels,
      signerDid: keypair.did || didKeyFromRaw(rawPub),
      dataHash,
    },
  };
}

// ---- verify ----

export async function verifyAudio(bytes) {
  const report = {
    format: null,
    found: false,
    storeOffset: null,
    storeLength: null,
    valid: false,
    state: "Invalid",
    codes: [],
    signingCredential: {
      did: null,
      selfSigned: null,
      untrusted: null,
      algorithm: null,
    },
    claim: {
      instanceID: null,
      claimGenerator: null,
      signatureUri: null,
      createdAssertions: [],
    },
    dataHash: {
      alg: null,
      hash: null,
      recomputedHash: null,
      match: null,
      exclusions: [],
    },
    signature: { verified: false, claimMismatch: null, cose: false },
  };

  const loc = locateManifestSync(bytes);
  if (!loc || !loc.found) {
    report.codes.push("manifest.missing");
    return report;
  }
  report.format = loc.format;
  report.storeOffset = loc.storeOffset;
  report.storeLength = loc.storeLength;
  report.found = true;

  const storeBytes = bytes.slice(
    loc.storeOffset,
    loc.storeOffset + loc.storeLength,
  );
  let tree;
  try {
    tree = parseJumbfStore(storeBytes);
  } catch {
    report.codes.push("manifest.missing");
    return report;
  }

  const claimNode = findNodeByLabel(tree, CLAIM_LABEL);
  const sigNode = findNodeByLabel(tree, SIGNATURE_LABEL);
  const assertionsNode = findNodeByLabel(tree, ASSERTIONS_LABEL);
  if (!claimNode || !sigNode || !assertionsNode) {
    report.codes.push("manifest.missing");
    return report;
  }

  const claimBytes = contentData(claimNode);
  let claim;
  try {
    claim = cborDecode(new Uint8Array(claimBytes), 0).val;
  } catch {
    report.codes.push("claim.malformed");
    return report;
  }
  if (
    !claim ||
    typeof claim !== "object" ||
    !("signature" in claim) ||
    !("instanceID" in claim) ||
    !("created_assertions" in claim) ||
    !("claim_generator_info" in claim)
  ) {
    report.codes.push("claim.malformed");
    return report;
  }

  report.claim.instanceID = claim.instanceID;
  report.claim.claimGenerator = claim.claim_generator_info;
  const manifestNode = findNodeByLabelPrefix(tree, "urn:c2pa:");
  const manifestHdr = manifestNode && manifestNode.children[0];
  const manifestLabel =
    manifestNode && manifestHdr && manifestHdr.desc
      ? manifestHdr.desc.label
      : "";
  report.claim.signatureUri = `self#jumbf=c2pa/${manifestLabel}/c2pa.signature`;

  // created_assertions: verify hashes over each assertion superbox.
  const assertionBoxesByLabel = {};
  for (const child of assertionsNode.children || []) {
    const hdr = child.children && child.children[0];
    if (hdr && hdr.desc) assertionBoxesByLabel[hdr.desc.label] = child;
  }
  let assertionsOk = true;
  const created = Array.isArray(claim.created_assertions)
    ? claim.created_assertions
    : [];
  for (const [i, entry] of created.entries()) {
    const url = entry.url;
    const assertedHash = Uint8Array.from(entry.hash || new Uint8Array(0));
    const label = String(url).split("/").pop();
    const box = assertionBoxesByLabel[label];
    let verified = false;
    if (box) {
      const h = await sha256(Uint8Array.from(box.boxBytes));
      verified = bytesEqual(h, assertedHash);
    }
    if (!verified) assertionsOk = false;
    report.claim.createdAssertions.push({
      url,
      hash: assertedHash,
      label,
      verified,
    });
  }

  // Recomputed data hash over the file excluding manifest ranges.
  const dataHashNode = findAssertionDataNode(assertionsNode);
  if (dataHashNode) {
    const dm = dataHashNode.map;
    const exclusions = (dm.exclusions || []).map((e) => ({
      start: e.start,
      length: e.length,
    }));
    report.dataHash.alg = dm.alg;
    report.dataHash.hash = Uint8Array.from(dm.hash || new Uint8Array(0));
    report.dataHash.exclusions = exclusions;
    try {
      const recomputed = await sha256Excluding(bytes, exclusions);
      report.dataHash.recomputedHash = recomputed;
      report.dataHash.match = bytesEqual(report.dataHash.hash, recomputed);
    } catch {
      report.dataHash.match = false;
    }
  }

  // COSE signature.
  const coseBytes = contentData(sigNode);
  if (coseBytes) {
    try {
      const cose = decodeCoseSign1(new Uint8Array(coseBytes));
      report.signature.cose = true;
      if (!cose.cert || cose.alg !== -8) {
        report.codes.push("algorithm.unsupported");
      } else {
        const expectedStruct = buildSigStructure(
          cose.protectedMapBytes,
          new Uint8Array(0),
          buildClaimPayloadBytes(claim),
        );
        const claimSig = Uint8Array.from(claim.signature || new Uint8Array(0));
        report.signature.claimMismatch = !bytesEqual(claimSig, expectedStruct);
        const { raw, key } = await importCertPublicKey(cose.cert);
        report.signingCredential.did = didKeyFromRaw(raw);
        report.signingCredential.algorithm = "Ed25519";
        report.signingCredential.selfSigned = true;
        report.signingCredential.untrusted = true;
        report.signature.verified = await crypto.subtle.verify(
          { name: "Ed25519" },
          key,
          cose.signatureBytes,
          expectedStruct,
        );
      }
    } catch (e) {
      console.error("COSE branch throw:", e && e.message);
      report.signature.cose = false;
      report.codes.push("signature.invalid");
    }

    if (report.signature.cose && report.signature.verified)
      report.codes.push("claimSignature.validated");
    else report.codes.push("signature.invalid");
    if (report.dataHash.match === false)
      report.codes.push("assertion.dataHash.mismatch");
    if (!assertionsOk)
      report.codes.push("assertion.createdAssertions.mismatch");
    if (report.signingCredential.algorithm)
      report.codes.push("signingCredential.untrusted");

    const checked =
      assertionsOk &&
      report.dataHash.match === true &&
      report.signature.cose &&
      report.signature.verified &&
      !report.signature.claimMismatch;
    report.valid = checked;
    report.state = checked ? "Valid" : "Invalid";
    return report;
  }
}

function findAssertionDataNode(assertionsNode) {
  for (const child of assertionsNode.children || []) {
    const hdr = child.children && child.children[0];
    if (!hdr || !hdr.desc || hdr.desc.label !== DATA_HASH_LABEL) continue;
    const data = contentData(child);
    if (!data) continue;
    try {
      return { map: cborDecode(new Uint8Array(data), 0).val };
    } catch {
      return null;
    }
  }
  return null;
}

if (typeof window !== "undefined") {
  window.VoiceProvenance = Object.assign(window.VoiceProvenance || {}, {
    embedAudio,
    verifyAudio,
    extractStore,
    locateManifest,
    locateManifestSync,
    detectAudioFormat,
    buildManifestStore,
    buildAssertionSuperBox,
    buildClaimBytes,
    buildOtsAssertionCbor,
    buildCoseSign1,
    decodeCoseSign1,
    buildSigStructure,
    buildX509Cert,
    parseJumbfStore,
    sha256Excluding,
    uuidV4,
    didKeyFromRaw,
    SHA256_ALG_ID,
    DATA_HASH_LABEL,
    OTS_LABEL,
    UUID_C2PA,
    UUID_C2MA,
    UUID_C2AS,
    UUID_C2CL,
    UUID_C2CS,
    UUID_CBOR,
  });
}
