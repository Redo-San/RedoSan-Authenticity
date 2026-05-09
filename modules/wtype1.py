import os, struct
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
    if len(b) > w * h * 3:
        return False, f"Image too small: need {len(b)} bits, have {w*h*3}"
    idx = 0
    for y in range(h):
        for x in range(w):
            if idx >= len(b):
                break
            r, g, bv = px[x, y]
            if idx < len(b):
                r = (r & ~1) | int(b[idx]); idx += 1
            if idx < len(b):
                g = (g & ~1) | int(b[idx]); idx += 1
            if idx < len(b):
                bv = (bv & ~1) | int(b[idx]); idx += 1
            px[x, y] = (r, g, bv)
        if idx >= len(b):
            break
    img.save(output_path)
    return True, f"Type 1 (Spatial LSB): {len(secret)} bytes hidden in {output_path}"

def extract(stego_path, outdir, password=None):
    img = load_rgb(stego_path)
    px = img.load()
    w, h = img.size
    b = ""
    for y in range(h):
        for x in range(w):
            r, g, bv = px[x, y]
            b += str(r & 1) + str(g & 1) + str(bv & 1)
            if len(b) >= 32:
                dlen = int(b[:32], 2)
                if dlen <= 0 or dlen > (w * h * 3 // 8 - 4):
                    return False, f"Corrupted: invalid size {dlen}"
                if len(b) >= 32 + dlen * 8:
                    break
        if len(b) >= 32:
            dlen = int(b[:32], 2)
            if len(b) >= 32 + dlen * 8:
                break
    if len(b) < 32:
        return False, "No data found"
    dlen = int(b[:32], 2)
    if dlen <= 0 or dlen > w * h * 3 // 8:
        return False, f"Corrupted: invalid size {dlen}"
    data = from_bits(b[32:32 + dlen * 8])
    data = xor_bytes(data, pw_key(password))
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, "extracted_type1")
    with open(out, "wb") as f:
        f.write(data)
    return True, f"Type 1 extract: {dlen} bytes -> {out}"
