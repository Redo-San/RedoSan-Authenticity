import os, hashlib, struct, math, random

def bits(data):
    return "".join(format(b, "08b") for b in data)

def from_bits(bits_str):
    return bytes(int(bits_str[i:i+8], 2) for i in range(0, len(bits_str), 8))

def load_rgb(path):
    from PIL import Image
    with Image.open(path) as img:
        return img.convert("RGB")

def pw_key(password):
    if not password:
        return b""
    return hashlib.pbkdf2_hmac("sha256", password.encode(), password.encode(), 100000)

def xor_bytes(data, key):
    if not key:
        return data
    return bytes(data[i] ^ key[i % len(key)] for i in range(len(data)))

def dct_8x8(block):
    result = [[0.0]*8 for _ in range(8)]
    for u in range(8):
        for v in range(8):
            s = 0.0
            for x in range(8):
                for y in range(8):
                    s += block[x][y] * math.cos((2*x+1)*u*math.pi/16) * math.cos((2*y+1)*v*math.pi/16)
            cu = 1.0/math.sqrt(2) if u==0 else 1.0
            cv = 1.0/math.sqrt(2) if v==0 else 1.0
            result[u][v] = s * cu * cv * 0.25
    return result

def idct_8x8(dct_block):
    result = [[0]*8 for _ in range(8)]
    for x in range(8):
        for y in range(8):
            s = 0.0
            for u in range(8):
                for v in range(8):
                    cu = 1.0/math.sqrt(2) if u==0 else 1.0
                    cv = 1.0/math.sqrt(2) if v==0 else 1.0
                    s += cu * cv * dct_block[u][v] * math.cos((2*x+1)*u*math.pi/16) * math.cos((2*y+1)*v*math.pi/16)
            result[x][y] = max(0, min(255, int(round(s * 0.25))))
    return result

def block_iter(img, bsize=8):
    w, h = img.size
    for y in range(0, h - h % bsize, bsize):
        for x in range(0, w - w % bsize, bsize):
            yield x, y

def get_block(img, x, y, bsize=8):
    block = [[0]*bsize for _ in range(bsize)]
    for dy in range(bsize):
        for dx in range(bsize):
            p = img.getpixel((x+dx, y+dy))
            block[dy][dx] = p[0] if isinstance(p, (tuple, list)) else p
    return block

def set_block(img, x, y, block):
    for dy in range(len(block)):
        for dx in range(len(block[0])):
            img.putpixel((x+dx, y+dy), block[dy][dx])

def img_to_ycbcr(img):
    return img.convert("YCbCr")

def ycbcr_to_rgb(img):
    return img.convert("RGB")

MID = [(0,4),(1,3),(2,2),(3,1),(4,0),(0,5),(1,4),(2,3),(3,2),(4,1),(5,0)]

def embed_in_dct(img_y, payload_bits, strength=8):
    w, h = img_y.size
    bidx = 0
    for bx, by in block_iter(img_y, 8):
        if bidx >= len(payload_bits):
            break
        block = get_block(img_y, bx, by)
        dct_arr = dct_8x8(block)
        for mi, (u, v) in enumerate(MID):
            if bidx >= len(payload_bits):
                break
            bit = int(payload_bits[bidx])
            if bit == 1:
                dct_arr[u][v] = abs(dct_arr[u][v]) + strength
            else:
                dct_arr[u][v] = -abs(dct_arr[u][v]) - strength
            bidx += 1
        block2 = idct_8x8(dct_arr)
        set_block(img_y, bx, by, block2)
    return img_y

def max_dct_bits(img_shape, bits_per_block=11):
    """Maximum bits that can be embedded via DCT in an image of given size."""
    w, h = img_shape
    bsize = 8
    cols = (w - w % bsize) // bsize
    rows = (h - h % bsize) // bsize
    return cols * rows * bits_per_block

def extract_from_dct(img_y, num_bits):
    w, h = img_y.size
    result = ""
    bidx = 0
    for bx, by in block_iter(img_y, 8):
        if bidx >= num_bits:
            break
        block = get_block(img_y, bx, by)
        dct_arr = dct_8x8(block)
        for mi, (u, v) in enumerate(MID):
            if bidx >= num_bits:
                break
            result += "1" if dct_arr[u][v] > 0 else "0"
            bidx += 1
    return result
