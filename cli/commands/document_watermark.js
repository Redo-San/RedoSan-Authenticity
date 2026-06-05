// ── Document Watermark CLI ──
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { readDocumentText, writeFileText } = require("../utils");

function compressData(data) {
  var encoded = Buffer.from(data, "utf8");
  var compressed = zlib.deflateSync(encoded);
  if (compressed.length < encoded.length) {
    var payload = Buffer.alloc(1 + compressed.length);
    payload[0] = 0x02;
    compressed.copy(payload, 1);
    return payload;
  }
  return encoded;
}

function decompressData(buf) {
  if (buf.length < 1) return "";
  if (buf[0] === 0x02) {
    try {
      var decompressed = zlib.inflateSync(buf.slice(1));
      var end = decompressed.length;
      for (var ti = decompressed.length - 1; ti >= 0; ti--) { if (decompressed[ti] !== 0) { end = ti + 1; break; } }
      return decompressed.slice(0, end).toString("utf8");
    } catch (e) {
      // Browser may compress with raw deflate (RFC 1951, no zlib wrapper)
      try {
        var decompressed2 = zlib.inflateRawSync(buf.slice(1));
        var end2 = decompressed2.length;
        for (var ti2 = decompressed2.length - 1; ti2 >= 0; ti2--) { if (decompressed2[ti2] !== 0) { end2 = ti2 + 1; break; } }
        return decompressed2.slice(0, end2).toString("utf8");
      } catch(e2) {
        throw e; // throw original error
      }
    }
  }
  var end2 = buf.length;
  for (var ti2 = 0; ti2 < buf.length; ti2++) { if (buf[ti2] === 0) { end2 = ti2; break; } }
  return buf.slice(0, end2).toString("utf8");
}

function embed(text, message, algo, password) {
  var data = password ? password + ":" + message : message;
  var compressed = compressData(data);
  var bits = msgToBitsRaw(compressed);
  if (!bits) throw new Error("Empty message");

  switch (String(algo)) {
    case "1": return embedZwc(text, bits);
    case "2": return embedHomoglyph(text, bits);
    case "3": return embedWhitespace(text, bits);
    default: throw new Error("Unknown algorithm: " + algo);
  }
}

function extract(text, algo, password) {
  var bits;
  switch (String(algo)) {
    case "0": return autoDetect(text, password);
    case "1": bits = extractZwc(text); break;
    case "2": bits = extractHomoglyph(text); break;
    case "3": bits = extractWhitespace(text); break;
    default: throw new Error("Unknown algorithm: " + algo);
  }
  return bitsToMsg(bits, password);
}

function autoDetect(text, password) {
  var pwError = false;
  for (var a = 1; a <= 3; a++) {
    try {
      var result = extract(text, String(a), password);
      if (result) return result;
    } catch (e) {
      if (e.message === "WRONG_PASSWORD") pwError = true;
    }
  }
  if (pwError) throw new Error("WRONG_PASSWORD");
  return null;
}

// ── Zero-Width Characters (UPGRADED) ──
// 16 ZWC variants (4 bits each), dynamic ZWCs per visible char.
// Capacity: up to 8 bytes per cover char
var ZWC_CHARS = ["\u200B", "\u200C", "\u200D", "\uFEFF",
                 "\u2060", "\u2061", "\u2062", "\u2063",
                 "\u2064", "\u2066", "\u2067", "\u2068",
                 "\u2069", "\u180E", "\u034F", "\u061C"];
var ZWC_BITS_PER_ZWC = 4;
var ZWC_MAX_ZWCS_PER_CHAR = 16;

function embedZwc(text, bits) {
  var needed = Math.ceil(bits.length / ZWC_BITS_PER_ZWC);
  var perChar = Math.ceil(needed / text.length);
  if (perChar > ZWC_MAX_ZWCS_PER_CHAR) {
    throw new Error("Cover text too short. Need ~" + Math.ceil(needed / ZWC_MAX_ZWCS_PER_CHAR) + " chars, have " + text.length);
  }
  var result = "";
  var bitIdx = 0;
  for (var i = 0; i < text.length; i++) {
    result += text[i];
    if (bitIdx < bits.length) {
      for (var z = 0; z < perChar && bitIdx < bits.length; z++) {
        var chunk = bits.substr(bitIdx, ZWC_BITS_PER_ZWC);
        while (chunk.length < ZWC_BITS_PER_ZWC) chunk += "0";
        result += ZWC_CHARS[parseInt(chunk, 2)];
        bitIdx += ZWC_BITS_PER_ZWC;
      }
    }
  }
  return result;
}

function extractZwc(text) {
  var bits = "";
  for (var i = 0; i < text.length; i++) {
    for (var j = 0; j < ZWC_CHARS.length; j++) {
      if (text[i] === ZWC_CHARS[j]) {
        var b = j.toString(2);
        while (b.length < ZWC_BITS_PER_ZWC) b = "0" + b;
        bits += b;
        break;
      }
    }
  }
  return bits;
}

// ── Homoglyph (UPGRADED) ──
// Multi-bit for select letters with 3+ homoglyph variants (2-bit).
var HOMO_MAP = {
  "A": "\u0410", "B": "\u0412", "C": "\u0421", "D": "\u13A0",
  "E": "\u0415", "F": "\u13DF", "G": "\u050C", "H": "\u041D",
  "I": "\u0406", "J": "\u0408", "K": "\u041A", "L": "\u13DE",
  "M": "\u041C", "N": "\u0397", "O": "\u041E", "P": "\u0420",
  "Q": "\u051A", "R": "\u042F", "S": "\u0405", "T": "\u0422",
  "U": "\u0478", "V": "\u0474", "W": "\u051C", "X": "\u0425",
  "Y": "\u04AE", "Z": "\u0396",
  "a": "\u0430", "b": "\u0180", "c": "\u0441", "d": "\u0501",
  "e": "\u0435", "f": "\u0192", "g": "\u0261", "h": "\u04BB",
  "i": "\u0456", "j": "\u0458", "k": "\u0138", "l": "\u026C",
  "m": "\u043C", "n": "\u03B7", "o": "\u043E", "p": "\u0440",
  "q": "\u051B", "r": "\u0433", "s": "\u0455", "t": "\u0442",
  "u": "\u03BD", "v": "\u0475", "w": "\u051D", "x": "\u0445",
  "y": "\u0443", "z": "\u03B6"
};
var HOMO_REV = {};
for (var k in HOMO_MAP) HOMO_REV[HOMO_MAP[k]] = k;

// 2-bit homoglyphs: 3+ variants per char
var HOMO_MULTI = {
  "A": ["\u0410", "\u0391", "\u13AA"],
  "C": ["\u0421", "\u03F9", "\u13DF"],
  "E": ["\u0415", "\u0395", "\u04BA"],
  "H": ["\u041D", "\u0397", "\u04A2"],
  "K": ["\u041A", "\u039A", "\u13C6"],
  "M": ["\u041C", "\u039C", "\u13F4"],
  "O": ["\u041E", "\u039F", "\u047A"],
  "P": ["\u0420", "\u03A1", "\u13E2"],
  "T": ["\u0422", "\u03A4", "\u13BE"],
  "X": ["\u0425", "\u03A7", "\u13B0"],
  "a": ["\u0430", "\u03B1", "\u04D1"],
  "c": ["\u0441", "\u03F2", "\u04AB"],
  "e": ["\u0435", "\u03B5", "\u04D9"],
  "i": ["\u0456", "\u03B9", "\u04D7"],
  "k": ["\u0138", "\u03BA", "\u049F"],
  "m": ["\u043C", "\u03BC", "\u04CE"],
  "n": ["\u03B7", "\u03AE", "\u04C9"],
  "o": ["\u043E", "\u03BF", "\u04A8"],
  "p": ["\u0440", "\u03C1", "\u04E7"],
  "s": ["\u0455", "\u03C2", "\u04B1"],
  "t": ["\u0442", "\u03C4", "\u04AD"],
  "x": ["\u0445", "\u03C7", "\u04B3"],
  "y": ["\u0443", "\u03B3", "\u04AF"]
};
var HOMO_MULTI_REV = {};
for (var mk in HOMO_MULTI) {
  HOMO_MULTI_REV[mk] = { key: mk, idx: 0 };
  var arr = HOMO_MULTI[mk];
  for (var vi = 0; vi < arr.length; vi++) {
    HOMO_MULTI_REV[arr[vi]] = { key: mk, idx: vi + 1 };
  }
}

function isEligible(ch) {
  return HOMO_MAP[ch] !== undefined || HOMO_MULTI[ch] !== undefined;
}

function embedHomoglyph(text, bits) {
  var eligible = [];
  for (var i = 0; i < text.length; i++) {
    if (isEligible(text[i])) eligible.push(i);
  }
  var maxBits = 0;
  for (var e = 0; e < eligible.length; e++) {
    maxBits += HOMO_MULTI[text[eligible[e]]] ? 2 : 1;
  }
  if (bits.length > maxBits) {
    throw new Error("Text too short. Need ~" + bits.length + " bits, eligible chars provide " + maxBits + " bits");
  }
  var result = text.split("");
  var bitIdx = 0;
  for (var e2 = 0; e2 < eligible.length; e2++) {
    var idx = eligible[e2];
    var ch = text[idx];
    var multi = HOMO_MULTI[ch];
    if (multi) {
      var pair = bitIdx < bits.length ? bits.substr(bitIdx, 2) : "00";
      while (pair.length < 2) pair += "0";
      var val = parseInt(pair, 2);
      if (val > 0) result[idx] = multi[val - 1];
      bitIdx += 2;
    } else {
      if (bitIdx < bits.length && bits[bitIdx] === "1") result[idx] = HOMO_MAP[ch];
      bitIdx += 1;
    }
  }
  return result.join("");
}

function extractHomoglyph(text) {
  var bits = "";
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (HOMO_MULTI_REV[ch] !== undefined) {
      var info = HOMO_MULTI_REV[ch];
      var pair = info.idx.toString(2);
      while (pair.length < 2) pair = "0" + pair;
      bits += pair;
    } else if (HOMO_MAP[ch] !== undefined) {
      bits += "0";
    } else if (HOMO_REV[ch] !== undefined) {
      bits += "1";
    }
  }
  return bits;
}

// ── Whitespace Replacement (UPGRADED) ──
// 16 space variants, no separator char needed (uses last space implicitly)
var WS_SPACES = ["\u2002", "\u2003", "\u2004", "\u2005",
                 "\u2006", "\u2008", "\u2009", "\u200A",
                 "\u202F", "\u205F", "\u3000", "\u00A0",
                 "\u2000", "\u2001", "\u2007", "\u2060"];
var WS_BITS_PER_SPACE = 4;

function embedWhitespace(text, bits) {
  var spaceCount = 0;
  for (var j = 0; j < text.length; j++) {
    if (text[j] === " ") spaceCount++;
  }
  var encodedCount = Math.ceil(bits.length / WS_BITS_PER_SPACE);
  if (spaceCount < encodedCount) {
    throw new Error("Not enough spaces. Need ~" + encodedCount + ", found " + spaceCount);
  }

  var encoded = [];
  for (var i = 0; i + (WS_BITS_PER_SPACE - 1) < bits.length; i += WS_BITS_PER_SPACE) {
    var quad = bits.substr(i, WS_BITS_PER_SPACE);
    while (quad.length < WS_BITS_PER_SPACE) quad += "0";
    encoded.push(WS_SPACES[parseInt(quad, 2)]);
  }
  var rem = bits.length % WS_BITS_PER_SPACE;
  if (rem > 0) {
    var last = bits.substr(bits.length - rem, rem);
    while (last.length < WS_BITS_PER_SPACE) last += "0";
    encoded.push(WS_SPACES[parseInt(last, 2)]);
  }

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
}

function extractWhitespace(text) {
  var found = [];
  for (var i = 0; i < text.length; i++) {
    var idx = WS_SPACES.indexOf(text[i]);
    if (idx >= 0) found.push(idx);
  }
  if (found.length === 0) return "";
  var bits = "";
  for (var j = 0; j < found.length; j++) {
    var b = found[j].toString(2);
    while (b.length < WS_BITS_PER_SPACE) b = "0" + b;
    bits += b;
  }
  return bits;
}

// ── Bit/Message helpers ──
function msgToBitsRaw(buf) {
  if (!buf || buf.length === 0) return null;
  var bits = "";
  for (var i = 0; i < buf.length; i++) {
    var b = buf[i];
    for (var j = 7; j >= 0; j--) bits += (b >> j) & 1 ? "1" : "0";
  }
  return bits;
}

function bitsToBytes(bits) {
  if (bits.length < 8) return Buffer.alloc(0);
  var bytes = [];
  for (var i = 0; i + 7 < bits.length; i += 8) {
    var byteVal = 0;
    for (var j = 0; j < 8; j++) byteVal = (byteVal << 1) | (bits[i + j] === "1" ? 1 : 0);
    bytes.push(byteVal);
  }
  return Buffer.from(bytes);
}

function checkPassword(result, password) {
  if (!password) return result;
  var colonIdx = result.indexOf(":");
  if (colonIdx > 0 && colonIdx <= 50) {
    if (result.indexOf(password + ":") === 0) return result.substr(password.length + 1);
    throw new Error("WRONG_PASSWORD");
  }
  return result;
}

function bitsToMsg(bits, password) {
  if (bits.length < 8) return "";
  var buf = bitsToBytes(bits);
  if (buf.length > 0 && buf[0] === 0x02) {
    try {
      var result = decompressData(buf);
      return checkPassword(result, password);
    } catch (e) {
      if (e.message === "WRONG_PASSWORD") throw e;
      return "";
    }
  }
  var result = "";
  for (var k = 0; k < buf.length; k++) {
    if (buf[k] === 0) break;
    result += String.fromCharCode(buf[k]);
  }
  return checkPassword(result, password);
}

// ── CLI entry ──
async function runDocumentWatermark(action, opts) {
  var inputPath = path.resolve(opts.input);
  var text = await readDocumentText(inputPath);
  var message = "";

  if (action === "embed") {
    if (opts.secret) {
      var secretPath = path.resolve(opts.secret);
      message = await readDocumentText(secretPath);
    } else if (opts.message) {
      message = opts.message;
    } else {
      console.error("Error: --secret or --message required for embed");
      process.exit(1);
    }

    var watermarked = embed(text, message, opts.algo || "1", opts.password || "");
    var outPath = opts.output ? path.resolve(opts.output) : inputPath + ".watermarked.txt";
    writeFileText(outPath, watermarked);
    console.log("Watermarked text saved to: " + outPath);
  } else {
    var result = opts.algo === "0"
      ? extract(text, "0", opts.password || "")
      : extract(text, opts.algo || "1", opts.password || "");
    if (result) {
      if (opts.output) {
        writeFileText(path.resolve(opts.output), result);
        console.log("Extracted message saved to: " + path.resolve(opts.output));
      } else {
        console.log("\nExtracted message:\n" + result);
      }
    } else {
      console.log("No watermark found.");
    }
  }
}

module.exports = { runDocumentWatermark };
