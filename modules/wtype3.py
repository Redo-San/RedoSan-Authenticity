import os, struct, random
from .wtype_common import bits, from_bits, load_rgb, pw_key, xor_bytes

def embed(img_path, secret_path, output_path, password=None):
    with open(secret_path, "rb") as f:
        secret = f.read()
    key = pw_key(password)
    secret = xor_bytes(secret, key)
    payload = struct.pack(">I", len(secret)) + secret
    b = bits(payload)
    img = load_rgb(img_path)
    px = img.load()
    w, h = img.size
    rng = random.Random(key if key else b"default")
    positions = [(x, y, c) for y in range(h) for x in range(w) for c in range(3)]
    rng.shuffle(positions)
    for idx, (x, y, c) in enumerate(positions):
        if idx >= len(b):
            break
        bit = int(b[idx])
        r, g, bv = px[x, y]
        val = [r, g, bv][c]
        val = (val & ~1) | bit
        if c == 0:
            px[x, y] = (val, g, bv)
        elif c == 1:
            px[x, y] = (r, val, bv)
        else:
            px[x, y] = (r, g, val)
    img.save(output_path)
    return True, f"Type 3 (Neural SS): {len(secret)} bytes hidden in PRNG positions"

def extract(stego_path, outdir, password=None):
    img = load_rgb(stego_path)
    px = img.load()
    w, h = img.size
    key = pw_key(password)
    rng = random.Random(key if key else b"default")
    positions = [(x, y, c) for y in range(h) for x in range(w) for c in range(3)]
    rng.shuffle(positions)
    b = ""
    for idx, (x, y, c) in enumerate(positions):
        if len(b) >= 32:
            dlen = int(b[:32], 2)
            if dlen > 0 and dlen < 100000 and len(b) >= 32 + dlen * 8:
                break
        r, g, bv = px[x, y]
        val = [r, g, bv][c]
        b += str(val & 1)
    if len(b) < 32:
        return False, "No data found"
    dlen = int(b[:32], 2)
    if dlen <= 0 or dlen > 100000:
        return False, f"Corrupted: {dlen}"
    if len(b) < 32 + dlen * 8:
        return False, "Incomplete data"
    data = from_bits(b[32:32 + dlen * 8])
    data = xor_bytes(data, key)
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, "extracted_type3")
    with open(out, "wb") as f:
        f.write(data)
    return True, f"Type 3 extract: {dlen} bytes -> {out}"
