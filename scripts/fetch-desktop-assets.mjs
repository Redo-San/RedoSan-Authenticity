#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- every path is
   built as path.join(ROOT, <entry>.dest) from the pinned ASSETS and
   COMMITTED_VENDOR manifests plus the fixed repo ROOT; no user or network
   input reaches these calls */
// Fetch the heavy desktop offline assets into vendor/ (gitignored dirs;
// plan A3). The small committed libs are check-only COMMITTED_VENDOR entries
// (git is the source of truth; never downloaded or overwritten here).
// The pin table lives in scripts/desktop-assets-manifest.mjs (single source
// of truth, also imported by tauri-prepare-assets.mjs).
// Every entry is pinned by SHA-256 + size; downloads are verified
// before landing and skipped entirely when already valid (idempotent).
// Required before `npx tauri build` (enforced by tauri-prepare-assets.mjs);
// the web build keeps its CDN fallbacks and does not need this script.
// Usage:
//   node scripts/fetch-desktop-assets.mjs          # fetch/repair
//   node scripts/fetch-desktop-assets.mjs --check  # verify only, no network
//   node scripts/fetch-desktop-assets.mjs --force  # re-download even when
//                                                   # already valid (recovery)
//
// Pinning: every sha256/size in the manifest was computed from the artifact
// downloaded from its pinned `url` when the manifest was authored (plan A3),
// then re-verified on every fetch and by `--check`.
// Re-pinning (upstream version bump): point `url` at the new release,
// download it once, recompute that entry's sha256 and size, run `--check`,
// and commit the manifest update together with the upstream version note.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ASSETS, COMMITTED_VENDOR } from "./desktop-assets-manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_ONLY = process.argv.includes("--check");
const FORCE = process.argv.includes("--force");

/**
 * @param {Buffer} buf - raw bytes to digest
 * @returns {string} lowercase hex SHA-256
 */
function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * @param {string} abs - absolute path of the candidate file
 * @param {{sha256: string, size: number}} asset - pinned manifest entry
 * @returns {boolean} true when the file exists with the pinned hash + size
 */
function isValid(abs, asset) {
  if (!existsSync(abs)) return false;
  const buf = readFileSync(abs);
  return buf.length === asset.size && sha256(buf) === asset.sha256;
}

/**
 * Download one asset, verify the pin, then land it atomically.
 * @param {(typeof ASSETS)[number]} asset - pinned manifest entry to fetch
 * @returns {Promise<void>} rejects on any verification failure
 */
async function download(asset) {
  const res = await fetch(asset.url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${asset.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== asset.size) {
    throw new Error(
      `size mismatch: got ${buf.length}, pinned ${asset.size} (${asset.url})`,
    );
  }
  const got = sha256(buf);
  if (got !== asset.sha256) {
    throw new Error(`sha256 mismatch: got ${got} (${asset.url})`);
  }
  const abs = path.join(ROOT, asset.dest);
  const part = abs + ".part";
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(part, buf);
  if (existsSync(abs)) unlinkSync(abs);
  renameSync(part, abs);
}

/**
 * @returns {Promise<void>} exits 1 when any asset is missing or invalid
 */
async function main() {
  let fetched = 0;
  let skipped = 0;
  const failed = [];
  for (const asset of [...ASSETS, ...COMMITTED_VENDOR]) {
    const abs = path.join(ROOT, asset.dest);
    // Committed files are git-managed: never downloaded, never --force
    // overwritten; a mismatch means local corruption or an EOL rewrite.
    if (asset.committed) {
      if (isValid(abs, asset)) skipped += 1;
      else
        failed.push(
          `${asset.dest} (committed file missing or modified - ` +
            `restore with: git checkout -- ${asset.dest})`,
        );
      continue;
    }
    // --force refetches valid files; --check stays offline in every mode.
    if (isValid(abs, asset) && (CHECK_ONLY || !FORCE)) {
      skipped += 1;
      continue;
    }
    if (CHECK_ONLY) {
      failed.push(`${asset.dest} (missing or hash mismatch)`);
      continue;
    }
    if (asset.size >= 1024 * 1024) {
      console.log(
        `fetching ${asset.dest} (${(asset.size / (1024 * 1024)).toFixed(1)} MB)...`,
      );
    }
    try {
      await download(asset);
      fetched += 1;
      console.log(`fetched ${asset.dest} (${asset.size} bytes)`);
    } catch (error) {
      failed.push(`${asset.dest}: ${error.message}`);
    }
  }
  const total = ASSETS.length + COMMITTED_VENDOR.length;
  console.log(
    `[assets:desktop] fetched=${fetched} valid=${skipped} total=${total}` +
      (CHECK_ONLY ? " (check-only)" : ""),
  );
  if (failed.length > 0) {
    for (const line of failed) console.error(`  FAILED ${line}`);
    console.error(
      "[assets:desktop] FAIL: offline assets incomplete - rerun `npm run assets:desktop` " +
        "or fix the network/proxy before building the desktop app",
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[assets:desktop] FAIL: ${error.message}`);
  process.exit(1);
});
