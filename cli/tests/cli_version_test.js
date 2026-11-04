"use strict";

// Guards the contract that `redosan --version` reports the published package
// version. The CLI used to hardcode "1.0.0" while package.json was 2.1.0.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const CLI = path.join(ROOT, "cli", "index.js");
const pkg = require(path.join(ROOT, "package.json"));

/**
 * Run the CLI and return its trimmed stdout.
 * @param {string[]} args - CLI arguments.
 * @returns {string} Trimmed stdout.
 */
function runCli(args) {
  return execFileSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    timeout: 60_000,
  }).trim();
}

test("redosan --version matches package.json", () => {
  assert.equal(runCli(["--version"]), pkg.version);
});

test("redosan -V matches package.json", () => {
  assert.equal(runCli(["-V"]), pkg.version);
});
