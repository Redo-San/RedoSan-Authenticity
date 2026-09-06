#!/usr/bin/env node
// Runs oxlint on staged JS files with the repo-root config.
// Converts absolute paths (lint-staged on Windows) to relative paths so
// oxc#1124 (absolute-path ignore bug) is avoided.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..");

// Drops node_modules/ plus the roots oxlint itself ignores (oxlint.config.json
// ignorePatterns, e.g. **/.tools/**) so a commit whose only JS change lives
// there does not fail with "No files found to lint" (following oxc#1124 spirit).
const IGNORED_ROOTS = [
  ".tools",
  ".opencode",
  ".agents",
  "agent",
  ".claude",
  "skills",
  ".env",
  "backstop_data",
  "certs",
  "docs",
  ".lh13",
  ".lighthouseci",
  ".playwright-mcp",
  ".stryker-tmp",
  "test-results",
  "tests",
  "cli/tests", // oxlint.config.json `**/tests/**` subsumes cli/ tests
  "vendor",
];

const files = process.argv
  .slice(2)
  .map((p) =>
    path
      .relative(repoRoot, path.isAbsolute(p) ? p : path.join(repoRoot, p))
      .replace(/\\/g, "/"),
  )
  .filter(
    (p) =>
      !p.startsWith("node_modules/") &&
      p.endsWith(".js") &&
      !IGNORED_ROOTS.some((root) => p.startsWith(root + "/")),
  );

if (files.length === 0) process.exit(0);

const cmd = `npx oxlint --config "${path.join(repoRoot, "oxlint.config.json").replace(/\\/g, "/")}" ${files.map((f) => JSON.stringify(f)).join(" ")}`;
const res = spawnSync(cmd, { cwd: repoRoot, stdio: "inherit", shell: true });
process.exit(res.status === null ? 1 : res.status);
