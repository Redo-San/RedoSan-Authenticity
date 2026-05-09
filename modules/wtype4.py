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
    bits3 = "".join(c * 3 for c in b)
    img = load_rgb(img_path)
    cap = max_dct_bits(img.size)
    if len(bits3) > cap:
        max_secret = (cap // 3 - 32) // 8
        return False, f"Secret too large: image supports ~{max_secret} bytes with 3x redundancy"
    ycbcr = img_to_ycbcr(img)
    y, cb, cr = ycbcr.split()
    y = embed_in_dct(y, bits3, strength=25)
    out = Image.merge("YCbCr", [y, cb, cr])
    out = ycbcr_to_rgb(out)
    out.save(output_path)
    return True, f"Type 4 (Latent DCT redundant): {len(secret)} bytes"

def extract(stego_path, outdir, password=None):
    img = load_rgb(stego_path)
    ycbcr = img_to_ycbcr(img)
    y, cb, cr = ycbcr.split()
    n3 = 32 * 3
    bits3 = extract_from_dct(y, n3)
    if len(bits3) < n3:
        return False, "No data found"
    b = "".join("1" if bits3[i:i+3].count("1") >= 2 else "0" for i in range(0, len(bits3), 3))
    dlen = int(b[:32], 2)
    if dlen <= 0 or dlen > 100000:
        return False, f"Corrupted: {dlen}"
    n3 = (32 + dlen * 8) * 3
    bits3 = extract_from_dct(y, n3)
    b = "".join("1" if bits3[i:i+3].count("1") >= 2 else "0" for i in range(0, len(bits3), 3))
    data = from_bits(b[32:32 + dlen * 8])
    data = xor_bytes(data, pw_key(password))
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, "extracted_type4")
    with open(out, "wb") as f:
        f.write(data)
    return True, f"Type 4 extract: {dlen} bytes -> {out}"
