// ── CLI: Certificate Command Tests ──
// Tests for cli/commands/certificate.js
// Uses vm.runInNewContext to avoid CJS loader crash when mocking fs
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const vm = require("vm");

// ── Helper: create a minimal valid PNG ──
function createMinimalPng() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xd7, 0x63, 0x60, 0x60, 0x00, 0x00,
    0x00, 0x04, 0x00, 0x01, 0x27, 0x34, 0x27, 0x24,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
    0xae, 0x42, 0x60, 0x82,
  ]);
}

// Helper: load certificate command with mocked fs
function loadCmd(mocks) {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "commands", "certificate.js"),
    "utf8",
  );

  const logLines = [];
  const errLines = [];

  // Create a mocked fs that tracks calls
  const mockFS = {
    existsSync: mocks.existsSync || (() => true),
    readFileSync: mocks.readFileSync || ((p) => {
      if (typeof p === "string" && p.endsWith(".png")) return createMinimalPng();
      return Buffer.from("");
    }),
    writeFileSync: mocks.writeFileSync || (() => {}),
    statSync: mocks.statSync || ((p) => ({ size: 0 })),
  };

  const mockConsole = {
    log: (...args) => logLines.push(args.join(" ")),
    error: (...args) => errLines.push(args.join(" ")),
  };

  let exitCode = null;
  const mockProcess = Object.assign({}, process, {
    exit: (code) => { exitCode = code; throw new Error(`EXIT:${code}`); },
  });

  const sandbox = Object.assign({}, globalThis, {
    require: (mod) => {
      // Provide mocked modules
      if (mod === "node:fs" || mod === "fs") return mockFS;
      if (mod === "node:path" || mod === "path") return path;
      if (mod === "node:crypto" || mod === "crypto") {
        // Use real crypto for hashing
        const realCrypto = require("crypto");
        return realCrypto;
      }
      // NPM packages — use real require
      if (mod === "pdfkit" || mod === "qrcode" || mod === "jszip") {
        return require(mod);
      }
      // Fallback: try real require for node built-ins
      try {
        return require(mod);
      } catch {
        return undefined;
      }
    },
    __dirname: path.resolve(__dirname, "..", "commands"),
    module: { exports: {} },
    exports: {},
    console: mockConsole,
    process: mockProcess,
    Buffer: Buffer,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    URL: URL,
    // canvas is optional — require("canvas") inside buildCertData should fail gracefully
  });

  vm.runInNewContext(src, sandbox, {
    filename: path.resolve(__dirname, "..", "commands", "certificate.js"),
  });

  // Internal functions are not exported, but we can access them via module.exports (which only has runCertificate)
  // We also expose internal functions for testing by reaching into the sandbox
  return {
    runCertificate: sandbox.module.exports.runCertificate,
    logLines,
    errLines,
    exitCode: () => exitCode,
    // Access internal functions from sandbox scope (they're defined in module scope)
    escHtml: sandbox.escHtml || sandbox.globalThis?.escHtml,
    stripHtml: sandbox.stripHtml,
    fmtSize: sandbox.fmtSize,
    buildQRVerificationJSON: sandbox.buildQRVerificationJSON,
    buildCertData: sandbox.buildCertData,
  };
}

describe("Certificate Command — buildCertData", () => {
  it("should build data with file info and user options", async () => {
    const testPng = createMinimalPng();
    const testPngPath = "test.png";

    const cmd = loadCmd({
      existsSync: (p) => p === testPngPath,
      readFileSync: (p) => p === testPngPath ? testPng : Buffer.from(""),
    });

    const data = await cmd.buildCertData(testPngPath, {
      name: "Alice",
      email: "alice@example.com",
      phoneCode: "+1",
      phone: "555-0100",
      website: "https://alice.example.com",
      socialTiktok: "@alice",
      socialFacebook: "alicefb",
      musicSpotify: "spotify:alice",
    });

    assert.equal(data.user.name, "Alice");
    assert.equal(data.user.email, "alice@example.com");
    assert.equal(data.user.phone, "555-0100");
    assert.equal(data.file.name, "test.png");
    assert.ok(data.file.buf);
    assert.ok(data.file.hash);
    assert.equal(data.file.type, "image/png");
  });

  it("should load watermark result from file", async () => {
    const testPng = createMinimalPng();
    const testPngPath = "test.png";
    const wmPath = "watermark.txt";

    const cmd = loadCmd({
      existsSync: (p) => p === testPngPath || p === wmPath,
      readFileSync: (p) => {
        if (p === testPngPath) return testPng;
        if (p === wmPath) return Buffer.from("Watermarked content\nline2");
        return Buffer.from("");
      },
    });

    const data = await cmd.buildCertData(testPngPath, {
      watermark: wmPath,
    });

    assert.equal(data.watermark, true);
    assert.ok(data.watermarkResult.includes("Watermarked content"));
  });

  it("should load fingerprint JSON from file", async () => {
    const fpPath = "fingerprint.json";
    const fpContent = JSON.stringify({
      hashes: {
        "SHA-256": "abc123",
        "BLAKE3": "def456",
      },
      perceptual_hashes: {
        dHash: "dhashval",
      },
    });

    const cmd = loadCmd({
      existsSync: (p) => p === fpPath,
      readFileSync: (p) => {
        if (p === fpPath) return Buffer.from(fpContent);
        return Buffer.from("");
      },
    });

    const data = await cmd.buildCertData("", { fingerprint: fpPath });

    assert.equal(data.fingerprint, true);
    assert.equal(data.fpResult.hashes["SHA-256"], "abc123");
    assert.equal(data.fpResult.perceptual_hashes.dHash, "dhashval");
  });

  it("should handle invalid fingerprint JSON gracefully", async () => {
    const fpPath = "bad_fingerprint.json";

    const cmd = loadCmd({
      existsSync: (p) => p === fpPath,
      readFileSync: (p) => {
        if (p === fpPath) return Buffer.from("not valid json{{{");
        return Buffer.from("");
      },
    });

    const data = await cmd.buildCertData("", { fingerprint: fpPath });

    assert.equal(data.fingerprint, false);
  });

  it("should load DID identity from file", async () => {
    const didPath = "did.json";
    const didContent = JSON.stringify({
      did: "did:key:z6MkhaXgBZQbVrVZqZqZqZqZqZqZqZq",
      signature: "sig_value_here_12345678901234567890",
      algorithm: "Ed25519",
      timestamp: "2026-01-01T00:00:00Z",
    });

    const cmd = loadCmd({
      existsSync: (p) => p === didPath,
      readFileSync: (p) => {
        if (p === didPath) return Buffer.from(didContent);
        return Buffer.from("");
      },
    });

    const data = await cmd.buildCertData("", { did: didPath });

    // Regression test for GH-339: data.didSig must be the parsed object,
    // not the signature string (used as .didSig.did / .didSig.signature downstream).
    assert.ok(data.didSig);
    assert.equal(data.didSig.did, "did:key:z6MkhaXgBZQbVrVZqZqZqZqZqZqZqZq");
    assert.equal(data.didSig.signature, "sig_value_here_12345678901234567890");
    assert.equal(data.didSig.algorithm, "Ed25519");
    assert.equal(data.didIdentity, "did:key:z6MkhaXgBZQbVrVZqZqZqZqZqZqZqZq");
  });

  it("should load timestamp info from file", async () => {
    const tsPath = "proof.ots";

    const cmd = loadCmd({
      existsSync: (p) => p === tsPath,
      readFileSync: () => Buffer.from(""),
      statSync: () => ({ size: 123 }),
    });

    const data = await cmd.buildCertData("", { timestamp: tsPath });

    assert.equal(data.timestamp, true);
    assert.ok(data.tsResult.includes("proof.ots"));
  });

  it("should treat filePath as fingerprint JSON if it has hashes", async () => {
    const jsonPath = "data.json";
    const jsonContent = JSON.stringify({
      hashes: { "SHA-256": "xyz789" },
      fileHash: "abc",
    });

    const cmd = loadCmd({
      existsSync: (p) => p === jsonPath,
      readFileSync: (p) => Buffer.from(jsonContent),
    });

    const data = await cmd.buildCertData(jsonPath, {});

    assert.equal(data.fingerprint, true);
    assert.equal(data.fpResult.hashes["SHA-256"], "xyz789");
  });

  it("should treat non-JSON filePath gracefully", async () => {
    const txtPath = "readme.txt";

    const cmd = loadCmd({
      existsSync: (p) => p === txtPath,
      readFileSync: (p) => Buffer.from("This is not JSON"),
    });

    const data = await cmd.buildCertData(txtPath, {});
    assert.equal(data.fingerprint, false);
  });
});

describe("Certificate Command — buildQRVerificationJSON", () => {
  it("should include all data fields", async () => {
    const cmd = loadCmd({});

    const data = {
      generator: "RedoSan",
      generatedAt: "2026-06-01T12:00:00Z",
      file: { name: "photo.jpg", size: 5000, hash: "abc", width: 1920, height: 1080 },
      user: { name: "Bob", email: "bob@test.com" },
      fpResult: {
        hashes: { "SHA-256": "sha256hash", "MD5": "md5hash" },
        perceptual_hashes: { dHash: "dhash" },
      },
      didSig: {
        did: "did:key:z6Mklongdidstringthatwillsurelyexceedsixty",
        signature: "somesignaturevalue",
        algorithm: "Ed25519",
        timestamp: "2026-06-01T12:00:00Z",
      },
      watermark: true,
      pixelInjection: false,
      timestamp: true,
    };

    const qrStr = cmd.buildQRVerificationJSON(data);
    const qr = JSON.parse(qrStr);

    assert.equal(qr.v, 1);
    assert.equal(qr.file.n, "photo.jpg");
    assert.equal(qr.fp["SHA-256"], "sha256hash");
    assert.equal(qr.fp.ph_dHash, "dhash");
    assert.equal(qr.wm, 1);
    assert.equal(qr.pi, 0);
    assert.equal(qr.ts, 1);
  });

  it("should handle missing fpResult and didSig", async () => {
    const cmd = loadCmd({});

    const data = {
      generator: "RedoSan",
      generatedAt: "2026-01-01",
      file: { name: "", size: 0 },
      user: { name: "", email: "" },
      didIdentity: "did:key:z6Mkfallback",
      watermark: false,
      pixelInjection: false,
      timestamp: false,
    };

    const qrStr = cmd.buildQRVerificationJSON(data);
    const qr = JSON.parse(qrStr);

    assert.equal(qr.fp, undefined);
    assert.equal(qr.did, "did:key:z6Mkfallback");
    assert.equal(qr.wm, 0);
  });
});

describe("Certificate Command — fmtSize", () => {
  it("should format sizes correctly", async () => {
    const cmd = loadCmd({});

    assert.equal(cmd.fmtSize(0), "0 B");
    assert.equal(cmd.fmtSize(500), "500 B");
    assert.equal(cmd.fmtSize(1024), "1.0 KB");
    assert.equal(cmd.fmtSize(1536), "1.5 KB");
    assert.equal(cmd.fmtSize(1048576), "1.0 MB");
    assert.equal(cmd.fmtSize(1572864), "1.5 MB");
  });
});

describe("Certificate Command — stripHtml", () => {
  it("should strip tags and decode entities", async () => {
    const cmd = loadCmd({});

    assert.equal(cmd.stripHtml(null), "");
    assert.equal(cmd.stripHtml(undefined), "");
    assert.equal(cmd.stripHtml(""), "");
    assert.equal(cmd.stripHtml("Hello"), "Hello");
    assert.equal(cmd.stripHtml("<p>Hi</p>"), "Hi");
    assert.equal(cmd.stripHtml("&amp;"), "&");
    assert.equal(cmd.stripHtml("&lt;tag&gt;"), "<tag>");
    assert.equal(cmd.stripHtml("  spaced  "), "spaced");
    assert.equal(cmd.stripHtml("<br/>Line1<br/>Line2"), "Line1Line2");
  });
});

describe("Certificate Command — escHtml", () => {
  it("should escape HTML special characters", async () => {
    const cmd = loadCmd({});

    assert.equal(cmd.escHtml(null), "");
    assert.equal(cmd.escHtml("safe"), "safe");
    assert.equal(cmd.escHtml("<script>"), "&lt;script&gt;");
    assert.equal(cmd.escHtml('a&b "c"'), "a&amp;b &quot;c&quot;");
    assert.equal(cmd.escHtml("it's"), "it&#39;s");
  });
});

describe("Certificate Command — runCertificate", () => {
  it("should generate a PDF passport for a valid file", async () => {
    const testPng = createMinimalPng();
    const testPngPath = "passport_input.png";

    let writtenPath, writtenData;

    const cmd = loadCmd({
      existsSync: (p) => p === testPngPath,
      readFileSync: (p) => p === testPngPath ? testPng : Buffer.from(""),
      writeFileSync: (p, data) => {
        writtenPath = p;
        writtenData = data;
      },
    });

    await cmd.runCertificate(testPngPath, {
      name: "Charlie",
      format: "pdf",
      output: "passport.pdf",
    });

    assert.ok(writtenPath, "Should have written output file");
    assert.ok(writtenData, "Should have data");
    assert.ok(cmd.logLines.some((l) => l.includes("passport.pdf")),
      "Should log output path: " + cmd.logLines.join("; "));
  });

  it("should generate a DOCX passport", async () => {
    const testPng = createMinimalPng();
    const testPngPath = "passport_input_docx.png";

    let writtenPath;

    const cmd = loadCmd({
      existsSync: (p) => p === testPngPath,
      readFileSync: (p) => p === testPngPath ? testPng : Buffer.from(""),
      writeFileSync: (p, d) => { writtenPath = p; },
    });

    await cmd.runCertificate(testPngPath, {
      name: "Dave",
      format: "docx",
      output: "passport.docx",
    });

    assert.ok(writtenPath, "Should have written DOCX");
    assert.ok(writtenPath.endsWith(".docx"));
  });

  it("should generate an EPUB passport", async () => {
    const testPng = createMinimalPng();
    const testPngPath = "passport_input_epub.png";

    let writtenPath;

    const cmd = loadCmd({
      existsSync: (p) => p === testPngPath,
      readFileSync: (p) => p === testPngPath ? testPng : Buffer.from(""),
      writeFileSync: (p, d) => { writtenPath = p; },
    });

    await cmd.runCertificate(testPngPath, {
      name: "Eve",
      email: "eve@test.com",
      format: "epub",
      output: "passport.epub",
    });

    assert.ok(writtenPath, "Should have written EPUB");
    assert.ok(writtenPath.endsWith(".epub"));
  });

  it("should exit with error for unsupported format", async () => {
    const testPngPath = "test.png";

    const cmd = loadCmd({
      existsSync: (p) => p === testPngPath,
      readFileSync: (p) => createMinimalPng(),
    });

    try {
      await cmd.runCertificate(testPngPath, { format: "txt" });
    } catch (e) {
      // expected
    }

    assert.equal(cmd.exitCode(), 1);
    assert.ok(cmd.errLines.some((l) => l.includes("Unsupported") || l.includes("format")),
      "Should show unsupported format error");
  });
});
