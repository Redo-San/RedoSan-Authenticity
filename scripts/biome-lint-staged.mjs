#!/usr/bin/env node
// Runs Biome from the repo root with the centralized biome.json so lint-staged
// file paths (relative or absolute) resolve deterministically on Windows.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..");
const configPath = path.join(repoRoot, ".tools", "Developer_Toolkit", "biome.json");

if (!existsSync(configPath)) {
  console.error("biome-lint-staged: biome.json not found in .tools/Developer_Toolkit");
  process.exit(1);
}

const args = process.argv.slice(2).map((p) =>
  (path.isAbsolute(p) ? p : path.join(repoRoot, p)).replace(/\\/g, "/"),
);

// Biome skips hidden files/dirs (.github, .gitignore, ...) by default; drop
// them from the command so lint-staged still passes for e.g. workflow YAMLs.
const visible = args.filter(
  (p) => !p.split("/").some((seg) => seg.length > 0 && seg.startsWith(".")),
);
if (visible.length === 0) process.exit(0);

const cmd = `npx @biomejs/biome check --write --config-path "${configPath.replace(/\\/g, "/")}" ${visible.map((a) => JSON.stringify(a)).join(" ")}`;
const res = spawnSync(cmd, {
  cwd: repoRoot,
  stdio: "inherit",
  shell: true,
});
process.exit(res.status === null ? 1 : res.status);
