#!/usr/bin/env node
// RedoSan pre-commit large-file guard.
// Blocks staged files >= 10 MiB (override with REDOSAN_ALLOW_LARGE=1),
// warns on 5-10 MiB. Binary blobs are the main target: CI's file-size-budget
// workflow only polices .js/.css/.html/.json and skips vendor/.
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";

const HARD_LIMIT = 10 * 1024 * 1024;
const SOFT_LIMIT = 5 * 1024 * 1024;
const ALLOW = process.env.REDOSAN_ALLOW_LARGE === "1";

let staged = [];
try {
  const out = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    {
      encoding: "utf8",
    },
  );
  staged = out.split("\0").filter(Boolean);
} catch {
  process.exit(0);
}

if (staged.length === 0) process.exit(0);

const big = [];
for (const file of staged) {
  let size;
  try {
    size = statSync(file).size;
  } catch {
    continue;
  }
  const mib = size / (1024 * 1024);
  if (size >= HARD_LIMIT) big.push({ file, size: mib });
  else if (size >= SOFT_LIMIT)
    console.warn(`  WARN: ${file} is ${mib.toFixed(1)} MiB`);
}

if (big.length > 0) {
  console.error("ERROR: staged files exceed the 10 MiB limit:");
  for (const { file, size } of big)
    console.error(`  ${size.toFixed(1)} MiB  ${file}`);
  if (!ALLOW) {
    console.error(
      "Remove the file(s), or set REDOSAN_ALLOW_LARGE=1 to override. CI file-size-budget does not track binary blobs.",
    );
    process.exit(1);
  }
}
