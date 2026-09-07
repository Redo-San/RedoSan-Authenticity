"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_URL = "https://github.com/Redo-San/RedoSan-Authenticity";

const UNIT_NAME_RE = /(_test|\.test)\.(js|mjs)$/;
const UNIT_LEADING_RE = /^test-.*\.(js|mjs)$/;
const E2E_NAME_RE = /_test\.(js|mjs)$/;

const EXCLUDED_TEST_DIRS = new Set(["e2e", "fixtures", "a11y"]);

const WORKFLOW_CATEGORIES = [
  {
    name: "AI Review",
    re: /ai-review|gemini|ollama|reviewdog|eslint-review|^review$/,
  },
  {
    name: "PR Management",
    re: /auto-assign|branch-name|pr-title|pr-size|pr-body|cross-ref|labeler|label-actions|label-sync|pr-stats/,
  },
  {
    name: "Security",
    re: /codeql|semgrep|zizmor|malware|npm-audit|dependency-review|security|scorecard|secret|permissions|pwn-hunter|abom/,
  },
  {
    name: "Quality",
    re: /a11y|backstop|dead-css|dom-review|e2e-coverage|file-size|size-limit|performance|mutat|spell|cspell|madge|depcheck|knip|codebase-audit|html-hint|css-lint|markdownlint|typedoc|console-log/,
  },
  {
    name: "Maintenance",
    re: /broken-links|translate|stale|todo-issues|milestone|lock-closed|request-info|release|dependabot|welcome|uptime|copilot|slash-command|minimal-dispatch/,
  },
  { name: "Core", re: /./ },
];

/**
 * Parse CLI flags (both `--flag value` and `--flag=value` forms).
 *
 * @param {string[]} argv - Raw command-line arguments.
 * @returns {Object} Normalized CLI arguments merged with environment defaults.
 */
function parseArgs(argv) {
  const args = { readme: "README.md", repoRoot: process.cwd() };
  const camel = (flag) =>
    flag.replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const withValue = (flag) => {
    const i = argv.indexOf(flag);
    if (i !== -1 && argv[i + 1]) args[camel(flag)] = argv[i + 1];
  };
  for (const flag of [
    "--readme",
    "--repo-root",
    "--release-version",
    "--release-name",
    "--release-body",
  ]) {
    const prefixed = argv.find((a) => a.startsWith(`${flag}=`));
    if (prefixed) args[camel(flag)] = prefixed.slice(flag.length + 1);
    else withValue(flag);
  }
  args.releaseVersion =
    args.releaseVersion || process.env.RELEASE_VERSION || "";
  args.releaseName = args.releaseName || process.env.RELEASE_NAME || "";
  args.releaseBody = args.releaseBody || process.env.RELEASE_BODY || "";
  return args;
}

/**
 * Recursively collect every file path below a directory.
 *
 * @param {string} dir - Directory to walk.
 * @param {string[]} [out] - Accumulator for collected file paths.
 * @returns {string[]} Full paths of every file under `dir`.
 */
function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_TEST_DIRS.has(entry.name)) walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

/**
 * Tell whether a file name follows the unit test naming rules.
 *
 * @param {string} name - File base name.
 * @returns {boolean} True when the name matches a unit test pattern.
 */
function isUnitFile(name) {
  return UNIT_NAME_RE.test(name) || UNIT_LEADING_RE.test(name);
}

/**
 * Count test declarations (`test(...)`/`it(...)`) inside a test file.
 *
 * @param {string} file - Path to a test file.
 * @returns {number} Number of detected test declarations.
 */
function countDeclarations(file) {
  const text = fs.readFileSync(file, "utf8");
  let count = (text.match(/\btest\(\s*['"]/g) || []).length;
  count += (text.match(/\bit\(\s*['"]/g) || []).length;
  return count;
}

/**
 * Compute the testing statistics for the repository.
 *
 * @param {string} repoRoot - Repository root directory.
 * @returns {{unit: number, e2e: number, tests: number, testsRounded: number}} Testing stats.
 */
function computeStats(repoRoot) {
  const testsDir = path.join(repoRoot, "cli", "tests");
  const unitFiles = walk(path.join(testsDir)).filter((f) =>
    isUnitFile(path.basename(f)),
  );
  const e2eFiles = walk(path.join(testsDir, "e2e")).filter((f) =>
    E2E_NAME_RE.test(path.basename(f)),
  );
  const tests = [...unitFiles, ...e2eFiles].reduce(
    (sum, f) => sum + countDeclarations(f),
    0,
  );
  return {
    unit: unitFiles.length,
    e2e: e2eFiles.length,
    tests,
    testsRounded: Math.floor(tests / 100) * 100,
  };
}

/**
 * Convert a hyphenated workflow file name into a display label.
 *
 * @param {string} basename - Workflow base name without extension.
 * @returns {string} Human-readable display name.
 */
function displayName(basename) {
  return basename
    .split("-")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

/**
 * Group workflow file names by their matching category.
 *
 * @param {string[]} files - Workflow file names.
 * @returns {Map<string, string[]>} Category name to display names.
 */
function categorize(files) {
  const groups = new Map(WORKFLOW_CATEGORIES.map((c) => [c.name, []]));
  for (const file of files) {
    const name = path.basename(file, path.extname(file));
    const match = WORKFLOW_CATEGORIES.find((c) => c.re.test(name));
    groups.get(match.name).push(displayName(name));
  }
  return groups;
}

/**
 * Build the "Testing" summary paragraph.
 *
 * @param {{unit: number, e2e: number, tests: number, testsRounded: number}} stats - Testing stats.
 * @returns {string} Markdown paragraph for the Testing section.
 */
function testingBlock(stats) {
  return (
    `${stats.unit} unit test files + ${stats.e2e} E2E suites with ` +
    `${stats.testsRounded.toLocaleString(
      "en-US",
    )}+ tests using \`node:test\` ` +
    "(zero external test dependencies) + Playwright:"
  );
}

/**
 * Build the CI/CD workflows table section.
 *
 * @param {string} repoRoot - Repository root directory.
 * @returns {string} Markdown for the workflows section.
 */
function workflowsBlock(repoRoot) {
  const workflowsDir = path.join(repoRoot, ".github", "workflows");
  const files = fs
    .readdirSync(workflowsDir)
    .filter((n) => /\.(ya?ml)$/.test(n) && !n.startsWith("."));
  const groups = categorize(files);
  const rows = [];
  for (const category of WORKFLOW_CATEGORIES) {
    const entries = groups.get(category.name);
    if (entries.length === 0) continue;
    rows.push(`| **${category.name}** | ${entries.join(", ")} |`);
  }
  return [
    `The project includes ${files.length} GitHub Actions workflows:`,
    "",
    "| Category | Workflows |",
    "| -------- | --------- |",
    ...rows,
  ].join("\n");
}

/**
 * Extract markdown list bullets from a release body's "What's Changed" section.
 *
 * @param {string} [body] - GitHub release body.
 * @returns {string[]} Bullet lines under the "What's Changed" heading.
 */
function bulletsFromRelease(body) {
  const lines = String(body || "").split("\n");
  const out = [];
  let capture = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      if (/what'?s changed/i.test(line)) {
        capture = true;
        continue;
      }
      if (capture) break;
      continue;
    }
    if (capture && /^-\s+/.test(line)) out.push(line);
  }
  return out;
}

/**
 * Turn bullet lines into a short archive summary.
 *
 * @param {string[]} bullets - Bullet lines of the current active version.
 * @returns {string} Short summary label for the archive.
 */
function summaryFromBullets(bullets) {
  if (bullets.length === 0) return "Release notes";
  let first = bullets[0]
    .replace(/^[-*]\s+/, "")
    .trim()
    .replace(/\*\*/g, "");
  const cut = first.search(/\s[—-]\s|\s:|\s,/);
  return cut > -1 ? first.slice(0, cut).trim() : first.slice(0, 80).trim();
}

/**
 * Build an archive `<details>` block for a previous version.
 *
 * @param {string} version - Version label.
 * @param {string} summary - Short summary label.
 * @param {string[]} bullets - Bullet lines of that version.
 * @returns {string} Markdown details block.
 */
function detailsBlock(version, summary, bullets) {
  return [
    "<details>",
    `<summary><b>${version}</b> — ${summary}</summary>`,
    "",
    ...bullets,
    "",
    "</details>",
  ].join("\n");
}

/**
 * Compute the new "What's New" region content, archiving the previous version.
 *
 * @param {string} currentInner - Content between the markers.
 * @param {string} releaseVersion - New release version.
 * @param {string} [releaseBody] - Release body for the new bullets.
 * @returns {string} New "What's New" region content.
 */
function whatsNewBlock(currentInner, releaseVersion, releaseBody) {
  const inner = currentInner.trimStart();
  const match = inner.match(/^## What's New in (\S+)\s*\n\n([\s\S]*)$/);
  const oldVersion = match ? match[1] : "previous";
  if (oldVersion === releaseVersion) return inner.trimEnd();
  const rest = match ? match[2] : "";
  const detailsIdx = rest.indexOf("\n<details>");
  const activeBlock = detailsIdx === -1 ? rest : rest.slice(0, detailsIdx);
  const detailsBlocks =
    detailsIdx === -1 ? "" : rest.slice(detailsIdx + 1).trimStart();
  const activeBullets = activeBlock
    .split("\n")
    .filter((l) => /^\s*[-*]\s+/.test(l.trim()));

  const releaseBullets = bulletsFromRelease(releaseBody);
  const newBullets =
    releaseBullets.length > 0
      ? releaseBullets
      : [
          `- See the full release notes: ${REPO_URL}/releases/tag/${releaseVersion}`,
        ];

  const archive = detailsBlock(
    oldVersion,
    summaryFromBullets(activeBullets),
    activeBullets,
  );

  return [
    `## What's New in ${releaseVersion}`,
    "",
    ...newBullets,
    "",
    archive,
    detailsBlocks ? `\n${detailsBlocks}` : "",
  ]
    .join("\n")
    .trimEnd();
}

/**
 * Build one BOT marker comment.
 *
 * @param {string} id - Marker id.
 * @param {boolean} [end] - True for the END marker.
 * @returns {string} HTML comment marker.
 */
function marker(id, end) {
  return `<!-- BOT:${end ? "END" : "START"} ${id} -->`;
}

/**
 * Extract the content between a marker pair.
 *
 * @param {string} text - Full document.
 * @param {string} id - Marker id.
 * @returns {string} Content between the START and END markers.
 */
function regionContent(text, id) {
  const start = marker(id, false);
  const end = marker(id, true);
  const si = text.indexOf(start);
  const ei = text.indexOf(end, si === -1 ? 0 : si + start.length);
  if (si === -1 || ei === -1) {
    throw new Error(`README marker pair "${id}" not found`);
  }
  return text.slice(si + start.length, ei);
}

/**
 * Replace the content between a marker pair.
 *
 * @param {string} text - Full document.
 * @param {string} id - Marker id.
 * @param {string} content - New region content.
 * @returns {string} Updated document.
 */
function replaceRegion(text, id, content) {
  const start = marker(id, false);
  const end = marker(id, true);
  const si = text.indexOf(start);
  const ei = text.indexOf(end, si === -1 ? 0 : si + start.length);
  if (si === -1 || ei === -1) {
    throw new Error(`README marker pair "${id}" not found`);
  }
  return (
    text.slice(0, si + start.length) + "\n" + content + "\n" + text.slice(ei)
  );
}

/**
 * Command entry point: regenerate the generated README sections.
 * Writes the README when anything changed and prints a stats JSON summary.
 */
function main() {
  const args = parseArgs(process.argv.slice(2));
  const readmePath = path.resolve(args.repoRoot, args.readme);
  const original = fs.readFileSync(readmePath, "utf8");
  let current = original;

  const stats = computeStats(args.repoRoot);
  current = replaceRegion(current, "testing-stats", testingBlock(stats));
  current = replaceRegion(current, "workflows", workflowsBlock(args.repoRoot));

  if (args.releaseVersion) {
    const inner = regionContent(current, "whats-new");
    current = replaceRegion(
      current,
      "whats-new",
      whatsNewBlock(inner, args.releaseVersion, args.releaseBody),
    );
  }

  const changed = current !== original;
  if (changed) fs.writeFileSync(readmePath, current);

  const summary = {
    unit: stats.unit,
    e2e: stats.e2e,
    tests: stats.tests,
    workflows: fs
      .readdirSync(path.join(args.repoRoot, ".github", "workflows"))
      .filter((n) => /\.(ya?ml)$/.test(n) && !n.startsWith(".")).length,
    changed,
  };
  console.log(JSON.stringify(summary));

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  }
}

main();
