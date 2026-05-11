import os, hashlib

def embed(img_path, secret_path, output_path, password=None):
    from PIL import Image
    from PIL.PngImagePlugin import PngInfo
    with Image.open(img_path) as pil_img:
        img = pil_img.convert("RGB")
    px = img.load()
    w, h = img.size
    h_obj = hashlib.sha256()
    for y in range(h):
        for x in range(w):
            h_obj.update(bytes(px[x, y]))
    digest = h_obj.hexdigest()
    pnginfo = PngInfo()
    pnginfo.add_text("WatermarkFragile", digest)
    img.save(output_path, pnginfo=pnginfo)
    return True, f"Type 8 (Fragile): SHA256 of pixels embedded -> {output_path}"

def extract(stego_path, outdir="", password=None):
    from PIL import Image
    with Image.open(stego_path) as img:
        stored = img.info.get("WatermarkFragile")
        if not stored:
            return False, "Type 8: No fragile watermark found"
        img = img.convert("RGB")
        px = img.load()
        w, h = img.size
        h_obj = hashlib.sha256()
        for y in range(h):
            for x in range(w):
                h_obj.update(bytes(px[x, y]))
        cur = h_obj.hexdigest()
        if cur == stored:
            return True, f"Type 8: INTACT - Pixel data unchanged (SHA256: {stored[:16]}...)"
        return False, f"Type 8: TAMPERED!\n  Stored: {stored[:16]}...\n  Actual: {cur[:16]}..."
