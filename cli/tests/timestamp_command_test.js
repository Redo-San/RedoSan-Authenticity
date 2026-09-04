// ── CLI: Timestamp Command Tests ──
// Tests for cli/commands/timestamp.js — runTimestamp (CLI handler)
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const vm = require("vm");

// ── Helper: load the command module into a fresh sandbox per call ──
function loadCmd(mocks) {
  // mocks is an object with optional fns for: readFileBytes, getFileInfo, fmtSize, existsSync, writeFileSync, httpsRequest
  const src = fs.readFileSync(
    path.join(__dirname, "..", "commands", "timestamp.js"),
    "utf8",
  );
  const sandbox = Object.assign({}, globalThis, {
    require: (mod) => {
      if (mod === "../utils" || mod === "./utils") {
        return {
          readFileBytes: mocks.readFileBytes || ((p) => Buffer.from("default")),
          getFileInfo:
            mocks.getFileInfo ||
            (() => ({ name: "f", size: 1, type: "bin", ext: ".bin" })),
          fmtSize: mocks.fmtSize || ((s) => String(s) + " B"),
        };
      }
      // Fall through to actual require for node built-ins
      return require(mod);
    },
    __dirname: path.resolve(__dirname, "..", "commands"),
    __filename: path.resolve(__dirname, "..", "commands", "timestamp.js"),
    module: { exports: {} },
    exports: {},
    console: mocks.console || console,
    process: mocks.process || process,
    Buffer: Buffer,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    URL: URL,
  });
  vm.runInNewContext(src, sandbox, {
    filename: path.resolve(__dirname, "..", "commands", "timestamp.js"),
  });
  return sandbox.module.exports;
}

// ── Helpers ──
function captureConsole() {
  const logs = { out: [], err: [] };
  const mockConsole = {
    log: (...args) => logs.out.push(args.join(" ")),
    error: (...args) => logs.err.push(args.join(" ")),
  };
  return { logs, mockConsole };
}

function makeExitThrow() {
  let lastExitCode = null;
  const mockProcess = Object.assign({}, process, {
    exit: (code) => {
      lastExitCode = code;
      throw new Error(`EXIT:${code}`);
    },
  });
  return { lastExitCode, mockProcess };
}

describe("Timestamp Command — runTimestamp", () => {
  it("should create an incomplete .ots when aggregator unreachable", async () => {
    const testData = Buffer.from("test data for timestamp");
    const { logs, mockConsole } = captureConsole();
    // Mock exit
    const mockProc = Object.assign({}, process, {
      exit: (code) => {
        throw new Error(`EXIT:${code}`);
      },
    });

    // Track written file
    let writtenData = null;

    // Mock https to fail (aggregator unreachable)
    const EventEmitter = require("events");
    const mockHttps = {
      request: (opts, cb) => {
        const req = new EventEmitter();
        req.write = () => {};
        req.end = () => {
          req.destroy();
          process.nextTick(() => req.emit("error", new Error("ECONNREFUSED")));
        };
        return req;
      },
    };

    // Override the https module loading in the sandbox
    const origHttps = require("https");
    const src = fs.readFileSync(
      path.join(__dirname, "..", "commands", "timestamp.js"),
      "utf8",
    );
    const sandbox = Object.assign({}, globalThis, {
      require: (mod) => {
        if (mod === "../utils" || mod === "./utils") {
          return {
            readFileBytes: (p) => testData,
            getFileInfo: (p) => ({
              name: "test.bin",
              size: testData.length,
              type: "bin",
              ext: ".bin",
            }),
            fmtSize: (s) => String(s) + " B",
          };
        }
        if (mod === "node:https" || mod === "https") return mockHttps;
        if (mod === "node:fs" || mod === "fs") {
          return Object.assign({}, fs, {
            existsSync: () => false,
            writeFileSync: (p, buf) => {
              writtenData = buf;
            },
            readFileSync: fs.readFileSync,
          });
        }
        if (mod === "node:path" || mod === "path") return path;
        if (mod === "node:crypto" || mod === "crypto") return require("crypto");
        return require(mod);
      },
      __dirname: path.resolve(__dirname, "..", "commands"),
      module: { exports: {} },
      exports: {},
      console: mockConsole,
      process: mockProc,
      Buffer: Buffer,
    });
    vm.runInNewContext(src, sandbox, {
      filename: path.resolve(__dirname, "..", "commands", "timestamp.js"),
    });
    const { runTimestamp } = sandbox.module.exports;

    try {
      await runTimestamp("create", "test.bin", {});
    } catch (e) {
      // expected - process exit
    }

    assert.ok(writtenData, "Should have written .ots data");
    assert.ok(writtenData.length > 0, "OTS data should not be empty");
  });

  it("should exit with error for unknown action", async () => {
    const { mockConsole } = captureConsole();
    let exitCode = null;
    const mockProc = Object.assign({}, process, {
      exit: (code) => {
        exitCode = code;
        throw new Error(`EXIT:${code}`);
      },
    });

    const src = fs.readFileSync(
      path.join(__dirname, "..", "commands", "timestamp.js"),
      "utf8",
    );
    const sandbox = Object.assign({}, globalThis, {
      require: (mod) => {
        if (mod === "../utils" || mod === "./utils")
          return {
            readFileBytes: () => Buffer.from("data"),
            getFileInfo: () => ({
              name: "f",
              size: 1,
              type: "bin",
              ext: ".bin",
            }),
            fmtSize: (s) => String(s) + " B",
          };
        return require(mod);
      },
      __dirname: path.resolve(__dirname, "..", "commands"),
      module: { exports: {} },
      exports: {},
      console: mockConsole,
      process: mockProc,
      Buffer: Buffer,
    });
    vm.runInNewContext(src, sandbox, {
      filename: path.resolve(__dirname, "..", "commands", "timestamp.js"),
    });
    const { runTimestamp } = sandbox.module.exports;

    try {
      await runTimestamp("bad-action", "test.bin", {});
    } catch (e) {
      // expected
    }
    assert.equal(exitCode, 1);
  });

  it("should handle runCreate error and exit with code 1", async () => {
    const { mockConsole } = captureConsole();
    let exitCode = null;

    const src = fs.readFileSync(
      path.join(__dirname, "..", "commands", "timestamp.js"),
      "utf8",
    );
    const sandbox = Object.assign({}, globalThis, {
      require: (mod) => {
        if (mod === "../utils" || mod === "./utils")
          return {
            readFileBytes: () => {
              throw new Error("File not found");
            },
            getFileInfo: () => ({ name: "f", size: 0 }),
            fmtSize: (s) => String(s) + " B",
          };
        return require(mod);
      },
      __dirname: path.resolve(__dirname, "..", "commands"),
      module: { exports: {} },
      exports: {},
      console: mockConsole,
      process: Object.assign({}, process, {
        exit: (code) => {
          exitCode = code;
          throw new Error(`EXIT:${code}`);
        },
      }),
      Buffer: Buffer,
    });
    vm.runInNewContext(src, sandbox, {
      filename: path.resolve(__dirname, "..", "commands", "timestamp.js"),
    });
    const { runTimestamp } = sandbox.module.exports;

    try {
      await runTimestamp("create", "nonexistent.bin", {});
    } catch (e) {
      // expected
    }
    assert.equal(exitCode, 1);
  });

  it("should verify matching hashes successfully", async () => {
    const testData = Buffer.from("test data for verify");
    const sha256 = require("crypto")
      .createHash("sha256")
      .update(testData)
      .digest();
    // Build valid OTS
    const otsHeader = new Uint8Array([
      0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61,
      0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf,
      0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
    ]);
    const otsBuf = Buffer.concat([
      Buffer.from(otsHeader),
      Buffer.from([1, 0x08]),
      Buffer.from(sha256),
    ]);

    const { mockConsole } = captureConsole();
    const logs = [];

    const src = fs.readFileSync(
      path.join(__dirname, "..", "commands", "timestamp.js"),
      "utf8",
    );
    const sandbox = Object.assign({}, globalThis, {
      require: (mod) => {
        if (mod === "../utils" || mod === "./utils")
          return {
            readFileBytes: (p) => (p.endsWith(".ots") ? otsBuf : testData),
            getFileInfo: (p) => ({
              name: "test.bin",
              size: testData.length,
              type: "bin",
              ext: ".bin",
            }),
            fmtSize: (s) => String(s) + " B",
          };
        if (mod === "node:fs" || mod === "fs") {
          return Object.assign({}, fs, {
            existsSync: (p) => p.endsWith(".ots") || p.endsWith("test.bin"),
            writeFileSync: () => {},
          });
        }
        return require(mod);
      },
      __dirname: path.resolve(__dirname, "..", "commands"),
      module: { exports: {} },
      exports: {},
      console: {
        log: (...args) => logs.push(args.join(" ")),
        error: (...args) => logs.push(args.join(" ")),
      },
      process: Object.assign({}, process, {
        exit: () => {},
      }),
      Buffer: Buffer,
    });
    vm.runInNewContext(src, sandbox, {
      filename: path.resolve(__dirname, "..", "commands", "timestamp.js"),
    });
    const { runTimestamp } = sandbox.module.exports;

    await runTimestamp("verify", "test.bin", {});

    const allOutput = logs.join(" ");
    assert.ok(
      allOutput.includes("Verified") || allOutput.includes("matches"),
      "Should indicate verification success, got: " + allOutput,
    );
  });

  it("should fail verification on hash mismatch and exit 1", async () => {
    const testData = Buffer.from("test data");
    const otherHash = require("crypto")
      .createHash("sha256")
      .update(Buffer.from("other data"))
      .digest();
    const otsHeader = new Uint8Array([
      0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61,
      0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf,
      0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
    ]);
    const otsBuf = Buffer.concat([
      Buffer.from(otsHeader),
      Buffer.from([1, 0x08]),
      Buffer.from(otherHash),
    ]);

    let exitCode = null;

    const src = fs.readFileSync(
      path.join(__dirname, "..", "commands", "timestamp.js"),
      "utf8",
    );
    const sandbox = Object.assign({}, globalThis, {
      require: (mod) => {
        if (mod === "../utils" || mod === "./utils")
          return {
            readFileBytes: (p) => (p.endsWith(".ots") ? otsBuf : testData),
            getFileInfo: (p) => ({
              name: "test.bin",
              size: testData.length,
              type: "bin",
              ext: ".bin",
            }),
            fmtSize: (s) => String(s) + " B",
          };
        if (mod === "node:fs" || mod === "fs") {
          return Object.assign({}, fs, {
            existsSync: (p) => p.endsWith(".ots") || p.endsWith("test.bin"),
            writeFileSync: () => {},
          });
        }
        return require(mod);
      },
      __dirname: path.resolve(__dirname, "..", "commands"),
      module: { exports: {} },
      exports: {},
      console: { log: () => {}, error: () => {} },
      process: Object.assign({}, process, {
        exit: (code) => {
          exitCode = code;
        },
      }),
      Buffer: Buffer,
    });
    vm.runInNewContext(src, sandbox, {
      filename: path.resolve(__dirname, "..", "commands", "timestamp.js"),
    });
    const { runTimestamp } = sandbox.module.exports;

    await runTimestamp("verify", "test.bin", {});
    assert.equal(exitCode, 1);
  });

  it("should exit when proof file not found for verify", async () => {
    let exitCode = null;

    const src = fs.readFileSync(
      path.join(__dirname, "..", "commands", "timestamp.js"),
      "utf8",
    );
    const sandbox = Object.assign({}, globalThis, {
      require: (mod) => {
        if (mod === "../utils" || mod === "./utils")
          return {
            readFileBytes: () => Buffer.from("data"),
            getFileInfo: () => ({ name: "f", size: 1 }),
            fmtSize: (s) => String(s) + " B",
          };
        if (mod === "node:fs" || mod === "fs") {
          return Object.assign({}, fs, {
            existsSync: () => false,
          });
        }
        return require(mod);
      },
      __dirname: path.resolve(__dirname, "..", "commands"),
      module: { exports: {} },
      exports: {},
      console: { log: () => {}, error: () => {} },
      process: Object.assign({}, process, {
        exit: (code) => {
          exitCode = code;
        },
      }),
      Buffer: Buffer,
    });
    vm.runInNewContext(src, sandbox, {
      filename: path.resolve(__dirname, "..", "commands", "timestamp.js"),
    });
    const { runTimestamp } = sandbox.module.exports;

    await runTimestamp("verify", "test.bin", {});
    assert.equal(exitCode, 1);
  });
});

describe("Timestamp Command — upgradeOts (https)", () => {
  it("should throw when all aggregators fail", async () => {
    const EventEmitter = require("events");
    const mockHttps = {
      request: (opts, cb) => {
        const req = new EventEmitter();
        req.write = () => {};
        req.end = () => {
          process.nextTick(() => req.emit("error", new Error("Network error")));
        };
        return req;
      },
    };

    const src = fs.readFileSync(
      path.join(__dirname, "..", "commands", "timestamp.js"),
      "utf8",
    );
    const sandbox = Object.assign({}, globalThis, {
      require: (mod) => {
        if (mod === "../utils" || mod === "./utils")
          return {
            readFileBytes: () => Buffer.from(""),
            getFileInfo: () => ({}),
            fmtSize: () => "",
          };
        if (mod === "https" || mod === "node:https") return mockHttps;
        return require(mod);
      },
      __dirname: path.resolve(__dirname, "..", "commands"),
      module: { exports: {} },
      exports: {},
      console: console,
      process: process,
      Buffer: Buffer,
    });
    vm.runInNewContext(src, sandbox, {
      filename: path.resolve(__dirname, "..", "commands", "timestamp.js"),
    });
    const { upgradeOts } = sandbox.module.exports;

    await assert.rejects(() => upgradeOts(new Uint8Array([1, 2, 3])));
  });

  it("should succeed when https responds with data", async () => {
    const EventEmitter = require("events");
    const successResponse = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const mockHttps = {
      request: (opts, cb) => {
        const req = new EventEmitter();
        req.write = () => {};
        req.end = () => {
          const res = new EventEmitter();
          res.statusCode = 200;
          process.nextTick(() => {
            res.emit("data", Buffer.from(successResponse));
            res.emit("end");
          });
          cb(res);
        };
        return req;
      },
    };

    const src = fs.readFileSync(
      path.join(__dirname, "..", "commands", "timestamp.js"),
      "utf8",
    );
    const sandbox = Object.assign({}, globalThis, {
      require: (mod) => {
        if (mod === "../utils" || mod === "./utils")
          return {
            readFileBytes: () => Buffer.from(""),
            getFileInfo: () => ({}),
            fmtSize: () => "",
          };
        if (mod === "https" || mod === "node:https") return mockHttps;
        return require(mod);
      },
      __dirname: path.resolve(__dirname, "..", "commands"),
      module: { exports: {} },
      exports: {},
      console: console,
      process: process,
      Buffer: Buffer,
      URL: URL,
    });
    vm.runInNewContext(src, sandbox, {
      filename: path.resolve(__dirname, "..", "commands", "timestamp.js"),
    });
    const { upgradeOts } = sandbox.module.exports;

    let result;
    try {
      result = await upgradeOts(new Uint8Array([1, 2, 3]));
    } catch (e) {
      assert.fail("upgradeOts threw: " + e.message);
    }
    assert.ok(result, "result should be truthy");
    assert.equal(result.length, 4);
    assert.equal(result[0], 0x01);
  });

  it("should reject on non-2xx HTTP status code", async () => {
    const EventEmitter = require("events");
    const mockHttps = {
      request: (opts, cb) => {
        const req = new EventEmitter();
        req.write = () => {};
        req.end = () => {
          const res = new EventEmitter();
          res.statusCode = 500;
          process.nextTick(() => {
            res.emit("data", Buffer.from("Server Error"));
            res.emit("end");
          });
          cb(res);
        };
        return req;
      },
    };

    const src = fs.readFileSync(
      path.join(__dirname, "..", "commands", "timestamp.js"),
      "utf8",
    );
    const sandbox = Object.assign({}, globalThis, {
      require: (mod) => {
        if (mod === "../utils" || mod === "./utils")
          return {
            readFileBytes: () => Buffer.from(""),
            getFileInfo: () => ({}),
            fmtSize: () => "",
          };
        if (mod === "https" || mod === "node:https") return mockHttps;
        return require(mod);
      },
      __dirname: path.resolve(__dirname, "..", "commands"),
      module: { exports: {} },
      exports: {},
      console: console,
      process: process,
      Buffer: Buffer,
      URL: URL,
    });
    vm.runInNewContext(src, sandbox, {
      filename: path.resolve(__dirname, "..", "commands", "timestamp.js"),
    });
    const { upgradeOts } = sandbox.module.exports;

    try {
      await upgradeOts(new Uint8Array([1, 2, 3]));
      assert.fail("Expected upgradeOts to reject on HTTP error status");
    } catch (e) {
      assert.ok(
        e.message.includes("500"),
        "Should mention HTTP 500, got: " + e.message,
      );
    }
  });

  it("should handle https timeout and reject", async () => {
    const EventEmitter = require("events");
    const mockHttps = {
      request: (opts, cb) => {
        const req = new EventEmitter();
        req.write = () => {};
        req.destroy = () => {};
        req.end = () => {
          const res = new EventEmitter();
          res.statusCode = 200;
          cb(res);
          // Emit timeout instead of data/end
          setImmediate(() => {
            req.emit("timeout");
          });
        };
        return req;
      },
    };

    const src = fs.readFileSync(
      path.join(__dirname, "..", "commands", "timestamp.js"),
      "utf8",
    );
    const sandbox = Object.assign({}, globalThis, {
      require: (mod) => {
        if (mod === "../utils" || mod === "./utils")
          return {
            readFileBytes: () => Buffer.from(""),
            getFileInfo: () => ({}),
            fmtSize: () => "",
          };
        if (mod === "https" || mod === "node:https") return mockHttps;
        return require(mod);
      },
      __dirname: path.resolve(__dirname, "..", "commands"),
      module: { exports: {} },
      exports: {},
      console: console,
      process: process,
      Buffer: Buffer,
      URL: URL,
    });
    vm.runInNewContext(src, sandbox, {
      filename: path.resolve(__dirname, "..", "commands", "timestamp.js"),
    });
    const { upgradeOts } = sandbox.module.exports;

    await assert.rejects(
      () => upgradeOts(new Uint8Array([1, 2, 3])),
      /Request timeout/,
    );
  });

  it("should create complete .ots when aggregator responds (success path)", async () => {
    const testData = Buffer.from("data for complete OTS");
    const logs = [];
    let writtenData = null;
    const EventEmitter = require("events");
    const aggregatorResponse = new Uint8Array([0x10, 0x20, 0x30]);

    const mockHttps = {
      request: (opts, cb) => {
        const req = new EventEmitter();
        req.write = () => {};
        req.end = () => {
          const res = new EventEmitter();
          res.statusCode = 200;
          process.nextTick(() => {
            res.emit("data", Buffer.from(aggregatorResponse));
            res.emit("end");
          });
          cb(res);
        };
        return req;
      },
    };

    const src = fs.readFileSync(
      path.join(__dirname, "..", "commands", "timestamp.js"),
      "utf8",
    );
    const sandbox = Object.assign({}, globalThis, {
      require: (mod) => {
        if (mod === "../utils" || mod === "./utils")
          return {
            readFileBytes: (p) => testData,
            getFileInfo: (p) => ({
              name: "success.bin",
              size: testData.length,
              type: "bin",
              ext: ".bin",
            }),
            fmtSize: (s) => String(s) + " B",
          };
        if (mod === "https" || mod === "node:https") return mockHttps;
        if (mod === "node:fs" || mod === "fs") {
          return Object.assign({}, fs, {
            existsSync: () => false,
            writeFileSync: (p, buf) => {
              writtenData = buf;
            },
            readFileSync: fs.readFileSync,
          });
        }
        if (mod === "node:path" || mod === "path") return path;
        if (mod === "node:crypto" || mod === "crypto") return require("crypto");
        return require(mod);
      },
      __dirname: path.resolve(__dirname, "..", "commands"),
      module: { exports: {} },
      exports: {},
      console: {
        log: (...args) => logs.push(args.join(" ")),
        error: (...args) => logs.push(args.join(" ")),
      },
      process: Object.assign({}, process, { exit: () => {} }),
      Buffer: Buffer,
      URL: URL,
    });
    vm.runInNewContext(src, sandbox, {
      filename: path.resolve(__dirname, "..", "commands", "timestamp.js"),
    });
    const { runTimestamp } = sandbox.module.exports;

    await runTimestamp("create", "success.bin", {});

    assert.ok(writtenData, "Should have written OTS data");
    const allOutput = logs.join(" ");
    assert.ok(
      allOutput.includes("Complete"),
      "Should indicate complete OTS, got: " + allOutput,
    );
  });
});
