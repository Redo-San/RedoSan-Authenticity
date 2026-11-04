#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- every path is a
   fixed repository-relative literal joined to ROOT, never external input. */
// Package-content guard: `files` in package.json must point at real paths and
// must not sweep in build-time assets that are gitignored locally.
//
// Why this exists: listing the bare `vendor` directory made a local `npm pack`
// produce a 42 MB tarball (ffmpeg/onnx/wasm blobs) while CI produced 1.7 MB,
// because those blobs exist only after `npm run assets:desktop`. The explicit
// vendor file list and this size ceiling keep local and CI tarballs identical.
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const SKIP_DIRS = new Set(["node_modules", ".git"]);

const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
const entries = Array.isArray(pkg.files) ? pkg.files : [];
const errors = [];
const oversized = [];

/**
 * Recursively collect files below a path.
 * @param {string} abs - Absolute file or directory path.
 * @param {string[]} [out] - Accumulator for file paths.
 * @returns {string[]} Absolute file paths.
 */
function walk(abs, out = []) {
  const stats = lstatSync(abs);
  // Never follow symlinks: a linked directory could escape the repository or
  // make the walk unbounded.
  if (stats.isSymbolicLink()) return out;
  if (!stats.isDirectory()) {
    out.push(abs);
    return out;
  }
  const entries = readdirSync(abs, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    walk(path.join(abs, entry.name), out);
  }
  return out;
}

for (const entry of entries) {
  const abs = path.resolve(ROOT, entry);
  const rel = path.relative(ROOT, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    errors.push(`files entry is outside the repository: ${entry}`);
    continue;
  }
  let files;
  try {
    files = walk(abs);
  } catch {
    errors.push(`files entry does not exist: ${entry}`);
    continue;
  }
  for (const file of files) {
    const size = lstatSync(file).size;
    if (size > MAX_FILE_BYTES) {
      oversized.push({
        path: path.relative(ROOT, file).replace(/\\/g, "/"),
        mib: size / (1024 * 1024),
      });
    }
  }
}

console.error(
  `[package-files] ${entries.length} entries, ${oversized.length} oversized file(s)`,
);

if (oversized.length > 0) {
  oversized.sort((a, b) => b.mib - a.mib);
  for (const { path: file, mib } of oversized.slice(0, 10)) {
    errors.push(`${file} is ${mib.toFixed(1)} MiB (limit 2.0 MiB)`);
  }
  errors.push(
    'Replace directory-wide entries such as "vendor" with explicit files; build-time assets (ffmpeg, onnx, wasm, human-models) are gitignored and must not ship.',
  );
}

if (errors.length > 0) {
  console.error("[package-files] FAIL");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.error(
  "[package-files] OK - every shipped entry exists and stays small",
);
