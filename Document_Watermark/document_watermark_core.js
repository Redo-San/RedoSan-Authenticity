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

/**
 *
 * @param str
 */
function _utf8Encode(str) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
  /* c8 ignore start */
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var cp = str.charCodeAt(i);
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x8_00) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0xd8_00 || cp >= 0xe0_00)
      bytes.push(
        0xe0 | (cp >> 12),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    else if (cp >= 0xd8_00 && cp <= 0xdb_ff && i + 1 < str.length) {
      var cp2 = str.charCodeAt(i + 1);
      if (cp2 >= 0xdc_00 && cp2 <= 0xdf_ff) {
        var full = ((cp - 0xd8_00) << 10) + (cp2 - 0xdc_00) + 0x1_00_00;
        bytes.push(
          0xf0 | (full >> 18),
          0x80 | ((full >> 12) & 0x3f),
          0x80 | ((full >> 6) & 0x3f),
          0x80 | (full & 0x3f),
        );
        i++;
      }
    }
  }
  return new Uint8Array(bytes);
  /* c8 ignore stop */
}

/**
 *
 * @param bytes
 */
function _utf8Decode(bytes) {
  if (typeof TextDecoder !== "undefined")
    return new TextDecoder().decode(bytes);
  /* c8 ignore start */
  var str = "";
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (b < 0x80) str += String.fromCharCode(b);
    else if (b >= 0xc0 && b < 0xe0 && i + 1 < bytes.length)
      str += String.fromCharCode(((b & 0x1f) << 6) | (bytes[++i] & 0x3f));
    else if (b >= 0xe0 && b < 0xf0 && i + 2 < bytes.length)
      str += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f),
      );
    else if (b >= 0xf0 && i + 3 < bytes.length) {
      var cp =
        ((b & 0x07) << 18) |
        ((bytes[++i] & 0x3f) << 12) |
        ((bytes[++i] & 0x3f) << 6) |
        (bytes[++i] & 0x3f);
      str += String.fromCharCode(
        0xd8_00 + ((cp - 0x1_00_00) >> 10),
        0xdc_00 + ((cp - 0x1_00_00) & 0x3_ff),
      );
    }
  }
  return str;
  /* c8 ignore stop */
}

/**
 *
 * @param bytes
 */
async function _deflate(bytes) {
  if (typeof CompressionStream === "undefined")
    /* c8 ignore next */ throw new Error("CompressionStream not available");
  var cs = new CompressionStream("deflate");
  var writer = cs.writable.getWriter();
  var reader = cs.readable.getReader();
  var chunks = [];
  var readPromise = (async function () {
    while (true) {
      try {
        var v = await reader.read();
        if (v.done) break;
        chunks.push(v.value);
      } /* c8 ignore next */ catch {
        break;
      }
    }
  })();
  readPromise.catch(function () {});
  try {
    await writer.write(bytes);
    await writer.close();
  } /* c8 ignore next */ catch {
    /* suppress */
  }
  await readPromise;
  var total = 0;
  for (var i = 0; i < chunks.length; i++) total += chunks[i].length;
  var result = new Uint8Array(total);
  var offset = 0;
  for (var i2 = 0; i2 < chunks.length; i2++) {
    result.set(chunks[i2], offset);
    offset += chunks[i2].length;
  }
  return result;
}

/**
 *
 * @param bytes
 */
async function _inflate(bytes) {
  if (typeof DecompressionStream === "undefined")
    /* c8 ignore next */ throw new Error("DecompressionStream not available");
  var ds = new DecompressionStream("deflate");
  var writer = ds.writable.getWriter();
  var reader = ds.readable.getReader();
  var chunks = [];
  var readPromise = (async function () {
    while (true) {
      try {
        var v = await reader.read();
        if (v.done) break;
        chunks.push(v.value);
      } /* c8 ignore next */ catch {
        break;
      }
    }
  })();
  readPromise.catch(function () {});
  try {
    await writer.write(bytes);
    await writer.close();
  } /* c8 ignore next */ catch {
    /* write/close errors — suppress */
  }
  await readPromise;
  var total = 0;
  for (var i = 0; i < chunks.length; i++) total += chunks[i].length;
  var result = new Uint8Array(total);
  var offset = 0;
  for (var i2 = 0; i2 < chunks.length; i2++) {
    result.set(chunks[i2], offset);
    offset += chunks[i2].length;
  }
  return result;
}

/**
 *
 * @param message
 * @param password
 */
async function _msgToBits(message, password) {
  if (!message) return null;
  var data = password ? password + ":" + message : message;
  var bytes = _utf8Encode(data);
  var compressed;
  try {
    compressed = await _deflate(bytes);
  } /* c8 ignore start */ catch {
    compressed = null;
  } /* c8 ignore stop */
  var payload;
  if (compressed && compressed.length < bytes.length) {
    payload = new Uint8Array(1 + compressed.length);
    payload[0] = 0x02;
    payload.set(compressed, 1);
  } else {
    payload = bytes;
  }
  var bits = "";
  for (var i = 0; i < payload.length; i++) {
    var b = payload[i];
    for (var j = 7; j >= 0; j--) bits += (b >> j) & 1 ? "1" : "0";
  }
  return bits;
}

/**
 *
 * @param result
 * @param password
 */
function _checkPassword(result, password) {
  if (!password) return result;
  var colonIdx = result.indexOf(":");
  if (colonIdx > 0 && colonIdx <= 50) {
    if (result.indexOf(password + ":") === 0)
      return result.substr(password.length + 1);
    throw new Error("WRONG_PASSWORD");
  }
  return result;
}

/**
 *
 * @param bits
 * @param password
 */
async function _bitsToMsg(bits, password) {
  if (bits.length < 8) return "";
  var bytes = [];
  for (var i = 0; i + 7 < bits.length; i += 8) {
    var byteVal = 0;
    for (var j = 0; j < 8; j++)
      byteVal = (byteVal << 1) | (bits[i + j] === "1" ? 1 : 0);
    bytes.push(byteVal);
  }
  if (bytes.length > 0 && bytes[0] === 0x02) {
    var payloadBytes = new Uint8Array(bytes.slice(1));
    try {
      var decoded = await _inflate(payloadBytes);
      var end = decoded.length;
      for (var ti = decoded.length - 1; ti >= 0; ti--) {
        if (decoded[ti] !== 0) {
          end = ti + 1;
          break;
        }
      }
      decoded = decoded.slice(0, end);
      var result = _utf8Decode(decoded);
      return _checkPassword(result, password);
    } catch (error) {
      if (error.message === "WRONG_PASSWORD") throw error;
      /* c8 ignore start */
      return "";
    }
    /* c8 ignore stop */
  }
  var result = "";
  for (var k = 0; k < bytes.length; k++) {
    if (bytes[k] === 0) break;
    result += String.fromCharCode(bytes[k]);
  }
  return _checkPassword(result, password);
}

// ── Zero-Width Character (ZWC) Watermark ──
// UPGRADED: 16 ZWC variants (4 bits each), dynamic ZWCs per visible char.
// Capacity: up to 8 bytes per cover char (16 ZWCs × 4 bits)
var DOCW_ZWC = {
  CHARS: [
    "\u200B",
    "\u200C",
    "\u200D",
    "\uFEFF",
    "\u2060",
    "\u2061",
    "\u2062",
    "\u2063",
    "\u2064",
    "\u2066",
    "\u2067",
    "\u2068",
    "\u2069",
    "\u180E",
    "\u034F",
    "\u061C",
  ],
  BITS_PER_ZWC: 4,
  MAX_ZWCS_PER_CHAR: 16,

  embed: async function (text, message, password) {
    var bits = await _msgToBits(message, password);
    if (!bits) throw new Error("Empty message");
    if (!text) throw new Error("Cover text is required");
    var needed = Math.ceil(bits.length / this.BITS_PER_ZWC);
    var perChar = Math.ceil(needed / text.length);
    if (perChar > this.MAX_ZWCS_PER_CHAR) {
      throw new Error(
        "Cover text too short. Need ~" +
          needed / this.MAX_ZWCS_PER_CHAR +
          " chars, have " +
          text.length,
      );
    }
    var result = "";
    var bitIdx = 0;
    for (var i = 0; i < text.length; i++) {
      result += text[i];
      if (bitIdx < bits.length) {
        for (var z = 0; z < perChar && bitIdx < bits.length; z++) {
          var chunk = bits.substr(bitIdx, this.BITS_PER_ZWC);
          /* c8 ignore next */ while (chunk.length < this.BITS_PER_ZWC)
            chunk += "0";
          result += this.CHARS[parseInt(chunk, 2)];
          bitIdx += this.BITS_PER_ZWC;
        }
      }
    }
    return result;
  },

  extract: async function (text, password) {
    var extracted = "";
    for (var i = 0; i < text.length; i++) {
      var cc = text.charCodeAt(i);
      for (var j = 0; j < this.CHARS.length; j++) {
        if (cc === this.CHARS[j].charCodeAt(0)) {
          var b = j.toString(2);
          while (b.length < this.BITS_PER_ZWC) b = "0" + b;
          extracted += b;
          break;
        }
      }
    }
    return await _bitsToMsg(extracted, password);
  },
};

// ── Unicode Homoglyph Substitution Watermark ──
// UPGRADED: Multi-bit encoding for select letters with 3+ homoglyph variants.
// 2-bit for letters with 4+ variants, 1-bit for others.
// Expanded MAP to include digit homoglyphs and additional variants.
var DOCW_HOMOGLYPH = {
  MAP: {
    A: "\u0410",
    B: "\u0412",
    C: "\u0421",
    D: "\u13A0",
    E: "\u0415",
    F: "\uFF26",
    G: "\u050C",
    H: "\u041D",
    I: "\u0406",
    J: "\u0408",
    K: "\u041A",
    L: "\u13DE",
    M: "\u041C",
    N: "\uFF2E",
    O: "\u041E",
    P: "\u0420",
    Q: "\u051A",
    R: "\u042F",
    S: "\u0405",
    T: "\u0422",
    U: "\u0478",
    V: "\u0474",
    W: "\u051C",
    X: "\u0425",
    Y: "\u04AE",
    Z: "\u0396",
    a: "\u0430",
    b: "\u0180",
    c: "\u0441",
    d: "\u0501",
    e: "\u0435",
    f: "\u0192",
    g: "\u0261",
    h: "\u04BB",
    i: "\u0456",
    j: "\u0458",
    k: "\u0138",
    l: "\u026C",
    m: "\u043C",
    n: "\u03B7",
    o: "\u043E",
    p: "\u0440",
    q: "\u051B",
    r: "\u0433",
    s: "\u0455",
    t: "\u0442",
    u: "\u03BD",
    v: "\u0475",
    w: "\u051D",
    x: "\u0445",
    y: "\u0443",
    z: "\u03B6",
    // Digits (fullwidth)
    0: "\uFF10",
    1: "\uFF11",
    2: "\uFF12",
    3: "\uFF13",
    4: "\uFF14",
    5: "\uFF15",
    6: "\uFF16",
    7: "\uFF17",
    8: "\uFF18",
    9: "\uFF19",
    // Punctuation
    ".": "\u2024",
    ",": "\u104A",
    ":": "\u2236",
    ";": "\u037E",
    "-": "\u2010",
  },
  MULTI_MAP: {
    A: ["\u0410", "\u0391", "\u13AA"],
    C: ["\u0421", "\u03F9", "\u13DF"],
    E: ["\u0415", "\u0395", "\u04BA"],
    H: ["\u041D", "\u0397", "\u04A2"],
    K: ["\u041A", "\u039A", "\u13C6"],
    M: ["\u041C", "\u039C", "\u13F4"],
    O: ["\u041E", "\u039F", "\u047A"],
    P: ["\u0420", "\u03A1", "\u13E2"],
    T: ["\u0422", "\u03A4", "\u13BE"],
    X: ["\u0425", "\u03A7", "\u13B0"],
    // Upgraded uppercase
    R: ["\u042F", "\u13A1", "\u01A6"],
    S: ["\u0405", "\u135A", "\u10BD"],
    // Lowercase
    a: ["\u0430", "\u03B1", "\u04D1"],
    c: ["\u0441", "\u03F2", "\u04AB"],
    e: ["\u0435", "\u03B5", "\u04D9"],
    i: ["\u0456", "\u03B9", "\u04D7"],
    k: ["\u0138", "\u03BA", "\u049F"],
    m: ["\u043C", "\u03BC", "\u04CE"],
    n: ["\u03B7", "\u03AE", "\u04C9"],
    o: ["\u043E", "\u03BF", "\u04A8"],
    p: ["\u0440", "\u03C1", "\u04E7"],
    s: ["\u0455", "\u03C2", "\u04B1"],
    t: ["\u0442", "\u03C4", "\u04AD"],
    x: ["\u0445", "\u03C7", "\u04B3"],
    y: ["\u0443", "\u03B3", "\u04AF"],
    // Upgraded lowercase
    d: ["\u0501", "\u0503", "\u0257"],
    h: ["\u04BB", "\u0266", "\u0127"],
    r: ["\u0433", "\u0280", "\u027F"],
    u: ["\u03BD", "\u057D", "\u222A"],
  },
  REVERSE: null,
  MULTI_REV: null,

  _initReverse: function () {
    if (this.REVERSE) return;
    this.REVERSE = {};
    for (var k in this.MAP) this.REVERSE[this.MAP[k]] = k;
    this.MULTI_REV = {};
    for (var mk in this.MULTI_MAP) {
      this.MULTI_REV[mk] = { key: mk, idx: 0 };
      var arr = this.MULTI_MAP[mk];
      for (var vi = 0; vi < arr.length; vi++) {
        this.MULTI_REV[arr[vi]] = { key: mk, idx: vi + 1 };
      }
    }
  },

  _isEligible: function (ch) {
    return this.MAP[ch] !== undefined || this.MULTI_MAP[ch] !== undefined;
  },

  embed: async function (text, message, password) {
    var bits = await _msgToBits(message, password);
    if (!bits) throw new Error("Empty message");
    var eligible = [];
    for (var i = 0; i < text.length; i++) {
      if (this._isEligible(text[i])) eligible.push(i);
    }
    var maxBits = 0;
    for (var e = 0; e < eligible.length; e++) {
      maxBits += this.MULTI_MAP[text[eligible[e]]] ? 2 : 1;
    }
    if (bits.length > maxBits) {
      throw new Error(
        "Text too short. Need ~" +
          bits.length +
          " bits, eligible chars provide " +
          maxBits +
          " bits",
      );
    }
    var result = text.split("");
    var bitIdx = 0;
    for (var e2 = 0; e2 < eligible.length; e2++) {
      var idx = eligible[e2];
      var ch2 = text[idx];
      var multi = this.MULTI_MAP[ch2];
      if (multi) {
        var pair = bitIdx < bits.length ? bits.substr(bitIdx, 2) : "00";
        while (pair.length < 2) pair += "0";
        var val = parseInt(pair, 2);
        if (val > 0) result[idx] = multi[val - 1];
        bitIdx += 2;
      } else {
        if (bitIdx < bits.length && bits[bitIdx] === "1")
          result[idx] = this.MAP[ch2];
        bitIdx += 1;
      }
    }
    return result.join("");
  },

  extract: async function (text, password) {
    this._initReverse();
    var bits = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (this.MULTI_REV[ch] !== undefined) {
        var info = this.MULTI_REV[ch];
        var pair = info.idx.toString(2);
        while (pair.length < 2) pair = "0" + pair;
        bits += pair;
      } else if (this.MAP[ch] !== undefined) {
        bits += "0";
      } else if (this.REVERSE[ch] !== undefined) {
        bits += "1";
      }
    }
    return await _bitsToMsg(bits, password);
  },
};

// ── Whitespace Replacement Watermark ──
// UPGRADED: 16 space variants (4-bit each), uses the last space as implicit separator
// (no separate separator char needed → more capacity)
var DOCW_WHITESPACE = {
  SPACES: [
    "\u2002",
    "\u2003",
    "\u2004",
    "\u2005",
    "\u2006",
    "\u2008",
    "\u2009",
    "\u200A",
    "\u202F",
    "\u205F",
    "\u3000",
    "\u00A0",
    "\u2000",
    "\u2001",
    "\u2007",
    "\u2060",
  ],
  BITS_PER_SPACE: 4,

  embed: async function (text, message, password) {
    var bits = await _msgToBits(message, password);
    if (!bits) throw new Error("Empty message");

    var spaceCount = 0;
    for (var j = 0; j < text.length; j++) {
      if (text[j] === " ") spaceCount++;
    }
    var encodedCount = Math.ceil(bits.length / this.BITS_PER_SPACE);
    if (spaceCount < encodedCount) {
      throw new Error(
        "Not enough spaces. Need ~" + encodedCount + ", found " + spaceCount,
      );
    }

    var encoded = [];
    for (
      var i = 0;
      i + (this.BITS_PER_SPACE - 1) < bits.length;
      i += this.BITS_PER_SPACE
    ) {
      var quad = bits.substr(i, this.BITS_PER_SPACE);
      /* c8 ignore next */ while (quad.length < this.BITS_PER_SPACE)
        quad += "0";
      encoded.push(this.SPACES[parseInt(quad, 2)]);
    }
    var rem = bits.length % this.BITS_PER_SPACE;
    /* c8 ignore start */
    if (rem > 0) {
      var last = bits.substr(bits.length - rem, rem);
      while (last.length < this.BITS_PER_SPACE) last += "0";
      encoded.push(this.SPACES[parseInt(last, 2)]);
    }
    /* c8 ignore stop */

    var result = "";
    var encIdx = 0;
    for (var k = 0; k < text.length; k++) {
      if (text[k] === " ") {
        if (encIdx < encoded.length) {
          result += encoded[encIdx];
          encIdx++;
        } else {
          result += " ";
        }
      } else {
        result += text[k];
      }
    }
    return result;
  },

  extract: async function (text, password) {
    var found = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var idx = this.SPACES.indexOf(ch);
      if (idx >= 0) found.push(idx);
    }
    if (found.length === 0) return "";
    var bits = "";
    for (var j = 0; j < found.length; j++) {
      var b = found[j].toString(2);
      while (b.length < this.BITS_PER_SPACE) b = "0" + b;
      bits += b;
    }
    return await _bitsToMsg(bits, password);
  },
};

// ── Module dispatcher ──
var DOCW_ALGOS = {
  1: { name: "Zero-Width Characters", impl: DOCW_ZWC },
  2: { name: "Unicode Homoglyphs", impl: DOCW_HOMOGLYPH },
  3: { name: "Whitespace Replacement", impl: DOCW_WHITESPACE },
};

/**
 *
 * @param text
 * @param message
 * @param algoId
 * @param password
 */
async function docwEmbed(text, message, algoId, password) {
  var algo = DOCW_ALGOS[String(algoId)];
  if (!algo) throw new Error("Unknown algorithm: " + algoId);
  return await algo.impl.embed(text, message, password || "");
}

/**
 *
 * @param text
 * @param algoId
 * @param password
 */
async function docwExtract(text, algoId, password) {
  var algo = DOCW_ALGOS[String(algoId)];
  if (!algo) throw new Error("Unknown algorithm: " + algoId);
  return await algo.impl.extract(text, password || "");
}

/**
 *
 * @param msg
 */
function _isGarbageResult(msg) {
  if (!msg || msg.length < 2) return true;
  if (msg.length < 4) return false;
  var unique = 0,
    seen = {};
  for (var i = 0; i < msg.length && i < 50; i++) {
    if (!seen[msg[i]]) {
      seen[msg[i]] = true;
      unique++;
    }
  }
  return unique < 2;
}

/**
 *
 * @param text
 * @param password
 */
async function docwAutoDetect(text, password) {
  var pwError = false;
  var candidates = [];
  for (var id in DOCW_ALGOS) {
    try {
      var result = await DOCW_ALGOS[id].impl.extract(text, password || "");
      if (result) {
        if (!_isGarbageResult(result))
          return { algo: id, name: DOCW_ALGOS[id].name, message: result };
        candidates.push({
          algo: id,
          name: DOCW_ALGOS[id].name,
          message: result,
        });
      }
    } catch (error) {
      if (error.message === "WRONG_PASSWORD") pwError = true;
    }
  }
  if (candidates.length > 0) {
    candidates.sort(function (a, b) {
      return b.message.length - a.message.length;
    });
    return candidates[0];
  }
  if (pwError) throw new Error("WRONG_PASSWORD");
  return null;
}

/**
 *
 * @param text
 * @param algoId
 */
function docwEstimateCapacity(text, algoId) {
  if (!text) return 0;
  var algo = DOCW_ALGOS[String(algoId)];
  if (!algo) return 0;
  var impl = algo.impl;
  if (impl === DOCW_ZWC)
    return Math.floor(
      (text.length * impl.MAX_ZWCS_PER_CHAR * impl.BITS_PER_ZWC) / 8,
    );
  if (impl === DOCW_HOMOGLYPH) {
    DOCW_HOMOGLYPH._initReverse();
    var count1 = 0,
      count2 = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (DOCW_HOMOGLYPH.MULTI_MAP[ch] !== undefined) count2++;
      else if (DOCW_HOMOGLYPH.MAP[ch] !== undefined) count1++;
    }
    return Math.floor((count1 + count2 * 2) / 8);
  }
  if (impl === DOCW_WHITESPACE) {
    var sc = 0;
    for (var j = 0; j < text.length; j++) {
      if (text[j] === " ") sc++;
    }
    return Math.floor((sc * impl.BITS_PER_SPACE) / 8);
  }
  /* c8 ignore next */
  return 0;
}
