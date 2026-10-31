// Release-time guard for the packaged manifests. `wxt zip` rewrites the
// manifest per browser, so the config-level assertions in
// tests/manifest.test.js cannot see what actually ships. This script runs in
// .github/workflows/wxt-release.yml after `npm run zip` and refuses to submit a
// package whose permissions drifted away from the v1 scope
// (.Plans/TAURI-WXT-DISTRIBUTION-PLAN.md, B1).
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, ".output");
const VERSION = JSON.parse(
  readFileSync(path.join(ROOT, "package.json"), "utf8"),
).version;

/**
 * Permissions the listing copy in STORE_LISTING.md justifies, per target. An
 * addition here must also be justified there and in the store dashboard.
 */
const TARGETS = [
  {
    dir: "chrome-mv3",
    label: "Chrome MV3",
    manifestVersion: 3,
    permissions: ["activeTab", "contextMenus", "scripting", "storage"],
    zips: ["-chrome.zip"],
  },
  {
    dir: "firefox-mv2",
    label: "Firefox MV2",
    manifestVersion: 2,
    permissions: ["activeTab", "contextMenus", "storage"],
    zips: ["-firefox.zip", "-sources.zip"],
  },
];

/** The AMO add-on ID; AMO rejects an upload whose manifest disagrees. */
const FIREFOX_ID = "inspector@redo-san.github.io";

/** Patterns that would grant access to every page at runtime. */
const FORBIDDEN_STRINGS = ["<all_urls>", "*://*/*"];

const problems = [];

/**
 * Record a failure when a release invariant does not hold.
 * @param {boolean} ok Whether the invariant holds.
 * @param {string} message Description used in the failure report.
 * @returns {void}
 */
function requireInvariant(ok, message) {
  if (!ok) problems.push(message);
}

/**
 * Assert one built manifest against the target's allowlist.
 * @param {object} target Entry from TARGETS.
 * @param {string} raw Serialized manifest.json from the build output.
 * @returns {void}
 */
function checkManifest(target, raw) {
  /** @type {Record<string, unknown>} */
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    problems.push(`${target.label}: manifest.json is not valid JSON: ${error}`);
    return;
  }

  requireInvariant(
    manifest.manifest_version === target.manifestVersion,
    `${target.label}: manifest_version is ${manifest.manifest_version}, expected ${target.manifestVersion}`,
  );
  requireInvariant(
    manifest.version === VERSION,
    `${target.label}: manifest version ${manifest.version} does not match package.json ${VERSION}`,
  );
  requireInvariant(
    JSON.stringify([...(manifest.permissions ?? [])].sort()) ===
      JSON.stringify([...target.permissions].sort()),
    `${target.label}: permissions ${JSON.stringify(manifest.permissions)} differ from the reviewed set ${JSON.stringify(target.permissions)}`,
  );
  requireInvariant(
    (manifest.host_permissions ?? []).length === 0,
    `${target.label}: host_permissions must stay empty, found ${JSON.stringify(manifest.host_permissions)}`,
  );
  requireInvariant(
    (manifest.optional_permissions ?? []).length === 0,
    `${target.label}: optional_permissions must stay empty, found ${JSON.stringify(manifest.optional_permissions)}`,
  );
  requireInvariant(
    (manifest.optional_host_permissions ?? []).length === 0,
    `${target.label}: optional_host_permissions must stay empty, found ${JSON.stringify(manifest.optional_host_permissions)}`,
  );
  requireInvariant(
    !("content_scripts" in manifest),
    `${target.label}: content_scripts is registered at load time; injection must stay on demand`,
  );
  requireInvariant(
    !("web_accessible_resources" in manifest),
    `${target.label}: web_accessible_resources would expose the injected bundle to pages`,
  );

  // The context menu and the on-demand injection both live in the background
  // entrypoint; a different or missing worker would break the v1 flow silently
  // after a WXT upgrade.
  const background = manifest.background ?? {};
  if (target.manifestVersion === 3) {
    requireInvariant(
      background.service_worker === "background.js",
      `${target.label}: background.service_worker is ${JSON.stringify(background.service_worker)}, expected "background.js"`,
    );
    requireInvariant(
      !("scripts" in background) && !("page" in background),
      `${target.label}: background must stay an MV3 service worker`,
    );
  } else {
    requireInvariant(
      Array.isArray(background.scripts) &&
        background.scripts.length === 1 &&
        background.scripts[0] === "background.js",
      `${target.label}: background.scripts is ${JSON.stringify(background.scripts)}, expected ["background.js"]`,
    );
    requireInvariant(
      background.persistent !== true,
      `${target.label}: background.persistent must stay false (event page)`,
    );
  }

  // Strip the localized strings first: a description that happens to mention a
  // pattern is not a grant, and the checks above already require every
  // permission-bearing array to be empty.
  const scan = raw
    .replaceAll(manifest.name ?? "", "")
    .replaceAll(manifest.description ?? "", "");
  for (const token of FORBIDDEN_STRINGS) {
    requireInvariant(
      !scan.includes(token),
      `${target.label}: manifest mentions ${token}`,
    );
  }

  if (target.manifestVersion === 2) {
    const gecko = manifest.browser_specific_settings?.gecko;
    requireInvariant(
      gecko?.id === FIREFOX_ID,
      `${target.label}: gecko id is ${JSON.stringify(gecko?.id)}, expected ${FIREFOX_ID}`,
    );
  }

  console.log(
    `${target.label}: v${manifest.version} permissions=${JSON.stringify(manifest.permissions)} host_permissions=[]`,
  );
}

/**
 * Report the zips WXT produced for one target and require them to exist.
 * @param {object} target Entry from TARGETS.
 * @param {string[]} zips File names in .output.
 * @returns {void}
 */
function checkZips(target, zips) {
  for (const suffix of target.zips) {
    const name = zips.find((entry) => entry.endsWith(suffix));
    requireInvariant(
      Boolean(name),
      `${target.label}: no *${suffix} in .output; run \`npm run zip\` and \`npm run zip:firefox\``,
    );
    if (name) {
      // `name` comes from the .output listing filtered above, never from input.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const bytes = statSync(path.join(OUTPUT, name)).size;
      console.log(
        `${target.label}: ${name} (${bytes.toLocaleString("en-US")} bytes)`,
      );
    }
  }
}

const zips = readdirSync(OUTPUT).filter((entry) => entry.endsWith(".zip"));

for (const target of TARGETS) {
  try {
    // `target.dir` is one of the two literals in TARGETS above.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const raw = readFileSync(
      path.join(OUTPUT, target.dir, "manifest.json"),
      "utf8",
    );
    checkManifest(target, raw);
  } catch {
    problems.push(
      `${target.label}: missing .output/${target.dir}/manifest.json; run \`npm run zip\` and \`npm run zip:firefox\``,
    );
  }
  checkZips(target, zips);
}

if (problems.length > 0) {
  for (const message of problems) {
    console.error(`::error::${message}`);
  }
  console.error(`\n${problems.length} packaging invariant(s) failed.`);
  process.exit(1);
}

console.log("\nStore packages match the reviewed v1 scope.");
