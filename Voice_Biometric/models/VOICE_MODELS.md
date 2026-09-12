# Voice_Biometric — Model & Artifact Ledger

Human-readable license/provenance ledger for the models and preprocessing artifacts
shipped with the `Voice_Biometric` module. Mirrors the machine-readable extended
manifest (`models/manifest.json`, schema_version 2 — see the build plan §4) and is the
single source of truth for **what** was pinned, **from where**, **under which license**,
and the VoxCeleb/Creative-Commons attribution that redistribution carries.

> Status: **assets committed at Phase C2 (2026-09-09)**. `silero_vad.onnx`, `aasist-l.onnx`
> and `aasist.onnx` were downloaded from their pinned HF commits, verified byte-for-byte
> against the digests recorded below, and committed into `Voice_Biometric/models/`.
> `manifest.json` (schema_version 2) ships the full provenance + preprocessing contract;
> `NOTICE` carries the Apache-2.0 / CC-BY-4.0 / MIT attribution (§2). The 83.5 MiB ECAPA
> embedder remains runtime-fetched + SRI-verified (pre-commit large-file guard ≥10 MiB).

## 1. Pinned artifacts

### 1a. ECAPA-TDNN embedder (B2)

Source repo: `vedk00/ecapa-voxceleb-speaker-embedding-onnx`
(<https://huggingface.co/vedk00/ecapa-voxceleb-speaker-embedding-onnx>)

HF commit SHA pinned at research time: **`a9cb9321b07b4ee5b0ea47fdd25242d9cacd824a`**
(last updated 2026-05-25).

| Path in repo                       | Size (bytes)           | SHA-256 (LFS, read 2026-09-08)                                     | Role                                             |
| ---------------------------------- | ---------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| `model/ecapa-speaker-v1.onnx`      | 83 476 039 (~79.6 MiB) | `f46380bbaeddb929fb3a10ab63a4b1877a50e3d1e5fdd55a1b618d5651d3f64e` | ECAPA-TDNN speaker embedder, 192-d               |
| `model/fbank-80x201-f32.bin`       | 64 320                 | `024e5073b7cfedee84408dc68dd6bafa02808fc786e67f1314e9c918297f5a63` | frozen 80-band mel filterbank (80 × 201 float32) |
| `manifest.json`                    | 825                    | — (plain git)                                                      | shipped preprocessing contract (see §3)          |
| `README.md` / `NOTICE` / `LICENSE` | 2 026 / 1 953 / 11 357 | —                                                                  | provenance + license text                        |

`Voice_Biometric/models/` must contain (after Phase C2) the two binary assets named
exactly as above, plus the extended `manifest.json` (`schema_version: 2`) that the report
and the SRI loader use.

**Status 2026-09-08:** `fbank-80x201-f32.bin` is downloaded and verified byte-for-byte
against the LFS SHA above (64 320 B) — and is **byte-identical to the fbank shipped by
vedk00** (`model/fbank-80x201-f32.bin`, 0/64 320 byte diffs) and to SpeechBrain 1.1.1's
frozen `_triangular_filters`. `ecapa-speaker-v1.onnx` (83.5 MB) is **not committed**: it
exceeds the repo pre-commit large-file guard (≥10 MiB) and, per the `face_embed_onnx.js`
precedent, is fetched at runtime and SRI-verified (W3C pattern via `crypto.subtle`) before
an inference session is created. The digest below was **measured from the artifact** at
revision `a9cb93…` on 2026-09-08 and matches the LFS SHA. The oracle's reference SpeechBrain
checkout (`speechbrain/spkrec-ecapa-voxceleb` @ `0f99f2d0ebe89ac095bcc5903c4dd8f72b367286`,
last modified 2025-02-18) lives in `cli/tests/fixtures/spkrec_ecapa/` (git-ignored, ~83 MB,
fetched once via `huggingface_hub.snapshot_download`).

### Measured ONNX graph contract (B2, extracted from the artifact 2026-09-08)

| Field         | Value                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Producer      | `pytorch 2.8.0`, opset 17, 1038 nodes                                                                                                 |
| Input         | `features` float32 `[batch, frames, 80]` (mean-normalized fbank)                                                                      |
| Input         | `feature_lens` float32 `[batch]` — length fraction; `1.0` = full utterance; used only as an attention/pooling weight (SE-block `Mul`) |
| Output        | `embedding` float32 `[batch, 192]`                                                                                                    |
| In-graph norm | **none** (`ReduceMean` absent) — the "sentence mean subtraction" is external (B1 `computeLogMel`)                                     |

Verified end-to-end with onnxruntime fake-seam tests (38/38) plus a real-inference run:
`computeLogMel(pcm, fbank, 16000).data` → `features [1,T,80]` + `feature_lens=[1]` → ECAPA
ONNX → embedding **cosine = 1.000000000** vs the golden SpeechBrain embeddings for both
`golden_sp1` (210 frames) and `golden_sp2` (982 frames) — tolerance `embedding_cosine_min`
0.999. Opt-in real check: `REDOSAN_VOICE_ONNX_REAL=1` (requires `onnxruntime-node` + model
path via `REDOSAN_VOICE_ONNX_MODEL`).

### 1b. Silero VAD v5 (B3)

Source repo: `runanywhere/silero-vad-v5`
(<https://huggingface.co/runanywhere/silero-vad-v5>) — byte-identical ONNX to upstream
`snakers4/silero-vad` master (`silero_vad.onnx`, 0 byte diffs), **MIT** licensed.

| Path in repo      | Size (bytes) | SHA-256 (measured from artifact, 2026-09-08)                       | Role                         |
| ----------------- | ------------ | ------------------------------------------------------------------ | ---------------------------- |
| `silero_vad.onnx` | 2 327 524    | `1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3` | speech-activity gate (64 kb) |

**Pinned at C2 (2026-09-09):** HF commit `38a8e93669ea8fd4dd5d693bc90d86b7b667d36d`
(`runanywhere/silero-vad-v5`); re-hashed byte-for-byte → digest above (MATCH, forwarded
from B3). Committed at `Voice_Biometric/models/silero_vad.onnx`.

**Measured ONNX graph contract (B3, extracted from the artifact 2026-09-08):**

| Field       | Value                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Producer    | spox, opset 16                                                                                                                                  |
| Input       | `input` float32 `[?,?]` — 64 context + 512 pcm samples (576) per step @ 16 kHz                                                                  |
| Input       | `state` float32 `[2,1,128]` — LSTM hidden/cell state, zero-init, **MUST carry via `stateN`**                                                    |
| Input       | `sr` **int64 0-D scalar** = 16000                                                                                                               |
| Output      | `output` float32 `[1,1]` speech probability                                                                                                     |
| Output      | `stateN` float32 `[2,1,128]` fed back as `state` on the next call (**stateful**)                                                                |
| Endpointing | upstream `utils_vad.py` defaults: THRESHOLD 0.5, NEG_THRESHOLD 0.35, MIN_SPEECH_MS 250, MIN_SILENCE_MS 100, SPEECH_PAD_MS 30, MAX_UTTERANCE_S 4 |

Enforced by `VoiceVAD.MODEL_SHA256` + the `voice_vad_test.js` pin. Per the 83.5 MB embedder
precedent, the VAD ONNX is fetched at runtime and SHA-256-verified (`crypto.subtle`) before a
session is created; it will be committed into `Voice_Biometric/models/silero_vad.onnx` at C2
only after re-verification (2 327 524 B / digest above) and license-recorded here. Default
runtime CDN pin (same as embedder): `onnxruntime-web@1.20.1` via jsdelivr, verified by
`RUNTIME_URL` + the SRI logic; execution providers tried webgpu → wasm → cpu.

### 1c. AASIST / AASIST-L anti-spoof PAD gate (B5)

Source repos: `SpeechAntiSpoofingBenchmarks/AASIST` and `SpeechAntiSpoofingBenchmarks/AASIST-L`
(<https://huggingface.co/SpeechAntiSpoofingBenchmarks/AASIST>,
<https://huggingface.co/SpeechAntiSpoofingBenchmarks/AASIST-L>), **MIT** licensed, exported from
upstream clovaai/aasist (<https://github.com/clovaai/aasist>).

| Path in repo    | Size (bytes) | SHA-256 (measured at C2, 2026-09-09)                               | Role                                                                   |
| --------------- | ------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `aasist-l.onnx` | 766 114      | `f43f0a638b52846f5d0e630c0a738d10e9306325945127c6f8662d559585f218` | AASIST-L (0.085306 M params) raw-waveform anti-spoof gate, logits[:,1] |
| `aasist.onnx`   | 1 615 195    | `130e536266b7c537f9a13029e1612a9f392fd1cc827783683b6d1c062a3db5e1` | Full AASIST variant (model switcher)                                   |

**Pinned at C2 (2026-09-09):** both artifacts downloaded from their pinned HF commits and
re-hashed byte-for-byte — AASIST-L @ `357e022c44a1aa926097e18c1457bde3873ed8bf`,
AASIST @ `16774d458d86d2a021ae31646c1bf66a5331b53e`. Both committed at
`Voice_Biometric/models/aasist{-l,}.onnx`; digests pinned in `voice_antispoof.js`
`MODELS.*.sha256` (enforced by `voice_antispoof_test.js`, SRI pattern).

Sizes above are HF-LFS metadata read at research time (2026-09-08); the onnx files are **not
committed at B5** and no digest is pinned yet (module `MODELS.*.sha256` is deliberately null —
no fabricated digest). Digests are measured at C2 when the assets are committed.

**Measured ONNX graph contract (B5, from the official export script `trt_aasist_l.py`):**

| Field       | Value                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| Producer    | export via `trt_aasist_l.py`, opset 17, `do_constant_folding=True`, `_freeze_sinc` baked into plain Conv1d   |
| Input       | `wav` float32 `[B, 64600]` raw mono waveform (16 kHz) — **not** mel/spectrogram                              |
| Output      | `logits` float32 `[B, 2]`; **logits[:,1] = bona-fide logit** (higher = bonafide)                             |
| Window      | 64600 samples = 4.0375 s; preprocessing = first-window (longer) / tile-repeat `pad_fixed` (shorter), NO norm |
| Run-time EP | WASM first (`DEFAULT_EXECUTION_PROVIDERS=["wasm"]`) — WebGPU table lacks `Selu`, `Reshape` has no GPU kernel |

Browser-validity gate enforced by `voice_antispoof.js` + `voice_antispoof_test.js` (29 tests);
fallback verdicts never shipped hard-coded — `applyCalibration` (α·logit+β vs threshold, B4
manifest pattern) leaves `calibrated:false` / `INCONCLUSIVE` until externally fitted.

## 2. License chain & attribution

| Layer                                | License                              | Who grants / requires                                         | Consequence                            |
| ------------------------------------ | ------------------------------------ | ------------------------------------------------------------- | -------------------------------------- |
| Repo code & packaging (`vedk00/...`) | Apache-2.0                           | Repo `LICENSE` + `NOTICE` files                               | redistributable, keep NOTICE           |
| Model weights                        | trained on **VoxCeleb** (Oxford VGG) | dataset license **CC-BY-4.0** applies to models trained on it | **attribution mandatory**              |
| Upstream speechbrain config          | `speechbrain/spkrec-ecapa-voxceleb`  | Apache-2.0 (SpeechBrain)                                      | record upstream commit at oracle build |
| AASIST / AASIST-L weights (B5)       | clovaai/aasist (releases, **MIT**)   | HF mirror `SpeechAntiSpoofingBenchmarks/AASIST[-L]`           | MIT notice retained at C2              |
| ASVspoof metrics (reporting only)    | none (numbers derived at runtime)    | —                                                             | not shipped                            |

**Required attribution (ship with the assets, per CC-BY-4.0):**

```text
Speaker embeddings in this module are computed with an ECAPA-TDNN model
(256-channel, 192-d output) trained on the VoxCeleb dataset
(https://www.robots.ox.ac.uk/~vgg/data/voxceleb/).

Creator: Joon Son Chung, Arsha Nagrani and Andrew Zisserman.
VoxCeleb is released under the Creative Commons Attribution 4.0 International License
(CC BY 4.0, https://creativecommons.org/licenses/by/4.0/).
Modifications: converted to ONNX with a frozen SpeechBrain-compatible
80-band filterbank (fbank-80x201-f32.bin); preprocessing contract in models/manifest.json.
```

> The exact strings embedded in `NOTICE`/attribution files are finalized at Phase C1
> (legal gate). Nothing here changes the GPL-2.0 license of the repository itself; the
> Apache-2.0/CC-BY-4.0 chain applies to the _model artifacts_ only, which is why they are
> kept vendored with their own NOTICE rather than merged into the GPL source tree.

## 3. Preprocessing contract (from the shipped `manifest.json`)

These values are **derived from the pinned artifact**, not assumed from ECAPA folklore.
The browser pipeline must reproduce them exactly; any parameter not present in the
manifest (e.g. pre-emphasis 0.97, Hamming window, zero-padding to 512) may only be used
if a recorded parity test proves it against this oracle (§8.1 of the plan).

| Field                  | Value (from shipped manifest)                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `sample_rate_hz`       | 16000                                                                                                        |
| `channels`             | 1                                                                                                            |
| `feature_type`         | `SpeechBrain fbank`                                                                                          |
| `n_fft`                | 400                                                                                                          |
| `win_length`           | 400                                                                                                          |
| `hop_length`           | 160 (25 ms / 10 ms at 16 kHz)                                                                                |
| `n_mels`               | 80                                                                                                           |
| `normalization`        | `sentence mean subtraction` (per-utterance mean over log-mel frames — **not** mean/variance standardization) |
| `embedding_dimensions` | 192                                                                                                          |
| `upstream`             | `speechbrain/spkrec-ecapa-voxceleb`                                                                          |

**ONNX input is the SpeechBrain-compatible fbank tensor `[1, 80, T]` — not raw audio.**
The 400-point FFT yields 201 bins, matching the shipped `fbank-80x201-f32.bin`.

## 4. Oracle inputs & fixture voices

`cli/tests/fixtures/generate_oracle.py` (offline, not in CI) consumes fixture voices and
writes `golden_<voice>.json`. Ledger of fixture voices:

| Fixture                                | Purpose                                                 | License / origin                                             | Attribution entry                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `silence.wav`, `silence_5s.wav` (repo) | rejection / VAD-negative tests — **no golden expected** | project fixture                                              | —                                                                                                                                  |
| `golden_sp1.wav` (2.09 s, F)           | positive golden, short utterance                        | LibriSpeech **dev-clean** clip `84-121123-0000` (CC BY 4.0)  | Reader **Christie Nowak** — _The Count of Monte Cristo_ (LibriVox, ch. 47); wav sha256 `6e8353d8…0ff`; transcript "GO DO YOU HEAR" |
| `golden_sp2.wav` (9.81 s, M)           | positive golden, longer utterance                       | LibriSpeech **dev-clean** clip `251-136532-0000` (CC BY 4.0) | Reader **Mark Nelson** — _Omnilingual_ (LibriVox); wav sha256 `f1c5805c…3fa5`; transcript "THEY ALSO FOUND A MARTIAN CALENDAR…"    |

Corpus citation: V. Panayotov, G. Chen, D. Povey and S. Khudanpur, "LibriSpeech: an ASR
corpus based on public domain audio books", ICASSP 2015. Source:
<https://www.openslr.org/resources/12/> (corpus license CC BY 4.0); the underlying
recordings are public-domain LibriVox audiobooks. Original FLAC sha256:
`4c0f9a69…e995` (`golden_sp1`), `39a86dd8…c6ae2` (`golden_sp2`). The committed WAVs are the
LibriSpeech-native 16 kHz mono PCM-16 clips re-wrapped as WAV; their canonical int16 digest
is recorded as `canonical.digest_sha256` in the matching `golden_<voice>.json`.

Rule (plan §1.2 / §8.1): no new voice enters the fixtures until its source, author and
CC-BY-4.0 terms are recorded in this table. Gravitas: fixtures are committed to the repo,
so attribution must be exact.

## 5. Implementation checklist (run at Phase C2)

- [x] Re-hash `fbank-80x201-f32.bin` locally → `024e5073…7f5a63` byte-for-byte (2026-09-08).
- [x] Re-hash `ecapa-speaker-v1.onnx` → `f46380bbaeddb929fb3a10ab63a4b1877a50e3d1e5fdd55a1b618d5651d3f64e`
      (measured 2026-09-08 from the artifact at `a9cb93…`; matches LFS SHA; enforced by the
      module's `MODEL_SHA256` + the golden `onnx_sha256` pin).
- [x] Re-check the ONNX model repo revision (pin `a9cb9321b07b4ee5b0ea47fdd25242d9cacd824a`
      confirmed 2026-09-08; recorded as `oracle.onnx_repo_source_commit` in the golden JSONs).
- [x] Record the same pin in the shipped `manifest.json` `source_commit` at Phase C2
      (`model.source_commit = a9cb9321…`; also recorded the VAD `38a8e936…` and AASIST
      `357e022c…` / `16774d45…` pins — 2026-09-09).
- [x] Record the `onnxruntime-web` version + selected execution provider in `manifest.json`
      `runtime` (`onnxruntime_web_version 1.20.1`, `ep "webgpu|wasm|cpu"`, bundle URL +
      integrity note — 2026-09-09). No module README exists yet; runtime is also recorded in
      the module `RUNTIME_URL` / `DEFAULT_EXECUTION_PROVIDERS` constants.
- [x] Ship `NOTICE` with the Apache-2.0 + VoxCeleb CC-BY-4.0 attribution (§2) —
      `Voice_Biometric/models/NOTICE` written 2026-09-09 (also carries MIT for VAD + AASIST).
- [x] Fixture-voice ledger (§4) updated for `golden_sp1.wav` / `golden_sp2.wav` (2026-09-08).
- [x] Re-hash `silero_vad.onnx` at C2 (target 2 327 524 B / `1a153a22…8788e3`) and record its
      MIT license + provenance (`runanywhere/silero-vad-v5` ≡ upstream `snakers4/silero-vad`
      master) in §1b — re-hashed byte-for-byte at C2 → **MATCH**, committed (2026-09-09).
- [x] B4 calibration artifact (`calibration/calibration_manifest.json`) references the §1a
      digests - `model.sha256` `f46380bb…3f64e`, `preprocessing.fbankSha256`
      `024e5073…f5a63`, `dimension` 192 - and is asserted parseable by
      `voice_matcher_test.js` ("accepts the shipped calibration_manifest.json artifact")
      (2026-09-08).
- [x] At C2, regenerate `calibration/calibration_manifest.json` against the committed binary
      assets (embed + fbank re-hash) and confirm `fitCalibration`/`threshold` reproduce —
      committed `fbank-80x201-f32.bin` re-hash `024e5073…7f5a63` **MATCH** (2026-09-09),
      `model.sha256` pin `f46380bb…3f64e` unchanged; manifest regenerated/annotated
      `generatedAt=2026-09-09`, threshold `4.59511985013459` reproduces under
      `VoiceMatcher.fitCalibration` (voice_matcher_test.js).
- [x] Measure `aasist-l.onnx` / `aasist.onnx` SHA-256 at C2, commit both into
      `Voice_Biometric/models/`, and pin the digests in `voice_antispoof.js` `MODELS.*.sha256`
      — `f43f0a63…f218` and `130e5362…b5e1`, both committed + pinned (2026-09-09).

## 6. References

- Model repo: <https://huggingface.co/vedk00/ecapa-voxceleb-speaker-embedding-onnx>
- HF API file tree (sizes): <https://huggingface.co/api/models/vedk00/ecapa-voxceleb-speaker-embedding-onnx/tree/main?recursive=true&expand=true>
- Upstream model config: <https://huggingface.co/speechbrain/spkrec-ecapa-voxceleb>
- LibriSpeech corpus (fixture voices): <https://www.openslr.org/resources/12/>
- VoxCeleb dataset: <https://www.robots.ox.ac.uk/~vgg/data/voxceleb/>
- AASIST models (B5): <https://huggingface.co/SpeechAntiSpoofingBenchmarks/AASIST>,
  <https://huggingface.co/SpeechAntiSpoofingBenchmarks/AASIST-L>
- AASIST upstream (B5): <https://github.com/clovaai/aasist> (MIT)
- CC BY 4.0: <https://creativecommons.org/licenses/by/4.0/>
- Apache-2.0: <https://www.apache.org/licenses/LICENSE-2.0>
