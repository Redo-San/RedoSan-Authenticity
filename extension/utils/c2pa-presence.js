// Parse-only C2PA presence detection.
//
// v1 does not validate signatures: it answers "does this file carry a C2PA
// manifest store, and where". The container rules come from the C2PA
// Technical Specification (spec.c2pa.org):
//
//   PNG   -> an ancillary chunk of type "caBX"
//   JPEG  -> APP11 (0xFFEB) segments holding a JUMBF box labelled "c2pa"
//   WebP  -> a RIFF chunk of type "C2PA"
//
// HEIF/AVIF (uuid box) and SVG are out of scope for v1.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * @param {Uint8Array} data
 * @param {number} offset
 * @param {number} length
 * @returns {string} ASCII (best effort; non-ASCII bytes become "?")
 */
function ascii(data, offset, length) {
  let out = "";
  for (let i = 0; i < length; i++) {
    const byte = data[offset + i];
    out += byte === undefined ? "" : String.fromCharCode(byte);
  }
  return out;
}

/**
 * @param {Uint8Array} data
 * @param {number} offset
 * @param {number} end
 * @param {string} needle
 * @returns {number} index or -1
 */
function indexOfAscii(data, offset, end, needle) {
  const last = end - needle.length;
  for (let i = offset; i <= last; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (data[i + j] !== needle.charCodeAt(j)) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/**
 * @param {Uint8Array} data
 * @param {number} offset
 * @returns {number}
 */
function readUint32BE(data, offset) {
  return (
    ((data[offset] << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3]) >>>
    0
  );
}

/**
 * @param {Uint8Array} data
 * @param {number} offset
 * @returns {number}
 */
function readUint32LE(data, offset) {
  return (
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>>
    0
  );
}

/**
 * Walk PNG chunks. `caBX` is the spec type; `c2pa` is the non-standard chunk
 * name older RedoSan CLI builds wrote (kept detectable so those files report
 * honestly instead of silently showing "absent").
 * @param {Uint8Array} data
 * @returns {object|null}
 */
function scanPng(data) {
  if (data.length < 8 || !PNG_SIGNATURE.every((byte, i) => data[i] === byte)) {
    return null;
  }
  let offset = 8;
  while (offset + 12 <= data.length) {
    const length = readUint32BE(data, offset);
    const type = ascii(data, offset + 4, 4);
    const chunkEnd = offset + 12 + length;
    if (length > data.length || chunkEnd > data.length) break;
    if (type === "caBX") {
      return {
        present: true,
        format: "png",
        standard: true,
        chunk: type,
        offset,
        length: length + 12,
      };
    }
    if (type === "c2pa") {
      return {
        present: true,
        format: "png",
        standard: false,
        chunk: type,
        offset,
        length: length + 12,
      };
    }
    if (type === "IEND") break;
    offset = chunkEnd;
  }
  return null;
}

/**
 * Walk JPEG markers up to the first SOS. APP11 payloads that start with the
 * JUMBF identifier "JP" and contain the "c2pa" box label are manifest stores.
 * @param {Uint8Array} data
 * @returns {object|null}
 */
function scanJpeg(data) {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = data[offset + 1];
    if (marker === 0xff) {
      offset++;
      continue;
    }
    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) break; // start of scan: metadata is behind us
    const length = (data[offset + 2] << 8) | data[offset + 3];
    if (length < 2) break;
    const end = Math.min(data.length, offset + 2 + length);
    if (
      marker === 0xeb &&
      ascii(data, offset + 4, 2) === "JP" &&
      indexOfAscii(data, offset + 4, end, "c2pa") !== -1
    ) {
      return {
        present: true,
        format: "jpeg",
        standard: true,
        chunk: "APP11",
        offset,
        length,
      };
    }
    offset += 2 + length;
  }
  return null;
}

/**
 * Walk RIFF chunks for the WebP C2PA chunk.
 * @param {Uint8Array} data
 * @returns {object|null}
 */
function scanWebp(data) {
  if (
    data.length < 12 ||
    ascii(data, 0, 4) !== "RIFF" ||
    ascii(data, 8, 4) !== "WEBP"
  ) {
    return null;
  }
  let offset = 12;
  while (offset + 8 <= data.length) {
    const type = ascii(data, offset, 4);
    const length = readUint32LE(data, offset + 4);
    const end = offset + 8 + length;
    if (end > data.length) break;
    if (type === "C2PA") {
      return {
        present: true,
        format: "webp",
        standard: true,
        chunk: type,
        offset,
        length: length + 8,
      };
    }
    offset = end + (length % 2); // chunks are padded to an even size
  }
  return null;
}

/**
 * Detect a C2PA manifest store without validating it.
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {{present: boolean, format?: string, standard?: boolean, chunk?: string, offset?: number, length?: number}}
 */
export function detectC2pa(input) {
  const data =
    input instanceof Uint8Array
      ? input
      : input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : null;
  if (!data)
    throw new TypeError("detectC2pa: expected a Uint8Array or an ArrayBuffer");

  const found = scanPng(data) || scanJpeg(data) || scanWebp(data);
  return found || { present: false };
}
