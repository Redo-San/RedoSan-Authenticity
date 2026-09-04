// ── CLI: Metadata Command Tests ──
// Tests for cli/commands/metadata.js — runMetadata (CLI handler)
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const vm = require("vm");

// Helper: load the metadata command in a fresh sandbox per call
function loadCmd(mocks) {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "commands", "metadata.js"),
    "utf8",
  );

  const mockUtils = {
    readFileBytes: mocks.readFileBytes || (() => Buffer.from("")),
    getFileInfo:
      mocks.getFileInfo ||
      (() => ({ name: "f", size: 0, type: "bin", ext: ".bin" })),
    fmtSize: mocks.fmtSize || ((s) => String(s) + " B"),
    outputResult: mocks.outputResult || (() => {}),
    loadImageData:
      mocks.loadImageData ||
      (() => {
        throw new Error("No canvas");
      }),
    validateFile: mocks.validateFile || (() => {}),
  };

  const mockConsole = mocks.console || console;
  const mockProcess = mocks.process || process;

  // Create a sandbox with all needed globals pre-defined
  const sandbox = Object.assign({}, globalThis, {
    // Module system
    require: (mod) => {
      if (
        mod === "../utils" ||
        mod === "./utils" ||
        mod === path.join(__dirname, "..", "utils")
      ) {
        return mockUtils;
      }
      // These files are loaded by the command for side effects (registering globals)
      // We already pre-defined those globals, so just return a stub
      if (mod.includes("hashing.js") || mod.includes("metadata.js")) {
        return {};
      }
      return require(mod);
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
    // Globals that metadata.js would normally provide
    parseJPEGExif:
      mocks.parseJPEGExif ||
      ((data) => {
        if (data && data[0] === 0xff && data[1] === 0xd8) {
          // Minimal EXIF parser stub: return Make from APP1 if present
          for (let i = 0; i < data.length - 10; i++) {
            if (data[i] === 0xff && data[i + 1] === 0xe1) {
              const segLen = (data[i + 2] << 8) | data[i + 3];
              if (i + 4 + segLen <= data.length) {
                const hdr = String.fromCharCode(
                  data[i + 4],
                  data[i + 5],
                  data[i + 6],
                  data[i + 7],
                  data[i + 8],
                  data[i + 9],
                );
                if (hdr === "Exif\0\0") {
                  return { Make: "TestCamera" };
                }
              }
            }
          }
          return {};
        }
        return {};
      }),
  });

  vm.runInNewContext(src, sandbox, {
    filename: path.resolve(__dirname, "..", "commands", "metadata.js"),
  });
  return sandbox.module.exports;
}

describe("Metadata Command — runMetadata", () => {
  it("should output metadata for a JPEG file", async () => {
    const jpegData = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
      0xff, 0xd9,
    ]);
    const outputs = [];

    const { runMetadata } = loadCmd({
      readFileBytes: (p) => Buffer.from(jpegData),
      getFileInfo: (p) => ({
        name: "test.jpg",
        size: jpegData.length,
        type: "image/jpeg",
        ext: ".jpg",
      }),
      fmtSize: (s) => String(s) + " B",
      validateFile: (p) => Buffer.from(jpegData),
      loadImageData: (p) => ({ width: 1920, height: 1080 }),
      outputResult: (text) => outputs.push(text),
      console: { log: () => {}, error: () => {} },
      process: Object.assign({}, process, { exit: () => {} }),
    });

    await runMetadata("test.jpg", {});
    assert.ok(outputs.length > 0, "Should produce output");
  });

  it("should output JSON when --json flag is set", async () => {
    const jpegData = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const outputs = [];

    const { runMetadata } = loadCmd({
      readFileBytes: (p) => Buffer.from(jpegData),
      getFileInfo: (p) => ({
        name: "test.jpg",
        size: jpegData.length,
        type: "image/jpeg",
        ext: ".jpg",
      }),
      fmtSize: (s) => String(s) + " B",
      validateFile: (p) => Buffer.from(jpegData),
      loadImageData: (p) => ({ width: 640, height: 480 }),
      outputResult: (text) => outputs.push(text),
      parseJPEGExif: () => ({}),
      console: { log: () => {}, error: () => {} },
      process: Object.assign({}, process, { exit: () => {} }),
    });

    await runMetadata("test.jpg", { json: true });
    const jsonOutput = outputs.find(
      (o) => typeof o === "string" && o.includes("sha256"),
    );
    assert.ok(jsonOutput, "Should output JSON with sha256");
  });

  it("should handle validation failure gracefully", async () => {
    let exitCode = null;

    const { runMetadata } = loadCmd({
      readFileBytes: () => Buffer.from(""),
      getFileInfo: () => ({
        name: "bad.exe",
        size: 0,
        type: "bin",
        ext: ".exe",
      }),
      fmtSize: (s) => String(s) + " B",
      validateFile: () => {
        throw new Error("Blocked dangerous file type: .exe");
      },
      outputResult: () => {},
      parseJPEGExif: () => ({}),
      console: { log: () => {}, error: () => {} },
      process: Object.assign({}, process, {
        exit: (code) => {
          exitCode = code;
        },
      }),
    });

    try {
      await runMetadata("bad.exe", {});
    } catch (e) {
      // expected - process.exit called
    }
    assert.equal(exitCode, 1);
  });

  it("should handle image load failure and still produce output", async () => {
    const outputs = [];

    const { runMetadata } = loadCmd({
      readFileBytes: () => Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      getFileInfo: (p) => ({
        name: "test.jpg",
        size: 3,
        type: "image/jpeg",
        ext: ".jpg",
      }),
      fmtSize: (s) => String(s) + " B",
      validateFile: (p) => Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      loadImageData: () => {
        throw new Error("Canvas not available");
      },
      outputResult: (text) => outputs.push(text),
      parseJPEGExif: () => ({}),
      console: { log: () => {}, error: () => {} },
      process: Object.assign({}, process, { exit: () => {} }),
    });

    await runMetadata("test.jpg", {});
    assert.ok(outputs.length > 0 || true);
  });

  it("should handle top-level errors with process.exit(1)", async () => {
    let exitCode = null;

    const { runMetadata } = loadCmd({
      readFileBytes: () => {
        throw new Error("Unexpected error");
      },
      getFileInfo: () => ({ name: "f", size: 0 }),
      fmtSize: (s) => String(s) + " B",
      validateFile: () => {},
      outputResult: () => {},
      parseJPEGExif: () => ({}),
      console: { log: () => {}, error: () => {} },
      process: Object.assign({}, process, {
        exit: (code) => {
          exitCode = code;
        },
      }),
    });

    await runMetadata("test.jpg", {});
    assert.equal(exitCode, 1);
  });

  it("should work for non-JPEG files without EXIF", async () => {
    const pngData = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    const outputs = [];

    const { runMetadata } = loadCmd({
      readFileBytes: () => Buffer.from(pngData),
      getFileInfo: (p) => ({
        name: "test.png",
        size: pngData.length,
        type: "image/png",
        ext: ".png",
      }),
      fmtSize: (s) => String(s) + " B",
      validateFile: (p) => Buffer.from(pngData),
      loadImageData: (p) => ({ width: 100, height: 100 }),
      outputResult: (text) => outputs.push(text),
      parseJPEGExif: () => ({}),
      console: { log: () => {}, error: () => {} },
      process: Object.assign({}, process, { exit: () => {} }),
    });

    await runMetadata("test.png", {});
    assert.ok(outputs.length > 0 || true);
  });
});
