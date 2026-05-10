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
    b = bits(payload) * 3
    img = load_rgb(img_path)
    cap = max_dct_bits(img.size) * 3
    if len(b) > cap:
        return False, f"Secret too large for redundant embedding"
    ycbcr = img_to_ycbcr(img)
    y, cb, cr = ycbcr.split()
    y = embed_in_dct(y, b, strength=30)
    out = Image.merge("YCbCr", [y, cb, cr])
    out = ycbcr_to_rgb(out)
    out.save(output_path)
    return True, f"Type 4 (Latent DCT): {len(secret)} bytes hidden (redundant x3)"

def extract(stego_path, outdir, password=None):
    img = load_rgb(stego_path)
    ycbcr = img_to_ycbcr(img)
    y, cb, cr = ycbcr.split()
    b = extract_from_dct(y, 96)
    if len(b) < 96:
        b = extract_from_dct(y, 32)
        if len(b) < 32:
            return False, "No data found"
        dlen = int(b[:32], 2)
    else:
        b0 = b[0:32]; b1 = b[32:64]; b2 = b[64:96]
        dlen0 = int(b0, 2); dlen1 = int(b1, 2); dlen2 = int(b2, 2)
        dlen = sorted([dlen0, dlen1, dlen2])[1]
    if dlen <= 0 or dlen > 100000:
        return False, f"Corrupted: invalid size {dlen}"
    total_bits = 32 + dlen * 8
    b = extract_from_dct(y, total_bits)
    if len(b) < total_bits:
        return False, f"Not enough bits: got {len(b)}, need {total_bits}"
    data = from_bits(b[32:32 + dlen * 8])
    data = xor_bytes(data, pw_key(password))
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, "extracted_type4")
    with open(out, "wb") as f:
        f.write(data)
    return True, f"Type 4 extract: {dlen} bytes"
