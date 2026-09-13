const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/voice_performance.js",
  hostname: "localhost",
  origin: "null",
};

const srcDir = path.join(__dirname, "../../Voice_Biometric");

for (const mod of ["voice_matcher.js", "voice_performance.js"]) {
  const src = fs.readFileSync(path.join(srcDir, mod), "utf8");
  vm.runInThisContext(src, { filename: path.join(srcDir, mod) });
}

const VoiceMatcher = globalThis.VoiceMatcher;
const VoicePerformance = globalThis.VoicePerformance;

describe("VoicePerformance — trial ingestion", () => {
  it("accumulates labelled trials and validates their shape", () => {
    const p = new VoicePerformance();
    p.addTrial({
      label: "genuine",
      decision: "MATCH",
      score: 0.9,
      latencyMs: 8,
    });
    p.addTrial({
      label: "impostor",
      decision: "NON-MATCH",
      score: -0.4,
      latencyMs: 9.5,
    });
    p.addTrial({
      label: "attack",
      decision: "MATCH",
      score: 0.6,
      latencyMs: 7,
    });
    const r = p.evaluate();
    assert.equal(r.nGenuine, 1);
    assert.equal(r.nImpostor, 1);
    assert.equal(r.nAttack, 1);
    assert.equal(r.totalTrials, 3);
  });

  it("rejects malformed trials", () => {
    const p = new VoicePerformance();
    assert.throws(
      () =>
        p.addTrial({
          label: "ghost",
          decision: "MATCH",
          score: 1,
          latencyMs: 1,
        }),
      /label/,
    );
    assert.throws(
      () =>
        p.addTrial({
          label: "genuine",
          decision: "MAYBE",
          score: 1,
          latencyMs: 1,
        }),
      /decision/,
    );
    assert.throws(
      () =>
        p.addTrial({
          label: "genuine",
          decision: "MATCH",
          score: NaN,
          latencyMs: 1,
        }),
      /score/,
    );
    assert.throws(
      () =>
        p.addTrial({
          label: "genuine",
          decision: "MATCH",
          score: 1,
          latencyMs: -1,
        }),
      /latency/,
    );
  });

  it("reports zeros/null metrics on an empty run", () => {
    const r = new VoicePerformance().evaluate();
    assert.equal(r.apcer, 0);
    assert.equal(r.bpcer, 0);
    assert.equal(r.latencyMs, 0);
    assert.equal(r.sampleSizeSufficient, false);
  });
});

describe("VoicePerformance — APCER / BPCER / FAR / FRR", () => {
  function fixture() {
    const p = new VoicePerformance();
    // attacks 3 MATCH + 1 NON-MATCH -> APCER = 3/4 = 0.75
    for (let i = 0; i < 3; i += 1)
      p.addTrial({
        label: "attack",
        decision: "MATCH",
        score: 0.7,
        latencyMs: 5,
      });
    p.addTrial({
      label: "attack",
      decision: "NON-MATCH",
      score: -0.3,
      latencyMs: 6,
    });
    // genuine 4 MATCH + 1 NON-MATCH -> BPCER = 1/5 = 0.2
    for (let i = 0; i < 4; i += 1)
      p.addTrial({
        label: "genuine",
        decision: "MATCH",
        score: 0.8,
        latencyMs: 4,
      });
    p.addTrial({
      label: "genuine",
      decision: "NON-MATCH",
      score: -0.2,
      latencyMs: 5,
    });
    // impostors 1 MATCH + 3 NON-MATCH -> FAR = 1/4 = 0.25
    p.addTrial({
      label: "impostor",
      decision: "MATCH",
      score: 0.5,
      latencyMs: 6,
    });
    for (let i = 0; i < 3; i += 1)
      p.addTrial({
        label: "impostor",
        decision: "NON-MATCH",
        score: -0.5,
        latencyMs: 7,
      });
    return p.evaluate();
  }

  it("computes exact attack/bona-fide/impostor error rates", () => {
    const r = fixture();
    assert.equal(r.apcer, 0.75);
    assert.equal(r.bpcer, 0.2);
    assert.equal(r.far, 0.25);
    assert.equal(r.frr, 0.2);
    assert.equal(r.nGenuine, 5);
    assert.equal(r.nImpostor, 4);
    assert.equal(r.nAttack, 4);
    assert.equal(r.nInconclusive, 0);
  });

  it("flags threshold violations from the ISO/IEC 30107-3 gate", () => {
    const r = fixture();
    assert.equal(r.apcerPass, false); // 0.75 > MAX_APCER 0.005
    assert.equal(r.bpcerPass, false); // 0.2 > MAX_BPCER 0.05
  });
});

describe("VoicePerformance — EER / minDCF / C_llr reporting", () => {
  const BONAFIDE = [0.8, 0.3, -0.2, -0.6];
  const IMPOSTOR = [0.5, 0.1, -0.3, -0.8];

  function scoredRun() {
    const p = new VoicePerformance();
    for (const s of BONAFIDE)
      p.addTrial({
        label: "genuine",
        decision: "MATCH",
        score: s,
        latencyMs: 3 + Math.abs(s),
      });
    for (const s of IMPOSTOR)
      p.addTrial({
        label: "impostor",
        decision: "NON-MATCH",
        score: s,
        latencyMs: 4 + Math.abs(s),
      });
    return p.evaluate();
  }

  it("reports EER/minDCF/Cllr consistent with the matcher's exact functions", () => {
    const r = scoredRun();
    const mEer = VoiceMatcher.eer(BONAFIDE, IMPOSTOR);
    const mMin = VoiceMatcher.minDcf(BONAFIDE, IMPOSTOR);
    const mCllr = VoiceMatcher.cllr(BONAFIDE, IMPOSTOR);
    assert.ok(Math.abs(r.eer - mEer.eer) < 1e-9);
    assert.ok(Math.abs(r.minDCF - mMin.minDCF) < 1e-9);
    assert.ok(Math.abs(r.Cllr - mCllr) < 1e-9);
    assert.ok(Math.abs(r.eer - 0.5) < 1e-9);
  });

  it("records latency as a plain number (mean of trial latencies)", () => {
    const p = new VoicePerformance();
    p.addTrial({
      label: "genuine",
      decision: "MATCH",
      score: 0.9,
      latencyMs: 10,
    });
    p.addTrial({
      label: "impostor",
      decision: "NON-MATCH",
      score: -0.9,
      latencyMs: 20,
    });
    const r = p.evaluate();
    assert.equal(typeof r.latencyMs, "number");
    assert.equal(r.latencyMs, 15);
  });

  it("guards the minimum sample size for threshold claims", () => {
    const small = scoredRun();
    assert.equal(small.sampleSizeSufficient, false);
    const p = new VoicePerformance();
    for (let i = 0; i < 6; i += 1) {
      p.addTrial({
        label: "genuine",
        decision: "MATCH",
        score: 0.9,
        latencyMs: 5,
      });
      p.addTrial({
        label: "impostor",
        decision: "NON-MATCH",
        score: -0.9,
        latencyMs: 6,
      });
    }
    const big = p.evaluate();
    assert.equal(big.nGenuine, 6);
    assert.equal(big.nImpostor, 6);
    assert.equal(big.sampleSizeSufficient, true);
  });
});

describe("VoicePerformance — calibration-manifest stamping", () => {
  const MANIFEST = VoiceMatcher.buildManifest({
    generatedBy: "cli/tests/voice_performance_test.js",
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
      description: "test harness",
      source: "cli/tests/fixtures",
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
  });

  it("stamps the redoSan.voiceBiometricReport contract fields", () => {
    const p = new VoicePerformance();
    p.addTrial({
      label: "genuine",
      decision: "MATCH",
      score: 0.9,
      latencyMs: 12,
    });
    const report = p.stampReport(MANIFEST);
    assert.equal(report.calibration_model_version, "20240324");
    assert.equal(report.calibration_dataset_version, "1");
    assert.equal(report.operating_point.P_TARGET, 0.01);
    assert.ok(Math.abs(report.threshold - 4.59511985021159) < 1e-9);
    assert.ok(Math.abs(report.minDCF - 0.12) < 1e-9);
    assert.ok(Math.abs(report.Cllr - 0.6) < 1e-9);
    assert.equal(typeof report.latencyMs, "number");
  });
});

describe("VoicePerformance — module README", () => {
  it("carries an ISO/IEC-standard header in the module source", () => {
    const src = fs.readFileSync(
      path.join(srcDir, "voice_performance.js"),
      "utf8",
    );
    assert.match(src, /ISO\/IEC\s+30107-3/);
    assert.match(src, /ISO\/IEC\s+19795/);
  });
});
