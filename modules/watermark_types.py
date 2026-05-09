import importlib, sys

WATERMARK_TYPES = [
    {"id":1,"name":"Spatial LSB","short":"Spatial LSB","implemented":True},
    {"id":2,"name":"Frequency DCT","short":"Frequency DCT","implemented":True},
    {"id":3,"name":"Neural SS (Spread Spectrum)","short":"Neural SS","implemented":True},
    {"id":4,"name":"Latent DCT (Redundant)","short":"Latent DCT","implemented":True},
    {"id":5,"name":"Zero-bit / Presence","short":"Zero-bit","implemented":True},
    {"id":6,"name":"Multi-bit","short":"Multi-bit","implemented":True},
    {"id":7,"name":"Forensic (Robust DCT)","short":"Forensic","implemented":True},
    {"id":8,"name":"Fragile / Tamper-Proof","short":"Fragile","implemented":True},
    {"id":9,"name":"Imatag-style (Robust Invisible)","short":"Imatag-style","implemented":True},
]

_WTYPE_MODULES = {}
_WTYPE_NAMES = {1:"wtype1",2:"wtype2",3:"wtype3",4:"wtype4",5:"wtype5",
                6:"wtype6",7:"wtype7",8:"wtype8",9:"wtype9"}

# Eager-load all wtype modules so any missing dependency (like PIL) is caught at import time
_WTYPE_LOAD_ERRORS = {}
for _wt_id, _wt_name in _WTYPE_NAMES.items():
    try:
        _m = importlib.import_module(f"modules.{_wt_name}")
        _WTYPE_MODULES[_wt_id] = _m
    except Exception as _e:
        _WTYPE_LOAD_ERRORS[_wt_id] = f"{type(_e).__name__}: {_e}"

def _load(wtype):
    if wtype in _WTYPE_MODULES:
        return _WTYPE_MODULES[wtype]
    if wtype in _WTYPE_LOAD_ERRORS:
        print(f"[watermark_types] _load({wtype}) failed: {_WTYPE_LOAD_ERRORS[wtype]}")
    return None

def embed(wtype, img_path, secret_path, output_path, password=None):
    mod = _load(wtype)
    if not mod:
        return False, f"Unknown type: {wtype}"
    try:
        return mod.embed(img_path, secret_path, output_path, password)
    except ImportError as e:
        return False, f"Missing dependency: {e}. Install with: pip install Pillow"

def extract(wtype, stego_path, outdir, password=None):
    mod = _load(wtype)
    if not mod:
        return False, f"Unknown type: {wtype}"
    try:
        return mod.extract(stego_path, outdir, password)
    except ImportError as e:
        return False, f"Missing dependency: {e}. Install with: pip install Pillow"

def list_watermarks():
    lines = ["Watermark Types:", "=" * 55]
    for wt in WATERMARK_TYPES:
        icon = "[V]" if wt["implemented"] else "[X]"
        lines.append(f"  {icon} {wt['id']}. {wt['name']}")
    return "\n".join(lines)

def describe_watermark(wtype):
    names = {1:"Spatial LSB",2:"Frequency DCT",3:"Neural SS",
             4:"Latent DCT",5:"Zero-bit",6:"Multi-bit",
             7:"Forensic",8:"Fragile",9:"Imatag-style"}
    supported = wtype in _WTYPE_MODULES
    status = "supported" if supported else "not supported"
    extra = ""
    if wtype in _WTYPE_LOAD_ERRORS:
        extra = f" [error: {_WTYPE_LOAD_ERRORS[wtype]}]"
    return f"Type {wtype}: {names.get(wtype, 'Unknown')} ({status}){extra}"
