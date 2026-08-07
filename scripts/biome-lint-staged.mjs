#!/usr/bin/env node
// Runs Biome from the repo root with the centralized biome.json so lint-staged
// file paths (relative or absolute) resolve deterministically on Windows.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..");
const configPath = path.join(
	repoRoot,
	".tools",
	"Developer_Toolkit",
	"biome.json",
);

if (!existsSync(configPath)) {
	console.error(
		"biome-lint-staged: biome.json not found in .tools/Developer_Toolkit",
	);
	process.exit(1);
}

const args = process.argv
	.slice(2)
	.map((p) =>
		(path.isAbsolute(p) ? p : path.join(repoRoot, p)).replace(/\\/g, "/"),
	);

// Biome skips hidden files/dirs (.github, .gitignore, ...) and package-lock.json
// by default; drop them from the command so lint-staged still passes for e.g.
// workflow YAMLs.
const visible = args.filter((p) => {
	const base = path.basename(p);
	if (base === "package-lock.json") return false;
	return !p.split("/").some((seg) => seg.length > 0 && seg.startsWith("."));
});
if (visible.length === 0) process.exit(0);

// The biome.json files.includes whitelist only covers **/cli/**/*.js; any file
// outside that scope makes biome exit 1 with "paths provided but ignored".
// Mirror the whitelist here so lint-staged passes for JSON/YAML/MD edits that
// biome is not configured to check.
const biomeConfig = JSON.parse(
	readFileSync(configPath, "utf8"),
);
const includes = biomeConfig.files?.includes ?? [];
const allowed = visible.filter((p) => {
	const negated = includes.filter((inc) => inc.startsWith("!"));
	if (negated.some((inc) => globMatches(p, inc.slice(1)))) return false;
	return includes.some(
		(inc) => !inc.startsWith("!") && globMatches(p, inc),
	);
});
if (allowed.length === 0) process.exit(0);

const cmd = `npx @biomejs/biome check --write --config-path "${configPath.replace(/\\/g, "/")}" ${allowed.map((a) => JSON.stringify(a)).join(" ")}`;
const res = spawnSync(cmd, {
	cwd: repoRoot,
	stdio: "inherit",
	shell: true,
});
process.exit(res.status === null ? 1 : res.status);

function globMatches(p, pattern) {
	const rel = p.split("/");
	const pat = pattern.split("/");
	if (pat[0] === "**") pat.shift();
	if (pat.at(-1) === "**") pat.pop();
	const star = pat.indexOf("**");
	const prefix = star === -1 ? pat : pat.slice(0, star);
	const suffix = star === -1 ? [] : pat.slice(star + 1);
	if (prefix.length > rel.length) return false;
	if (suffix.length > rel.length) return false;
	return (
		prefix.every((s, i) => rel[i] === s) &&
		suffix.every((s, i) => rel[rel.length - suffix.length + i] === s)
	);
}
