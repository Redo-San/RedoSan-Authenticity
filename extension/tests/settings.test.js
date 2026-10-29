import test from "node:test";
import assert from "node:assert/strict";

import { HASH_NAMES, PERCEPTUAL_NAMES } from "../utils/hash-names.js";
import {
  ALL_HASHES,
  normalizeEnabledHashes,
  resolveLanguage,
  setGroupEnabled,
  setHashEnabled,
} from "../utils/settings.js";

test("every hash is enabled until the user saves a selection", () => {
  assert.deepEqual(normalizeEnabledHashes(undefined), ALL_HASHES);
  assert.deepEqual(normalizeEnabledHashes(null), ALL_HASHES);
  assert.deepEqual(normalizeEnabledHashes("MD5"), ALL_HASHES);
  assert.equal(ALL_HASHES.length, HASH_NAMES.length + PERCEPTUAL_NAMES.length);
});

test("an explicit empty selection stays empty", () => {
  assert.deepEqual(normalizeEnabledHashes([]), []);
});

test("unknown and duplicate names are dropped in canonical order", () => {
  assert.deepEqual(normalizeEnabledHashes(["MD5", "nope", "MD5", 42]), ["MD5"]);
  assert.deepEqual(normalizeEnabledHashes(["MD5", "SHA-256"]), [
    "SHA-256",
    "MD5",
  ]);
});

test("setHashEnabled adds and removes one name", () => {
  assert.deepEqual(setHashEnabled(["MD5"], "SHA-256", true), [
    "SHA-256",
    "MD5",
  ]);
  assert.deepEqual(setHashEnabled(["MD5", "SHA-256"], "MD5", false), [
    "SHA-256",
  ]);
  assert.deepEqual(setHashEnabled([], "phash", true), ["phash"]);
});

test("setGroupEnabled selects or clears one group only", () => {
  const crypto = setGroupEnabled(["phash"], HASH_NAMES, true);
  assert.equal(crypto.length, HASH_NAMES.length + 1);
  assert.ok(crypto.includes("phash"));

  const perceptual = setGroupEnabled(crypto, PERCEPTUAL_NAMES, false);
  assert.deepEqual(perceptual, HASH_NAMES);
});

test("resolveLanguage accepts supported codes and rejects the rest", () => {
  assert.equal(resolveLanguage("ar"), "ar");
  assert.equal(resolveLanguage("en"), "en");
  assert.equal(resolveLanguage("de"), "en");
  assert.equal(resolveLanguage(""), "en");
  assert.equal(resolveLanguage(undefined), "en");
});
