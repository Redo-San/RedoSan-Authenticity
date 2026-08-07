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
	let match = false;
	for (const pattern of includes) {
		if (pattern.startsWith("!")) continue;
		const negated = includes.filter((inc) => inc.startsWith("!"));
		if (negated.some((inc) => matchPattern(p, inc.slice(1)))) return false;
		if (matchPattern(p, pattern)) match = true;
	}
	return match;
});
if (allowed.length === 0) process.exit(0);

const cmd = `npx @biomejs/biome check --write --config-path "${configPath.replace(/\\/g, "/")}" ${allowed.map((a) => JSON.stringify(a)).join(" ")}`;
const res = spawnSync(cmd, {
	cwd: repoRoot,
	stdio: "inherit",
	shell: true,
});
process.exit(res.status === null ? 1 : res.status);

function matchPattern(p, pattern) {
	const rel = p.split("/");
	const segs = pattern.split("/");
	if (segs[0] === "**") segs.shift();
	if (segs[segs.length - 1] === "**") segs.pop();
	const isDirGlob = segs.some((s) => s.includes("**"));
	return rel.some((_, i) =>
		segs.every((s, j) => (rel[i + j] ?? "").match(globToRegExp(s))),
	);
}

function globToRegExp(glob) {
	return new RegExp(
		`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
	);
}
