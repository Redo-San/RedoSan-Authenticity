"""
Audio steganography — WAV LSB using Python standard library (wave)
Pure Python, zero external dependencies.
"""
import os, struct, hashlib, wave
from pathlib import Path


def _bits_from_bytes(data):
    return "".join(format(b, "08b") for b in data)


def _bytes_from_bits(bits):
    return bytes(int(bits[i:i+8], 2) for i in range(0, len(bits), 8))


def embed(wav_path, secret_path, output_path, password=None):
    if not os.path.exists(wav_path):
        return False, "WAV file not found"
    if not os.path.exists(secret_path):
        return False, "Secret file not found"

    with wave.open(wav_path, "rb") as w:
        if w.getsampwidth() != 2:
            return False, "Only 16-bit PCM WAV supported"
        params = w.getparams()
        frames = bytearray(w.readframes(w.getnframes()))

    with open(secret_path, "rb") as f:
        secret = f.read()

    if password:
        key = hashlib.sha256(password.encode()).digest()
        secret = bytes(secret[i] ^ key[i % len(key)] for i in range(len(secret)))

    payload = struct.pack(">I", len(secret)) + secret
    bits = _bits_from_bytes(payload)

    # 16-bit samples: 2 bytes each
    num_samples = len(frames) // 2
    if len(bits) > num_samples:
        return False, f"Audio too small: need {len(bits)} bits, have {num_samples}"

    for i in range(len(bits)):
        offset = i * 2
        samp = struct.unpack_from("<h", frames, offset)[0]
        samp = (samp & ~1) | int(bits[i])
        struct.pack_into("<h", frames, offset, samp)

    with wave.open(output_path, "wb") as w:
        w.setparams(params)
        w.writeframes(bytes(frames))

    return True, f"Data hidden in {output_path}"


def extract(wav_path, outdir, password=None):
    if not os.path.exists(wav_path):
        return False, "WAV file not found"

    with wave.open(wav_path, "rb") as w:
        if w.getsampwidth() != 2:
            return False, "Only 16-bit PCM WAV supported"
        frames = bytearray(w.readframes(w.getnframes()))

    # Read first 32 bits = secret length
    len_bits = ""
    for i in range(32):
        samp = struct.unpack_from("<h", frames, i * 2)[0]
        len_bits += str(samp & 1)

    secret_len = int(len_bits, 2)
    if secret_len <= 0 or secret_len > (len(frames) // 2) - 32:
        return False, f"Invalid or corrupted data (size: {secret_len})"

    # Read secret bits
    data_bits = ""
    for i in range(32, 32 + secret_len * 8):
        samp = struct.unpack_from("<h", frames, i * 2)[0]
        data_bits += str(samp & 1)

    secret = _bytes_from_bits(data_bits)

    if password:
        key = hashlib.sha256(password.encode()).digest()
        secret = bytes(secret[i] ^ key[i % len(key)] for i in range(len(secret)))

    os.makedirs(outdir, exist_ok=True)
    out_path = os.path.join(outdir, "extracted_from_audio")
    with open(out_path, "wb") as f:
        f.write(secret)

    return True, f"Extracted to {out_path}"
