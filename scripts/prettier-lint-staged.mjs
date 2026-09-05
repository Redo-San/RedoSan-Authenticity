#!/usr/bin/env node
// Runs Prettier from the repo root with the centralized .prettierrc so lint-staged
// file paths (relative or absolute) resolve deterministically on Windows.
//
// Mirrors the file scope of .github/workflows/prettier-check.yml: only *.js,
// *.css, *.html and *.json files that are NOT excluded there (i18n-data*.js,
// i18n.js, Style/pages/, Style/shared.js, cli/) are passed to Prettier. Note
// that --ignore-path alone cannot protect a file lint-staged passes explicitly,
// so the exclusion list is applied here before invoking Prettier.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..");
const toolDir = path.join(repoRoot, ".tools", "Developer_Toolkit");
const configPath = path.join(toolDir, ".prettierrc");
const ignorePath = path.join(toolDir, ".prettierignore");

if (!existsSync(configPath)) {
  console.error(
    "prettier-lint-staged: .prettierrc not found in .tools/Developer_Toolkit",
  );
  process.exit(1);
}

const EXTENSIONS = new Set(["js", "css", "html", "json"]);
const EXCLUDED = [
  /i18n-data\.js/,
  /i18n\.js/,
  /^Style\/pages\//,
  /^Style\/shared\.js$/,
  /^cli\//,
];

const rootUrl = repoRoot.replace(/\\/g, "/");

const files = process.argv
  .slice(2)
  .map((p) =>
    (path.isAbsolute(p) ? p : path.join(repoRoot, p)).replace(/\\/g, "/"),
  )
  .filter((p) => {
    const ext = p.split(".").pop();
    if (!EXTENSIONS.has(ext)) return false;
    const rel = p.startsWith(rootUrl + "/") ? p.slice(rootUrl.length + 1) : p;
    if (rel === "package-lock.json") return false;
    return !EXCLUDED.some((re) => re.test(rel));
  });

if (files.length === 0) process.exit(0);

const cmd = `prettier --write --config "${configPath.replace(/\\/g, "/")}" --ignore-path "${ignorePath.replace(/\\/g, "/")}" ${files.map((f) => JSON.stringify(f)).join(" ")}`;
const res = spawnSync(cmd, {
  cwd: repoRoot,
  stdio: "inherit",
  shell: true,
});
process.exit(res.status === null ? 1 : res.status);
