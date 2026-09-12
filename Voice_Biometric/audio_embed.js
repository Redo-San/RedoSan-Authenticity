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

const enc = new TextEncoder();
const dec = new TextDecoder();

export const C2PA_CHUNK_ID = "C2PA";
export const GEOB_MIME_TYPE = "application/c2pa";
export const GEOB_MIME_DEPRECATED = "application/x-c2pa-manifest-store";
export const GEOB_FILE_NAME = "c2pa";
export const GEOB_DESCRIPTION = "c2pa manifest store";
export const GEOB_PREFIX_LEN = 43;

export function concatBytes(...arrays) {
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

export function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function u32be(n) {
  return new Uint8Array([
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ]);
}

export function u32le(n) {
  return new Uint8Array([
    n & 0xff,
    (n >>> 8) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 24) & 0xff,
  ]);
}

export function syncsafe(n) {
  return new Uint8Array([
    (n >>> 21) & 0x7f,
    (n >>> 14) & 0x7f,
    (n >>> 7) & 0x7f,
    n & 0x7f,
  ]);
}

export function readU32le(bytes, off) {
  return (
    bytes[off] |
    (bytes[off + 1] << 8) |
    (bytes[off + 2] << 16) |
    (bytes[off + 3] << 24)
  );
}

export function readU32be(bytes, off) {
  return (
    ((bytes[off] << 24) |
      (bytes[off + 1] << 16) |
      (bytes[off + 2] << 8) |
      bytes[off + 3]) >>>
    0
  );
}

export function readSyncsafe(bytes, off) {
  return (
    ((bytes[off] & 0x7f) << 21) |
    ((bytes[off + 1] & 0x7f) << 14) |
    ((bytes[off + 2] & 0x7f) << 7) |
    (bytes[off + 3] & 0x7f)
  );
}

export function ascii(bytes, off, len) {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[off + i]);
  return s;
}

export function startsWithAscii(bytes, off, str) {
  if (off + str.length > bytes.length) return false;
  for (let i = 0; i < str.length; i++) {
    if (bytes[off + i] !== str.charCodeAt(i)) return false;
  }
  return true;
}

export function detectAudioFormat(bytes) {
  if (startsWithAscii(bytes, 0, "RIFF") || startsWithAscii(bytes, 0, "RIFX")) {
    const bigEndian = startsWithAscii(bytes, 0, "RIFX");
    if (bytes.length >= 12 && startsWithAscii(bytes, 8, "WAVE"))
      return bigEndian ? "RIFX" : "WAV";
    return bigEndian ? "RIFX" : "RIFF";
  }
  if (startsWithAscii(bytes, 0, "ID3")) {
    const header = parseId3Header(bytes);
    if (header) return sniffPayloadFormat(bytes, header.payloadEnd);
    return "ID3";
  }
  return sniffPayloadFormat(bytes, 0);
}

function sniffPayloadFormat(bytes, off) {
  for (let depth = 0; depth < 8; depth++) {
    if (startsWithAscii(bytes, off, "fLaC")) return "FLAC";
    if (
      off < bytes.length &&
      bytes[off] === 0xff &&
      (bytes[off + 1] & 0xe0) === 0xe0
    )
      return "MP3";
    if (!startsWithAscii(bytes, off, "ID3")) return "UNKNOWN";
    const tag = parseId3Header(bytes, off);
    if (!tag || tag.payloadEnd > bytes.length) return "UNKNOWN";
    off = tag.payloadEnd;
  }
  return "UNKNOWN";
}

export function parseRiff(bytes) {
  const id = startsWithAscii(bytes, 0, "RIFF")
    ? "RIFF"
    : startsWithAscii(bytes, 0, "RIFX")
      ? "RIFX"
      : null;
  if (!id) return null;
  const bigEndian = id === "RIFX";
  const formType = ascii(bytes, 8, Math.min(4, bytes.length - 8));
  const chunks = [];
  const readSize = bigEndian ? readU32be : readU32le;
  let off = 12;
  while (off + 8 <= bytes.length) {
    const size = readSize(bytes, off + 4);
    const dataOffset = off + 8;
    if (size === 0) break;
    if (dataOffset + size > bytes.length) break;
    chunks.push({
      id: ascii(bytes, off, 4),
      offset: off,
      dataOffset,
      size,
      pad: size & 1,
      dataBytes: bytes.slice(dataOffset, dataOffset + size),
      total: 8 + size + (size & 1),
    });
    off += 8 + size + (size & 1);
  }
  return {
    id,
    bigEndian,
    formType,
    chunks,
    readSize,
    writeSize: bigEndian ? u32be : u32le,
  };
}

export function riffGetManifestLocation(bytes) {
  const riff = parseRiff(bytes);
  if (!riff) return null;
  const fmt =
    riff.formType === "WAVE" ? (riff.bigEndian ? "RIFX" : "WAV") : "RIFF";
  const chunk = riff.chunks.find((c) => c.id === C2PA_CHUNK_ID);
  if (!chunk) {
    return { format: fmt, found: false, bigEndian: riff.bigEndian };
  }
  return {
    format: fmt,
    found: true,
    bigEndian: riff.bigEndian,
    chunkIdOffset: chunk.offset,
    storeOffset: chunk.dataOffset,
    storeLength: chunk.size,
    exclusionStart: chunk.offset,
    exclusionLength: chunk.size + 8,
  };
}

export function riffRemove(bytes) {
  const riff = parseRiff(bytes);
  if (!riff) throw new Error("Not a RIFF file");
  const others = riff.chunks.filter((c) => c.id !== C2PA_CHUNK_ID);
  const removed = others.length !== riff.chunks.length;
  if (!removed)
    return {
      output: bytes,
      removed: false,
      storeOffset: null,
      storeLength: null,
    };
  return {
    output: buildRiff(riff, others),
    removed: true,
    storeOffset: null,
    storeLength: null,
  };
}

function buildRiff(riff, chunks) {
  let data = new Uint8Array(0);
  for (const c of chunks) {
    data = concatBytes(data, enc.encode(c.id), riff.writeSize(c.size));
    if (c.dataBytes) data = concatBytes(data, c.dataBytes);
    if (c.pad) data = concatBytes(data, new Uint8Array(1));
  }
  const sizeField = 4 + data.length;
  return concatBytes(
    enc.encode(riff.id),
    riff.writeSize(sizeField),
    enc.encode(riff.formType.slice(0, 4)),
    data,
  );
}

export function riffEmbed(bytes, store) {
  const riff = parseRiff(bytes);
  if (!riff) throw new Error("Not a RIFF file");
  const others = riff.chunks.filter((c) => c.id !== C2PA_CHUNK_ID);
  const c2pa = {
    id: C2PA_CHUNK_ID,
    size: store.length,
    pad: store.length & 1,
    dataBytes: store,
  };
  const exclusionStart = 12 + chunkBytesLength(others);
  const exclusionLength = 8 + store.length;
  const storeOffset = exclusionStart + 8;
  const output = buildRiff(riff, others.concat([c2pa]));
  return {
    output,
    storeOffset,
    storeLength: store.length,
    exclusionStart,
    exclusionLength,
  };
}

function chunkBytesLength(chunks) {
  let n = 0;
  for (const c of chunks) n += 8 + c.size + (c.size & 1);
  return n;
}

function parseId3Header(bytes, start = 0) {
  if (!startsWithAscii(bytes, start, "ID3")) return null;
  const major = bytes[start + 3];
  if (major < 2 || major > 4) return null;
  const tagSize = readSyncsafe(bytes, start + 6);
  const payloadStart = start + 10;
  const payloadEnd = payloadStart + tagSize;
  if (payloadEnd > bytes.length) return null;
  return {
    major,
    revision: bytes[start + 4],
    flags: bytes[start + 5],
    tagSize,
    payloadStart,
    payloadEnd,
  };
}

function parseId3Frames(bytes, tag) {
  const frames = [];
  let off = tag.payloadStart;
  const isV22 = tag.major === 2;
  while (off + (isV22 ? 6 : 10) <= tag.payloadEnd) {
    if (bytes[off] === 0) break;
    const id = ascii(bytes, off, isV22 ? 3 : 4);
    if (isV22) {
      const size =
        ((bytes[off + 3] & 0x7f) << 14) |
        ((bytes[off + 4] & 0x7f) << 7) |
        (bytes[off + 5] & 0x7f);
      const dataOffset = off + 6;
      if (dataOffset + size > tag.payloadEnd) break;
      frames.push({ id, offset: off, dataOffset, size, total: 6 + size });
      off += 6 + size;
    } else {
      const size =
        tag.major === 4
          ? readU32be(bytes, off + 4)
          : readSyncsafe(bytes, off + 4);
      const dataOffset = off + 10;
      if (dataOffset + size > tag.payloadEnd) break;
      frames.push({ id, offset: off, dataOffset, size, total: 10 + size });
      off += 10 + size;
    }
  }
  return frames;
}

function findNul(bytes, off, end) {
  for (let i = off; i < end; i++) if (bytes[i] === 0) return i;
  return -1;
}

function parseGeobPrefix(data) {
  if (data.length < 4) return null;
  let p = 1;
  let mimeEnd = findNul(data, p, data.length);
  if (mimeEnd < 0) return null;
  const mime = dec.decode(data.subarray(p, mimeEnd));
  p = mimeEnd + 1;
  let fnameEnd = findNul(data, p, data.length);
  if (fnameEnd < 0) return null;
  const filename = dec.decode(data.subarray(p, fnameEnd));
  p = fnameEnd + 1;
  let descEnd = findNul(data, p, data.length);
  if (descEnd < 0) return null;
  const description = dec.decode(data.subarray(p, descEnd));
  return { mime, filename, description, prefixLen: descEnd + 1 };
}

export function id3GetManifestLocation(bytes) {
  const header = parseId3Header(bytes);
  if (!header) return null;
  const frames = parseId3Frames(bytes, header);
  const format = sniffPayloadFormat(bytes, header.payloadEnd);
  const geoId = header.major === 2 ? "GEO" : "GEOB";
  for (const f of frames) {
    if (f.id !== geoId) continue;
    const prefix = parseGeobPrefix(
      bytes.subarray(f.dataOffset, f.dataOffset + f.size),
    );
    if (!prefix) continue;
    if (
      (prefix.mime === GEOB_MIME_TYPE ||
        prefix.mime === GEOB_MIME_DEPRECATED) &&
      prefix.filename === GEOB_FILE_NAME
    ) {
      const storeOffset = f.dataOffset + prefix.prefixLen;
      const storeLength = f.size - prefix.prefixLen;
      return {
        format,
        found: true,
        major: header.major,
        frameOffset: f.offset,
        storeOffset,
        storeLength,
        exclusionStart: storeOffset,
        exclusionLength: storeLength,
        header,
        frames,
      };
    }
  }
  return { format, found: false, major: header.major, header, frames };
}

export function id3Remove(bytes) {
  const loc = id3GetManifestLocation(bytes);
  if (!loc) throw new Error("Not an ID3 file");
  if (!loc.found)
    return {
      output: bytes,
      removed: false,
      storeOffset: null,
      storeLength: null,
    };
  return rebuildId3(bytes, loc, null);
}

function rebuildId3(bytes, loc, store) {
  const header = loc.header;
  if (header.major < 3) {
    throw new Error(
      "ID3v2.2 tags are not supported for C2PA embed/remove (v2.3/v2.4 required)",
    );
  }
  const keep = [];
  for (const f of loc.frames) {
    if (f.id === "GEOB") {
      const prefix = parseGeobPrefix(
        bytes.subarray(f.dataOffset, f.dataOffset + f.size),
      );
      if (
        prefix &&
        (prefix.mime === GEOB_MIME_TYPE ||
          prefix.mime === GEOB_MIME_DEPRECATED) &&
        prefix.filename === GEOB_FILE_NAME
      )
        continue;
    }
    keep.push({
      id: f.id,
      data: bytes.subarray(f.dataOffset, f.dataOffset + f.size),
    });
  }
  if (store === null) {
    if (keep.length === 0) {
      return {
        output: bytes.subarray(header.payloadEnd),
        removed: true,
        storeOffset: null,
        storeLength: null,
        exclusionStart: null,
        exclusionLength: null,
      };
    }
    const tag = buildId3Tag(keep, null);
    return {
      output: concatBytes(tag.bytes, bytes.subarray(header.payloadEnd)),
      removed: true,
      storeOffset: null,
      storeLength: null,
      exclusionStart: null,
      exclusionLength: null,
    };
  }
  const tag = buildId3Tag(keep, store);
  return {
    output: concatBytes(tag.bytes, bytes.subarray(header.payloadEnd)),
    storeOffset: tag.storeOffset,
    storeLength: store.length,
    exclusionStart: tag.storeOffset,
    exclusionLength: store.length,
  };
}

function buildId3Tag(preserved, store) {
  const frameParts = [];
  let storeOffset = 10;
  for (const f of preserved) {
    frameParts.push(
      concatBytes(
        enc.encode(f.id),
        u32be(f.data.length),
        new Uint8Array([0, 0]),
        f.data,
      ),
    );
    storeOffset += 10 + f.data.length;
  }
  if (store) {
    const geobData = concatBytes(
      new Uint8Array([0]),
      enc.encode(GEOB_MIME_TYPE),
      new Uint8Array([0]),
      enc.encode(GEOB_FILE_NAME),
      new Uint8Array([0]),
      enc.encode(GEOB_DESCRIPTION),
      new Uint8Array([0]),
      store,
    );
    const geobHeader = concatBytes(
      enc.encode("GEOB"),
      u32be(geobData.length),
      new Uint8Array([0, 0]),
    );
    storeOffset += geobHeader.length + GEOB_PREFIX_LEN;
    frameParts.push(concatBytes(geobHeader, geobData));
  }
  const frameBytes = concatBytes(...frameParts);
  const tagSize = frameBytes.length;
  const tagHeader = concatBytes(
    enc.encode("ID3"),
    new Uint8Array([4, 0, 0]),
    syncsafe(tagSize),
  );
  return { bytes: concatBytes(tagHeader, frameBytes), storeOffset };
}

export function id3Embed(bytes, store) {
  const loc = id3GetManifestLocation(bytes);
  if (loc && loc.found) {
    const r = rebuildId3(bytes, loc, store);
    return { format: loc.format, ...r };
  }
  const format = detectAudioFormat(bytes);
  const tag = buildId3Tag([], store);
  return {
    format,
    output: concatBytes(tag.bytes, bytes),
    storeOffset: tag.storeOffset,
    storeLength: store.length,
    exclusionStart: tag.storeOffset,
    exclusionLength: store.length,
  };
}
