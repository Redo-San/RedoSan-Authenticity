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

import { concatBytes } from "./audio_embed.js";
import {
  encodeArray,
  encodeBstr,
  encodeInt,
  encodeMap,
  encodeTstr,
} from "../C2PA/cbor.js";

async function sha256(bytes) {
  const out = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(out);
}

export function validateExclusions(exclusions) {
  for (const ex of exclusions) {
    if (
      !Number.isInteger(ex.start) ||
      !Number.isInteger(ex.length) ||
      ex.start < 0 ||
      ex.length < 0
    )
      throw new Error("Invalid exclusion range");
  }
  const sorted = exclusions
    .slice()
    .sort((a, b) => a.start - b.start || a.length - b.length);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    if (sorted[i].start < prev.start + prev.length)
      throw new Error("Overlapping exclusion ranges");
  }
}

export async function sha256Excluding(bytes, exclusions) {
  validateExclusions(exclusions);
  const ranges = [];
  let cursor = 0;
  for (const ex of exclusions) {
    const end = ex.start + ex.length;
    if (cursor < ex.start) ranges.push(bytes.subarray(cursor, ex.start));
    cursor = Math.max(cursor, end);
  }
  if (cursor < bytes.length) ranges.push(bytes.subarray(cursor));
  return sha256(concatBytes(...ranges));
}

function exclusionListEnc(exclusions) {
  return encodeArray(
    exclusions.map((ex) =>
      encodeMap([
        [encodeTstr("start"), encodeInt(ex.start)],
        [encodeTstr("length"), encodeInt(ex.length)],
      ]),
    ),
  );
}

function dataHashMapEntries(algEnc, padEnc, hashEnc, exclusionsEnc) {
  const entries = [
    [encodeTstr("alg"), algEnc],
    [encodeTstr("pad"), padEnc],
    [encodeTstr("hash"), hashEnc],
    [encodeTstr("exclusions"), exclusionsEnc],
  ];
  entries.sort((a, b) => compareBytes(a[0], b[0]));
  return entries;
}

export async function buildDataHashMap(bytes, exclusions, algId, padBytes) {
  validateExclusions(exclusions);
  const algEnc = encodeInt(algId);
  const padEnc = encodeBstr(padBytes || new Uint8Array(0));
  const hash = await sha256Excluding(bytes, exclusions);
  const map = encodeMap(
    dataHashMapEntries(
      algEnc,
      padEnc,
      encodeBstr(hash),
      exclusionListEnc(exclusions),
    ),
  );
  return { hash, map };
}

export function buildDataHashMapDeterministic(
  algId,
  padBytes,
  hashBytes,
  exclusions,
) {
  const map = encodeMap(
    dataHashMapEntries(
      encodeInt(algId),
      encodeBstr(padBytes || new Uint8Array(0)),
      encodeBstr(hashBytes),
      exclusionListEnc(exclusions || []),
    ),
  );
  return map;
}

export function compareBytes(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}
