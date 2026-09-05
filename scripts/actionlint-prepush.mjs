#!/usr/bin/env node
/**
 * Pre-push hook: runs actionlint only when .github/workflows/ files are
 * in the pushed range. Skips silently when no workflows changed.
 *
 * Works on Windows (PowerShell) and POSIX via `git diff --name-only`.
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const ACTIONLINT = "actionlint";
const TOOLKIT_ACTIONLINT = path.resolve(
  ".tools/Developer_Toolkit/actionlint.exe",
);

function git(args) {
  return execSync(`git ${args}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

// Determine the pushed range (push.default=upstream on this repo)
let range;
try {
  // If upstream is set, compare @{u}..HEAD
  range = `${git("rev-parse @{u}")}..${git("rev-parse HEAD")}`;
} catch {
  try {
    // Fallback: origin/main..HEAD
    range = `${git("rev-parse origin/main")}..${git("rev-parse HEAD")}`;
  } catch {
    // Cannot determine range, skip
    process.exit(0);
  }
}

const files = git(`diff --name-only ${range}`).split("\n").filter(Boolean);
const workflowFiles = files.filter((f) => f.startsWith(".github/workflows/"));

if (workflowFiles.length === 0) {
  // No workflow changes in this push — skip actionlint
  process.exit(0);
}

console.log(
  `actionlint: checking ${workflowFiles.length} changed workflow(s)...`,
);

// Probe PATH first, then fall back to the on-disk toolkit binary.
let result = spawnSync(ACTIONLINT, [], { stdio: "inherit" });
if (
  result.error &&
  result.error.code === "ENOENT" &&
  existsSync(TOOLKIT_ACTIONLINT)
) {
  console.log(`actionlint: not on PATH, using ${TOOLKIT_ACTIONLINT}`);
  result = spawnSync(TOOLKIT_ACTIONLINT, [], { stdio: "inherit" });
}

if (result.error) {
  console.warn(
    `actionlint: binary not found (PATH or ${TOOLKIT_ACTIONLINT}); skipping workflow lint.`,
  );
  process.exit(0);
}

// actionlint printed its own error output
if (result.status === 0) {
  console.log("actionlint: all workflows OK");
}
process.exit(result.status ?? 1);
