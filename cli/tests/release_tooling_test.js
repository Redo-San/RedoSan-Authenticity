"use strict";

// Regression coverage for the release tooling: the guards must pass on the
// current tree, and README generation must understand git-cliff release
// bodies (grouped under `### Features`, not "What's Changed").

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const pkg = require(path.join(ROOT, "package.json"));

/**
 * Run a Node script from the repository root.
 * @param {string[]} args - Script path and arguments.
 * @returns {{status: number|null, stdout: string, stderr: string}} Result.
 */
function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120_000,
  });
}

test("release guards pass on the repository", () => {
  for (const script of [
    "scripts/check-version-sync.mjs",
    "scripts/check-package-files.mjs",
  ]) {
    const result = runNode([script]);
    assert.equal(result.status, 0, `${script}\n${result.stderr}`);
  }
});

test("README generation consumes a git-cliff release body", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "redosan-readme-"));
  const readme = path.join(dir, "README.md");
  fs.copyFileSync(path.join(ROOT, "README.md"), readme);

  const body = [
    "### Features",
    "",
    "- add the release guard",
    "",
    "### Bug Fixes",
    "",
    "- keep the package README current",
  ].join("\n");

  try {
    const result = runNode([
      "scripts/update-readme.js",
      `--readme=${readme}`,
      `--repo-root=${ROOT}`,
      "--release-version=v9.9.9",
      `--release-body=${body}`,
    ]);
    assert.equal(result.status, 0, result.stderr);

    const out = fs.readFileSync(readme, "utf8");
    const start = out.indexOf("<!-- BOT:START whats-new -->");
    const end = out.indexOf("<!-- BOT:END whats-new -->", start);
    const region = out.slice(start, end);

    assert.match(region, /^## What's New in v9\.9\.9$/m);
    assert.match(region, /^- add the release guard$/m);
    assert.match(region, /^- keep the package README current$/m);
    assert.match(region, new RegExp(`<summary><b>v${pkg.version}</b>`));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
