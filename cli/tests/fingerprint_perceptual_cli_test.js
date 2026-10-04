const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");

const CLI = path.join(__dirname, "..", "index.js");
const PNG = path.join(__dirname, "fixtures", "testimg_64x64.png");

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
    timeout: 60000,
  });
}

// `hashing_perceptual.js` defines ahash/dhash/phash/whash; `hashing.js` only
// calls them. The CLI must load both files or the perceptual block throws
// "globalThis.ahash is not a function" and silently drops the hashes.
describe("CLI fingerprint — perceptual hashes", () => {
  it("computes all four perceptual hashes for an image", () => {
    const r = run(["fingerprint", PNG, "--json"]);
    assert.equal(r.status, 0, r.stderr || "process failed");

    for (const key of ["ahash", "dhash", "phash", "whash"]) {
      const re = new RegExp(`"${key}"\\s*:\\s*"[0-9a-f]+"`);
      assert.match(r.stdout, re, `stdout should contain a ${key} hex digest`);
    }
    assert.ok(
      !r.stderr.includes("Perceptual hash error"),
      `stderr should be free of perceptual errors: ${r.stderr}`,
    );
  });

  it("renders the perceptual section in human-readable output", () => {
    const r = run(["fingerprint", PNG]);
    assert.equal(r.status, 0, r.stderr || "process failed");
    assert.match(r.stdout, /Perceptual \(image hashes\):/);
    assert.ok(
      !r.stderr.includes("Perceptual hash error"),
      `stderr should be free of perceptual errors: ${r.stderr}`,
    );
  });

  it("leaves perceptual hashes out for a non-image file", () => {
    const r = run([
      "fingerprint",
      path.join(__dirname, "fixtures", "test.txt"),
      "--json",
    ]);
    assert.equal(r.status, 0, r.stderr || "process failed");
    assert.ok(
      !r.stdout.includes("perceptual_hashes"),
      "non-image input should not produce perceptual hashes",
    );
  });
});
