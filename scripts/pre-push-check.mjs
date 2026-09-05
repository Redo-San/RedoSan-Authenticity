#!/usr/bin/env node
// pre-push: validate commit messages (commitlint) and whitespace over the
// commits about to be pushed. CI runs no commitlint job (only pr-title-lint),
// so this closes that gap without duplicating the heavy CI suite.
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("@commitlint/cli/package.json");
const binRel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.commitlint;
const cliPath = require.resolve(`@commitlint/cli/${binRel}`);
const CONFIG = ".tools/Developer_Toolkit/commitlint.config.mjs";

function git(args, opts = {}) {
  return execFileSync("git", args, { encoding: "utf8", ...opts });
}

function outgoingRange() {
  try {
    git(["rev-parse", "--abbrev-ref", "@{u}"], { stdio: "ignore" });
    return "@{u}..HEAD";
  } catch {
    try {
      git(["rev-parse", "--verify", "origin/main"], { stdio: "ignore" });
      return "origin/main..HEAD";
    } catch {
      return null;
    }
  }
}

const rangeExpr = outgoingRange();
if (!rangeExpr) {
  console.log(
    "pre-push: no upstream or origin/main to compare against - skipping.",
  );
  process.exit(0);
}

try {
  git(["diff", "--check", rangeExpr], { stdio: ["ignore", "inherit", "pipe"] });
} catch (error) {
  const detail = (error.stderr || "").toString();
  console.error(
    `pre-push: whitespace errors or leftover conflict markers in the outgoing diff:\n${detail}`,
  );
  process.exit(1);
}

const commits = git(["rev-list", rangeExpr]).trim().split("\n").filter(Boolean);
if (commits.length === 0) process.exit(0);

for (const sha of commits) {
  const msg = git(["log", "--format=%B", "-1", sha]);
  const res = spawnSync(process.execPath, [cliPath, "--config", CONFIG], {
    input: msg,
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (res.status !== 0) {
    console.error(
      `pre-push: commit ${sha.slice(0, 7)} does not pass commitlint. Fix the message before pushing.`,
    );
    process.exit(res.status === null ? 1 : res.status);
  }
}

console.log(
  `pre-push: validated ${commits.length} outgoing commit message(s).`,
);
