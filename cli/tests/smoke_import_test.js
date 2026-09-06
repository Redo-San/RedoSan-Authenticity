const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CLI = path.join(__dirname, "..", "index.js");

function run(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: cwd || path.resolve(__dirname, ".."),
    encoding: "utf8",
    timeout: 60000,
  });
}

describe("CLI smoke (real binary)", () => {
  it("--help exits 0 with usage output", () => {
    const r = run(["--help"]);
    assert.equal(r.status, 0);
    assert.ok(r.stdout.length > 0, "stdout should be non-empty");
    assert.match(r.stdout, /Usage: redosan/);
  });

  it("did generate exits 0 and prints the DID", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "redosan-smoke-"));
    try {
      const r = run(["did", "generate", "--algo", "Ed25519"], tmp);
      assert.equal(r.status, 0, r.stderr || "process failed");
      assert.match(r.stdout, /DID generated: did:key:/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("did sign (missing file) exits non-zero with error text", () => {
    const r = run(["did", "sign"]);
    assert.notEqual(r.status, 0, "missing-arg path must fail");
    assert.ok(
      /File argument required/.test(r.stderr || ""),
      "stderr should mention the missing argument",
    );
  });
});
