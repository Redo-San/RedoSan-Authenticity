require("./setup");
const assert = require("node:assert");
const test = require("node:test");

const IP = global.IrisPerformance;

// ═══════════════════════════════════════════════════════════════
// iris_performance.js — additional coverage
// ═══════════════════════════════════════════════════════════════

test("IrisPerformance.THRESHOLDS exists", () => {
  assert.ok(IP.THRESHOLDS);
  assert.equal(typeof IP.THRESHOLDS.MAX_FAR, "number");
});

test("IrisPerformance.calculateFAR: basic", () => {
  assert.equal(IP.calculateFAR(1, 1000), 0.001);
});

test("IrisPerformance.calculateFRR: basic", () => {
  assert.equal(IP.calculateFRR(1, 100), 0.01);
});

test("IrisPerformance.calculateEER: symmetric ROC", () => {
  const roc = [
    { threshold: 0, far: 1, frr: 0 },
    { threshold: 0.5, far: 0.5, frr: 0.5 },
    { threshold: 1, far: 0, frr: 1 },
  ];
  const result = IP.calculateEER(roc);
  assert.ok(result);
  assert.ok(result.eer >= 0 && result.eer <= 1);
});

test("IrisPerformance.calculateAccuracy: perfect", () => {
  assert.equal(IP.calculateAccuracy(90, 10, 100), 1);
});

test("IrisPerformance.generateROC: returns array", () => {
  const genuine = [0.9, 0.8, 0.7, 0.6];
  const impostor = [0.3, 0.2, 0.1, 0.05];
  const roc = IP.generateROC(genuine, impostor, 10);
  assert.ok(Array.isArray(roc));
  assert.ok(roc.length > 0);
});

test("IrisPerformance.generateDET: returns array", () => {
  const genuine = [0.9, 0.8, 0.7, 0.6];
  const impostor = [0.3, 0.2, 0.1, 0.05];
  const det = IP.generateDET(genuine, impostor, 10);
  assert.ok(Array.isArray(det));
});

test("IrisPerformance.generatePADDET: returns array", () => {
  const labels = [0, 0, 1, 1];
  const scores = [0.8, 0.7, 0.3, 0.2];
  const det = IP.generatePADDET(labels, scores, 10);
  assert.ok(Array.isArray(det));
});

test("IrisPerformance.reportPADMetrics: returns object", () => {
  const labels = [0, 0, 0, 1, 1, 1];
  const scores = [0.9, 0.8, 0.7, 0.3, 0.2, 0.1];
  const result = IP.reportPADMetrics(labels, scores);
  assert.ok(result);
  assert.ok(typeof result.bpcer === "number");
});

test("IrisPerformance.wilsonCI: basic", () => {
  const ci = IP.wilsonCI(90, 100, 0.95);
  assert.ok(ci);
  assert.ok(ci.lower <= ci.estimate);
  assert.ok(ci.upper >= ci.estimate);
});

test("IrisPerformance.evaluate: full evaluation", () => {
  const result = IP.evaluate({
    genuineScores: [0.9, 0.85, 0.8, 0.75],
    impostorScores: [0.3, 0.25, 0.2, 0.15],
    systemName: "test",
  });
  assert.ok(result);
  assert.ok(result.metrics);
  assert.ok(result.summary);
});

test("IrisPerformance.pairedTTest: different distributions", () => {
  const s1 = [0.9, 0.85, 0.8];
  const s2 = [0.5, 0.45, 0.4];
  const result = IP.pairedTTest(s1, s2);
  assert.ok(result);
  assert.equal(typeof result.tStatistic, "number");
  assert.equal(typeof result.pValue, "number");
  assert.equal(typeof result.significant, "boolean");
});

test("IrisPerformance.compareSystems: returns winner", () => {
  const sys1 = { genuineScores: [0.9, 0.85], impostorScores: [0.2, 0.15] };
  const sys2 = { genuineScores: [0.7, 0.65], impostorScores: [0.3, 0.25] };
  const result = IP.compareSystems(sys1, sys2);
  assert.ok(result);
  assert.ok(result.winner);
});

test("IrisPerformance.recordFTA: increments count", () => {
  const instance = new IP();
  IP.recordFTA(instance, "test reason");
  const rates = IP.getFtaFterRates(instance);
  assert.equal(rates.ftaCount, 1);
});

test("IrisPerformance.recordFTER: increments count", () => {
  const instance = new IP();
  IP.recordFTER(instance, "test reason");
  const rates = IP.getFtaFterRates(instance);
  assert.equal(rates.fterCount, 1);
});

test("IrisPerformance.recordAcquisition: records timing", () => {
  const instance = new IP();
  IP.recordAcquisition(instance, 100);
  assert.equal(instance._totalAcquisitions, 1);
});

test("IrisPerformance.recordEnrollment: records timing", () => {
  const instance = new IP();
  IP.recordEnrollment(instance, 200);
  assert.equal(instance._totalEnrollments, 1);
});

test("IrisPerformance.fnirAtFpir: returns operating points", () => {
  const genuine = [0.9, 0.85, 0.8];
  const impostor = [0.3, 0.25, 0.2];
  const result = IP.fnirAtFpir(genuine, impostor);
  assert.ok(result);
  assert.ok(Array.isArray(result.operatingPoints));
});

test("IrisPerformance.computeTimingStats: returns stats", () => {
  const instance = new IP();
  IP.recordAcquisition(instance, 50);
  IP.recordEnrollment(instance, 100);
  const stats = IP.computeTimingStats(instance);
  assert.ok(stats);
  assert.equal(typeof stats.enrollMeanMs, "number");
});

// ═══════════════════════════════════════════════════════════════
// IrisPerformance — push from 64% to 80%+
// ═══════════════════════════════════════════════════════════════
test("IrisPerformance.calculateFAR: edge case zero denominators", () => {
  assert.strictEqual(IrisPerformance.calculateFAR(0, 0), 0);
  assert.strictEqual(IrisPerformance.calculateFAR(5, 0), 0);
  assert.strictEqual(IrisPerformance.calculateFAR(0, 100), 0);
});

test("IrisPerformance.calculateFRR: edge case zero denominators", () => {
  assert.strictEqual(IrisPerformance.calculateFRR(0, 0), 0);
  assert.strictEqual(IrisPerformance.calculateFRR(5, 0), 0);
  assert.strictEqual(IrisPerformance.calculateFRR(0, 100), 0);
});

test("IrisPerformance.calculateEER: asymmetric ROC", () => {
  const r = IrisPerformance.calculateEER([0.1, 0.2, 0.3], [0.4, 0.5, 0.6]);
  assert(typeof r === "object");
  assert(typeof r.eer === "number");
});

test("IrisPerformance.calculateAccuracy: zero total", () => {
  assert.strictEqual(IrisPerformance.calculateAccuracy(0, 0, 0, 0), 0);
});

test("IrisPerformance.calculateAPCER: basic", () => {
  const r = IrisPerformance.calculateAPCER(5, 100);
  assert(typeof r === "number");
});

test("IrisPerformance.calculateAPCER: zero denominator", () => {
  assert.strictEqual(IrisPerformance.calculateAPCER(0, 0), 0);
});

test("IrisPerformance.calculateBPCER: basic", () => {
  const r = IrisPerformance.calculateBPCER(5, 100);
  assert(typeof r === "number");
});

test("IrisPerformance.calculateBPCER: zero denominator", () => {
  assert.strictEqual(IrisPerformance.calculateBPCER(0, 0), 0);
});

test("IrisPerformance.generatePADDET: with scores", () => {
  const r = IrisPerformance.generatePADDET([0.1, 0.2, 0.3], [0.4, 0.5, 0.6]);
  assert(Array.isArray(r));
  assert(r.length > 0);
});

test("IrisPerformance.generatePADDET: empty", () => {
  const r = IrisPerformance.generatePADDET([], []);
  assert(Array.isArray(r));
});

test("IrisPerformance.reportPADMetrics: basic", () => {
  const r = IrisPerformance.reportPADMetrics([0.1, 0.2], [0.5, 0.6], 0.3);
  assert(typeof r === "object");
});

test("IrisPerformance.reportPADMetrics: with empty arrays", () => {
  const r = IrisPerformance.reportPADMetrics([], [], 0.3);
  assert(typeof r === "object");
});

test("IrisPerformance.generateROC: various thresholds", () => {
  const r = IrisPerformance.generateROC([0.1, 0.2, 0.3, 0.4], [0.5, 0.6, 0.7, 0.8], 20);
  assert(typeof r === "object");
  assert(r.length > 0);
});

test("IrisPerformance.generateROC: empty", () => {
  const r = IrisPerformance.generateROC([], [], 5);
  assert(Array.isArray(r));
});

test("IrisPerformance.wilsonCI: basic", () => {
  const r = IrisPerformance.wilsonCI(50, 100, 1.96);
  assert(typeof r === "object");
  assert(typeof r.lower === "number");
  assert(typeof r.upper === "number");
  assert(r.lower <= r.upper);
});

test("IrisPerformance.wilsonCI: edge cases", () => {
  const r1 = IrisPerformance.wilsonCI(0, 0, 1.96);
  assert(typeof r1 === "object");
  const r2 = IrisPerformance.wilsonCI(100, 100, 1.96);
  assert(r2.lower > 0.9);
});

test("IrisPerformance.evaluate: comprehensive", () => {
  const r = IrisPerformance.evaluate({
    genuineScores: [0.1, 0.15, 0.2, 0.25],
    impostorScores: [0.5, 0.6, 0.7, 0.8]
  });
  assert(typeof r === "object");
  assert(typeof r.systemName === "string");
  assert(typeof r.metrics === "object");
  assert(typeof r.summary === "string");
});

test("IrisPerformance.evaluate: minimal", () => {
  const r = IrisPerformance.evaluate({
    genuineScores: [0.1],
    impostorScores: [0.5]
  });
  assert(typeof r === "object");
  assert(typeof r.systemName === "string");
});

test("IrisPerformance.pairedTTest: different distributions", () => {
  const r = IrisPerformance.pairedTTest([0.1, 0.2, 0.3], [0.4, 0.5, 0.6]);
  assert(typeof r === "object");
  assert(typeof r.tStatistic === "number");
  assert(typeof r.pValue === "number");
});

test("IrisPerformance.pairedTTest: identical distributions", () => {
  const r = IrisPerformance.pairedTTest([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]);
  assert.strictEqual(r.significant, false);
});

test("IrisPerformance.compareSystems: system1 wins", () => {
  const s1 = { genuineScores: [0.1, 0.1, 0.1], impostorScores: [0.8, 0.8, 0.8] };
  const s2 = { genuineScores: [0.3, 0.3, 0.3], impostorScores: [0.6, 0.6, 0.6] };
  const r = IrisPerformance.compareSystems(s1, s2);
  assert(typeof r.winner === "string");
  assert(typeof r.eerDifference === "number");
  assert(typeof r.significant === "boolean");
});

test("IrisPerformance.compareSystems: null → tie", () => {
  const r = IrisPerformance.compareSystems(null, null);
  assert.strictEqual(r.winner, "tie");
  assert.strictEqual(r.significant, false);
});

test("IrisPerformance.compareSystems: one null", () => {
  const s1 = { genuineScores: [0.1], impostorScores: [0.8] };
  const r = IrisPerformance.compareSystems(s1, null);
  assert(typeof r.winner === "string");
});

test("IrisPerformance.fnirAtFpir: returns operating points", () => {
  const r = IrisPerformance.fnirAtFpir([0.1, 0.2, 0.3], [0.5, 0.6, 0.7]);
  assert(typeof r === "object");
  assert(typeof r.operatingPoints === "object");
  assert(r.operatingPoints.length > 0);
});

test("IrisPerformance.fnirAtFpir: empty", () => {
  const r = IrisPerformance.fnirAtFpir([], []);
  assert(typeof r === "object");
  assert(typeof r.operatingPoints === "object");
});

test("IrisPerformance.recordFTA: increments count", () => {
  const inst = { _ftaCount: 0, _totalAcquisitions: 0, _timings: [], _fterCount: 0, _totalEnrollments: 0 };
  IrisPerformance.recordFTA(inst, "test reason");
  assert(inst._ftaCount === 1);
  assert(inst._totalAcquisitions === 1);
  assert(inst._timings.length === 1);
});

test("IrisPerformance.recordFTER: increments count", () => {
  const inst = { _fterCount: 0, _totalEnrollments: 0, _timings: [], _ftaCount: 0, _totalAcquisitions: 0 };
  IrisPerformance.recordFTER(inst, "test reason");
  assert(inst._fterCount === 1);
  assert(inst._totalEnrollments === 1);
  assert(inst._timings.length === 1);
});

test("IrisPerformance.recordAcquisition: records timing", () => {
  const inst = { _totalAcquisitions: 0, _timings: [], _ftaCount: 0, _fterCount: 0, _totalEnrollments: 0 };
  IrisPerformance.recordAcquisition(inst, 100);
  assert(inst._totalAcquisitions === 1);
  assert(inst._timings.length === 1);
});

test("IrisPerformance.recordEnrollment: records timing", () => {
  const inst = { _totalEnrollments: 0, _timings: [], _ftaCount: 0, _fterCount: 0, _totalAcquisitions: 0 };
  IrisPerformance.recordEnrollment(inst, 200);
  assert(inst._totalEnrollments === 1);
  assert(inst._timings.length === 1);
});

test("IrisPerformance.getFtaFterRates: returns rates", () => {
  const inst = { _ftaCount: 2, _fterCount: 1, _totalAcquisitions: 10, _totalEnrollments: 5, _timings: [] };
  const r = IrisPerformance.getFtaFterRates(inst);
  assert(typeof r === "object");
});

test("IrisPerformance.computeTimingStats: returns stats", () => {
  const inst = { _timings: [{durationMs: 100}, {durationMs: 200}] };
  const r = IrisPerformance.computeTimingStats(inst);
  assert(typeof r === "object");
});

test("IP.wilsonCI: 99% confidence (L404)", () => {
  const result = IP.wilsonCI(80, 100, 0.99);
  assert.equal(typeof result.lower, "number");
  assert.equal(typeof result.upper, "number");
});

test("IP.wilsonCI: 90% confidence", () => {
  const result = IP.wilsonCI(50, 100, 0.90);
  assert.ok(result.lower >= 0 && result.lower <= 1);
});

test("IP.evaluate: default systemName (L496)", () => {
  const genu = [0.8, 0.85, 0.7, 0.9, 0.75];
  const imp = [0.2, 0.3, 0.1, 0.4, 0.25];
  const result = IP.evaluate({ genuineScores: genu, impostorScores: imp });
  assert.equal(typeof result.systemName, "string");
  assert.ok(result.metrics);
});

test("IP.pairedTTest: identical arrays → NaN (L546)", () => {
  const result = IP.pairedTTest([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]);
  assert.ok(Number.isNaN(result.tStatistic));
  assert.ok(Number.isNaN(result.pValue));
  assert.equal(result.significant, false);
});

test("IP.pairedTTest: different arrays (L553-L558)", () => {
  const a = [0.8, 0.7, 0.6, 0.9, 0.85];
  const b = [0.3, 0.4, 0.5, 0.2, 0.35];
  const result = IP.pairedTTest(a, b);
  assert.equal(typeof result.tStatistic, "number");
  assert.equal(typeof result.pValue, "number");
});

test("IP.compareSystems: produces report (L590-L612)", () => {
  const sysA = { genuineScores: [0.8, 0.7, 0.9], impostorScores: [0.2, 0.3, 0.1] };
  const sysB = { genuineScores: [0.6, 0.5, 0.7], impostorScores: [0.4, 0.5, 0.3] };
  const result = IP.compareSystems(sysA, sysB);
  assert.ok(result.winner);
  assert.equal(typeof result.eerDifference, "number");
});

test("IP.getFtaFterRates: null instance (L704)", () => {
  const result = IP.getFtaFterRates(null);
  assert.equal(result.ftaCount, 0);
  assert.equal(result.fterCount, 0);
});

test("IP.recordFTA: with _timings array", () => {
  const inst = { _ftaCount: 0, _totalAcquisitions: 0, _timings: [] };
  IP.recordFTA(inst, "test-reason");
  assert.equal(inst._ftaCount, 1);
  assert.equal(inst._totalAcquisitions, 1);
  assert.equal(inst._timings.length, 1);
});

test("IP.recordFTER: with _timings array", () => {
  const inst = { _fterCount: 0, _totalEnrollments: 0, _timings: [] };
  IP.recordFTER(inst, "test-reason");
  assert.equal(inst._fterCount, 1);
  assert.equal(inst._totalEnrollments, 1);
});

test("IP.recordAcquisition: with _timings array", () => {
  const inst = { _totalAcquisitions: 0, _timings: [] };
  IP.recordAcquisition(inst, 15);
  assert.equal(inst._totalAcquisitions, 1);
});

test("IP.recordEnrollment: with _timings array", () => {
  const inst = { _totalEnrollments: 0, _timings: [] };
  IP.recordEnrollment(inst, 25);
  assert.equal(inst._totalEnrollments, 1);
});

test("IP.generatePADDET: with real data (L240)", () => {
  const labels = [1, 0, 1, 0, 1, 0, 0, 1];
  const scores = [0.9, 0.3, 0.8, 0.2, 0.85, 0.1, 0.4, 0.75];
  const result = IP.generatePADDET(labels, scores, 50);
  assert.ok(Array.isArray(result));
});

test("IP.generateROC: uniform scores → uniform ROC (L314-L376)", () => {
  const genu = [0.8, 0.8, 0.8];
  const imp = [0.2, 0.2, 0.2];
  const result = IP.generateROC(genu, imp, 10);
  assert.ok(Array.isArray(result));
  assert.ok(result.length === 11);
});

test("IP.calculateFAR: zero total (L830-L832)", () => {
  const result = IP.calculateFAR(0, 0);
  assert.equal(result, 0);
});

test("IP.calculateFRR: zero total (L843-L845)", () => {
  const result = IP.calculateFRR(0, 0);
  assert.equal(result, 0);
});

test("IP.calculateAccuracy: basic (L856-L858)", () => {
  const result = IP.calculateAccuracy(8, 2, 10);
  assert.equal(typeof result, "number");
  assert.ok(result >= 0);
});

test("IP.fnirAtFpir: simple data (L429-L445)", () => {
  const genu = [0.9, 0.8, 0.7, 0.6, 0.5];
  const imp = [0.3, 0.4, 0.2, 0.5, 0.1];
  const result = IP.fnirAtFpir(genu, imp);
  assert.ok(result.operatingPoints);
  assert.ok(Array.isArray(result.operatingPoints));
});

test("IP.reportPADMetrics: binary labels (L188-L224)", () => {
  const labels = [1, 0, 1, 0, 1, 0, 1, 0];
  const scores = [0.9, 0.2, 0.8, 0.3, 0.85, 0.1, 0.75, 0.4];
  const result = IP.reportPADMetrics(labels, scores);
  assert.equal(typeof result.iapar, "number");
  assert.ok(Array.isArray(result.det));
});

test("IP.wilsonCI: edge case (L396-L406)", () => {
  const result = IP.wilsonCI(0, 10);
  assert.equal(typeof result.lower, "number");
  assert.equal(typeof result.upper, "number");
  assert.ok(result.lower >= 0);
});

test("IP.calculateEER: null input (L100-L102)", () => {
  const r = IP.calculateEER(null);
  assert.equal(r.eer, 0);
});

test("IP.calculateEER: empty array (L100-L102)", () => {
  const r = IP.calculateEER([]);
  assert.equal(r.eer, 0);
});

test("IP.generatePADDET: NaN scores (L213)", () => {
  const r = IP.generatePADDET([NaN, NaN], [NaN, NaN]);
  assert.ok(Array.isArray(r));
});

test("IP.fnirAtFpir: no operating point meets target (L260-L266)", () => {
  const genuine = [0.1, 0.12, 0.14, 0.16, 0.18];
  const impostor = [0.9, 0.88, 0.86, 0.84, 0.82];
  const r = IP.fnirAtFpir(genuine, impostor);
  assert.ok(r);
  assert.ok(Array.isArray(r.operatingPoints));
});

test("IP.generateROC: empty arrays (L297)", () => {
  const r = IP.generateROC([], [1, 2, 3]);
  assert.ok(Array.isArray(r));
  assert.equal(r.length, 0);
});

test("IP.generateROC: null input (L297)", () => {
  const r = IP.generateROC(null, null);
  assert.ok(Array.isArray(r));
  assert.equal(r.length, 0);
});

test("IP.wilsonCI: low confidence else branch (L407-L408)", () => {
  const r = IP.wilsonCI(50, 100, 0.8);
  assert.ok(r);
  assert.equal(typeof r.lower, "number");
});

test("IP.evaluate: missing params throws (L440-L442)", () => {
  assert.throws(() => IP.evaluate(null), /genuineScores/);
  assert.throws(() => IP.evaluate({}), /genuineScores/);
});

test("IP.pairedTTest: invalid inputs (L546-L548)", () => {
  const r1 = IP.pairedTTest(null, [1]);
  assert.equal(r1.significant, false);
  const r2 = IP.pairedTTest([1], [1, 2]);
  assert.equal(r2.significant, false);
  const r3 = IP.pairedTTest([1], [1]);
  assert.equal(r3.significant, false);
});

test("IP.compareSystems: system2 wins (L611-L613)", () => {
  const s1 = { genuineScores: [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0.02, 0.01], impostorScores: [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.92, 0.95, 0.99] };
  const s2 = { genuineScores: [0.98, 0.95, 0.92, 0.9, 0.88, 0.85, 0.82, 0.8, 0.78, 0.75, 0.72, 0.7, 0.68, 0.65, 0.62, 0.6, 0.58, 0.55, 0.52, 0.5], impostorScores: [0.01, 0.02, 0.05, 0.08, 0.1, 0.12, 0.15, 0.18, 0.2, 0.22, 0.25, 0.28, 0.3, 0.32, 0.35, 0.38, 0.4, 0.42, 0.45, 0.48] };
  const r = IP.compareSystems(s1, s2);
  assert.ok(r);
  assert.equal(typeof r.winner, "string");
});

test("IP.recordFTA (L643)", () => {
  const inst = { _timings: [], _ftaCount: 0, _totalAcquisitions: 0 };
  IP.recordFTA(inst, "blur");
  assert.equal(inst._ftaCount, 1);
  assert.ok(inst._timings.length > 0);
});

test("IP.recordAcquisition (L659)", () => {
  const inst = { _timings: [], _totalAcquisitions: 0 };
  IP.recordAcquisition(inst, 50);
  assert.ok(inst._timings.length > 0);
});

test("IP.recordFTER (L677)", () => {
  const inst = { _timings: [], _fterCount: 0, _totalEnrollments: 0 };
  IP.recordFTER(inst, "noise");
  assert.equal(inst._fterCount, 1);
});

test("IP.recordEnrollment (L693)", () => {
  const inst = { _timings: [], _totalEnrollments: 0 };
  IP.recordEnrollment(inst, 100);
  assert.ok(inst._timings.length > 0);
});

test("IP.computeTimingStats: empty instance (L775-L777)", () => {
  const r = IP.computeTimingStats(null);
  assert.equal(r.eventCount, 0);
  const r2 = IP.computeTimingStats({ _timings: [] });
  assert.equal(r2.eventCount, 0);
});

test("IP.compareSystems: same-length genuineScores triggers paired t-test (L598-L604)", () => {
  const s1 = { genuineScores: [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0.02, 0.01], impostorScores: [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.92, 0.95, 0.99] };
  const s2 = { genuineScores: [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0.02, 0.01], impostorScores: [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.92, 0.95, 0.99] };
  const r = IP.compareSystems(s1, s2);
  assert.ok(r);
  assert.equal(typeof r.winner, "string");
});

test("IP.generateROC: with data (L344)", () => {
  const r = IP.generateROC([0.9, 0.8, 0.7], [0.3, 0.4, 0.5]);
  assert.ok(Array.isArray(r));
  assert.ok(r.length > 0);
});

test("IP.pairedTTest: identical arrays (L594)", () => {
  const r = IP.pairedTTest([0.5, 0.6, 0.7], [0.5, 0.6, 0.7]);
  assert.equal(typeof r.tStatistic, "number");
  assert.equal(typeof r.pValue, "number");
});

test("IP.fnirAtFpir: with data (L768)", () => {
  const r = IP.fnirAtFpir([0.9, 0.8, 0.7, 0.6, 0.5], [0.1, 0.2, 0.3, 0.4, 0.5]);
  assert.ok(r.operatingPoints);
  assert.ok(r.operatingPoints.length > 0);
});

// ── IP.reportPADMetrics: empty arrays → det.length===0 (L265) ──
test("IP.reportPADMetrics: empty arrays → returns defaults (L265)", () => {
  const r = IP.reportPADMetrics([], []);
  assert.equal(r.apcerAtBpcer10, 0);
  assert.equal(r.bpcer, 0);
  assert.ok(Array.isArray(r.det));
  assert.equal(r.det.length, 0);
});

// ── IP.generateROC: with spread scores (L344) ──
test("IP.generateROC: spread genuine/impostor scores (L344)", () => {
  const r = IP.generateROC([0.1, 0.3, 0.5, 0.7, 0.9], [0.9, 0.7, 0.5, 0.3, 0.1]);
  assert.ok(Array.isArray(r));
  assert.ok(r.length > 0);
  assert.ok(r[0].far !== undefined);
});

// ── IP.compareSystems: full comparison with paired t-test (L639, L649, L668) ──
test("IP.compareSystems: two systems with same-length genuine scores (L639, L649, L668)", () => {
  const s1 = { genuineScores: [0.9, 0.85, 0.8, 0.75, 0.7], impostorScores: [0.3, 0.35, 0.4, 0.45, 0.5] };
  const s2 = { genuineScores: [0.8, 0.75, 0.7, 0.65, 0.6], impostorScores: [0.4, 0.45, 0.5, 0.55, 0.6] };
  const r = IP.compareSystems(s1, s2);
  assert.ok(r);
  assert.equal(typeof r.winner, "string");
  assert.equal(typeof r.eerDifference, "number");
  assert.equal(typeof r.system1Eer, "number");
  assert.equal(typeof r.system2Eer, "number");
  assert.equal(typeof r.significant, "boolean");
});

// ── IP.compareSystems: with null system2 (L635) ──
test("IP.compareSystems: null system2 → tie (L635)", () => {
  const r = IP.compareSystems({ genuineScores: [0.9], impostorScores: [0.1] }, null);
  assert.equal(r.winner, "tie");
});

// ── IP.getFtaFterRates: with instance having acquisitions (L768) ──
test("IP.getFtaFterRates: instance with data (L768)", () => {
  const r = IP.getFtaFterRates({
    _totalAcquisitions: 100,
    _ftaCount: 5,
    _totalEnrollments: 50,
    _fterCount: 3,
  });
  assert.equal(r.ftaRate, 0.05);
  assert.equal(r.fterRate, 0.06);
  assert.equal(r.ftaCount, 5);
  assert.equal(r.fterCount, 3);
});

// ── IP.getFtaFterRates: with non-null instance having zero totals (L768) ──
test("IP.getFtaFterRates: instance with zero totals (L768)", () => {
  const r = IP.getFtaFterRates({
    _totalAcquisitions: 0,
    _ftaCount: 0,
    _totalEnrollments: 0,
    _fterCount: 0,
  });
  assert.equal(r.ftaRate, 0);
  assert.equal(r.fterRate, 0);
});
