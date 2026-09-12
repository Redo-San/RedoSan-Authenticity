const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills needed by the origin-guard IIFE in voice_matcher.js
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/voice_matcher.js",
  hostname: "localhost",
  origin: "null",
};

const srcDir = path.join(__dirname, "../../Voice_Biometric");
const modSrc = fs.readFileSync(path.join(srcDir, "voice_matcher.js"), "utf8");
vm.runInThisContext(modSrc, {
  filename: path.resolve(srcDir, "voice_matcher.js"),
});

const VoiceMatcher = globalThis.VoiceMatcher;

function approx(actual, expected, tol) {
  const t = tol === undefined ? 1e-6 : tol;
  assert.ok(
    Math.abs(actual - expected) <= t,
    `expected ${actual} to be within ${t} of ${expected}`,
  );
}

function approxArray(actual, expected, tol) {
  const t = tol === undefined ? 1e-6 : tol;
  assert.equal(actual.length, expected.length, "array length");
  for (let i = 0; i < expected.length; i += 1)
    assert.ok(
      Math.abs(actual[i] - expected[i]) <= t,
      `index ${i}: expected ${actual[i]} within ${t} of ${expected[i]}`,
    );
}

// Example B — the primary worked example from B4 research
// (verified by hand against the official ASVspoof5 calculate_modules.py).
const BONAFIDE = [0.8, 0.3, -0.2, -0.6];
const IMPOSTOR = [0.5, 0.1, -0.3, -0.8];

const SRE24 = { P_TARGET: 0.01, C_MISS: 1, C_FA: 1 };
const ASVSPOOF5 = { P_TARGET: 0.95, C_MISS: 1, C_FA: 10 };

describe("VoiceMatcher — cosine scoring contract", () => {
  it("returns 1 for identical normalized embeddings", () => {
    const e = new Float32Array(192).fill(0.5);
    approx(VoiceMatcher.cosine(e, e), 1.0, 1e-9);
  });

  it("returns 0 for orthogonal embeddings", () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    approx(VoiceMatcher.cosine(a, b), 0.0, 1e-9);
  });

  it("is scale invariant (L2-normalized inner product)", () => {
    const a = new Float32Array([1, 1]);
    const b = new Float32Array([4, 0]);
    approx(VoiceMatcher.cosine(a, b), Math.SQRT1_2, 1e-9);
  });

  it("returns NaN on length mismatch or zero-norm input", () => {
    assert.ok(
      Number.isNaN(
        VoiceMatcher.cosine(new Float32Array(3), new Float32Array(4)),
      ),
    );
    assert.ok(
      Number.isNaN(
        VoiceMatcher.cosine(
          new Float32Array(2).fill(0),
          new Float32Array([1, 0]),
        ),
      ),
    );
    assert.ok(Number.isNaN(VoiceMatcher.cosine(null, new Float32Array([1]))));
    assert.ok(
      Number.isNaN(
        VoiceMatcher.cosine(new Float32Array(0), new Float32Array(0)),
      ),
    );
  });
});

describe("VoiceMatcher — detCurve (ASVspoof5 stable-merge DET)", () => {
  const curve = VoiceMatcher.detCurve(BONAFIDE, IMPOSTOR);

  it("emits n_scores+1 rows with the pushed-down sentinel threshold", () => {
    assert.equal(curve.frr.length, BONAFIDE.length + IMPOSTOR.length + 1);
    assert.equal(curve.far.length, curve.frr.length);
    assert.equal(curve.thresholds.length, curve.frr.length);
    assert.equal(curve.thresholds[0], -0.801); // sorted[0] - 0.001
  });

  it("matches the official threshold/far/frr arrays exactly", () => {
    approxArray(
      curve.thresholds,
      [-0.801, -0.8, -0.6, -0.3, -0.2, 0.1, 0.3, 0.5, 0.8],
    );
    approxArray(curve.frr, [0.0, 0.0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1.0]);
    approxArray(curve.far, [1.0, 0.75, 0.75, 0.5, 0.5, 0.25, 0.25, 0.0, 0.0]);
  });

  it("stably orders equal scores targets-before-nontargets (mergesort)", () => {
    const gen = [1.0, 0.0, 0.0];
    const imp = [0.0, -1.0];
    const c = VoiceMatcher.detCurve(gen, imp);
    // sorted labels with stable mergesort (targets first on ties): [0,1,1,0,1]
    approxArray(c.frr, [0.0, 0.0, 1 / 3, 2 / 3, 2 / 3, 1.0]);
    approxArray(c.far, [1.0, 0.5, 0.5, 0.5, 0.0, 0.0]);
  });
});

describe("VoiceMatcher — EER (minDCF prime layering)", () => {
  it("Example B EER = 0.5 at threshold -0.2", () => {
    const r = VoiceMatcher.eer(BONAFIDE, IMPOSTOR);
    approx(r.eer, 0.5, 1e-9);
    approx(r.threshold, -0.2, 1e-9);
  });

  it("perfectly separable data gives EER = 0", () => {
    const r = VoiceMatcher.eer([2, 1.5, 1], [0, -1, -2]);
    approx(r.eer, 0.0, 1e-9);
  });
});

describe("VoiceMatcher — minDCF (normalized detection cost)", () => {
  it("Example B minDCF under the ASVspoof5 cost model = 0.75 at -0.8", () => {
    const r = VoiceMatcher.minDcf(BONAFIDE, IMPOSTOR, ASVSPOOF5);
    approx(r.minDCF, 0.75, 1e-9);
    approx(r.threshold, -0.8, 1e-9);
  });

  it("Example B minDCF under the SRE24 cost model = 0.75 at 0.5", () => {
    const r = VoiceMatcher.minDcf(BONAFIDE, IMPOSTOR, SRE24);
    approx(r.minDCF, 0.75, 1e-9);
    approx(r.threshold, 0.5, 1e-9);
  });

  it("separable data gives minDCF = 0", () => {
    const r = VoiceMatcher.minDcf([2, 1.5, 1], [0, -1, -2], ASVSPOOF5);
    approx(r.minDCF, 0.0, 1e-9);
  });
});

describe("VoiceMatcher — actualDCF at the Bayes-optimal threshold", () => {
  it("ASVspoof5 model: actDCF = 0.75 at theta_Bayes = -0.641853886", () => {
    const r = VoiceMatcher.actualDcf(BONAFIDE, IMPOSTOR, ASVSPOOF5);
    approx(r.actDCF, 0.75, 1e-9);
    approx(r.threshold, -0.6418538861723948, 1e-9);
  });

  it("SRE24 model: actDCF = 1.0 at theta_Bayes = 4.595119850", () => {
    const r = VoiceMatcher.actualDcf(BONAFIDE, IMPOSTOR, SRE24);
    approx(r.actDCF, 1.0, 1e-9);
    approx(r.threshold, 4.59511985021159, 1e-9);
  });
});

describe("VoiceMatcher — C_llr (cost of log-likelihood ratios, bits)", () => {
  it("Example B Cllr = 0.9747231", () => {
    approx(VoiceMatcher.cllr(BONAFIDE, IMPOSTOR), 0.9747231, 1e-5);
  });

  it("separable example Cllr = 0.4267828", () => {
    approx(VoiceMatcher.cllr([2, 1.5, 1], [0, -1, -2]), 0.4267828, 1e-5);
  });
});

describe("VoiceMatcher — Bayes decision threshold (theta_Bayes = -log beta)", () => {
  it("SRE24 (p_target=0.01, C=1/1) threshold = 4.595119850", () => {
    approx(VoiceMatcher.thresholdFor(SRE24), 4.59511985021159, 1e-9);
  });

  it("ASVspoof5 (p_target=0.95, C=1/10) threshold = -0.641853886", () => {
    approx(VoiceMatcher.thresholdFor(ASVSPOOF5), -0.6418538861723948, 1e-9);
  });

  it("defaults to the plan's SRE24 operating point", () => {
    approx(VoiceMatcher.defaultThreshold(), 4.59511985021159, 1e-9);
  });
});

describe("VoiceMatcher — affine LLR calibration fit (Newton-IRLS logistic)", () => {
  const GEN = [1.0, 0.2, -0.3];
  const IMP = [0.7, 0.0, -0.8];

  function testLogLoss(gen, imp, alpha, beta) {
    let sum = 0;
    for (const s of gen) sum += Math.log1p(Math.exp(-(alpha * s + beta)));
    for (const s of imp) sum += Math.log1p(Math.exp(alpha * s + beta));
    return sum / (gen.length + imp.length);
  }

  it("rejects empty score sets", () => {
    assert.throws(() => VoiceMatcher.fitCalibration([], [], {}), RangeError);
    assert.throws(() => VoiceMatcher.fitCalibration([1], [], {}), RangeError);
  });

  it("converges to a finite minimum with alpha > 0 on overlapping data", () => {
    const fit = VoiceMatcher.fitCalibration(GEN, IMP);
    assert.equal(fit.converged, true);
    assert.ok(Number.isFinite(fit.alpha) && Number.isFinite(fit.beta));
    assert.ok(fit.alpha > 0, "genuine scores higher => positive slope");
    assert.ok(fit.iterations >= 1 && fit.iterations <= 100);
    approx(fit.nGenuine, 3);
    approx(fit.nImpostor, 3);
  });

  it("matches the independently computed log-loss objective", () => {
    const fit = VoiceMatcher.fitCalibration(GEN, IMP);
    approx(
      VoiceMatcher.logLoss(GEN, IMP, fit.alpha, fit.beta),
      testLogLoss(GEN, IMP, fit.alpha, fit.beta),
      1e-12,
    );
    approx(fit.logloss, testLogLoss(GEN, IMP, fit.alpha, fit.beta), 1e-12);
  });

  it("yields a log-loss no worse than an exhaustive grid search", () => {
    const fit = VoiceMatcher.fitCalibration(GEN, IMP);
    let best = Infinity;
    for (let a = 0; a <= 2.0; a += 0.02) {
      for (let b = -1.0; b <= 1.0; b += 0.02) {
        const v = testLogLoss(GEN, IMP, a, b);
        if (v < best) best = v;
      }
    }
    assert.ok(fit.logloss <= best + 1e-6, `${fit.logloss} > grid ${best}`);
  });

  it("still converges (crisp LLR) on perfectly separable data", () => {
    const fit = VoiceMatcher.fitCalibration([1, 0.5, 0.2], [-0.2, -0.5, -1]);
    assert.ok(fit.alpha > 1, "separable data drives slope upward");
    assert.ok(fit.logloss < 1e-3, "log-loss near zero when separable");
  });

  it("calibrate() maps a score through alpha*s + beta", () => {
    const fit = VoiceMatcher.fitCalibration(GEN, IMP);
    approx(
      VoiceMatcher.calibrate(0.25, fit.alpha, fit.beta),
      fit.alpha * 0.25 + fit.beta,
      1e-12,
    );
  });
});

describe("VoiceMatcher — MATCH / NON-MATCH / INCONCLUSIVE verdict", () => {
  const cal0 = { alpha: 1, beta: 0, threshold: 0 };

  it("accepts above threshold, rejects below, inconclusive on the boundary", () => {
    assert.equal(VoiceMatcher.decide(1, cal0).decision, "MATCH");
    assert.equal(VoiceMatcher.decide(-1, cal0).decision, "NON-MATCH");
    assert.equal(VoiceMatcher.decide(0, cal0).decision, "INCONCLUSIVE");
  });

  it("honors an explicit uncertainty band around the threshold", () => {
    const opts = { uncertaintyBand: 0.5 };
    assert.equal(VoiceMatcher.decide(0.6, cal0, opts).decision, "MATCH");
    assert.equal(VoiceMatcher.decide(0.4, cal0, opts).decision, "INCONCLUSIVE");
    assert.equal(
      VoiceMatcher.decide(-0.4, cal0, opts).decision,
      "INCONCLUSIVE",
    );
    assert.equal(VoiceMatcher.decide(-0.6, cal0, opts).decision, "NON-MATCH");
  });

  it("returns INCONCLUSIVE for non-finite scores", () => {
    assert.equal(VoiceMatcher.decide(NaN, cal0).decision, "INCONCLUSIVE");
    assert.equal(VoiceMatcher.decide(Infinity, cal0).decision, "INCONCLUSIVE");
  });

  it("derives the SRE24 threshold from the cost model (never hard-coded)", () => {
    const cal = { alpha: 1, beta: 0, costModel: SRE24 };
    for (let c = -1; c <= 1.001; c += 0.1) {
      if (Number.isFinite(c))
        assert.notEqual(
          VoiceMatcher.decide(c, cal).decision,
          "MATCH",
          `cosine ${c} must not MATCH under p_target=0.01`,
        );
    }
  });

  it("exposes the computed llr and threshold on the verdict", () => {
    const v = VoiceMatcher.decide(0.5, cal0);
    assert.equal(v.score, 0.5);
    assert.equal(v.llr, 0.5);
    assert.equal(v.threshold, 0);
    assert.equal(v.alpha, 1);
    assert.equal(v.beta, 0);
  });
});

describe("VoiceMatcher — calibration manifest (first-class artifact)", () => {
  const OPTS = {
    generatedBy:
      "node cli/commands/voice-calibrate.js --dev ecapa-golden-smoke-v1",
    model: {
      version: "20240324",
      sha256:
        "f46380bbaeddb929fb3a10ab63a4b1877a50e3d1e5fdd55a1b618d5651d3f64e",
    },
    preprocessing: {
      version: "B1",
      revision: "1.0",
      fbankSha256: "9f3c8e1b7a2d4f6c",
    },
    devSet: {
      id: "ecapa-192-golden-smoke-v1",
      datasetVersion: "1",
      description:
        "golden ECAPA embeddings from B2 fixtures (speechbrain parity)",
      source: "cli/tests/fixtures (golden_sp1, golden_sp2)",
      nGenuine: 6,
      nImpostor: 6,
    },
    calibration: {
      alpha: 1.4,
      beta: 0.1,
      logloss: 0.32,
      iterations: 5,
      converged: true,
    },
    metrics: { EER: 0.05, minDCF: 0.12, actDCF: 0.15, Cllr: 0.6 },
  };

  it("builds a manifest carrying the required first-class fields", () => {
    const m = VoiceMatcher.buildManifest(OPTS);
    assert.equal(m.schemaVersion, 1);
    assert.equal(m.generatedBy, OPTS.generatedBy);
    assert.equal(m.operatingPoint.P_TARGET, SRE24.P_TARGET);
    assert.equal(m.operatingPoint.C_MISS, SRE24.C_MISS);
    assert.equal(m.operatingPoint.C_FA, SRE24.C_FA);
    approx(m.threshold, 4.59511985021159, 1e-9);
    approx(m.metrics.minDCF, 0.12);
    approx(m.metrics.Cllr, 0.6);
    approx(m.calibration.alpha, 1.4);
    assert.equal(m.devSet.id, OPTS.devSet.id);
    assert.equal(m.devSet.datasetVersion, "1");
    assert.equal(m.model.version, OPTS.model.version);
    assert.equal(m.model.dimension, 192);
    assert.equal(m.preprocessing.revision, OPTS.preprocessing.revision);
  });

  it("round-trips through parseManifest", () => {
    const m = VoiceMatcher.parseManifest(VoiceMatcher.buildManifest(OPTS));
    assert.equal(m.devSet.id, OPTS.devSet.id);
    approx(m.metrics.Cllr, 0.6);
  });

  it("rejects a manifest missing a required field", () => {
    const bad = VoiceMatcher.buildManifest(OPTS);
    delete bad.metrics.minDCF;
    assert.throws(
      () => VoiceMatcher.parseManifest(bad),
      /calibration manifest/,
    );
  });

  it("stamps the redoSan.voiceBiometricReport contract fields", () => {
    const m = VoiceMatcher.buildManifest(OPTS);
    const report = VoiceMatcher.applyManifest({ latencyMs: 12.4 }, m);
    assert.equal(report.calibration_model_version, OPTS.model.version);
    assert.equal(report.calibration_dataset_version, "1");
    assert.equal(report.operating_point.P_TARGET, 0.01);
    approx(report.threshold, 4.59511985021159, 1e-9);
    approx(report.minDCF, 0.12);
    approx(report.Cllr, 0.6);
  });

  it("accepts the shipped calibration_manifest.json artifact", () => {
    const raw = fs.readFileSync(
      path.join(srcDir, "calibration/calibration_manifest.json"),
      "utf8",
    );
    const m = VoiceMatcher.parseManifest(raw);
    assert.equal(
      m.$schema,
      "Voice_Biometric/calibration/calibration-manifest-schema-v1",
    );
    assert.equal(m.operatingPoint.P_TARGET, 0.01);
    assert.equal(m.operatingPoint.C_MISS, 1);
    assert.equal(m.operatingPoint.C_FA, 1);
    approx(m.threshold, 4.59511985021159, 1e-9);
    const report = VoiceMatcher.applyManifest({}, m);
    assert.equal(report.calibration_model_version, m.model.version);
    assert.equal(report.calibration_dataset_version, "1");
    assert.ok(Number.isFinite(report.minDCF));
    assert.ok(Number.isFinite(report.Cllr));
  });
});

describe("VoiceMatcher — uncovered branch coverage", () => {
  it("cosine returns NaN on non-finite input (line 84)", () => {
    const a = new Float32Array([1, 2, NaN]);
    const b = new Float32Array([3, 4, 5]);
    const r = VoiceMatcher.cosine(a, b);
    assert.ok(Number.isNaN(r));
  });

  it("cosine returns NaN on zero vectors (line 89)", () => {
    const a = new Float32Array([0, 0]);
    const b = new Float32Array([0, 0]);
    const r = VoiceMatcher.cosine(a, b);
    assert.ok(Number.isNaN(r));
  });

  it("thresholdFor accepts a custom cost model (line 100)", () => {
    const custom = { C_MISS: 2, C_FA: 1, P_TARGET: 0.01 };
    const t = VoiceMatcher.thresholdFor(custom);
    assert.ok(Number.isFinite(t));
    assert.ok(t > 0);
  });

  it("decide() with calibration.alpha/beta present (line 381, 383)", () => {
    const calibration = { alpha: 2.5, beta: -1.0, threshold: 3.0 };
    const r = VoiceMatcher.decide(2.0, calibration, {});
    assert.equal(r.decision, VoiceMatcher.VERDICTS.MATCH);
  });

  it("buildManifest fills optional fields (line 416-420)", () => {
    const m = VoiceMatcher.buildManifest({
      model: { version: "1.0", arch: "wavlm" },
      preprocessing: { version: "1.0" },
      devSet: { nTarget: 50, nNontarget: 50 },
      calibration: {
        alpha: 1,
        beta: 0,
        threshold: 2,
        loss: 0.01,
        iterations: 3,
        method: "ml",
        version: "1.0",
      },
      metrics: { EER: 0.05, minDCF: 0.1, actDCF: 0.12, Cllr: 0.3 },
      operatingPoint: { C_MISS: 1, C_FA: 1, P_TARGET: 0.01 },
    });
    assert.equal(m.model.version, "1.0");
    assert.equal(m.calibration.method, "ml");
  });

  it("fitCalibration converges quickly on trivially separable scores (line 340, 349)", () => {
    const genuine = [10, 9, 8, 7, 6];
    const impostor = [-10, -9, -8, -7, -6];
    const r = VoiceMatcher.fitCalibration(genuine, impostor);
    assert.ok(r.converged);
    assert.ok(Number.isFinite(r.alpha));
    assert.ok(Number.isFinite(r.beta));
  });

  it("fitCalibration with single-sample sets (line 108)", () => {
    const r = VoiceMatcher.fitCalibration([5], [-5]);
    assert.ok(Number.isFinite(r.alpha));
    assert.ok(Number.isFinite(r.beta));
  });

  it("fitCalibration with identical scores returns finite result (line 340)", () => {
    const r = VoiceMatcher.fitCalibration([1, 1, 1], [1, 1, 1]);
    assert.ok(Number.isFinite(r.alpha));
    assert.ok(Number.isFinite(r.beta));
  });

  it("loadManifest rejects when fetch returns non-ok (line 536, 550)", async () => {
    globalThis.fetch = async function () {
      return { ok: false, status: 404 };
    };
    await assert.rejects(
      () => VoiceMatcher.loadManifest("http://example.com/manifest.json"),
      /404/,
    );
    delete globalThis.fetch;
  });
});
