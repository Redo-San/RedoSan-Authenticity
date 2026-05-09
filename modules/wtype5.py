import os
from .wtype_common import bits, from_bits, load_rgb
from .wtype_common import img_to_ycbcr, ycbcr_to_rgb, embed_in_dct, extract_from_dct

FIXED_SIG = b"RedoSanZeroBit"

def embed(img_path, secret_path, output_path, password=None):
    from PIL import Image
    b = bits(FIXED_SIG)
    img = load_rgb(img_path)
    ycbcr = img_to_ycbcr(img)
    y, cb, cr = ycbcr.split()
    y = embed_in_dct(y, b, strength=25)
    out = Image.merge("YCbCr", [y, cb, cr])
    out = ycbcr_to_rgb(out)
    out.save(output_path)
    return True, "Type 5 (Zero-bit): Presence mark embedded"

def extract(stego_path, outdir="", password=None):
    img = load_rgb(stego_path)
    ycbcr = img_to_ycbcr(img)
    y, cb, cr = ycbcr.split()
    b = extract_from_dct(y, len(FIXED_SIG) * 8)
    if len(b) < len(FIXED_SIG) * 8:
        return False, "No zero-bit watermark detected"
    data = from_bits(b[:len(FIXED_SIG) * 8])
    if data == FIXED_SIG:
        return True, "Type 5: PRESENCE CONFIRMED - Zero-bit watermark detected"
    matches = sum(1 for a, bv in zip(data, FIXED_SIG) if a == bv)
    ratio = matches / len(FIXED_SIG)
    if ratio > 0.85:
        return True, f"Type 5: Presence likely ({ratio*100:.0f}% match)"
    return False, f"Type 5: No watermark (only {ratio*100:.0f}% match)"
