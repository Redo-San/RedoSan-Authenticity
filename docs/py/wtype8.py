import os, hashlib
from wtype_common import bits, from_bits, load_rgb

def embed(img_path, secret_path, output_path, password=None):
    with open(secret_path, "rb") as f:
        secret = f.read()
    payload = hashlib.sha256(secret).hexdigest().encode()
    b = bits(payload)
    img = load_rgb(img_path)
    px = img.load()
    w, h = img.size
    if len(b) > w * h * 3:
        return False, f"Image too small"
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
    img.save(output_path)
    return True, "Type 8 (Fragile): SHA-256 integrity hash embedded"

def extract(stego_path, outdir, password=None):
    img = load_rgb(stego_path)
    px = img.load()
    w, h = img.size
    b = ""
    for y in range(h):
        for x in range(w):
            r, g, bv = px[x, y]
            b += str(r & 1) + str(g & 1) + str(bv & 1)
            if len(b) >= 256:
                break
        if len(b) >= 256:
            break
    if len(b) < 256:
        return False, "No hash found"
    data = from_bits(b[:256])
    hex_hash = data.decode("ascii", errors="replace")
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, "extracted_hash_type8.txt")
    with open(out, "w") as f:
        f.write(hex_hash)
    return True, f"Type 8: Embedded hash: {hex_hash}"
