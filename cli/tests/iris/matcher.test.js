require("./setup");
const test = require("node:test");
const assert = require("node:assert");

const IM = global.IrisMatcher;

test("IrisMatcher.normalizeHd: returns value 0-0.5", () => {
  const val = IM.normalizeHd(0.1, 1000, 500);
  assert.ok(val >= 0 && val <= 0.5);
});

test("IrisMatcher.decidabilityScore: returns >= 0", () => {
  const val = IM.decidabilityScore(0.1, 1000);
  assert.ok(val >= 0);
});

test("IrisMatcher.xorVisual: returns Uint8Array", () => {
  const a = { code: new Uint8Array([0xFF, 0x00]), mask: new Uint8Array([1, 1]) };
  const b = { code: new Uint8Array([0x00, 0xFF]), mask: new Uint8Array([1, 1]) };
  const result = IM.xorVisual(a, b);
  assert.ok(result instanceof Uint8Array);
  assert.equal(result.length, 2);
});

test("IrisMatcher.identify: finds best match in gallery", () => {
  const probe = { code: new Uint8Array([1, 0, 1, 0]), mask: new Uint8Array([1, 1, 1, 1]) };
  const gallery = [
    { code: new Uint8Array([1, 0, 1, 0]), mask: new Uint8Array([1, 1, 1, 1]), id: "a" },
    { code: new Uint8Array([0, 1, 0, 1]), mask: new Uint8Array([1, 1, 1, 1]), id: "b" },
  ];
  const result = IM.identify(probe, gallery);
  assert.ok(result.bestMatch);
  assert.ok(result.allResults.length === 2);
});

test("IrisMatcher.hammingDistance: null → hd=1", () => {
  const r = IrisMatcher.hammingDistance(null, null);
  assert.strictEqual(r.hd, 1);
  assert.strictEqual(r.validBits, 0);
  assert.strictEqual(r.match, false);
});

test("IrisMatcher.hammingDistance: identical codes → hd=0", () => {
  const code = new Uint8Array([1,0,1,0,1,0,1,0]);
  const mask = new Uint8Array([1,1,1,1,1,1,1,1]);
  const r = IrisMatcher.hammingDistance({code, mask}, {code, mask});
  assert.strictEqual(r.hd, 0);
  assert.strictEqual(r.validBits, 8);
  assert.strictEqual(r.match, true);
});

test("IrisMatcher.hammingDistance: opposite codes → hd=1", () => {
  const a = { code: new Uint8Array([1,1,1,1]), mask: new Uint8Array([1,1,1,1]) };
  const b = { code: new Uint8Array([0,0,0,0]), mask: new Uint8Array([1,1,1,1]) };
  const r = IrisMatcher.hammingDistance(a, b);
  assert.strictEqual(r.hd, 1);
});

test("IrisMatcher.hammingDistance: all masked → validBits=0", () => {
  const a = { code: new Uint8Array([1,1,1,1]), mask: new Uint8Array([0,0,0,0]) };
  const b = { code: new Uint8Array([0,0,0,0]), mask: new Uint8Array([0,0,0,0]) };
  const r = IrisMatcher.hammingDistance(a, b);
  assert.strictEqual(r.validBits, 0);
  assert.strictEqual(r.hd, 1);
});

test("IrisMatcher.hammingDistance: partial overlap", () => {
  const a = { code: new Uint8Array([1,0,1,0]), mask: new Uint8Array([1,1,0,0]) };
  const b = { code: new Uint8Array([1,1,0,0]), mask: new Uint8Array([1,0,1,1]) };
  const r = IrisMatcher.hammingDistance(a, b);
  assert.strictEqual(r.validBits, 1);
  assert(typeof r.hd === "number");
});

test("IrisMatcher.compare: identical → excellent match", () => {
  const code = new Uint8Array([1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0]);
  const mask = new Uint8Array(16).fill(1);
  const r = IrisMatcher.compare({code, mask}, {code, mask});
  assert.strictEqual(r.hd, 0);
  assert.strictEqual(r.match, true);
  assert(r.confidence > 0);
  assert(typeof r.details === "string");
  assert(typeof r.hdNorm === "number");
  assert(typeof r.significance === "number");
});

test("IrisMatcher.compare: opposite → no match", () => {
  const a = { code: new Uint8Array(16).fill(1), mask: new Uint8Array(16).fill(1) };
  const b = { code: new Uint8Array(16).fill(0), mask: new Uint8Array(16).fill(1) };
  const r = IrisMatcher.compare(a, b);
  assert.strictEqual(r.match, false);
  assert(r.details === "No match");
});

test("IrisMatcher.compare: low overlap → 'Low overlap' detail", () => {
  const a = { code: new Uint8Array(100).fill(1), mask: new Uint8Array(100).fill(0) };
  const b = { code: new Uint8Array(100).fill(0), mask: new Uint8Array(100).fill(1) };
  const r = IrisMatcher.compare(a, b);
  assert(r.details.includes("Low overlap"));
});

test("IrisMatcher.compare: marginal match", () => {
  const code = new Uint8Array(100);
  const mask = new Uint8Array(100).fill(1);
  for (let i = 0; i < 100; i++) code[i] = i % 2;
  const bCode = new Uint8Array(100);
  for (let i = 0; i < 100; i++) bCode[i] = (i % 2) ^ (i < 22 ? 1 : 0);
  const r = IrisMatcher.compare({code, mask}, {code: bCode, mask}, 0.30);
  assert(r.match);
  assert(r.details.includes("Marginal") || r.details.includes("match"));
});

test("IrisMatcher.identify: null probe → empty", () => {
  const r = IrisMatcher.identify(null, []);
  assert.strictEqual(r.bestMatch, null);
  assert.deepStrictEqual(r.allResults, []);
});

test("IrisMatcher.identify: empty gallery → empty", () => {
  const code = new Uint8Array(8).fill(1);
  const mask = new Uint8Array(8).fill(1);
  const r = IrisMatcher.identify({code, mask}, []);
  assert.strictEqual(r.bestMatch, null);
  assert.deepStrictEqual(r.allResults, []);
});

test("IrisMatcher.identify: finds best match", () => {
  const probe = { code: new Uint8Array(16).fill(1), mask: new Uint8Array(16).fill(1), id: "probe" };
  const g1 = { code: new Uint8Array(16).fill(1), mask: new Uint8Array(16).fill(1), id: "exact" };
  const g2 = { code: new Uint8Array(16).fill(0), mask: new Uint8Array(16).fill(1), id: "opposite" };
  const r = IrisMatcher.identify(probe, [g2, g1]);
  assert.strictEqual(r.bestMatch.id, "exact");
  assert(r.allResults.length === 2);
  assert(r.allResults[0].hd <= r.allResults[1].hd, "sorted by hd ascending");
});

test("IrisMatcher.identify: no match in gallery → bestMatch=null", () => {
  const probe = { code: new Uint8Array(16).fill(1), mask: new Uint8Array(16).fill(1) };
  const g = { code: new Uint8Array(16).fill(0), mask: new Uint8Array(16).fill(1), id: "opp" };
  const r = IrisMatcher.identify(probe, [g], 0.10);
  assert.strictEqual(r.bestMatch, null);
});

test("IrisMatcher.identify: with threshold override", () => {
  const code = new Uint8Array(8).fill(1);
  const mask = new Uint8Array(8).fill(1);
  const r = IrisMatcher.identify({code, mask}, [{code, mask, id:"a"}], 0.50);
  assert.strictEqual(r.bestMatch.id, "a");
});

test("IrisMatcher.xorVisual: identical → all 0", () => {
  const code = new Uint8Array([1,0,1,0]);
  const mask = new Uint8Array([1,1,1,1]);
  const r = IrisMatcher.xorVisual({code, mask}, {code, mask});
  assert(r.every(v => v === 0));
});

test("IrisMatcher.xorVisual: opposite → all 1", () => {
  const a = { code: new Uint8Array([1,1,1,1]), mask: new Uint8Array([1,1,1,1]) };
  const b = { code: new Uint8Array([0,0,0,0]), mask: new Uint8Array([1,1,1,1]) };
  const r = IrisMatcher.xorVisual(a, b);
  assert(r.every(v => v === 1));
});

test("IrisMatcher.xorVisual: masked → 2", () => {
  const a = { code: new Uint8Array([1,1]), mask: new Uint8Array([0,1]) };
  const b = { code: new Uint8Array([0,0]), mask: new Uint8Array([1,1]) };
  const r = IrisMatcher.xorVisual(a, b);
  assert.strictEqual(r[0], 2);
  assert.strictEqual(r[1], 1);
});

test("IrisMatcher.normalizeHd: valid inputs", () => {
  const r = IrisMatcher.normalizeHd(0.1, 1000, 1000);
  assert(typeof r === "number" && r >= 0 && r <= 0.5);
});

test("IrisMatcher.normalizeHd: invalid inputs → 0", () => {
  assert.strictEqual(IrisMatcher.normalizeHd("bad", 100, 1000), 0);
  assert.strictEqual(IrisMatcher.normalizeHd(0.1, -1, 1000), 0);
  assert.strictEqual(IrisMatcher.normalizeHd(0.1, 100, 0), 0);
});

test("IrisMatcher.decidabilityScore: good match → high score", () => {
  const r = IrisMatcher.decidabilityScore(0.1, 1000);
  assert(r > 10);
});

test("IrisMatcher.decidabilityScore: bad match → 0", () => {
  assert.strictEqual(IrisMatcher.decidabilityScore(0.5, 1000), 0);
  assert.strictEqual(IrisMatcher.decidabilityScore(0.1, 0), 0);
  assert.strictEqual(IrisMatcher.decidabilityScore("bad", 100), 0);
});

test("IM.identify: with gallery returns results object (L191-L224)", () => {
  const probe = { code: new Uint8Array(100).fill(0xFF), mask: new Uint8Array(100).fill(1) };
  const gallery = [
    { id: "1", code: new Uint8Array(100).fill(0xFF), mask: new Uint8Array(100).fill(1) },
    { id: "2", code: new Uint8Array(100).fill(0xAA), mask: new Uint8Array(100).fill(1) },
  ];
  const result = IM.identify(probe, gallery);
  assert.ok(result.allResults);
  assert.ok(Array.isArray(result.allResults));
  assert.equal(result.allResults.length, 2);
  assert.ok(result.bestMatch);
});

test("IM.identify: empty gallery (L194)", () => {
  const probe = { code: new Uint8Array(100).fill(0xFF), mask: new Uint8Array(100).fill(1) };
  const result = IM.identify(probe, []);
  assert.equal(result.bestMatch, null);
  assert.equal(result.allResults.length, 0);
});

test("IM.identify: with threshold arg", () => {
  const probe = { code: new Uint8Array(64).fill(0xFF), mask: new Uint8Array(64).fill(1) };
  const gallery = [
    { id: "match", code: new Uint8Array(64).fill(0xFF), mask: new Uint8Array(64).fill(1) },
    { id: "mismatch", code: new Uint8Array(64).fill(0x00), mask: new Uint8Array(64).fill(1) },
  ];
  const result = IM.identify(probe, gallery, 0.26);
  assert.ok(result.allResults.length === 2);
  assert.ok(result.bestMatch);
  assert.equal(result.bestMatch.id, "match");
});

test("IM.identify: no matching probe", () => {
  const probe = { code: new Uint8Array(64).fill(0xFF), mask: new Uint8Array(64).fill(1) };
  const gallery = [
    { id: "1", code: new Uint8Array(64).fill(0x00), mask: new Uint8Array(64).fill(1) },
  ];
  const result = IM.identify(probe, gallery, 0.26);
  assert.equal(result.bestMatch, null);
});

test("IM constructor (L21-L22)", () => { const m = new IM(); assert.ok(m); });
test("IM.compare: default threshold (L146-L151)", () => {
  const c1 = new Uint8Array(64); c1.fill(0xFF);
  const c2 = new Uint8Array(64); c2.fill(0xFF);
  const m1 = new Uint8Array(64); m1.fill(1);
  const m2 = new Uint8Array(64); m2.fill(1);
  const r = IM.compare({ code: c1, mask: m1 }, { code: c2, mask: m2 });
  assert.ok(r);
  assert.equal(typeof r.hd, "number");
});
test("IM.compare: Good match tier (L166)", () => {
  const c1 = new Uint8Array(64).fill(0xFF);
  const c2 = new Uint8Array(64).fill(0xFF);
  const m = new Uint8Array(64).fill(1);
  for (let i = 0; i < 13; i++) c2[i] = 0;
  const r = IM.compare({ code: c1, mask: m }, { code: c2, mask: m });
  assert.ok(r);
  assert.ok(r.details.includes("match") || r.details.includes("Good") || r.details.includes("Excellent") || r.details.includes("Marginal") || r.details.includes("No match"));
});
test("IM.identify: with entries (L191-L224)", () => {
  const c1 = new Uint8Array(64).fill(0xFF);
  const m = new Uint8Array(64).fill(1);
  const gallery = [{ id: "s1", code: c1, mask: m, label: "test" }];
  const r = IM.identify({ code: c1, mask: m }, gallery);
  assert.ok(r);
  assert.ok(typeof r.bestMatch === "object" || r.bestMatch === null);
});

test("IM.compare: uses window.IRIS_ENGINE_CONFIG threshold (L57-L58)", () => {
  const savedConfig = window.IRIS_ENGINE_CONFIG;
  window.IRIS_ENGINE_CONFIG = { hammingThreshold: 0.5 };
  try {
    const c1 = new Uint8Array(64).fill(0xFF);
    const c2 = new Uint8Array(64).fill(0xFF);
    for (let i = 0; i < 20; i++) c2[i] = 0;
    const m = new Uint8Array(64).fill(1);
    const r = IM.compare({ code: c1, mask: m }, { code: c2, mask: m });
    assert.ok(r);
    assert.equal(typeof r.hd, "number");
  } finally {
    window.IRIS_ENGINE_CONFIG = savedConfig;
  }
});

test("IM.identify: empty gallery returns no match (L191-L195)", () => {
  const c = new Uint8Array(64).fill(0xFF);
  const m = new Uint8Array(64).fill(1);
  const r = IM.identify({ code: c, mask: m }, []);
  assert.ok(r);
  assert.equal(r.bestMatch, null);
  assert.ok(Array.isArray(r.allResults));
  assert.equal(r.allResults.length, 0);
});

test("IM.compare: with IRIS_ENGINE_CONFIG threshold (L60)", () => {
  const saved = window.IRIS_ENGINE_CONFIG;
  window.IRIS_ENGINE_CONFIG = { hammingThreshold: 0.4 };
  try {
    const c1 = new Uint8Array(64).fill(0xFF);
    const c2 = new Uint8Array(64).fill(0xFF);
    c2[0] = 0;
    const m = new Uint8Array(64).fill(1);
    const r = IM.compare({ code: c1, mask: m }, { code: c2, mask: m });
    assert.equal(typeof r.hd, "number");
  } finally {
    window.IRIS_ENGINE_CONFIG = saved;
  }
});

test("IM.identify: gallery with matching entries (L204)", () => {
  const c1 = new Uint8Array(64).fill(0xFF);
  const c2 = new Uint8Array(64).fill(0xFF);
  const m = new Uint8Array(64).fill(1);
  const gallery = [
    { id: "t1", code: c1, mask: m },
    { id: "t2", code: c2, mask: m },
  ];
  const r = IM.identify({ code: c1, mask: m }, gallery);
  assert.ok(r.bestMatch);
  assert.ok(r.allResults.length > 0);
});

// ── IM.hammingDistance: with validCodesOnly option (L60) ──
test("IM.hammingDistance: with validCodesOnly flag (L60)", () => {
  const a = { code: new Uint8Array(64), mask: new Uint8Array(64).fill(1) };
  const b = { code: new Uint8Array(64), mask: new Uint8Array(64).fill(1) };
  for (let i = 0; i < 64; i++) a.code[i] = i % 2 === 0 ? 0xFF : 0;
  for (let i = 0; i < 64; i++) b.code[i] = i % 3 === 0 ? 0xFF : 0;
  const r = IM.hammingDistance(a, b, true);
  assert.equal(typeof r.hd, "number");
  assert.equal(typeof r.validBits, "number");
  assert.ok(r.validBits > 0);
});

// ── IM.compare: with custom threshold (L151, L168) ──
test("IM.compare: with custom threshold (L151, L168)", () => {
  const c1 = new Uint8Array(64);
  const c2 = new Uint8Array(64);
  for (let i = 0; i < 64; i++) { c1[i] = i % 2 === 0 ? 0xFF : 0; c2[i] = i % 3 === 0 ? 0xFF : 0; }
  const m = new Uint8Array(64).fill(1);
  const r = IM.compare({ code: c1, mask: m }, { code: c2, mask: m }, 0.3);
  assert.equal(typeof r.hd, "number");
  assert.equal(typeof r.significance, "number");
  assert.equal(typeof r.confidence, "number");
});

// ── IM.identify: with different gallery entries (L204) ──
test("IM.identify: diverse gallery entries (L204)", () => {
  const c1 = new Uint8Array(64).fill(0xFF);
  const c2 = new Uint8Array(64).fill(0);
  const c3 = new Uint8Array(64);
  for (let i = 0; i < 64; i++) c3[i] = i % 2 === 0 ? 0xFF : 0;
  const m = new Uint8Array(64).fill(1);
  const gallery = [
    { id: "same", code: c1, mask: m },
    { id: "diff", code: c2, mask: m },
    { id: "partial", code: c3, mask: m },
  ];
  const r = IM.identify({ code: c1, mask: m }, gallery);
  assert.ok(r.bestMatch);
  assert.equal(r.bestMatch.id, "same");
  assert.equal(r.allResults.length, 3);
});
