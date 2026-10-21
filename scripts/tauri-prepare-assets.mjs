#!/usr/bin/env node
// Tauri prepack: copy the static site into dist-tauri/ and rewrite the
// root-absolute "/RedoSan-Authenticity/" navigation prefix to relative so
// pages work under Tauri's tauri://localhost custom protocol.
// Wired as beforeDevCommand/beforeBuildCommand in src-tauri/tauri.conf.json.
// Exits 1 if any root-absolute prefix survives the rewrite (build gate).
// Plan: .Plans/TAURI-WXT-DISTRIBUTION-PLAN.md section A3.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist-tauri");

// Explicit allowlist — never a blind recursive copy of the repo (plan A3.1).
const ALLOWLIST = [
  "index.html",
  "favicon.ico",
  "Style",
  "Watermark",
  "Audio_Watermark",
  "Pixel_Injection",
  "Document_Watermark",
  "Fingerprint",
  "C2PA",
  "Certificate",
  "Decentralized_Identity_DID",
  "Timestamp",
  "Metadata",
  "Forensic",
  "ID_Forge",
  "Converter",
  "Assistant",
  "Face_Biometric",
  "Iris_Biometric",
  "Voice_Biometric",
  "vendor",
  "manifest.webmanifest",
];

const TEXT_EXT = new Set([".html", ".js", ".json", ".webmanifest", ".css"]);

// Root-absolute prefix occurrences: "/RedoSan-Authenticity/ , '/RedoSan-Authenticity/
// and the backtick form. https:// URLs (canonical, OG, GitHub) are untouched.
const REWRITE_PAIRS = [
  ['"/RedoSan-Authenticity/', '"./'],
  ["'/RedoSan-Authenticity/", "'./"],
  ["`/RedoSan-Authenticity/", "`./"],
];

// A surviving root-absolute reference: the slash before "RedoSan-Authenticity/"
// is not preceded by a URL host character (letters, digits, :, ., _, ~, -).
const ROOT_ABS_RE = /(^|[^A-Za-z0-9:._~-])\/RedoSan-Authenticity\//;

/**
 * Recursively list files under dir, skipping dotfiles and Thumbs.db.
 * @param {string} dir - directory to walk
 * @returns {string[]} absolute paths of all files
 */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "Thumbs.db" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/**
 * Copy the allowlisted site into dist-tauri/, rewrite the root-absolute
 * prefix, then fail the build if any survivor remains.
 * @returns {void} exits 1 on missing allowlist entry or gate failure
 */
function main() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  let fileCount = 0;
  let totalBytes = 0;
  let rewrittenFiles = 0;
  let rewrittenHits = 0;

  for (const entry of ALLOWLIST) {
    const src = path.join(ROOT, entry);
    if (!existsSync(src)) {
      if (entry === "manifest.webmanifest") continue; // optional (plan A3.1)
      console.error(`[tauri-prepack] missing allowlist entry: ${entry}`);
      process.exit(1);
    }
    const dst = path.join(DIST, entry);
    mkdirSync(path.dirname(dst), { recursive: true });
    cpSync(src, dst, {
      recursive: true,
      filter: (from) => {
        const base = path.basename(from);
        return !base.startsWith(".") && base !== "Thumbs.db";
      },
    });
  }

  for (const file of walk(DIST)) {
    fileCount += 1;
    totalBytes += statSync(file).size;
    if (!TEXT_EXT.has(path.extname(file).toLowerCase())) continue;
    const before = readFileSync(file, "utf8");
    let after = before;
    let hits = 0;
    for (const [from, to] of REWRITE_PAIRS) {
      let idx = after.indexOf(from);
      while (idx !== -1) {
        hits += 1;
        idx = after.indexOf(from, idx + from.length);
      }
      after = after.split(from).join(to);
    }
    if (hits > 0) {
      writeFileSync(file, after);
      rewrittenFiles += 1;
      rewrittenHits += hits;
    }
  }

  // Build gate (plan A3.2): zero root-absolute occurrences may remain.
  const survivors = [];
  for (const file of walk(DIST)) {
    if (!TEXT_EXT.has(path.extname(file).toLowerCase())) continue;
    const text = readFileSync(file, "utf8");
    if (ROOT_ABS_RE.test(text)) survivors.push(path.relative(DIST, file));
  }
  if (survivors.length > 0) {
    for (const rel of survivors) {
      console.error(`[tauri-prepack] root-absolute prefix survives: ${rel}`);
    }
    console.error(
      `[tauri-prepack] FAIL: ${survivors.length} file(s) still reference /RedoSan-Authenticity/`,
    );
    process.exit(1);
  }

  const mb = (totalBytes / 1024 / 1024).toFixed(2);
  console.log(
    `[tauri-prepack] ${fileCount} files, ${mb} MiB -> dist-tauri/; ` +
      `rewrote ${rewrittenHits} prefix occurrence(s) in ${rewrittenFiles} file(s); gate: 0 survivors`,
  );
}

main();
