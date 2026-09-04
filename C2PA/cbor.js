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
// Minimal CBOR encoder/decoder for COSE Sign1 construction
/**
 *
 * @param n
 */
export function encodeInt(n) {
  if (n >= 0) {
    if (n <= 23) return new Uint8Array([0x00 + n]);
    if (n <= 0xff) return new Uint8Array([0x18, n]);
    if (n <= 0xff_ff) return new Uint8Array([0x19, n >> 8, n & 0xff]);
    return new Uint8Array([
      0x1a,
      n >> 24,
      (n >> 16) & 0xff,
      (n >> 8) & 0xff,
      n & 0xff,
    ]);
  }
  // negative: CBOR stores -1 - n
  const v = -1 - n;
  if (v <= 23) return new Uint8Array([0x20 + v]);
  if (v <= 0xff) return new Uint8Array([0x38, v]);
  return new Uint8Array([0x39, v >> 8, v & 0xff]);
}

/**
 *
 * @param bytes
 */
export function encodeBstr(bytes) {
  const len = bytes.length;
  let prefix;
  if (len <= 23) prefix = new Uint8Array([0x40 + len]);
  else if (len <= 0xff) prefix = new Uint8Array([0x58, len]);
  else if (len <= 0xff_ff)
    prefix = new Uint8Array([0x59, len >> 8, len & 0xff]);
  else
    prefix = new Uint8Array([
      0x5a,
      len >> 24,
      (len >> 16) & 0xff,
      (len >> 8) & 0xff,
      len & 0xff,
    ]);
  return concat(prefix, new Uint8Array(bytes));
}

/**
 *
 * @param str
 */
export function encodeTstr(str) {
  const enc = new TextEncoder().encode(str);
  const len = enc.length;
  let prefix;
  if (len <= 23) prefix = new Uint8Array([0x60 + len]);
  else if (len <= 0xff) prefix = new Uint8Array([0x78, len]);
  else if (len <= 0xff_ff)
    prefix = new Uint8Array([0x79, len >> 8, len & 0xff]);
  else
    prefix = new Uint8Array([
      0x7a,
      len >> 24,
      (len >> 16) & 0xff,
      (len >> 8) & 0xff,
      len & 0xff,
    ]);
  return concat(prefix, enc);
}

/**
 *
 * @param items
 */
export function encodeArray(items) {
  const n = items.length;
  let header;
  if (n <= 23) header = new Uint8Array([0x80 + n]);
  else if (n <= 0xff) header = new Uint8Array([0x98, n]);
  else if (n <= 0xff_ff) header = new Uint8Array([0x99, n >> 8, n & 0xff]);
  else
    header = new Uint8Array([
      0x9a,
      n >> 24,
      (n >> 16) & 0xff,
      (n >> 8) & 0xff,
      n & 0xff,
    ]);
  const parts = [header, ...items];
  return concatAll(parts);
}

/**
 *
 * @param entries
 */
export function encodeMap(entries) {
  // entries: [[key, value], ...] where key is integer (auto-encoded) or Uint8Array (pre-encoded)
  const n = entries.length;
  let header;
  if (n <= 23) header = new Uint8Array([0xa0 + n]);
  else if (n <= 0xff) header = new Uint8Array([0xb8, n]);
  else
    header = new Uint8Array([
      0xba,
      n >> 24,
      (n >> 16) & 0xff,
      (n >> 8) & 0xff,
      n & 0xff,
    ]);
  const parts = [header];
  for (const [k, v] of entries) {
    parts.push(typeof k === "number" ? encodeInt(k) : k);
    parts.push(v);
  }
  return concatAll(parts);
}

/**
 *
 * @param tagNum
 * @param inner
 */
export function encodeTag(tagNum, inner) {
  let tag;
  if (tagNum <= 23) tag = new Uint8Array([0xc0 + tagNum]);
  else if (tagNum <= 0xff) tag = new Uint8Array([0xd8, tagNum]);
  else if (tagNum <= 0xff_ff)
    tag = new Uint8Array([0xd9, tagNum >> 8, tagNum & 0xff]);
  else
    tag = new Uint8Array([
      0xda,
      tagNum >> 24,
      (tagNum >> 16) & 0xff,
      (tagNum >> 8) & 0xff,
      tagNum & 0xff,
    ]);
  return concat(tag, new Uint8Array(inner));
}

/**
 *
 * @param a
 * @param b
 */
export function concat(a, b) {
  const r = new Uint8Array(a.length + b.length);
  r.set(a, 0);
  r.set(b, a.length);
  return r;
}

/**
 *
 * @param arrays
 */
function concatAll(arrays) {
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

// Minimal CBOR decoder
/**
 *
 * @param data
 * @param offset
 */
export function decode(data, offset) {
  if (offset >= data.length) throw new Error("CBOR: unexpected end");
  const first = data[offset];
  const major = first >> 5;
  const info = first & 0x1f;
  let val,
    off = offset + 1;

  if (info < 24) val = info;
  else
    switch (info) {
      case 24: {
        val = data[off];
        off += 1;
        break;
      }
      case 25: {
        val = (data[off] << 8) | data[off + 1];
        off += 2;
        break;
      }
      case 26: {
        val =
          (data[off] << 24) |
          (data[off + 1] << 16) |
          (data[off + 2] << 8) |
          data[off + 3];
        off += 4;
        break;
      }
      default: {
        throw new Error(`CBOR: unsupported additional info ${info}`);
      }
    }

  switch (major) {
    case 0: {
      return { val, off };
    } // unsigned int
    case 1: {
      return { val: -1 - val, off };
    } // negative int
    case 2: {
      // byte string
      const b = data.slice(off, off + val);
      return { val: b, off: off + val };
    }
    case 3: {
      // text string
      const b = data.slice(off, off + val);
      return { val: new TextDecoder().decode(b), off: off + val };
    }
    case 4: {
      // array
      const items = [];
      let o = off;
      for (let i = 0; i < val; i++) {
        const r = decode(data, o);
        items.push(r.val);
        o = r.off;
      }
      return { val: items, off: o };
    }
    case 5: {
      // map
      const m = {};
      let o = off;
      for (let i = 0; i < val; i++) {
        const kr = decode(data, o);
        const vr = decode(data, kr.off);
        m[kr.val] = vr.val;
        o = vr.off;
      }
      return { val: m, off: o };
    }
    case 6: {
      // tag
      const r = decode(data, off);
      return { val: [val, r.val], off: r.off };
    }
    default: {
      throw new Error(`CBOR: unsupported major type ${major}`);
    }
  }
}
