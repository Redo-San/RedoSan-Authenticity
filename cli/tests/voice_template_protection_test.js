const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills for GPL check
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/",
  hostname: "localhost",
  origin: "null",
};

const src = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "..",
    "Voice_Biometric",
    "voice_template_protection.js",
  ),
  "utf8",
);
vm.runInThisContext(src, {
  filename: path.resolve(
    __dirname,
    "../..",
    "Voice_Biometric",
    "voice_template_protection.js",
  ),
});

// 192-dim voice descriptor (ECAPA-TDNN)
function makeDescriptor(values) {
  const arr = new Float32Array(192);
  for (let i = 0; i < 192 && i < values.length; i++) arr[i] = values[i];
  for (let i = values.length; i < 192; i++) arr[i] = Math.sin(i) / (i + 1);
  return arr;
}

const DESC_A = makeDescriptor([
  0.32, -0.11, 0.45, -0.08, 0.91, -0.23, 0.02, -0.66, 0.5, -0.3,
]);
const SECRET_A = "correct horse battery staple";
const SECRET_B = "another-user-secret-42";
const DIM = 128;

describe("VoiceTemplateProtection — keyFingerprint", () => {
  it("is a deterministic 64-char lowercase hex", async () => {
    const a = await VoiceTemplateProtection.keyFingerprint(SECRET_A, "salt-v1");
    const b = await VoiceTemplateProtection.keyFingerprint(SECRET_A, "salt-v1");
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it("never contains the secret and differs across secrets/salts", async () => {
    const a = await VoiceTemplateProtection.keyFingerprint(SECRET_A, "salt-v1");
    const b = await VoiceTemplateProtection.keyFingerprint(SECRET_B, "salt-v1");
    const c = await VoiceTemplateProtection.keyFingerprint(SECRET_A, "salt-v2");
    assert.ok(!a.includes(SECRET_A));
    assert.notEqual(a, b);
    assert.notEqual(a, c);
  });
});

describe("VoiceTemplateProtection — generate (keyed transform)", () => {
  it("is deterministic for the same descriptor + secret", async () => {
    const r1 = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
    });
    const r2 = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
    });
    assert.deepEqual(Array.from(r1.code), Array.from(r2.code));
    assert.equal(r1.keyFingerprint, r2.keyFingerprint);
  });

  it("produces an unlinkable ≈50% code for a different secret", async () => {
    const r1 = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
    });
    const r2 = await VoiceTemplateProtection.generate(DESC_A, SECRET_B, {
      dim: DIM,
    });
    const disagree =
      VoiceTemplateProtection.hammingDistance(r1.code, r2.code) / DIM;
    assert.ok(disagree >= 0.45 && disagree <= 0.55, `disagreement=${disagree}`);
  });

  it("produces a different (renewable) code for a different salt", async () => {
    const r1 = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
      salt: "redosan-voice-biohash-v1",
    });
    const r2 = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
      salt: "redosan-voice-biohash-v2",
    });
    const disagree =
      VoiceTemplateProtection.hammingDistance(r1.code, r2.code) / DIM;
    assert.ok(disagree > 0.25, `disagreement=${disagree}`);
  });

  it("packed code has the requested bit length", async () => {
    const r = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
    });
    assert.equal(r.bits, DIM);
    assert.equal(r.code.length, Math.ceil(DIM / 8));
    assert.equal(r.schema, "voice-template-protection-v1");
  });

  it("throws when no secret is provided", async () => {
    await assert.rejects(
      VoiceTemplateProtection.generate(DESC_A, "", { dim: DIM }),
      /secret/i,
    );
    await assert.rejects(
      VoiceTemplateProtection.generate(DESC_A, undefined, { dim: DIM }),
      /secret/i,
    );
  });

  it("throws when descriptor is missing", async () => {
    await assert.rejects(
      VoiceTemplateProtection.generate(null, SECRET_A, { dim: DIM }),
      /descriptor/i,
    );
  });

  it("throws when dim exceeds descriptor length", async () => {
    await assert.rejects(
      VoiceTemplateProtection.generate(DESC_A, SECRET_A, { dim: 193 }),
      /dim/i,
    );
  });
});

describe("VoiceTemplateProtection — distance & similarity", () => {
  it("returns 0 distance and 1 similarity for identical codes", async () => {
    const r = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
    });
    assert.equal(VoiceTemplateProtection.hammingDistance(r.code, r.code), 0);
    assert.equal(VoiceTemplateProtection.similarity(r.code, r.code), 1);
  });

  it("returns -1 for invalid input", () => {
    assert.equal(VoiceTemplateProtection.hammingDistance(null, null), -1);
    assert.equal(VoiceTemplateProtection.similarity(null, []), -1);
  });

  it("counts differing bits correctly", () => {
    const a = new Uint8Array([0b11110000]);
    const b = new Uint8Array([0b11101010]);
    assert.equal(VoiceTemplateProtection.hammingDistance(a, b), 3);
  });

  it("robustness: small descriptor perturbation keeps code similarity high", async () => {
    const perturbed = DESC_A.slice();
    for (let i = 0; i < perturbed.length; i++)
      perturbed[i] += (i % 3 === 0 ? 1 : -1) * 0.001;
    const r1 = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
    });
    const r2 = await VoiceTemplateProtection.generate(perturbed, SECRET_A, {
      dim: DIM,
    });
    const sim = VoiceTemplateProtection.similarity(r1.code, r2.code);
    assert.ok(sim > 0.6, `similarity=${sim}`);
  });

  it("discriminability: different descriptors yield far codes", async () => {
    const neg = DESC_A.slice();
    for (let i = 0; i < neg.length; i++) neg[i] = -neg[i]; // all dot signs flip
    const r1 = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
    });
    const r2 = await VoiceTemplateProtection.generate(neg, SECRET_A, {
      dim: DIM,
    });
    const sim = VoiceTemplateProtection.similarity(r1.code, r2.code);
    assert.ok(sim < 0.62, `similarity=${sim}`);
  });
});

describe("VoiceTemplateProtection — match", () => {
  it("finds the right entry above threshold", async () => {
    const target = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
    });
    const other = await VoiceTemplateProtection.generate(
      makeDescriptor([-0.9, 0.8, -0.7, 0.6]),
      SECRET_A,
      { dim: DIM },
    );
    const result = VoiceTemplateProtection.match(target.code, [
      { code: other.code, label: "other" },
      { code: target.code, label: "me" },
    ]);
    assert.equal(result.match.label, "me");
    assert.equal(result.similarity, 1);
  });

  it("returns null when below threshold", async () => {
    const a = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
    });
    const b = await VoiceTemplateProtection.generate(
      makeDescriptor([0.5, -0.5, 0.5, -0.5]),
      SECRET_A,
      { dim: DIM },
    );
    const result = VoiceTemplateProtection.match(
      a.code,
      [{ code: b.code, label: "x" }],
      0.95,
    );
    assert.equal(result.match, null);
  });

  it("handles empty registry", () => {
    const r = VoiceTemplateProtection.match(new Uint8Array(16), []);
    assert.equal(r.match, null);
    assert.equal(r.distance, -1);
  });

  it("uses the default threshold when none is supplied", async () => {
    const target = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
    });
    const result = VoiceTemplateProtection.match(target.code, [
      { code: target.code, label: "me" },
    ]);
    assert.equal(result.match.label, "me");
  });
});

describe("VoiceTemplateProtection — unlinkabilitySelfTest (ISO/IEC 24745 §8.2.2)", () => {
  it("reports ≈50% mean pairwise disagreement with ok=true", async () => {
    const res = await VoiceTemplateProtection.unlinkabilitySelfTest(DESC_A, {
      dim: DIM,
      iterations: 5,
    });
    assert.equal(res.pairs, 10);
    assert.ok(res.meanDisagreement >= 0.48 && res.meanDisagreement <= 0.52);
    assert.ok(res.minDisagreement >= 0.4);
    assert.equal(res.ok, true);
  });

  it("produces distinct codes per secret", async () => {
    const res = await VoiceTemplateProtection.unlinkabilitySelfTest(DESC_A, {
      dim: DIM,
      iterations: 4,
    });
    assert.equal(res.codes.length, 4);
  });
});

describe("VoiceTemplateProtection — irreversibility (ISO/IEC 24745 §8.2.1)", () => {
  it("stores no descriptor material in the protected record", async () => {
    const r = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
    });
    const json = JSON.stringify(r);
    assert.ok(!("descriptor" in r));
    assert.ok(!json.includes("0.32"));
    assert.ok(!json.includes("-0.11"));
  });

  it("code capacity is far below descriptor information (pigeonhole many-to-one)", async () => {
    const r = await VoiceTemplateProtection.generate(DESC_A, SECRET_A, {
      dim: DIM,
    });
    const codeBits = r.bits;
    const descriptorBits = DESC_A.length * 32;
    assert.ok(
      codeBits < descriptorBits / 20,
      `${codeBits} < ${descriptorBits / 20}`,
    );
    assert.equal(typeof VoiceTemplateProtection.recoverDescriptor, "undefined");
  });
});

describe("VoiceTemplateProtection — bytesToHex", () => {
  it("produces lowercase hex pairs", () => {
    assert.equal(
      VoiceTemplateProtection.bytesToHex(
        new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
      ),
      "deadbeef",
    );
  });
});
