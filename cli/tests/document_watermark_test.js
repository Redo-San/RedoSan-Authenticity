const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

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

const PWD = "secret";
const MSG = "hello-docwm";

describe("Document Watermark — UTF-8 helpers", () => {
  it("_utf8Encode / _utf8Decode roundtrip", () => {
    const str = "Hello  عربى 日本語 🎉";
    const enc = _utf8Encode(str);
    assert.ok(enc instanceof Uint8Array);
    const dec = _utf8Decode(enc);
    assert.equal(dec, str);
  });

  it("_utf8Encode handles empty string", () => {
    const enc = _utf8Encode("");
    assert.equal(enc.length, 0);
  });
});

describe("Document Watermark — Payload (msgToBits / bitsToMsg)", () => {
  it("should roundtrip without password", async () => {
    const bits = await _msgToBits(MSG, null);
    assert.ok(typeof bits === "string");
    assert.ok(bits.length > 0);
    const result = await _bitsToMsg(bits, null);
    assert.equal(result, MSG);
  });

  it("should roundtrip with password", async () => {
    const bits = await _msgToBits(MSG, PWD);
    const result = await _bitsToMsg(bits, PWD);
    assert.equal(result, MSG);
  });

  it("should throw WRONG_PASSWORD for incorrect password", async () => {
    const bits = await _msgToBits(MSG, PWD);
    await assert.rejects(async () => {
      await _bitsToMsg(bits, "wrong");
    }, /WRONG_PASSWORD/);
  });

  it("_msgToBits returns null for empty message", async () => {
    const result = await _msgToBits(null, null);
    assert.equal(result, null);
  });

  it("_bitsToMsg returns empty for short bits", async () => {
    const result = await _bitsToMsg("", null);
    assert.equal(result, "");
  });
});

describe("Document Watermark — Algorithm 1: Zero-Width Characters (ZWC)", () => {
  it("should embed and extract a message", async () => {
    const cover = "The quick brown fox jumps over the lazy dog";
    const wm = await DOCW_ZWC.embed(cover, MSG, PWD);
    assert.ok(typeof wm === "string");
    assert.notEqual(wm, cover); // ZWC chars added
    const extracted = await DOCW_ZWC.extract(wm, PWD);
    assert.equal(extracted, MSG);
  });

  it("should throw for empty cover text", async () => {
    await assert.rejects(
      () => DOCW_ZWC.embed("", MSG, PWD),
      /Cover text is required/,
    );
  });

  it("should throw for cover text too short", async () => {
    await assert.rejects(
      () =>
        DOCW_ZWC.embed("A", "this-message-is-way-too-long-for-one-char", PWD),
      /Cover text too short/,
    );
  });

  it("extract returns empty string for clean text", async () => {
    const result = await DOCW_ZWC.extract("Just normal text", PWD);
    assert.equal(result, "");
  });
});

describe("Document Watermark — Algorithm 2: Homoglyph Substitution", () => {
  it("should embed and extract a short message", async () => {
    // Homoglyph stores 1-2 bits per eligible char. Each eligible uppercase letter provides 2 bits.
    // For a tiny payload (~16 bits raw), we need ~8 eligible chars.
    const cover = "A CAP ON A MAP AT AXIS X";
    const wm = await DOCW_HOMOGLYPH.embed(cover, "a", null);
    assert.ok(typeof wm === "string");
    const extracted = await DOCW_HOMOGLYPH.extract(wm, null);
    assert.equal(extracted, "a");
  });

  it("should throw for text without eligible characters", async () => {
    await assert.rejects(
      () => DOCW_HOMOGLYPH.embed("\u0100\u0102", MSG, PWD), // ĀĂ not in maps
      /Text too short/,
    );
  });

  it("_isEligible should detect eligible characters", () => {
    DOCW_HOMOGLYPH._initReverse();
    assert.ok(DOCW_HOMOGLYPH._isEligible("A"));
    assert.ok(DOCW_HOMOGLYPH._isEligible("a"));
    assert.ok(!DOCW_HOMOGLYPH._isEligible("\u0100")); // Ā - not in any map
  });

  it("_initReverse should populate reverse maps", () => {
    DOCW_HOMOGLYPH._initReverse();
    assert.ok(DOCW_HOMOGLYPH.REVERSE !== null);
    assert.ok(DOCW_HOMOGLYPH.MULTI_REV !== null);
    assert.equal(DOCW_HOMOGLYPH.REVERSE["\u0410"], "A"); // Cyrillic A maps back
  });
});

describe("Document Watermark — Algorithm 3: Whitespace Replacement", () => {
  it("should embed and extract a short message", async () => {
    // Need ~36 spaces for a short message (4 bits per space)
    const cover =
      "a b c d e f g h i j k l m n o p q r s t u v w x y z 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5";
    const wm = await DOCW_WHITESPACE.embed(cover, "hi", PWD);
    assert.ok(typeof wm === "string");
    const extracted = await DOCW_WHITESPACE.extract(wm, PWD);
    assert.equal(extracted, "hi");
  });

  it("should throw for text without enough spaces", async () => {
    await assert.rejects(
      () => DOCW_WHITESPACE.embed("short", MSG, PWD),
      /Not enough spaces/,
    );
  });

  it("extract returns empty for text with no special spaces", async () => {
    const result = await DOCW_WHITESPACE.extract("just spaces ", PWD);
    assert.equal(result, ""); // regular spaces aren't special chars
  });
});

describe("Document Watermark — Dispatcher (docwEmbed / docwExtract)", () => {
  it("should embed and extract with ZWC (algo 1)", async () => {
    const cover = "Cover text for ZWC embedding test";
    const wm = await docwEmbed(cover, MSG, 1, PWD);
    const result = await docwExtract(wm, 1, PWD);
    assert.equal(result, MSG);
  });

  it("should embed and extract with Homoglyph (algo 2)", async () => {
    const cover = "A CAP ON A MAP AT EAST ACROSS X";
    const wm = await docwEmbed(cover, "a", 2, null);
    const result = await docwExtract(wm, 2, null);
    assert.equal(result, "a");
  });

  it("should embed and extract with Whitespace (algo 3)", async () => {
    const cover =
      "a b c d e f g h i j k l m n o p q r s t u v w x y z 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5";
    const wm = await docwEmbed(cover, "hi", 3, PWD);
    const result = await docwExtract(wm, 3, PWD);
    assert.equal(result, "hi");
  });

  it("should throw for unknown algorithm", async () => {
    await assert.rejects(
      () => docwEmbed("text", "msg", 99, PWD),
      /Unknown algorithm/,
    );
  });
});

describe("Document Watermark — Auto Detect", () => {
  it("should auto-detect ZWC watermark", async () => {
    const cover = "This text will have a zero-width watermark";
    const wm = await DOCW_ZWC.embed(cover, "auto-test-msg", PWD);
    const result = await docwAutoDetect(wm, PWD);
    assert.ok(result !== null);
    assert.equal(result.message, "auto-test-msg");
  });

  it("should return null for clean text", async () => {
    const result = await docwAutoDetect("Plain text with no watermark", null);
    assert.equal(result, null);
  });

  it("should detect ZWC without password when embedded without password", async () => {
    const cover = "Auto-detect test with no password";
    const wm = await DOCW_ZWC.embed(cover, "no-pw", null);
    const result = await docwAutoDetect(wm, null);
    assert.ok(result !== null);
    assert.equal(result.message, "no-pw");
    assert.equal(result.algo, "1");
  });

  it("should not throw on non-watermarked text", async () => {
    const result = await docwAutoDetect(
      "plain text without any watermark anywhere",
      null,
    );
    assert.equal(result, null);
  });
});

describe("Document Watermark — Capacity Estimation", () => {
  it("should estimate ZWC capacity", () => {
    // ZWC: per char * 16 ZWCs * 4 bits / 8 = bytes
    const cap = docwEstimateCapacity("Hello World", 1);
    assert.ok(cap > 0);
    assert.equal(cap, Math.floor((11 * 16 * 4) / 8)); // 88 bytes
  });

  it("should estimate Homoglyph capacity", () => {
    const cap = docwEstimateCapacity("A quick brown fox", 2);
    assert.ok(cap > 0);
  });

  it("should estimate Whitespace capacity", () => {
    const cap = docwEstimateCapacity("a b c d e f g", 3);
    assert.equal(cap, Math.floor((7 * 4) / 8)); // 3 bytes
  });

  it("should return 0 for empty text", () => {
    assert.equal(docwEstimateCapacity("", 1), 0);
    assert.equal(docwEstimateCapacity(null, 1), 0);
  });

  it("should return 0 for unknown algorithm", () => {
    assert.equal(docwEstimateCapacity("text", 99), 0);
  });
});
