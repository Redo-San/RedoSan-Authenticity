import os, struct
from .wtype_common import bits, from_bits, load_rgb, pw_key, xor_bytes
from .wtype_common import img_to_ycbcr, ycbcr_to_rgb, embed_in_dct, extract_from_dct, max_dct_bits

def embed(img_path, secret_path, output_path, password=None):
    from PIL import Image
    with open(secret_path, "rb") as f:
        secret = f.read()
    key = pw_key(password)
    secret = xor_bytes(secret, key)
    payload = struct.pack(">I", len(secret)) + secret
    b = bits(payload)
    bits7 = "".join(c * 7 for c in b)
    img = load_rgb(img_path)
    cap = max_dct_bits(img.size)
    if len(bits7) > cap:
        max_secret = (cap // 7 - 32) // 8
        return False, f"Secret too large: image supports ~{max_secret} bytes with 7x spread (per channel)"
    ycbcr = img_to_ycbcr(img)
    y, cb, cr = ycbcr.split()
    y = embed_in_dct(y, bits7, strength=25)
    cb = embed_in_dct(cb, bits7, strength=25)
    out = Image.merge("YCbCr", [y, cb, cr])
    out = ycbcr_to_rgb(out)
    out.save(output_path)
    return True, f"Type 9 (Imatag-style): {len(secret)} bytes with 7x spread"

def extract(stego_path, outdir, password=None):
    img = load_rgb(stego_path)
    ycbcr = img_to_ycbcr(img)
    y, cb, cr = ycbcr.split()
    n7 = 32 * 7
    y_bits7 = extract_from_dct(y, n7)
    cb_bits7 = extract_from_dct(cb, n7)
    if len(y_bits7) < n7 or len(cb_bits7) < n7:
        return False, "No data found"
    b = ""
    for i in range(0, min(len(y_bits7), len(cb_bits7)), 7):
        group = y_bits7[i:i+7] + cb_bits7[i:i+7]
        b += "1" if group.count("1") >= 7 else "0"
    dlen = int(b[:32], 2)
    if dlen <= 0 or dlen > 100000:
        return False, f"Corrupted: {dlen}"
    n7 = (32 + dlen * 8) * 7
    y_bits7 = extract_from_dct(y, n7)
    cb_bits7 = extract_from_dct(cb, n7)
    b = ""
    for i in range(0, min(len(y_bits7), len(cb_bits7)), 7):
        group = y_bits7[i:i+7] + cb_bits7[i:i+7]
        b += "1" if group.count("1") >= 7 else "0"
    data = from_bits(b[32:32 + dlen * 8])
    data = xor_bytes(data, pw_key(password))
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, "extracted_type9")
    with open(out, "wb") as f:
        f.write(data)
    return True, f"Type 9 extract: {dlen} bytes -> {out}"
