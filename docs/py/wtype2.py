import os, struct
from wtype_common import bits, from_bits, load_rgb, pw_key, xor_bytes
from wtype_common import img_to_ycbcr, ycbcr_to_rgb, embed_in_dct, extract_from_dct, max_dct_bits

def embed(img_path, secret_path, output_path, password=None):
    from PIL import Image
    with open(secret_path, "rb") as f:
        secret = f.read()
    key = pw_key(password)
    secret = xor_bytes(secret, key)
    payload = struct.pack(">I", len(secret)) + secret
    b = bits(payload)
    img = load_rgb(img_path)
    cap = max_dct_bits(img.size)
    if len(b) > cap:
        max_secret = cap // 8 - 4
        return False, f"Secret too large: image supports ~{max_secret} bytes"
    ycbcr = img_to_ycbcr(img)
    y, cb, cr = ycbcr.split()
    y = embed_in_dct(y, b, strength=25)
    out = Image.merge("YCbCr", [y, cb, cr])
    out = ycbcr_to_rgb(out)
    out.save(output_path)
    return True, f"Type 2 (Frequency DCT): {len(secret)} bytes hidden"

def extract(stego_path, outdir, password=None):
    img = load_rgb(stego_path)
    ycbcr = img_to_ycbcr(img)
    y, cb, cr = ycbcr.split()
    b = extract_from_dct(y, 32)
    if len(b) < 32:
        return False, "No data found"
    dlen = int(b[:32], 2)
    if dlen <= 0 or dlen > 100000:
        return False, f"Corrupted: invalid size {dlen}"
    b = extract_from_dct(y, 32 + dlen * 8)
    if len(b) < 32 + dlen * 8:
        return False, f"Not enough bits: got {len(b)}, need {32 + dlen * 8}"
    data = from_bits(b[32:32 + dlen * 8])
    data = xor_bytes(data, pw_key(password))
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, "extracted_type2")
    with open(out, "wb") as f:
        f.write(data)
    return True, f"Type 2 extract: {dlen} bytes"
