#!/usr/bin/env node
/* eslint-disable unicorn/no-exports-in-scripts -- the pure helpers are the
   test seam for cli/tests/release_assets_test.js; the CLI still runs only when
   this file is executed directly. */
// Mirror the version-independent release assets onto a freshly published
// release and refresh SHA256SUMS.txt over every mirrored binary.
//
// The browser-extension set and the Windows desktop installers do not change
// with every main release, but users expect the complete download set on the
// release they are reading. This script copies the newest available asset of
// each family from an earlier release and writes one checksum file that covers
// every mirrored binary.
//
// Usage:
//   node scripts/sync-release-assets.mjs --repo owner/name --target v2.1.1
//   node scripts/sync-release-assets.mjs --repo owner/name --target v2.1.1 --dry-run
//   node scripts/sync-release-assets.mjs --repo owner/name --target v2.1.1 --source v2.1.0
//
// Authentication: GITHUB_TOKEN or GH_TOKEN with `contents: write`. A dry run
// works anonymously for public repositories.
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const API = "https://api.github.com";
const UPLOAD_API = "https://uploads.github.com";
const CHECKSUMS = "SHA256SUMS.txt";
const USER_AGENT = "redosan-release-assets";

// Each family is copied as a unit from its newest source release, so a release
// can never mix extension versions or pick up only one installer.
export const ASSET_FAMILIES = {
  extension: [
    /^redosan-authenticity-inspector-[0-9.]+-(?:chrome|firefox|sources)\.zip$/,
    /^RedoSan-Inspector-Setup-[0-9.]+\.exe$/,
  ],
  desktop: [
    /^RedoSan\.Authenticity_[0-9.]+_x64-setup\.exe$/,
    /^RedoSan\.Authenticity_[0-9.]+_x64_en-US\.msi$/,
  ],
};

/**
 * Check whether an asset belongs to one of the mirrored families.
 * @param {string} name - Release asset name.
 * @returns {boolean} True for extension archives and desktop installers.
 */
export function isMirrorable(name) {
  return Object.values(ASSET_FAMILIES).some((patterns) =>
    patterns.some((pattern) => pattern.test(name)),
  );
}

/**
 * Pick the newest published release that carries each asset family.
 * @param {Array<{tag_name: string, draft: boolean, assets: Array<{name: string}>}>} releases
 *   Releases returned by the GitHub API, newest first.
 * @param {string} targetTag - Tag being populated; never used as a source.
 * @returns {Array<{name: string, id: number, size: number, digest?: string}>}
 *   Assets to mirror, deduplicated by name.
 */
export function collectAssets(releases, targetTag) {
  const picked = new Map();
  for (const patterns of Object.values(ASSET_FAMILIES)) {
    const release = releases.find(
      (candidate) =>
        !candidate.draft &&
        candidate.tag_name !== targetTag &&
        candidate.assets.some((asset) =>
          patterns.some((pattern) => pattern.test(asset.name)),
        ),
    );
    if (!release) continue;
    for (const asset of release.assets) {
      if (patterns.some((pattern) => pattern.test(asset.name))) {
        picked.set(asset.name, asset);
      }
    }
  }
  const assets = [];
  for (const asset of picked.values()) assets.push(asset);
  return assets;
}

/**
 * Render SHA256SUMS.txt in `sha256sum -c` format.
 * @param {Array<{name: string, sha256: string}>} entries - Hashed assets.
 * @returns {string} Newline-terminated checksum file.
 */
export function formatChecksums(entries) {
  if (entries.length === 0) return "";
  return `${entries
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => `${entry.sha256}  ./${entry.name}`)
    .join("\n")}\n`;
}

/**
 * Validate a `owner/name` repository slug.
 * @param {string} value - Candidate slug.
 * @returns {boolean} True for a plain GitHub slug.
 */
export function isValidRepo(value) {
  const parts = value.split("/");
  return (
    parts.length === 2 &&
    parts.every(
      (part) => /^[A-Za-z0-9_.-]+$/.test(part) && part !== "." && part !== "..",
    )
  );
}

/**
 * Validate a tag name before it reaches a URL path.
 * @param {string} value - Candidate tag.
 * @returns {boolean} True for a conservative tag name.
 */
export function isValidTag(value) {
  return (
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) && !value.includes("..")
  );
}

/**
 * Parse the command line.
 * @param {string[]} argv - Arguments without `node` and the script path.
 * @returns {{repo: string, target: string, source: string|null, dryRun: boolean}}
 *   Parsed options.
 */
export function parseArgs(argv) {
  const options = {
    repo: process.env.GITHUB_REPOSITORY || "",
    target: process.env.GITHUB_REF_NAME || "",
    source: null,
    dryRun: false,
  };
  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--repo" || arg === "--target" || arg === "--source") {
      const value = args.shift();
      if (!value) throw new Error(`${arg} needs a value`);
      if (arg === "--repo") options.repo = value;
      if (arg === "--target") options.target = value;
      if (arg === "--source") options.source = value;
    } else {
      throw new Error(`unknown argument: ${String(arg)}`);
    }
  }
  if (!isValidRepo(options.repo)) {
    throw new Error("--repo must be owner/name (or set GITHUB_REPOSITORY)");
  }
  if (!isValidTag(options.target)) {
    throw new Error(
      "--target is not a valid tag name (or set GITHUB_REF_NAME)",
    );
  }
  if (options.source !== null && !isValidTag(options.source)) {
    throw new Error("--source is not a valid tag name");
  }
  return options;
}

/**
 * Hash a buffer with SHA-256.
 * @param {Buffer} buffer - Asset bytes.
 * @returns {string} Lowercase hex digest.
 */
function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Call the GitHub REST API.
 * @param {string} token - API token, or an empty string for anonymous reads.
 * @param {string} path - Path below `/repos` or another absolute API path.
 * @param {object} [options] - Request options.
 * @param {string} [options.method] - HTTP method.
 * @param {Buffer} [options.body] - Request body.
 * @param {string} [options.accept] - Accept header.
 * @param {string} [options.base] - API base URL.
 * @returns {Promise<Response>} Successful response.
 */
async function request(token, path, options = {}) {
  const headers = {
    Accept: options.accept || "application/vnd.github+json",
    "User-Agent": USER_AGENT,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body) headers["Content-Type"] = "application/octet-stream";
  const response = await fetch(`${options.base || API}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body,
    redirect: "manual",
    signal: AbortSignal.timeout(300_000),
  });
  if (response.status < 200 || response.status >= 300) {
    const detail = await response.text();
    throw new Error(
      `${options.method || "GET"} ${path} -> ${response.status} ${detail.slice(0, 200)}`,
    );
  }
  return response;
}

/**
 * List every release, newest first.
 * @param {string} token - API token.
 * @param {string} repo - `owner/name` slug.
 * @returns {Promise<Array<object>>} Release objects.
 */
async function listReleases(token, repo) {
  const releases = [];
  let page = 1;
  for (;;) {
    const response = await request(
      token,
      `/repos/${repo}/releases?per_page=100&page=${page}`,
    );
    const batch = await response.json();
    releases.push(...batch);
    const link = response.headers.get("link") || "";
    if (!link.includes('rel="next"') || batch.length === 0) break;
    page += 1;
  }
  return releases;
}

/**
 * Download one release asset without leaking the token to the CDN.
 * @param {string} token - API token.
 * @param {string} repo - `owner/name` slug.
 * @param {number} assetId - Asset identifier.
 * @returns {Promise<Buffer>} Asset bytes.
 */
async function downloadAsset(token, repo, assetId) {
  const headers = {
    Accept: "application/octet-stream",
    "User-Agent": USER_AGENT,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const target = `${API}/repos/${repo}/releases/assets/${assetId}`;
  const response = await fetch(target, {
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(300_000),
  });
  // The asset endpoint answers with a redirect to a signed CDN URL. Follow it
  // without the Authorization header so the token never leaves api.github.com.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error(`asset ${assetId} redirect has no location`);
    const cdn = await fetch(location, {
      redirect: "follow",
      signal: AbortSignal.timeout(300_000),
    });
    if (!cdn.ok) throw new Error(`asset ${assetId} CDN -> ${cdn.status}`);
    return Buffer.from(await cdn.arrayBuffer());
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `asset ${assetId} -> ${response.status} ${detail.slice(0, 200)}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Upload one asset to a release, retrying transient failures.
 * @param {string} token - API token.
 * @param {string} repo - `owner/name` slug.
 * @param {number} releaseId - Target release identifier.
 * @param {string} name - Asset name.
 * @param {Buffer} body - Asset bytes.
 * @returns {Promise<void>} Resolves after the upload succeeds.
 */
async function uploadAsset(token, repo, releaseId, name, body) {
  const path = `/repos/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await request(token, path, { method: "POST", body, base: UPLOAD_API });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2)
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}

/**
 * Replace an existing release asset.
 * @param {string} token - API token.
 * @param {string} repo - `owner/name` slug.
 * @param {number} assetId - Existing asset identifier.
 * @returns {Promise<void>} Resolves after deletion.
 */
async function deleteAsset(token, repo, assetId) {
  await request(token, `/repos/${repo}/releases/assets/${assetId}`, {
    method: "DELETE",
  });
}

/**
 * Mirror assets and refresh the checksum file.
 * @param {object} options - Parsed options plus `token`.
 * @returns {Promise<object>} Summary of the run.
 */
export async function syncReleaseAssets(options) {
  const { token, repo, target, source, dryRun } = options;
  const releases = await listReleases(token, repo);
  const targetRelease =
    releases.find((release) => release.tag_name === target) || null;
  if (!targetRelease) throw new Error(`release ${target} not found`);

  const pool = source
    ? releases.filter((release) => release.tag_name === source)
    : releases;
  if (source && pool.length === 0) {
    throw new Error(`source release ${source} not found`);
  }
  const wanted = collectAssets(pool, target);
  if (wanted.length === 0) {
    return { target, uploaded: [], skipped: [], checksums: false };
  }

  const existing = new Map(
    targetRelease.assets.map((asset) => [asset.name, asset]),
  );
  const hashes = new Map();
  const uploaded = [];
  const skipped = [];

  for (const asset of wanted) {
    const current = existing.get(asset.name);
    if (dryRun) {
      if (current) skipped.push(asset.name);
      else uploaded.push(asset.name);
      continue;
    }
    const body = await downloadAsset(token, repo, asset.id);
    const digest = sha256(body);
    hashes.set(asset.name, digest);
    if (current && current.digest === `sha256:${digest}`) {
      skipped.push(asset.name);
      continue;
    }
    if (current) await deleteAsset(token, repo, current.id);
    await uploadAsset(token, repo, targetRelease.id, asset.name, body);
    uploaded.push(asset.name);
  }

  if (dryRun) {
    return {
      target,
      uploaded,
      skipped,
      checksums: wanted.length > 0,
    };
  }

  const refreshed = await request(
    token,
    `/repos/${repo}/releases/${targetRelease.id}`,
  ).then((response) => response.json());
  for (const asset of refreshed.assets) {
    if (isMirrorable(asset.name) && !hashes.has(asset.name)) {
      hashes.set(
        asset.name,
        sha256(await downloadAsset(token, repo, asset.id)),
      );
    }
  }
  const checksumEntries = [];
  for (const [name, digest] of hashes) {
    checksumEntries.push({ name, sha256: digest });
  }
  const checksumText = formatChecksums(checksumEntries);
  const checksumBuffer = Buffer.from(checksumText, "utf8");
  const previous = refreshed.assets.find((asset) => asset.name === CHECKSUMS);
  if (previous) {
    const previousBody = await downloadAsset(token, repo, previous.id);
    if (previousBody.equals(checksumBuffer)) {
      return { target, uploaded, skipped, checksums: false };
    }
    await deleteAsset(token, repo, previous.id);
  }
  await uploadAsset(token, repo, targetRelease.id, CHECKSUMS, checksumBuffer);
  return { target, uploaded, skipped, checksums: true };
}

/**
 * Run the command line entry point.
 * @returns {Promise<void>} Resolves when the sync finishes.
 */
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  const summary = await syncReleaseAssets({ ...options, token });
  const action = options.dryRun ? "would upload" : "uploaded";
  const checksums = summary.checksums
    ? options.dryRun
      ? "would refresh"
      : "updated"
    : "unchanged";
  console.error(
    `[release-assets] ${options.target}: ${action} ${summary.uploaded.length}, ` +
      `skipped ${summary.skipped.length}, checksums ${checksums}`,
  );
  for (const name of summary.uploaded) console.error(`  + ${name}`);
  for (const name of summary.skipped) console.error(`  = ${name}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`[release-assets] ${error.message}`);
    process.exit(1);
  });
}
