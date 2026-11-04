#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- every path is a
   fixed repository-relative literal joined to ROOT, never external input. */
// Release-readiness guard: every manifest that ships or identifies the project
// must agree with package.json, and the README must already announce the
// version being packed.
//
// Why this exists: `redosan --version` printed a hardcoded 1.0.0 and the npm
// tarball shipped a README whose "What's New" announced the previous release.
// Both drifts were invisible to CI. This script runs in `npm run check` and on
// `prepack`, so a mismatched manifest can never reach the registry.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

/**
 * Read and parse a JSON file relative to the repository root.
 * @param {string} rel - Repository-relative path.
 * @returns {unknown} Parsed JSON.
 */
function readJson(rel) {
  return JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));
}

/**
 * Read a UTF-8 text file relative to the repository root.
 * @param {string} rel - Repository-relative path.
 * @returns {string} File contents.
 */
function readText(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

/**
 * Compare one version source against package.json, collecting failures.
 * @param {string} label - Source name shown in the report.
 * @param {string | null} actual - Version found in the source.
 * @param {string} expected - Version from package.json.
 * @returns {void}
 */
function expectVersion(label, actual, expected) {
  if (actual === expected) return;
  errors.push(`${label} is ${actual ?? "missing"}, expected ${expected}`);
}

/**
 * Extract the `[package]` version from a Cargo.toml document.
 * @param {string} text - Cargo.toml contents.
 * @returns {string | null} Version, or null when the section is absent.
 */
function cargoPackageVersion(text) {
  const start = text.indexOf("[package]");
  if (start === -1) return null;
  const next = text.indexOf("\n[", start + 1);
  const section = next === -1 ? text.slice(start) : text.slice(start, next);
  const match = section.match(/^version\s*=\s*"([^"]+)"/m);
  return match ? match[1] : null;
}

/**
 * Extract the workspace package version from a Cargo.lock document.
 * @param {string} text - Cargo.lock contents.
 * @returns {string | null} Version, or null when the entry is absent.
 */
function cargoLockVersion(text) {
  const match = text.match(
    /\[\[package\]\]\r?\nname = "redosan-authenticity"\r?\nversion = "([^"]+)"/,
  );
  return match ? match[1] : null;
}

/**
 * Resolve the Tauri config version, which is either a literal semver or a path
 * to a package.json file (Tauri 2 supports both).
 * @param {unknown} value - `version` value from tauri.conf.json.
 * @returns {string | null} Resolved version.
 */
function tauriVersion(value) {
  if (typeof value !== "string") return null;
  if (!value.endsWith(".json")) return value;
  const abs = path.resolve(ROOT, "src-tauri", value);
  const rel = path.relative(ROOT, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  const resolved = JSON.parse(readFileSync(abs, "utf8"));
  return typeof resolved.version === "string" ? resolved.version : null;
}

const pkg = readJson("package.json");
const version = pkg.version;
console.error(`[version-sync] package.json is ${version}`);

const lock = readJson("package-lock.json");
expectVersion("package-lock.json version", lock.version, version);
expectVersion(
  "package-lock.json packages[''].version",
  lock.packages?.[""]?.version,
  version,
);

const tauri = readJson("src-tauri/tauri.conf.json");
expectVersion(
  "src-tauri/tauri.conf.json version",
  tauriVersion(tauri.version),
  version,
);

expectVersion(
  "src-tauri/Cargo.toml [package].version",
  cargoPackageVersion(readText("src-tauri/Cargo.toml")),
  version,
);

expectVersion(
  "src-tauri/Cargo.lock redosan-authenticity version",
  cargoLockVersion(readText("src-tauri/Cargo.lock")),
  version,
);

const readmeMatch = readText("README.md").match(/^## What's New in v?(\S+)$/m);
expectVersion(
  "README.md What's New",
  readmeMatch ? readmeMatch[1] : null,
  version,
);

try {
  const cliVersion = execFileSync(
    process.execPath,
    [path.join(ROOT, "cli", "index.js"), "--version"],
    { encoding: "utf8", timeout: 60_000 },
  ).trim();
  expectVersion("cli/index.js --version", cliVersion, version);
} catch (error) {
  errors.push(`cli/index.js --version failed: ${error.message}`);
}

// On tag builds the git tag is the last source of truth. Branch builds (CI on
// main/PRs) set GITHUB_REF_NAME too, so only enforce it for v* refs.
const ref = process.env.GITHUB_REF_NAME || "";
if (/^v\d/.test(ref)) expectVersion("git tag", ref, `v${version}`);

if (errors.length > 0) {
  console.error("[version-sync] FAIL");
  for (const error of errors) console.error(`  - ${error}`);
  console.error(
    "Update the listed manifests (or run `node scripts/bump-version.mjs <version>`).",
  );
  process.exit(1);
}

console.error("[version-sync] OK - all version sources agree");
