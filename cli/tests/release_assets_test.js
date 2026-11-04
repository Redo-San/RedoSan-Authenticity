"use strict";

// Unit coverage for the release-asset mirror: family detection, source
// selection, checksum formatting, and argument validation. Network calls are
// intentionally out of scope; the workflow exercises those on real releases.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "sync-release-assets.mjs");

/**
 * Load the ESM helper module once per test.
 * @returns {Promise<object>} Exported helpers.
 */
async function loadHelpers() {
  return import(pathToFileURL(SCRIPT).href);
}

const EXTENSION = [
  { name: "redosan-authenticity-inspector-0.1.0-chrome.zip", id: 1, size: 10 },
  { name: "redosan-authenticity-inspector-0.1.0-firefox.zip", id: 2, size: 10 },
  { name: "redosan-authenticity-inspector-0.1.0-sources.zip", id: 3, size: 10 },
  { name: "RedoSan-Inspector-Setup-0.1.0.exe", id: 4, size: 10 },
];

const DESKTOP = [
  { name: "RedoSan.Authenticity_2.1.0_x64-setup.exe", id: 5, size: 10 },
  { name: "RedoSan.Authenticity_2.1.0_x64_en-US.msi", id: 6, size: 10 },
];

test("isMirrorable recognises the two release-asset families", async () => {
  const { isMirrorable } = await loadHelpers();
  for (const asset of [...EXTENSION, ...DESKTOP]) {
    assert.equal(isMirrorable(asset.name), true, asset.name);
  }
  for (const name of [
    "CHANGELOG.md",
    "sbom.spdx.json",
    "SHA256SUMS.txt",
    "RedoSan.Authenticity_2.0.1_x64-setup.pkg",
  ]) {
    assert.equal(isMirrorable(name), false, name);
  }
});

test("collectAssets takes each family from its newest published release", async () => {
  const { collectAssets } = await loadHelpers();
  const releases = [
    { tag_name: "v2.1.1", draft: false, assets: [{ name: "CHANGELOG.md" }] },
    {
      tag_name: "v2.1.0",
      draft: false,
      assets: [...EXTENSION, ...DESKTOP],
    },
    {
      tag_name: "desktop-v2.0.1",
      draft: false,
      assets: [
        { name: "RedoSan.Authenticity_2.0.1_x64-setup.exe", id: 7, size: 10 },
        { name: "RedoSan.Authenticity_2.0.1_x64_en-US.msi", id: 8, size: 10 },
      ],
    },
  ];
  const picked = collectAssets(releases, "v2.1.1");
  assert.deepEqual(
    picked.map((asset) => asset.name).sort(),
    [...EXTENSION, ...DESKTOP].map((asset) => asset.name).sort(),
  );
});

test("collectAssets fills each family from a different release", async () => {
  const { collectAssets } = await loadHelpers();
  const releases = [
    { tag_name: "v2.1.1", draft: false, assets: [] },
    { tag_name: "v2.1.0", draft: false, assets: EXTENSION },
    { tag_name: "desktop-v2.0.1", draft: false, assets: DESKTOP },
  ];
  const names = collectAssets(releases, "v2.1.1")
    .map((asset) => asset.name)
    .sort();
  assert.deepEqual(names, [...EXTENSION, ...DESKTOP].map((a) => a.name).sort());
});

test("collectAssets never uses the target release or a draft", async () => {
  const { collectAssets } = await loadHelpers();
  const releases = [
    { tag_name: "v2.1.1", draft: false, assets: EXTENSION },
    { tag_name: "v2.1.0", draft: true, assets: DESKTOP },
  ];
  assert.deepEqual(collectAssets(releases, "v2.1.1"), []);
});

test("formatChecksums sorts names and uses sha256sum syntax", async () => {
  const { formatChecksums } = await loadHelpers();
  const text = formatChecksums([
    { name: "b.zip", sha256: "bb" },
    { name: "a.exe", sha256: "aa" },
  ]);
  assert.equal(text, "aa  ./a.exe\nbb  ./b.zip\n");
  assert.equal(formatChecksums([]), "");
});

test("parseArgs accepts explicit options and the dry run flag", async () => {
  const { parseArgs } = await loadHelpers();
  const options = parseArgs([
    "--repo",
    "owner/repo",
    "--target",
    "v9.9.9",
    "--source",
    "v9.9.8",
    "--dry-run",
  ]);
  assert.deepEqual(options, {
    repo: "owner/repo",
    target: "v9.9.9",
    source: "v9.9.8",
    dryRun: true,
  });
});

test("parseArgs rejects missing values, unknown flags, and unsafe names", async () => {
  const { parseArgs } = await loadHelpers();
  assert.throws(() => parseArgs(["--repo"]), /needs a value/);
  assert.throws(() => parseArgs(["--bogus"]), /unknown argument/);
  assert.throws(
    () => parseArgs(["--repo", "owner/repo", "--target", "../evil"]),
    /not a valid tag name/,
  );
  assert.throws(
    () => parseArgs(["--repo", "owner/repo/extra", "--target", "v1.0.0"]),
    /must be owner\/name/,
  );
  assert.throws(
    () => parseArgs(["--repo", "../..", "--target", "v1.0.0"]),
    /must be owner\/name/,
  );
  assert.throws(
    () => parseArgs(["--repo", "owner/..", "--target", "v1.0.0"]),
    /must be owner\/name/,
  );
  assert.throws(
    () => parseArgs(["--repo", "owner/repo", "--target", "v1..0"]),
    /not a valid tag name/,
  );
});
