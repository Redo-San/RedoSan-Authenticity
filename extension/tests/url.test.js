import test from "node:test";
import assert from "node:assert/strict";

import { fileNameFromUrl, isFetchableImageUrl } from "../utils/url.js";

test("accepts the schemes a page can display and a content script can read", () => {
  assert.equal(isFetchableImageUrl("https://example.test/a.png"), true);
  // http is deliberately accepted: pages still serve images over it.
  // eslint-disable-next-line unicorn/prefer-https
  assert.equal(isFetchableImageUrl("http://example.test/a.png"), true);
  assert.equal(isFetchableImageUrl("data:image/png;base64,AAAA"), true);
  assert.equal(isFetchableImageUrl("blob:https://example.test/1234"), true);
  assert.equal(
    isFetchableImageUrl("/images/a.png", "https://example.test/page"),
    true,
  );
});

test("rejects schemes that could target another origin or execute script", () => {
  assert.equal(isFetchableImageUrl("javascript:alert(1)"), false);
  assert.equal(isFetchableImageUrl("chrome://settings"), false);
  assert.equal(isFetchableImageUrl("file:///etc/passwd"), false);
  assert.equal(isFetchableImageUrl(""), false);
  assert.equal(isFetchableImageUrl("https://"), false);
  assert.equal(isFetchableImageUrl(null), false);
});

test("takes the last path segment and decodes it", () => {
  assert.equal(
    fileNameFromUrl("https://example.test/a/b%20c.png?x=1#frag"),
    "b c.png",
  );
  assert.equal(fileNameFromUrl("https://example.test/a/"), "image");
  assert.equal(fileNameFromUrl("https://example.test"), "image");
});

test("data and blob addresses get the fallback name", () => {
  assert.equal(fileNameFromUrl("data:image/png;base64,AAAA"), "image");
  assert.equal(fileNameFromUrl("blob:https://example.test/1234"), "image");
  assert.equal(
    fileNameFromUrl("data:image/png;base64,AAAA", "clip.png"),
    "clip.png",
  );
});

test("malformed escapes do not throw", () => {
  assert.equal(fileNameFromUrl("https://example.test/%zz.png"), "%zz.png");
  assert.equal(fileNameFromUrl("not a url"), "not a url");
});
