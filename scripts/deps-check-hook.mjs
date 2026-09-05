#!/usr/bin/env node
// post-merge / post-rewrite hook: refresh npm deps when package manifests change.
// Usage: node scripts/deps-check-hook.mjs post-merge|post-rewrite
//  - post-merge  compares HEAD@{1} (or ORIG_HEAD) with HEAD.
//  - post-rewrite reads "old new" sha pairs from stdin (one per line).
// Set REDOSAN_DRY_RUN=1 to print the decision without running `npm install`.
import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const mode = process.argv[2];
const DRY = process.env.REDOSAN_DRY_RUN === "1";

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

console.log("deps-check: running `npm install` to refresh dependencies...");
const res = spawnSync("npm", ["install"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(res.status === null ? 1 : res.status);
