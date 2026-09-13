#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0
#
# Golden-oracle generator for the Voice_Biometric pipeline.
#   Offline only, NOT part of CI (keep it that way).
#
# For each fixture voice it reproduces the exact upstream pipeline
# (SpeechBrain spkrec-ecapa-voxceleb, pinned revision) and writes a
# deterministic golden JSON:  golden_<voice>.json
#
# Contents:
#   canonical.*        sha256 over the canonical staged audio bytes
#                      (decode -> resample 16 kHz mono -> int16 PCM).
#                      Same bytes => same digest; this is the drift marker.
#   preprocessing      the pinned manifest contract for the run (matches
#                      Voice_Biometric/models/manifest.json schema_version 2).
#   log_mel            base64(little-endian float32) 80-band log-mel
#                      intermediate tensor, shape [n_frames, 80] -- the exact
#                      tensor fed to the embedder, so silent preprocessing
#                      drift cannot hide behind a cosine.
#   embedding          base64(little-endian float32) 192-d ECAPA embedding.
#   tolerances         recorded at build time (log-mel abs ~1e-3; cosine min).
#   oracle.*           upstream source + revision + software versions.
#
# Usage (requires a local Python with torch, torchaudio, speechbrain, numpy):
#   Offline (recommended): checkout speechbrain/spkrec-ecapa-voxceleb once and:
#     python cli/tests/fixtures/generate_oracle.py \
#       --local-model-dir cli/tests/fixtures/spkrec_ecapa \
#       --filterbank Voice_Biometric/models/fbank-80x201-f32.bin \
#       --voice golden_sp1.wav golden_sp2.wav
#
# Prerequisites are python deps only (dev machine, never CI).

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sys
from pathlib import Path

TARGET_SR = 16000
DEFAULT_OUT = Path("cli/tests/fixtures")

# Mirror of the pinned artifact manifest (Voice_Biometric/models/manifest.json,
# schema_version 2). Only shipped manifest values go here.
PREPROCESSING = {
    "input_sample_rate": 16000,
    "input_channels": 1,
    "feature_type": "SpeechBrain fbank",
    "n_fft": 400,
    "win_length": 400,
    "hop_length": 160,
    "n_mels": 80,
    "normalization": "sentence mean subtraction",
}

# Recorded at build; tighten to the measured spread once the JS gate runs.
DEFAULT_TOLERANCES = {
    "log_mel_abs": 2.0e-3,
    "embedding_cosine_min": 0.999,
}


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_canonical_pcm(wav_path: Path):
    """Decode + resample to 16 kHz mono int16 PCM (the canonical bytes).

    Reads with `soundfile` (SpeechBrain's own declared dependency) instead of
    `torchaudio.load()`: torchaudio >= 2.9 dispatches load() to TorchCodec's
    AudioDecoder, which requires system FFmpeg *shared* libraries ("full-shared"
    build on Windows). The machine this oracle runs on ships a static FFmpeg
    build, so torchaudio is kept only for the pure-torch resample step. The
    canonical contract (decode -> resample 16 kHz -> mono -> int16 PCM) and the
    resulting sha256 digest are unchanged.
    """
    import soundfile as sf  # noqa: PLC0415
    import torch  # noqa: PLC0415
    import torchaudio  # noqa: PLC0415

    wf, sr = sf.read(str(wav_path), dtype="float32", always_2d=True)
    wf = torch.from_numpy(wf)
    if sr != TARGET_SR:
        wf = torchaudio.functional.resample(wf, sr, TARGET_SR)
    if wf.ndim >= 2 and wf.size(1) > 1:
        wf = wf.mean(1, keepdim=True)
    x = wf.clamp(-1.0, 1.0)
    pcm = (x * 32767.0).round().clamp(-32768, 32767).to(torch.int16)
    return pcm[:, 0]


def print_banner() -> None:
    sys.stderr.write(
        "generate_oracle.py: offline-only tool. Requires torch/torchaudio/"
        "speechbrain/numpy installed locally. Refusing to run in CI.\n"
    )


def load_classifier(args):
    from speechbrain.inference.speaker import EncoderClassifier  # noqa: PLC0415

    if args.local_model_dir:
        source = str(Path(args.local_model_dir).resolve())
        kwargs = {"source": source, "run_opts": {"device": "cpu"}}
    else:
        source = args.upstream
        kwargs = {
            "source": source,
            "savedir": str(args.hub_cache or ".hf_cache"),
            "run_opts": {"device": "cpu"},
        }
    if args.upstream_revision and not args.local_model_dir:
        kwargs["revision"] = args.upstream_revision
    return EncoderClassifier.from_hparams(**kwargs), source


def compute_oracle(classifier, pcm):
    """Return (log_mel [T,80], embedding [192]) computed through the SAME fbank
    tensor that the embedder consumes -- not two disconnected code paths."""
    import torch  # noqa: PLC0415

    sig = (pcm.float() / 32768.0).unsqueeze(0)  # back to [-1, 1], (1, T)
    lens = torch.ones(1, device=classifier.device)
    feats = classifier.mods.compute_features(sig)  # (1, T, 80) log-mel fbank
    feats = classifier.mods.mean_var_norm(feats, lens)  # sentence-mean subtraction
    emb = classifier.mods.embedding_model(feats, lens)  # (1, 192)
    return feats[0].detach().cpu().float(), emb.squeeze(0).detach().cpu().float()


def f32_b64(t) -> str:
    import numpy as np  # noqa: PLC0415

    arr = np.ascontiguousarray(t.numpy(), dtype="<f4")
    return base64.b64encode(arr.tobytes()).decode("ascii")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--voice",
        nargs="+",
        required=True,
        help="fixture voice WAV(s); each gets a golden_<stem>.json",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="output dir for golden JSON (default: cli/tests/fixtures)",
    )
    parser.add_argument(
        "--local-model-dir",
        type=Path,
        default=None,
        help="offline checkout of speechbrain/spkrec-ecapa-voxceleb (recommended)",
    )
    parser.add_argument(
        "--upstream",
        default="speechbrain/spkrec-ecapa-voxceleb",
        help="HF repo to load when no local checkout is given",
    )
    parser.add_argument(
        "--upstream-revision",
        default="main",
        help="pinned upstream commit for reproducibility",
    )
    parser.add_argument(
        "--filterbank",
        type=Path,
        default=None,
        help="path to the pinned fbank-80x201-f32.bin (records its sha256)",
    )
    parser.add_argument(
        "--source-commit",
        default="",
        help="HF commit SHA of the ONNX repo pinned at this build",
    )
    args = parser.parse_args(argv)

    print_banner()
    try:
        import numpy  # noqa: F401
        import torch
        import torchaudio
        import soundfile
        import speechbrain
    except ImportError as exc:  # pragma: no cover
        sys.stderr.write(
            f"Missing dependency: {exc}. Install locally; this tool is offline-only.\n"
        )
        return 1

    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    classifier, model_source = load_classifier(args)

    filterbank_sha = None
    if args.filterbank:
        fb = Path(args.filterbank).resolve()
        if fb.stat().st_size != 64320:
            sys.stderr.write(
                f"WARNING: {fb} size {fb.stat().st_size} != 64320 (pinned).\n"
            )
        filterbank_sha = sha256_hex(fb.read_bytes())

    pkg = lambda m: getattr(m, "__version__", "?")  # noqa: E731
    ret = 0
    for v in args.voice:
        vp = Path(v)
        if not vp.exists():
            sys.stderr.write(f"skip: missing {vp}\n")
            ret = 1
            continue
        pcm = load_canonical_pcm(vp)
        log_mel, emb = compute_oracle(classifier, pcm)
        stem = vp.stem
        gold = {
            "schema_version": 1,
            "voice": stem,
            "canonical": {
                "encoding": "int16-pcm-16k-mono",
                "sample_rate": TARGET_SR,
                "channels": 1,
                "digest_sha256": sha256_hex(pcm.cpu().numpy().tobytes()),
            },
            "preprocessing": PREPROCESSING,
            "filterbank_sha256": filterbank_sha,
            "log_mel": {
                "shape": list(log_mel.shape),
                "dtype": "float32_le",
                "encoding": "base64",
                "bytes": f32_b64(log_mel),
            },
            "embedding": {
                "shape": list(emb.shape),
                "dtype": "float32_le",
                "encoding": "base64",
                "bytes": f32_b64(emb),
            },
            "tolerances": DEFAULT_TOLERANCES,
            "oracle": {
                "model_source": model_source,
                "upstream_revision": args.upstream_revision,
                "onnx_repo_source_commit": args.source_commit or None,
                "speechbrain_version": pkg(speechbrain),
                "torch_version": pkg(torch),
                "torchaudio_version": pkg(torchaudio),
                "numpy_version": pkg(numpy),
            },
        }
        name = stem[7:] if stem.startswith("golden_") else stem
        dest = out_dir / f"golden_{name}.json"
        dest.write_text(
            json.dumps(gold, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        sys.stderr.write(
            f"wrote {dest} (log_mel {list(log_mel.shape)}, emb {list(emb.shape)})\n"
        )
    return ret


if __name__ == "__main__":
    raise SystemExit(main())
