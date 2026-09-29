#!/usr/bin/env node
// post-merge / post-rewrite hook: refresh npm deps when package manifests change.
// Usage: node scripts/deps-check-hook.mjs post-merge|post-rewrite
//  - post-merge  compares HEAD@{1} (or ORIG_HEAD) with HEAD.
//  - post-rewrite reads "old new" sha pairs from stdin (one per line).
// Set REDOSAN_DRY_RUN=1 to print the decision without running `npm install`.
// Set REDOSAN_DEPS_CHECK_FORCE=1 to run the install even on an older npm.
import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const mode = process.argv[2];
const DRY = process.env.REDOSAN_DRY_RUN === "1";
const FORCE = process.env.REDOSAN_DEPS_CHECK_FORCE === "1";

// npm >= 11 understands the `libc` field on optional native binaries
// (@biomejs/cli, @oxlint/binding, @oxc-parser/binding, jscpd). npm 10 drops
// those fields silently when it rewrites package-lock.json, so a developer on
// npm 10 who merges a dependency change commits a lockfile that can install a
// glibc build on a musl (Alpine) runner. CI uses Node 24 (npm 11), so the
// committed lockfile is the npm 11 shape; keep it that way locally too.
const MIN_NPM_MAJOR = 11;
const IS_WIN = process.platform === "win32";

/**
 * Reads the major version of the npm on PATH.
 * @returns {number|null} major version, or null when it cannot be determined
 */
function npmMajorVersion() {
  try {
    const out = execSync("npm --version", {
      encoding: "utf8",
      shell: IS_WIN,
    }).trim();
    const major = Number.parseInt(out.split(".", 1)[0], 10);
    return Number.isFinite(major) ? major : null;
  } catch {
    return null;
  }
}

/**
 * Counts `libc` markers in the lockfile, which tag the glibc/musl variant of
 * optional native binaries.
 * @returns {number|null} marker count, or null when the lockfile is unreadable
 */
function countLibcMarkers() {
  try {
    return (readFileSync("package-lock.json", "utf8").match(/"libc":/g) || [])
      .length;
  } catch {
    return null;
  }
}

/**
 *
 * @param fromRef
 * @param toRef
 */
function filesBetween(fromRef, toRef) {
  try {
    const out = execSync(`git diff --name-only ${fromRef} ${toRef}`, {
      encoding: "utf8",
    });
    return out
      .split("\n", -1)
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 *
 */
function changedFiles() {
  const set = new Set();
  const collect = (files) => files.forEach((f) => set.add(f));

  if (mode === "post-merge") {
    try {
      const base = execSync("git rev-parse HEAD@{1}", {
        encoding: "utf8",
      }).trim();
      collect(filesBetween(base, "HEAD"));
    } catch {
      try {
        collect(filesBetween("ORIG_HEAD", "HEAD"));
      } catch {
        // First commit or no prior HEAD: nothing to compare.
      }
    }
  } else {
    const stdin = readFileSync(0, "utf8");
    for (const line of stdin.split("\n")) {
      const [oldSha] = line.trim().split(/\s+/, 1);
      if (oldSha) collect(filesBetween(oldSha, "HEAD"));
    }
  }
  return set;
}

const changed = changedFiles();
const needsInstall =
  changed.has("package.json") || changed.has("package-lock.json");

if (!needsInstall) process.exit(0);

console.log(
  "deps-check: package.json / package-lock.json changed after this operation.",
);
if (DRY) {
  console.log("deps-check: [dry-run] would run `npm install`.");
  process.exit(0);
}

const major = npmMajorVersion();
if (!FORCE && major !== null && major < MIN_NPM_MAJOR) {
  console.warn(
    `deps-check: npm ${major} is older than the required npm ${MIN_NPM_MAJOR}; skipping \`npm install\`.`,
  );
  console.warn(
    "deps-check: npm < 11 strips the `libc` markers from package-lock.json, which breaks glibc/musl",
  );
  console.warn(
    "deps-check: detection for optional native binaries. Upgrade npm (`npm i -g npm@latest`), or set",
  );
  console.warn(
    "deps-check: REDOSAN_DEPS_CHECK_FORCE=1 to override and install anyway.",
  );
  console.warn(
    "deps-check: node_modules is left untouched; run `npm ci` yourself once npm is upgraded.",
  );
  process.exit(0);
}

const before = countLibcMarkers();
console.log(
  `deps-check: running \`npm install\` (npm ${major ?? "unknown"}) to refresh dependencies...`,
);
const res = spawnSync("npm", ["install"], {
  stdio: "inherit",
  shell: IS_WIN,
});

const after = countLibcMarkers();
if (before !== null && after !== null && after < before) {
  console.warn(
    `deps-check: warning - \`libc\` markers dropped from ${before} to ${after} in package-lock.json.`,
  );
  console.warn(
    "deps-check: restore the lockfile with `git checkout -- package-lock.json` and upgrade to npm >= 11.",
  );
  if (res.status === 0) process.exit(0);
}

process.exit(res.status === null ? 1 : res.status);
