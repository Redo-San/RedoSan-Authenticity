import os, struct
from wtype_common import bits, from_bits, load_rgb, pw_key, xor_bytes

def embed(img_path, secret_path, output_path, password=None):
    with open(secret_path, "rb") as f:
        secret = f.read()
    key = pw_key(password)
    secret = xor_bytes(secret, key)
    payload = struct.pack(">I", len(secret)) + secret
    b = bits(payload)
    from PIL import Image
    img = load_rgb(img_path)
    w, h = img.size
    px = img.load()
    need = len(b)
    idx = 0
    for y in range(h):
        for x in range(w):
            if idx >= need:
                break
            r, g, bv = px[x, y]
            if idx < need:
                r = (r & ~3) | (int(b[idx]) << 1 | int(b[idx+1] if idx+1 < need else 0)); idx += 2
            if idx < need:
                g = (g & ~3) | (int(b[idx]) << 1 | int(b[idx+1] if idx+1 < need else 0)); idx += 2
            if idx < need:
                bv = (bv & ~3) | (int(b[idx]) << 1 | int(b[idx+1] if idx+1 < need else 0)); idx += 2
            px[x, y] = (r, g, bv)
        if idx >= need:
            break
    img.save(output_path)
    return True, f"Type 6 (Multi-bit): {len(secret)} bytes hidden (2-bit LSB)"

def extract(stego_path, outdir, password=None):
    img = load_rgb(stego_path)
    px = img.load()
    w, h = img.size
    b = ""
    for y in range(h):
        for x in range(w):
            r, g, bv = px[x, y]
            b += str((r >> 1) & 1) + str(r & 1)
            b += str((g >> 1) & 1) + str(g & 1)
            b += str((bv >> 1) & 1) + str(bv & 1)
            if len(b) >= 32:
                dlen = int(b[:32], 2)
                if dlen > 0 and dlen < w * h * 3 // 4:
                    if len(b) >= 32 + dlen * 8:
                        break
        if len(b) >= 32:
            dlen = int(b[:32], 2)
            if len(b) >= 32 + dlen * 8:
                break
    if len(b) < 32:
        return False, "No data found"
    dlen = int(b[:32], 2)
    if dlen <= 0 or dlen > w * h * 3 // 4:
        return False, f"Corrupted: invalid size {dlen}"
    data = from_bits(b[32:32 + dlen * 8])
    data = xor_bytes(data, pw_key(password))
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, "extracted_type6")
    with open(out, "wb") as f:
        f.write(data)
    return True, f"Type 6 extract: {dlen} bytes"
