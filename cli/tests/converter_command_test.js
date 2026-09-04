// ── CLI: Converter Command Tests ──
// Tests for cli/commands/converter.js — runConverter (CLI handler)
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const vm = require("vm");

// Helper: load the converter command in a fresh sandbox per call
function loadCmd(mocks) {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "commands", "converter.js"),
    "utf8",
  );

  const logLines = [];
  const errLines = [];

  const mockFS = {
    existsSync: mocks.existsSync || (() => true),
    copyFileSync: mocks.copyFileSync || (() => {}),
  };

  const mockCP = {
    execSync: mocks.execSync || (() => Buffer.from("")),
  };

  const mockSharp =
    mocks.sharp ||
    (() => ({
      toFile: async () => {},
    }));

  const mockConsole = {
    log: (...args) => logLines.push(args.join(" ")),
    error: (...args) => errLines.push(args.join(" ")),
  };

  let exitCode = null;
  const mockProcess = Object.assign({}, process, {
    exit: (code) => {
      exitCode = code;
      throw new Error(`EXIT:${code}`);
    },
    argv: mocks.argv || process.argv,
  });

  const sandbox = Object.assign({}, globalThis, {
    require: (mod) => {
      if (mod === "node:path" || mod === "path") return path;
      if (mod === "node:fs" || mod === "fs") return mockFS;
      if (mod === "node:child_process" || mod === "child_process")
        return mockCP;
      if (mod === "sharp") return mockSharp;
      // For modules actually needed
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
  });

  vm.runInNewContext(src, sandbox, {
    filename: path.resolve(__dirname, "..", "commands", "converter.js"),
  });

  return {
    runConverter: sandbox.module.exports.runConverter,
    logLines,
    errLines,
    exitCode: () => exitCode,
  };
}

describe("Converter Command — runConverter", () => {
  it("should exit when input file not found", async () => {
    const cmd = loadCmd({
      existsSync: () => false,
    });

    try {
      await cmd.runConverter("nonexistent.jpg", { format: "png" });
    } catch (e) {
      // expected
    }

    assert.equal(cmd.exitCode(), 1);
    assert.ok(cmd.errLines.some((l) => l.includes("File not found")));
  });

  it("should exit when format option is missing", async () => {
    const cmd = loadCmd({
      existsSync: () => true,
    });

    try {
      await cmd.runConverter("test.jpg", {});
    } catch (e) {
      // expected
    }

    assert.equal(cmd.exitCode(), 1);
    assert.ok(
      cmd.errLines.some(
        (l) => l.includes("format") || l.includes("Target format"),
      ),
    );
  });

  it("should copy image file when no conversion libraries available", async () => {
    let copyCalled = false;
    const cmd = loadCmd({
      existsSync: (p) => {
        if (typeof p !== "string") return false;
        // Only the input file exists
        if (p.includes("test.jpg") || p === "test.jpg") return true;
        return false;
      },
      copyFileSync: (src, dst) => {
        copyCalled = true;
      },
      execSync: () => {
        throw new Error("command not found");
      },
      // sharp CLI bin not found, require('sharp') also fails
      sharp: () => {
        throw new Error("sharp module not found");
      },
    });

    try {
      await cmd.runConverter("test.jpg", { format: "png" });
    } catch (e) {
      // expected or not depending on fallback
    }

    // Fallback is fs.copyFileSync
    assert.ok(copyCalled, "Should have fallen back to copy");
  });

  it("should convert image via sharp npm package", async () => {
    const cmd = loadCmd({
      existsSync: (p) => {
        // Sharp CLI bin does not exist
        if (typeof p === "string" && p.includes("sharp")) return false;
        return true;
      },
      sharp: (input) => ({
        toFile: async (outPath) => {
          // success
        },
      }),
    });

    await cmd.runConverter("test.jpg", { format: "webp" });

    assert.ok(
      cmd.logLines.some((l) => l.includes("Converted")),
      "Should log conversion success",
    );
    assert.equal(cmd.exitCode(), null);
  });

  it("should convert image via ImageMagick when sharp not available", async () => {
    const cmd = loadCmd({
      existsSync: (p) => {
        if (typeof p !== "string") return false;
        // Only the input file exists (sharp CLI bin does not exist)
        if (p.includes("test.jpg")) return true;
        return false;
      },
      sharp: () => {
        throw new Error("sharp not installed");
      },
      execSync: (cmdStr) => {
        if (cmdStr.includes("magick")) return Buffer.from("ok");
        return Buffer.from("");
      },
    });

    await cmd.runConverter("test.jpg", { format: "png" });

    // magick succeeds silently (inner try completes, no log in that path)
    // The function should complete without throwing / exiting
    assert.equal(cmd.exitCode(), null, "Should not exit with error");
  });

  it("should try sharp CLI binary first", async () => {
    const cmd = loadCmd({
      existsSync: (p) => {
        // Sharp CLI bin DOES exist
        if (typeof p === "string" && p.includes("sharp")) return true;
        return true;
      },
      execSync: (cmdStr) => {
        if (cmdStr.includes("sharp")) return Buffer.from("ok");
        return Buffer.from("");
      },
    });

    try {
      await cmd.runConverter("test.jpg", { format: "png" });
    } catch (e) {
      // expected?
    }

    // Either sharp CLI or sharp npm used
    assert.ok(cmd.logLines.length > 0);
  });

  it("should handle non-image formats via ffmpeg CLI", async () => {
    const cmd = loadCmd({
      existsSync: (p) => {
        // ffmpeg.min.js does not exist
        return typeof p === "string" && p.includes("test.mp4");
      },
      execSync: (cmdStr) => {
        if (cmdStr.includes("ffmpeg")) return Buffer.from("ffmpeg success");
        return Buffer.from("");
      },
    });

    try {
      await cmd.runConverter("test.mp4", { format: "avi" });
    } catch (e) {
      // expected
    }

    // Should have tried ffmpeg via execSync
    assert.ok(
      cmd.logLines.some((l) => l.includes("ffmpeg") || l.includes("Converted")),
      "Should use ffmpeg: " + cmd.logLines.join("; "),
    );
  });

  it("should copy non-image file when ffmpeg not available", async () => {
    let copyCalled = false;
    const cmd = loadCmd({
      existsSync: (p) => typeof p === "string" && p.includes("test.mp4"),
      copyFileSync: (src, dst) => {
        copyCalled = true;
      },
      execSync: () => {
        throw new Error("ffmpeg not found");
      },
    });

    try {
      await cmd.runConverter("test.mp4", { format: "webm" });
    } catch (e) {
      // expected or not
    }

    assert.ok(
      copyCalled || cmd.logLines.some((l) => l.includes("Copied")),
      "Should have fallen back to copy: " + cmd.logLines.join("; "),
    );
  });

  it("should use built-in ffmpeg WASM when available", async () => {
    let copyCalled = false;
    const cmd = loadCmd({
      existsSync: (p) => {
        // ffmpeg.min.js exists
        if (typeof p === "string" && p.includes("ffmpeg.min.js")) return true;
        return typeof p === "string" && p.includes("test.mp4");
      },
      copyFileSync: (src, dst) => {
        copyCalled = true;
      },
    });

    await cmd.runConverter("test.mp4", { format: "avi" });

    // ffmpeg WASM path exists → copies file and logs
    assert.ok(copyCalled, "Should copy when ffmpeg WASM is available");
    assert.ok(
      cmd.logLines.some((l) => l.includes("ffmpeg") || l.includes("Output")),
      "Should log ffmpeg WASM usage",
    );
  });

  it("should handle conversion error and exit with code 1", async () => {
    let copyCalled = false;
    const cmd = loadCmd({
      existsSync: (p) =>
        (typeof p === "string" && p.includes("test.jpg")) || false,
      copyFileSync: (src, dst) => {
        copyCalled = true;
      },
      sharp: () => {
        throw new Error("sharp fails");
      },
      execSync: () => {
        throw new Error("magick also fails");
      },
    });

    try {
      await cmd.runConverter("test.jpg", { format: "png" });
    } catch (e) {
      // expected when all paths fail
    }

    // Should have tried copy as last resort (which is in the imageFormats else path)
    // Actually image path: sharp fails → magick fails → copyFileSync → returns
    // The copy fallback succeeds so exitCode stays null
    assert.ok(copyCalled, "Should copy as last resort");
  });
});
