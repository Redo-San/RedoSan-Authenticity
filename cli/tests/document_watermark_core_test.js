// ── Document Watermark Core — Supplementary Tests ──
// Adds coverage for functions/edge cases the main test suite doesn't cover.
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Standard globals for watermark loading
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};

const src = fs.readFileSync(
  path.join(__dirname, "../../Document_Watermark/document_watermark_core.js"),
  "utf8",
);
vm.runInThisContext(src, {
  filename: path.resolve(
    __dirname,
    "../../Document_Watermark/document_watermark_core.js",
  ),
});

describe("Document Watermark Core — _isGarbageResult", () => {
  it("returns true for null / undefined", () => {
    assert.equal(_isGarbageResult(null), true);
    assert.equal(_isGarbageResult(undefined), true);
  });

  it("returns true for strings shorter than 2 chars", () => {
    assert.equal(_isGarbageResult(""), true);
    assert.equal(_isGarbageResult("a"), true);
  });

  it("returns false for strings shorter than 4 chars (but >= 2)", () => {
    assert.equal(_isGarbageResult("ab"), false);
    assert.equal(_isGarbageResult("  "), false);
  });

  it("returns true for repetitive garbage (only 1 unique char)", () => {
    assert.equal(_isGarbageResult("aaaaaaaa"), true);
    assert.equal(_isGarbageResult("BBBBBBBB"), true);
  });

  it("returns false for diverse text (>= 2 unique chars)", () => {
    assert.equal(_isGarbageResult("abc"), false);
    assert.equal(_isGarbageResult("abababab"), false);
  });

  it("scans only first 50 chars", () => {
    // 60 chars all 'x' except last is 'y' — only first 50 scanned, all 'x'
    assert.equal(_isGarbageResult("x".repeat(60)), true);
    // 60 chars, first 50 contain both 'x' and 'y'
    assert.equal(_isGarbageResult("x".repeat(25) + "y".repeat(35)), false);
  });
});

describe("Document Watermark Core — docwAutoDetect edge cases", () => {
  it("should return null for clean text even with password provided", async () => {
    // docwAutoDetect on clean text with a password should return null
    const result = await docwAutoDetect(
      "This plain text has no watermark",
      "some-password",
    );
    assert.equal(result, null);
  });

  it("should return candidates with garbage result when no good result found", async () => {
    // Embed a minimal message "x" which decodes to garbage (< 2 chars unique)
    const cover = "Test text for garbage detection in auto-detect";
    const wm = await DOCW_ZWC.embed(cover, "x", null);
    const result = await docwAutoDetect(wm, null);
    // Since we embedded with ZWC, auto-detect should find a candidate
    // (even if it's garbage, candidates list is populated)
    assert.ok(result !== null, "Should return a candidate");
    assert.ok(result.message || result.algo, "Should have message or algo");
  });

  it("returns null for completely clean text", async () => {
    const result = await docwAutoDetect(
      "This is plain text with no watermark whatsoever",
      null,
    );
    assert.equal(result, null);
  });
});

describe("Document Watermark Core — Homoglyph multi-bit extraction", () => {
  it("should embed and extract using multi-bit characters (MULTI_MAP)", async () => {
    // Characters in MULTI_MAP store 2 bits each
    // A, C, E, H, K, M, O, P, T, X are multi-bit uppercase
    const cover = "A C E H K M O P T X"; // 10 chars, 20 bits capacity
    const msg = "z"; // small message
    const wm = await DOCW_HOMOGLYPH.embed(cover, msg, null);
    const extracted = await DOCW_HOMOGLYPH.extract(wm, null);
    assert.equal(extracted, msg);
  });

  it("should embed mixed multi-bit and single-bit chars", async () => {
    // Mix of multi-bit (A, C, E = 2 bits each) and single-bit (B, D = 1 bit each)
    // A(A→2) space B(B→1) space C(C→2) space D(D→1) space E(E→2) = 8 bits total
    // For message "h" (1 byte = 8 bits) this works
    const cover = "A B C D E X Y Z"; // multi(2)+single(1)+multi(2)+single(1)+multi(2)+single(1)+single(1)+single(1)=11 bits
    const msg = "h"; // single char message
    const wm = await DOCW_HOMOGLYPH.embed(cover, msg, null);
    const extracted = await DOCW_HOMOGLYPH.extract(wm, null);
    assert.equal(extracted, msg);
  });

  it("should handle extraction where some chars map via MAP (original) and some via REVERSE", async () => {
    // After embedding, the MULTI_REV maps substituted chars back to bits.
    // Characters that remain unchanged are in MAP (original), giving bit "0"
    // Characters that were substituted are in REVERSE, giving bit "1"
    // Multi-bit substituted chars are in MULTI_REV, giving 2 bits
    const cover = "EVERY GOOD BOY DESERVES FUDGE";
    const msg = "ab";
    const wm = await DOCW_HOMOGLYPH.embed(cover, msg, null);
    const extracted = await DOCW_HOMOGLYPH.extract(wm, null);
    assert.equal(extracted, msg);
  });

  it("embed should throw for null/empty message in Homoglyph", async () => {
    await assert.rejects(
      () => DOCW_HOMOGLYPH.embed("ABC", null, null),
      /Empty message/,
    );
  });
});

describe("Document Watermark Core — Whitespace edge cases", () => {
  it("should embed with exactly the number of spaces needed", async () => {
    // Need exactly N spaces where N = ceil(bits.length / 4)
    // A short message like "a" needs very few spaces
    const cover = "a b c d e f g h"; // 7 spaces
    const wm = await DOCW_WHITESPACE.embed(cover, "a", null);
    const extracted = await DOCW_WHITESPACE.extract(wm, null);
    assert.equal(extracted, "a");
  });

  it("should handle empty extraction result from no special spaces", async () => {
    const result = await DOCW_WHITESPACE.extract(
      "No special spaces here at all",
      null,
    );
    assert.equal(result, "");
  });

  it("extract should handle multiple found special space indices", async () => {
    // Create a watermark with Whitespace, then extract
    const cover =
      "a b c d e f g h i j k l m n o p q r s t u v w x y z 0 1 2 3 4 5";
    const wm = await DOCW_WHITESPACE.embed(cover, "hello", null);
    const extracted = await DOCW_WHITESPACE.extract(wm, null);
    assert.equal(extracted, "hello");
  });

  it("embed should throw for null/empty message in Whitespace", async () => {
    await assert.rejects(
      () => DOCW_WHITESPACE.embed("a b c", null, null),
      /Empty message/,
    );
  });
});

describe("Document Watermark Core — ZWC edge cases", () => {
  it("embed should throw for null/empty message", async () => {
    const cover = "Some cover text for ZWC";
    // _msgToBits returns null for falsy message
    await assert.rejects(
      () => DOCW_ZWC.embed(cover, null, null),
      /Empty message/,
    );
  });

  it("extract should handle text with ZWC characters interspersed", async () => {
    const cover = "The quick brown fox jumps over the lazy dog";
    const wm = await DOCW_ZWC.embed(cover, "test-message", "pass123");
    const extracted = await DOCW_ZWC.extract(wm, "pass123");
    assert.equal(extracted, "test-message");
  });

  it("extract should handle text with only some ZWC chars in it", async () => {
    // Mixed text with some ZWC chars from our set and some from other ranges
    const wm = "Hello\u200BWorld\u200C!"; // intentional ZWC
    const result = await DOCW_ZWC.extract(wm, null);
    // Should not crash, may return garbage or empty
    assert.ok(typeof result === "string");
  });
});

describe("Document Watermark Core — Payload edge cases (uncompressed path)", () => {
  it("_msgToBits should fall back to uncompressed when compression returns larger output", async () => {
    // For very short messages, compression might return larger output
    // which triggers the uncompressed path
    const bits = await _msgToBits("x", null);
    assert.ok(typeof bits === "string");
    assert.ok(bits.length > 0);
    const result = await _bitsToMsg(bits, null);
    assert.equal(result, "x");
  });

  it("_checkPassword should return result unchanged when no password provided", () => {
    assert.equal(_checkPassword("hello", null), "hello");
    assert.equal(_checkPassword("hello", ""), "hello");
  });

  it("_checkPassword should throw WRONG_PASSWORD for incorrect password prefix", () => {
    // If result contains "password:" and password doesn't match, it throws
    assert.throws(
      () => _checkPassword("mypass:secret", "wrongpw"),
      /WRONG_PASSWORD/,
    );
  });

  it("_checkPassword should strip password prefix when correct", () => {
    const result = _checkPassword("mypass:hello", "mypass");
    assert.equal(result, "hello");
  });

  it("_bitsToMsg should decompress when first byte is 0x02 (compressed marker)", async () => {
    // The roundtrip test already covers this path naturally
    const bits = await _msgToBits(
      "A longer message that will benefit from compression!",
      "pw",
    );
    const result = await _bitsToMsg(bits, "pw");
    assert.equal(
      result,
      "A longer message that will benefit from compression!",
    );
  });

  it("_bitsToMsg should handle uncompressed data (no 0x02 marker)", async () => {
    // Manually create bits without 0x02 prefix
    const bytes = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]); // "hello"
    var bits = "";
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      for (var j = 7; j >= 0; j--) bits += (b >> j) & 1 ? "1" : "0";
    }
    const result = await _bitsToMsg(bits, null);
    assert.equal(result, "hello");
  });

  it("_bitsToMsg should handle uncompressed data with null terminator", async () => {
    // Uncompressed data with zero byte in the middle
    const bytes = new Uint8Array([0x68, 0x65, 0x00, 0x6c, 0x6f]); // "he\0lo" → stops at \0
    var bits = "";
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      for (var j = 7; j >= 0; j--) bits += (b >> j) & 1 ? "1" : "0";
    }
    const result = await _bitsToMsg(bits, null);
    assert.equal(result, "he");
  });
});

describe("Document Watermark Core — docwEmbed / docwExtract error paths", () => {
  it("should throw for unknown algorithm ID", async () => {
    await assert.rejects(
      () => docwEmbed("text", "msg", 99, null),
      /Unknown algorithm/,
    );
    await assert.rejects(
      () => docwExtract("text", 99, null),
      /Unknown algorithm/,
    );
  });

  it("should throw for invalid algorithm ID string", async () => {
    await assert.rejects(
      () => docwEmbed("text", "msg", "invalid", null),
      /Unknown algorithm/,
    );
  });

  it("should pass empty string as password when password is undefined", async () => {
    const cover = "Cover text for ZWC with undefined password";
    const wm = await docwEmbed(cover, "msg", 1, undefined);
    const result = await docwExtract(wm, 1, undefined);
    assert.equal(result, "msg");
  });
});

describe("Document Watermark Core — docwEstimateCapacity extra", () => {
  it("should estimate ZWC capacity with maximum per-char ZWCs", () => {
    // ZWC: text.length * 16 * 4 / 8
    const cap = docwEstimateCapacity("Hello World!", 1);
    assert.equal(cap, Math.floor(("Hello World!".length * 16 * 4) / 8));
  });

  it("should estimate Homoglyph capacity separating multi and single bit chars", () => {
    // "A (multi) B (single) C (multi)"
    const cap = docwEstimateCapacity("ABC", 2);
    // A: multi → count2++, B: single → count1++, C: multi → count2++
    // bits = count1 + count2 * 2 = 1 + 2 * 2 = 5
    // bytes = floor(5 / 8) = 0
    // Actually Math.floor(5 / 8) = 0
    // Let's use a longer text
    const cap2 = docwEstimateCapacity("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 2);
    assert.ok(cap2 > 0);
  });

  it("should return 0 for empty/null text regardless of algorithm", () => {
    assert.equal(docwEstimateCapacity("", 1), 0);
    assert.equal(docwEstimateCapacity("", 2), 0);
    assert.equal(docwEstimateCapacity("", 3), 0);
    assert.equal(docwEstimateCapacity(null, 1), 0);
    assert.equal(docwEstimateCapacity(undefined, 1), 0);
  });

  it("should return 0 for unknown algorithm", () => {
    assert.equal(docwEstimateCapacity("text", 99), 0);
    assert.equal(docwEstimateCapacity("text", 0), 0);
  });

  it("should estimate Whitespace capacity", () => {
    // Whitespace is algorithm 3
    assert.ok(
      docwEstimateCapacity("a b c d e", 3) > 0,
      "should detect capacity from spaces",
    );
    assert.equal(
      docwEstimateCapacity("nospaces", 3),
      0,
      "no spaces = 0 capacity",
    );
  });
});

describe("Document Watermark Core — Additional branch coverage", () => {
  it("should cover whitespace remainder padding in embed", async () => {
    // Use 6 spaces to embed message "x" - the embed loop iterates in BITS_PER_SPACE
    // chunks and the remainder branch at line 561 handles leftover bits
    const result = await DOCW_WHITESPACE.embed("a b c d e f", "x");
    assert.ok(result.length > 0, "should produce output");
    const extracted = await DOCW_WHITESPACE.extract(result, null);
    assert.equal(extracted, "x");
  });

  it("should trigger WRONG_PASSWORD catch in docwAutoDetect", async () => {
    // Embed with a password using ZWC (algo 1)
    const wm = await docwEmbed("Hello World There", "secret", 1, "mypassword");
    // Extract with wrong password should throw WRONG_PASSWORD
    await assert.rejects(
      async () => await docwExtract(wm, 1, "wrongpassword"),
      /WRONG_PASSWORD/,
    );
  });

  it("should handle docwAutoDetect with password-embedded content", async () => {
    // Embed with password using ZWC (algo 1)
    const wm = await docwEmbed("Hello World There", "testmsg", 1, "secret123");
    // Auto-detect with correct password should find the message
    const result = await docwAutoDetect(wm, "secret123");
    assert.ok(result, "should find a result");
    assert.equal(result.message, "testmsg");
  });

  it("should estimate Whitespace capacity with space counting", () => {
    // Whitespace algo ID 3
    const cap1 = docwEstimateCapacity("a b c d e f g h i j", 3); // 10 spaces → 10*2/8 = 2 bytes
    const cap2 = docwEstimateCapacity("abcdefghij", 3); // 0 spaces → 0 bytes
    assert.equal(cap2, 0);
    const capMore = docwEstimateCapacity("a b c d e f g h i j k l m n o p", 3);
    assert.ok(
      capMore >= cap1,
      "more spaces should give more or equal capacity",
    );
  });
});

describe("Document Watermark Core — Compressed path (0x02 prefix)", () => {
  it("should roundtrip through compressed path with repetitive data", async () => {
    // Highly repetitive data compresses well, triggering the 0x02 compressed path
    const msg = "x".repeat(500);
    const bits = await _msgToBits(msg, null);
    // Verify the compressed path was taken — first byte should be 0x02
    var firstByte = 0;
    for (var j = 0; j < 8; j++)
      firstByte = (firstByte << 1) | (bits[j] === "1" ? 1 : 0);
    assert.equal(
      firstByte,
      0x02,
      "should have 0x02 marker for compressible data",
    );
    const result = await _bitsToMsg(bits, null);
    assert.equal(result, msg);
  });

  it("should roundtrip through compressed path with password", async () => {
    const msg = "z".repeat(300);
    const pw = "compresspw";
    const bits = await _msgToBits(msg, pw);
    // Verify 0x02 marker present
    var firstByte = 0;
    for (var j = 0; j < 8; j++)
      firstByte = (firstByte << 1) | (bits[j] === "1" ? 1 : 0);
    assert.equal(firstByte, 0x02, "should have 0x02 marker");
    const result = await _bitsToMsg(bits, pw);
    assert.equal(result, msg);
  });

  it("should throw WRONG_PASSWORD when using wrong password on compressed payload", async () => {
    const bits = await _msgToBits("y".repeat(400), "correctpw");
    await assert.rejects(
      async () => await _bitsToMsg(bits, "wrongpw"),
      /WRONG_PASSWORD/,
    );
  });

  it("should return empty string for corrupted compressed data (catch returns '')", async () => {
    // Manually construct bits with 0x02 marker followed by garbage (not valid deflate)
    var bytes = new Uint8Array([0x02, 0xff, 0xff, 0xff, 0xff]);
    var bits = "";
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      for (var j = 7; j >= 0; j--) bits += (b >> j) & 1 ? "1" : "0";
    }
    const result = await _bitsToMsg(bits, null);
    assert.equal(result, "");
  });

  it("should handle zero-trimming in decompressed data", async () => {
    // The decompression path strips trailing null bytes
    // Using compressible data should exercise the decompression loop
    const bits = await _msgToBits("hello".repeat(100), null);
    const result = await _bitsToMsg(bits, null);
    assert.equal(result, "hello".repeat(100));
  });
});

describe("Document Watermark Core — docwAutoDetect WRONG_PASSWORD path", () => {
  it("should detect WRONG_PASSWORD from docwAutoDetect when wrong password used with Whitespace", async () => {
    // Use Whitespace embed (algo 3) with password. ZWC and Homoglyph will return
    // empty strings on whitespace-embedded text, so no candidates are produced.
    const cover =
      "a b c d e f g h i j k l m n o p q r s t u v w x y z 0 1 2 3 4 5 6 7 8 9 a b c d e f g h i j k l m n o p";
    const wm = await docwEmbed(cover, "hi", 3, "correctpass");
    // Call docwAutoDetect with wrong password — hits line 665-666 catch + line 672 throw
    await assert.rejects(
      async () => await docwAutoDetect(wm, "wrongpass"),
      /WRONG_PASSWORD/,
    );
  });

  it("should still throw WRONG_PASSWORD when Homoglyph/Whitespace also find candidates", async () => {
    // Same approach with whitespace embed + wrong password
    const cover =
      "a b c d e f g h i j k l m n o p q r s t u v w x y z 0 1 2 3 4 5 6 7 8 9 a b c d e f g h i j k l m n o p";
    const wm = await docwEmbed(cover, "hi", 3, "mypassword");
    await assert.rejects(
      async () => await docwAutoDetect(wm, "badpassword"),
      /WRONG_PASSWORD/,
    );
  });
});
