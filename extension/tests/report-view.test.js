import test from "node:test";
import assert from "node:assert/strict";

import { buildReportModel, formatBytes } from "../utils/report-view.js";

/**
 * Build a minimal report for the model tests.
 * @param {object} [overrides] Fields to merge over the defaults.
 * @returns {object} Report shaped like `inspectImage()` output.
 */
function makeReport(overrides = {}) {
  return {
    file: { name: "photo.png", size: 2048, type: "image/png" },
    hashes: { "SHA-256": "abc123" },
    perceptual_hashes: { phash: "00000000000000ff" },
    c2pa: { present: false },
    image: { width: 640, height: 480 },
    ...overrides,
  };
}

test("builds one section per populated group, with C2PA last", () => {
  const model = buildReportModel(makeReport(), "en");
  assert.equal(model.title, "photo.png");
  assert.deepEqual(
    model.sections.map((section) => section.id),
    ["crypto", "perceptual", "c2pa"],
  );
  assert.deepEqual(model.meta, ["Dimensions: 640×480"]);
  assert.equal(model.sections[0].rows[0].label, "SHA-256");
  assert.equal(model.sections[0].rows[0].value, "abc123");
});

test("reports an absent C2PA manifest as a status row", () => {
  const model = buildReportModel(makeReport(), "en");
  const c2pa = model.sections.find((section) => section.id === "c2pa");
  assert.deepEqual(c2pa.rows, [
    { label: "Status", value: "No manifest store found" },
  ]);
});

test("describes a present manifest and flags a legacy chunk", () => {
  const model = buildReportModel(
    makeReport({
      c2pa: {
        present: true,
        format: "png",
        chunk: "c2pa",
        standard: false,
        offset: 41,
        length: 128,
      },
    }),
    "en",
  );
  const c2pa = model.sections.find((section) => section.id === "c2pa");
  assert.deepEqual(c2pa.rows, [
    { label: "Status", value: "Manifest store found" },
    { label: "Format", value: "PNG C2PA (non-standard chunk)" },
    { label: "Offset", value: "41" },
    { label: "Length", value: "128" },
  ]);
});

test("omits the crypto section and explains why when nothing is enabled", () => {
  const model = buildReportModel(
    makeReport({ hashes: {}, perceptual_hashes: null }),
    "en",
  );
  assert.deepEqual(
    model.sections.map((section) => section.id),
    ["c2pa"],
  );
  assert.ok(
    model.notices.some((notice) => notice.text.includes("No hashes enabled")),
  );
});

test("surfaces a decode failure as a warning notice", () => {
  const model = buildReportModel(
    makeReport({
      image: { error: "unsupported image" },
      perceptual_hashes: null,
    }),
    "en",
  );
  assert.ok(
    model.notices.some(
      (notice) =>
        notice.kind === "warning" &&
        notice.text === "Image decode failed: unsupported image",
    ),
  );
});

test("renders the report in the requested language", () => {
  const english = buildReportModel(makeReport(), "en");
  const arabic = buildReportModel(makeReport(), "ar");
  assert.equal(english.sections[2].heading, "C2PA");
  assert.notEqual(
    arabic.sections[0].heading,
    english.sections[0].heading,
    "the section heading should be localized",
  );
  assert.equal(arabic.sections[0].rows[0].label, "SHA-256");
});

test("falls back to a dash when the file has no name", () => {
  const model = buildReportModel(
    makeReport({ file: { size: 0, type: "" } }),
    "en",
  );
  assert.equal(model.title, "—");
  assert.equal(model.subtitle, formatBytes(0, "en"));
});

test("formatBytes switches units and localizes", () => {
  assert.match(formatBytes(512, "en"), /^512\s*(B|byte)$/);
  assert.match(formatBytes(2048, "en"), /^2\s*kB$/);
  assert.match(formatBytes(1_572_864, "en"), /^1[.,]5\s*MB$/);
  assert.notEqual(formatBytes(2048, "ar"), formatBytes(2048, "en"));
  assert.equal(formatBytes(NaN, "en"), "");
});
