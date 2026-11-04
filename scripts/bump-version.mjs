#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- every path is a
   fixed repository-relative literal joined to ROOT, never external input. */
// Bump the project version in every manifest that carries it.
//
// `npm version` alone only updates package.json + package-lock.json; the Tauri
// config and both Cargo files are edited here so `npm run check:release` stays
// green after a bump. Usage:
//
//   node scripts/bump-version.mjs 2.1.1
//
// The README "What's New" section is intentionally not touched: it needs the
// release notes, so update it with scripts/update-readme.js in the same commit.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = (process.argv[2] || "").replace(/^v/, "");

/**
 * Validate a semver string without a backtracking-prone regex.
 * @param {string} value - Candidate version.
 * @returns {boolean} True when value is a valid `MAJOR.MINOR.PATCH[-pre]`.
 */
function isSemver(value) {
  if (value.length === 0 || value.length > 64) return false;
  const dash = value.indexOf("-");
  const core = dash === -1 ? value : value.slice(0, dash);
  const pre = dash === -1 ? "" : value.slice(dash + 1);
  const coreParts = core.split(".");
  if (coreParts.length !== 3) return false;
  if (!coreParts.every((part) => /^\d+$/.test(part))) return false;
  if (dash === -1) return true;
  return (
    pre.length > 0 &&
    pre.split(".").every((part) => /^[0-9A-Za-z-]+$/.test(part))
  );
}

if (!isSemver(target)) {
  console.error("usage: node scripts/bump-version.mjs <semver>   (e.g. 2.1.1)");
  process.exit(1);
}

/**
 * Read a file relative to the repository root.
 * @param {string} rel - Repository-relative path.
 * @returns {string} File contents.
 */
function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

/**
 * Write a file relative to the repository root, preserving a trailing newline.
 * @param {string} rel - Repository-relative path.
 * @param {string} content - New contents.
 * @returns {void}
 */
function write(rel, content) {
  writeFileSync(path.join(ROOT, rel), content, "utf8");
}

/**
 * Serialize JSON the same way npm does (2-space indent, trailing newline).
 * @param {unknown} value - JSON value.
 * @returns {string} Serialized JSON.
 */
function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const pkg = JSON.parse(read("package.json"));
const previous = pkg.version;
if (previous === target) {
  console.log(`[bump] already at ${target} - nothing to do`);
  process.exit(0);
}

pkg.version = target;
write("package.json", json(pkg));

const lock = JSON.parse(read("package-lock.json"));
lock.version = target;
if (lock.packages?.[""]) lock.packages[""].version = target;
write("package-lock.json", json(lock));

// Cargo.toml: only the [package] section, never a dependency version.
const cargoToml = read("src-tauri/Cargo.toml");
const pkgSectionStart = cargoToml.indexOf("[package]");
const nextSection = cargoToml.indexOf("\n[", pkgSectionStart + 1);
const pkgSectionEnd = nextSection === -1 ? cargoToml.length : nextSection;
const cargoSection = cargoToml.slice(pkgSectionStart, pkgSectionEnd);
const cargoNameMatch = cargoSection.match(/^name\s*=\s*"([^"]+)"/m);
if (pkgSectionStart === -1 || !cargoNameMatch) {
  console.error("[bump] could not parse the [package] section of Cargo.toml");
  process.exit(1);
}
const cargoName = cargoNameMatch[1];
const bumpedCargoToml =
  cargoToml.slice(0, pkgSectionStart) +
  cargoSection.replace(/^version\s*=\s*"[^"]*"/m, `version = "${target}"`) +
  cargoToml.slice(pkgSectionEnd);
if (bumpedCargoToml === cargoToml) {
  console.error("[bump] could not find the [package] version in Cargo.toml");
  process.exit(1);
}
write("src-tauri/Cargo.toml", bumpedCargoToml);

// Cargo.lock: the workspace member entry, which cargo rewrites on next build
// anyway; editing it here keeps `--locked` builds and the guard consistent.
// Locate it by literal markers instead of a RegExp built from the crate name.
const cargoLock = read("src-tauri/Cargo.lock");
const eol = cargoLock.includes("\r\n") ? "\r\n" : "\n";
const lockMarker = `[[package]]${eol}name = "${cargoName}"${eol}version = "`;
const lockStart = cargoLock.indexOf(lockMarker);
const lockVersionStart = lockStart + lockMarker.length;
const lockVersionEnd =
  lockStart === -1 ? -1 : cargoLock.indexOf('"', lockVersionStart);
if (lockStart === -1 || lockVersionEnd === -1) {
  console.error(`[bump] could not locate ${cargoName} in Cargo.lock`);
  process.exit(1);
}
const bumpedCargoLock =
  cargoLock.slice(0, lockVersionStart) +
  target +
  cargoLock.slice(lockVersionEnd);
write("src-tauri/Cargo.lock", bumpedCargoLock);

// Tauri accepts a literal semver or a path to package.json. Only rewrite the
// literal form with a targeted replacement: re-serializing the JSON would
// reflow its compact arrays and bury the version bump in formatting noise.
const tauriRaw = read("src-tauri/tauri.conf.json");
const tauri = JSON.parse(tauriRaw);
if (typeof tauri.version === "string" && tauri.version.endsWith(".json")) {
  console.log("[bump] tauri.conf.json uses a package.json path - skipped");
} else {
  const bumpedTauri = tauriRaw.replace(
    /"version"\s*:\s*"[^"]*"/,
    `"version": "${target}"`,
  );
  if (bumpedTauri === tauriRaw || JSON.parse(bumpedTauri).version !== target) {
    console.error(
      '[bump] could not update the "version" field in tauri.conf.json',
    );
    process.exit(1);
  }
  write("src-tauri/tauri.conf.json", bumpedTauri);
}

console.log(`[bump] ${previous} -> ${target}`);
console.log("  package.json, package-lock.json, src-tauri/Cargo.toml,");
console.log("  src-tauri/Cargo.lock, src-tauri/tauri.conf.json");
console.log(
  `Next: run RELEASE_VERSION=v${target} node scripts/update-readme.js, then npm run check:release.`,
);
