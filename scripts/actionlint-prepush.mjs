#!/usr/bin/env node
/**
 * Pre-push hook: runs actionlint only when .github/workflows/ files are
 * in the pushed range. Skips silently when no workflows changed.
 *
 * Works on Windows (PowerShell) and POSIX via `git diff --name-only`.
 */
import { execSync } from "node:child_process";

const ACTIONLINT = "actionlint";

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

try {
  // actionlint runs against all workflows by default
  execSync(ACTIONLINT, { stdio: "inherit" });
  console.log("actionlint: all workflows OK");
} catch {
  // actionlint printed its own error output
  process.exit(1);
}
