#!/usr/bin/env node
// Runs oxlint on staged JS files with the repo-root config.
// Converts absolute paths (lint-staged on Windows) to relative paths so
// oxc#1124 (absolute-path ignore bug) is avoided.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..");

const files = process.argv
  .slice(2)
  .map((p) =>
    path
      .relative(repoRoot, path.isAbsolute(p) ? p : path.join(repoRoot, p))
      .replace(/\\/g, "/"),
  )
  .filter((p) => !p.startsWith("node_modules/") && p.endsWith(".js"));

if (files.length === 0) process.exit(0);

const cmd = `npx oxlint --config "${path.join(repoRoot, "oxlint.config.json").replace(/\\/g, "/")}" ${files.map((f) => JSON.stringify(f)).join(" ")}`;
const res = spawnSync(cmd, { cwd: repoRoot, stdio: "inherit", shell: true });
process.exit(res.status === null ? 1 : res.status);
