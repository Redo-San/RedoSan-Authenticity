#!/usr/bin/env node
// Runs oxlint on staged JS files with the repo-root config.
// Converts absolute paths (lint-staged on Windows) to relative paths so
// oxc#1124 (absolute-path ignore bug) is avoided.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..");

// Drops node_modules/ plus everything oxlint itself ignores (oxlint.config.json
// ignorePatterns) so a commit whose only JS change lives there does not fail
// with "No files found to lint" (following oxc#1124 spirit). Matched by path
// segment because the config also uses nested globs such as `**/tests/**`, which
// a first-segment check misses (e.g. extension/tests/*.test.js).
const IGNORED_SEGMENTS = new Set([
  "node_modules",
  "coverage",
  "vendor",
  "backstop_data",
  "certs",
  "docs",
  "test-results",
  "tests",
  ".tools",
  ".opencode",
  ".agents",
  "agent",
  ".claude",
  "skills",
  ".env",
  ".lh13",
  ".lighthouseci",
  ".playwright-mcp",
  ".stryker-tmp",
  "dist-tauri",
]);

const IGNORED_PREFIXES = ["src-tauri/target/", "src-tauri/gen/"];

const files = process.argv
  .slice(2)
  .map((p) =>
    path
      .relative(repoRoot, path.isAbsolute(p) ? p : path.join(repoRoot, p))
      .replace(/\\/g, "/"),
  )
  .filter(
    (p) =>
      p.endsWith(".js") &&
      !p.split("/").some((segment) => IGNORED_SEGMENTS.has(segment)) &&
      !IGNORED_PREFIXES.some((prefix) => p.startsWith(prefix)),
  );

if (files.length === 0) process.exit(0);

const cmd = `npx oxlint --config "${path.join(repoRoot, "oxlint.config.json").replace(/\\/g, "/")}" ${files.map((f) => JSON.stringify(f)).join(" ")}`;
const res = spawnSync(cmd, { cwd: repoRoot, stdio: "inherit", shell: true });
process.exit(res.status === null ? 1 : res.status);
