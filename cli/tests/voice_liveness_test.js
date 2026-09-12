const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Polyfills needed by the origin-guard IIFE in voice_liveness.js
globalThis.window = globalThis;
globalThis.location = {
  protocol: "file:",
  href: "file:///test/voice_liveness.js",
  hostname: "localhost",
  origin: "null",
};

const srcDir = path.join(__dirname, "../../Voice_Biometric");
const modSrc = fs.readFileSync(path.join(srcDir, "voice_liveness.js"), "utf8");
vm.runInThisContext(modSrc, {
  filename: path.resolve(srcDir, "voice_liveness.js"),
});

const Liveness = globalThis.VoiceLiveness;

describe("VoiceLiveness — module contract", () => {
  it("exposes the ISO 30107-flavoured verdict vocabulary", () => {
    assert.equal(
      Liveness.VERDICTS.BONAFIDE_PRESENTATION,
      "bonafide-presentation",
    );
    assert.equal(Liveness.VERDICTS.PRESENTATION_ATTACK, "presentation-attack");
    assert.equal(Liveness.VERDICTS.INCONCLUSIVE, "inconclusive");
  });

  it("declares the verdict record schema and coverage floor", () => {
    assert.equal(Liveness.SCHEMA, "voice-liveness-verdict-v1");
    assert.equal(Liveness.MIN_COVERAGE, 0.5);
  });
});

describe("VoiceLiveness — text normalization", () => {
  it("lowercases, trims and collapses whitespace", () => {
    assert.equal(
      Liveness.normalizeText("  Open   the DOOR  "),
      "open the door",
    );
  });

  it("strips punctuation by default", () => {
    assert.equal(Liveness.normalizeText("open the door!"), "open the door");
    assert.equal(
      Liveness.normalizeText('say "sesame", please.'),
      "say sesame please",
    );
  });

  it("preserves non-Latin script letters (deterministic)", () => {
    assert.equal(Liveness.normalizeText("مرحبا  يا  عاالم"), "مرحبا يا عاالم");
  });
});

describe("VoiceLiveness — challenge/response consistency", () => {
  it("accepts an exact normalized match", () => {
    const r = Liveness.challengeCheck({
      prompt: "Open the DOOR",
      response: "open the door",
    });
    assert.equal(r.ok, true);
    assert.equal(r.exact, true);
    assert.equal(r.prefix, false);
  });

  it("accepts a response that is a >=50% prefix of the prompt (ASR truncation)", () => {
    const r = Liveness.challengeCheck({
      prompt: "open the pod bay door",
      response: "open the pod bay",
    });
    assert.equal(r.ok, true);
    assert.equal(r.prefix, true);
  });

  it("rejects a mismatch", () => {
    const r = Liveness.challengeCheck({
      prompt: "open sesame",
      response: "wrong phrase",
    });
    assert.equal(r.ok, false);
  });

  it("rejects a low-coverage containment (single repeated word)", () => {
    const r = Liveness.challengeCheck({
      prompt: "open the pod bay door",
      response: "the",
    });
    assert.equal(r.ok, false);
  });

  it("rejects a missing/empty response", () => {
    assert.equal(
      Liveness.challengeCheck({ prompt: "open sesame", response: "" }).ok,
      false,
    );
    assert.equal(
      Liveness.challengeCheck({ prompt: "open sesame", response: null }).ok,
      false,
    );
  });
});

describe("VoiceLiveness — signal indicators (10 ms envelope, heuristic)", () => {
  function signal(amp, variant) {
    const n = 16000; // 1 s @ 16 kHz
    const a = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      if (variant === "ac") a[i] = i % 2 === 0 ? amp : -amp;
      else if (variant === "varying")
        a[i] = amp * (0.5 * Math.sin(i * 0.03) + 0.5 * Math.sin(i * 0.217));
      else a[i] = amp; // dc
    }
    return { pcm: a, sampleRate: 16000 };
  }

  it("flags digital silence", () => {
    const s = Liveness.signalIndicators(new Float32Array(16000), 16000);
    assert.equal(s.silence, true);
    assert.equal(s.rms, 0);
    assert.equal(s.peakAbs, 0);
  });

  it("detects a constant AC tone: constant envelope, no DC dominance", () => {
    const s = Liveness.signalIndicators(signal(0.01, "ac").pcm, 16000);
    assert.equal(s.silence, false);
    assert.equal(s.constantEnvelope, true);
    assert.equal(s.dcExcessive, false);
    assert.ok(Math.abs(s.rms - 0.01) < 1e-3);
    assert.ok(Math.abs(s.dcBias) < 1e-6);
  });

  it("flags a DC-dominated constant tone on both indicators", () => {
    const s = Liveness.signalIndicators(signal(0.01, "dc").pcm, 16000);
    assert.equal(s.constantEnvelope, true);
    assert.equal(s.dcExcessive, true);
    assert.ok(Math.abs(s.rms - 0.01) < 1e-3);
    assert.ok(Math.abs(s.dcBias - 0.01) < 1e-3);
  });

  it("sees a varying signal as non-constant", () => {
    const s = Liveness.signalIndicators(signal(0.02, "varying").pcm, 16000);
    assert.equal(s.silence, false);
    assert.equal(s.constantEnvelope, false);
    assert.ok(s.envStd > 0);
  });

  it("reports a 1 s window as durationSec 1", () => {
    const s = Liveness.signalIndicators(signal(0.01, "ac").pcm, 16000);
    assert.equal(s.durationSec, 1);
    assert.equal(s.windowMs, 10);
  });
});

describe("VoiceLiveness — ISO 30107-3 verdict record", () => {
  function speech(amp, variant) {
    const n = 16000;
    const a = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      a[i] =
        variant === "tone"
          ? amp * (i % 2 === 0 ? 1 : -1)
          : amp * (0.5 * Math.sin(i * 0.03) + 0.5 * Math.sin(i * 0.217));
    }
    return { pcm: a, sampleRate: 16000 };
  }

  const verdict = (overrides) =>
    Liveness.evaluate(
      Object.assign(
        {
          sampleRate: 16000,
          pcm: speech(0.02, "speech").pcm,
        },
        overrides,
      ),
    );

  it("passes a matched challenge + live speech as bonafide-presentation", () => {
    const v = verdict({ prompt: "open sesame", response: "open sesame" });
    assert.equal(v.conclusion, Liveness.VERDICTS.BONAFIDE_PRESENTATION);
    assert.equal(v.schema, Liveness.SCHEMA);
    assert.deepEqual(
      v.methods.sort(),
      ["challenge-response", "signal-liveness"].sort(),
    );
    assert.equal(v.flags.length, 0);
  });

  it("flags a mismatched challenge as a presentation attack", () => {
    const v = verdict({ prompt: "open sesame", response: "closing phrase" });
    assert.equal(v.conclusion, Liveness.VERDICTS.PRESENTATION_ATTACK);
    assert.ok(v.flags.includes("challenge-mismatch"));
  });

  it("flags max silence (replay of a silent file) as an attack", () => {
    const v = verdict({
      pcm: new Float32Array(16000),
      prompt: "open sesame",
      response: "open sesame",
    });
    assert.equal(v.conclusion, Liveness.VERDICTS.PRESENTATION_ATTACK);
    assert.ok(v.flags.includes("max-silence"));
  });

  it("flags a constant AC tone (machine signal) as an attack", () => {
    const v = verdict({
      pcm: speech(0.01, "tone").pcm,
      prompt: "open sesame",
      response: "open sesame",
    });
    assert.equal(v.conclusion, Liveness.VERDICTS.PRESENTATION_ATTACK);
    assert.ok(v.flags.includes("constant-envelope"));
  });

  it("stays inconclusive on an unanswered challenge", () => {
    const v = verdict({ prompt: "open sesame", response: null });
    assert.equal(v.conclusion, Liveness.VERDICTS.INCONCLUSIVE);
    assert.ok(v.flags.includes("challenge-unanswered"));
  });

  it("stays inconclusive with no challenge issued (signal alone cannot claim)", () => {
    const v = verdict({});
    assert.equal(v.conclusion, Liveness.VERDICTS.INCONCLUSIVE);
    assert.deepEqual(v.methods, ["signal-liveness"]);
  });

  it("declares APCER/BPCER unmeasured (no attack corpus in-repo)", () => {
    const v = verdict({ prompt: "open sesame", response: "open sesame" });
    assert.equal(v.metrics.APCER, null);
    assert.equal(v.metrics.BPCER, null);
    assert.equal(v.metrics.measured, false);
    assert.match(v.metrics.note, /unmeasured/i);
  });

  it("annotates all signal rules as non-standard heuristics", () => {
    const v = verdict({ prompt: "open sesame", response: "open sesame" });
    assert.ok(v.rulesets.length >= 2);
    for (const r of v.rulesets) {
      assert.equal(r.standard, "none");
      assert.equal(r.heuristic, true);
    }
    assert.equal(v.calibrated, false);
  });
});

describe("VoiceLiveness — uncovered branch coverage", () => {
  it("challengeCheck with null input defaults to empty object", () => {
    const r = Liveness.challengeCheck(null);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "prompt missing");
  });

  it("challengeCheck with empty prompt", () => {
    const r = Liveness.challengeCheck({ prompt: "", response: "hello" });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "prompt missing");
  });

  it("signalIndicators throws on non-Float32Array", () => {
    assert.throws(() => Liveness.signalIndicators([1, 2, 3]));
  });

  it("signalIndicators throws on empty Float32Array", () => {
    assert.throws(() => Liveness.signalIndicators(new Float32Array(0)));
  });

  it("evaluate with null input defaults to empty object", () => {
    const v = Liveness.evaluate(null);
    assert.equal(v.conclusion, Liveness.VERDICTS.INCONCLUSIVE);
    assert.ok(v.flags.includes("signal-unavailable"));
  });

  it("evaluate with Float32Array pcm triggers signal-liveness path", () => {
    const pcm = new Float32Array(16000).fill(0.1);
    const v = Liveness.evaluate({ pcm, sampleRate: 16000 });
    assert.ok(v.checks.signal);
    assert.ok(v.methods.includes("signal-liveness"));
  });

  it("evaluate without pcm adds signal-unavailable flag", () => {
    const v = Liveness.evaluate({ prompt: "hello", response: "hello" });
    assert.ok(v.flags.includes("signal-unavailable"));
  });

  it("evaluate with constant-envelope PCM triggers constant-envelope flag", () => {
    const pcm = new Float32Array(16000).fill(0.5);
    const v = Liveness.evaluate({ pcm, sampleRate: 16000 });
    assert.ok(v.flags.includes("constant-envelope"));
  });

  it("evaluate with silent PCM triggers max-silence flag", () => {
    const pcm = new Float32Array(16000).fill(0);
    const v = Liveness.evaluate({ pcm, sampleRate: 16000 });
    assert.ok(v.flags.includes("max-silence"));
  });

  it("evaluate with dc-excessive PCM triggers dc-excessive flag", () => {
    const pcm = new Float32Array(16000);
    for (let i = 0; i < pcm.length; i++)
      pcm[i] = 0.5 + Math.sin(i / 100) * 0.01;
    const v = Liveness.evaluate({ pcm, sampleRate: 16000 });
    assert.ok(v.flags.includes("dc-excessive"));
  });
});
