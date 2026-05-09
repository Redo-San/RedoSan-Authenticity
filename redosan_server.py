#!/usr/bin/env python3
"""
RedoSan Web Server - Unified API Server
Run: python redosan_server.py
"""
import http.server
import socketserver
import json
import os
import subprocess
import sys
import hashlib
import mimetypes
from functools import wraps
from urllib.parse import urlparse, parse_qs
import traceback

PORT = 3000
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)

sys.path.insert(0, SCRIPT_DIR)
try:
    from RedoSan_Authenticity import (
        __version__, find_openstego_jar, find_java,
        get_module, has_module
    )
except ImportError:
    __version__ = "1.0.0"
    def find_openstego_jar():
        return None
    def find_java():
        return None
    def get_module(name):
        return None
    def has_module(name):
        return False

def is_port_in_use(port):
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def get_file_params(path, post_data=None):
    if post_data:
        try:
            data = json.loads(post_data)
            return data.get("file", ""), data.get("params", {})
        except:
            return "", {}
    query = parse_qs(urlparse(path).query)
    return query.get("file", [""])[0], {}

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        
        if parsed.path == "/api/health":
            self.send_resp({
                "status": "ok", 
                "message": f"RedoSan Server v{__version__} running",
                "version": __version__,
                "openstego": find_openstego_jar() is not None,
                "java": find_java() is not None
            })
        elif parsed.path == "/api/status":
            self.send_resp({
                "version": __version__,
                "openstego": find_openstego_jar(),
                "java": find_java(),
                "modules": {
                    "timestamp": has_module("ots_stamp"),
                    "watermark": has_module("wtype9"),
                    "metadata": has_module("exiftool"),
                    "audio": has_module("audio_stego"),
                }
            })
        elif parsed.path == "/api/progress":
            self.send_resp({"status": "ok", "message": "[==========----------] 50%"})
        elif parsed.path.startswith("/api/hash"):
            filepath, _ = get_file_params(parsed.path)
            if filepath:
                result = run_rust_hash(filepath)
                self.send_resp(result)
            else:
                self.send_resp({"status": "error", "message": "Missing file parameter"})
        elif parsed.path == "/api/fingerprint":
            print(f"DEBUG: path={parsed.path}, query={parsed.query}")
            query = parse_qs(parsed.query)
            filepath = query.get("file", [""])[0]
            print(f"DEBUG: filepath={filepath}")
            if filepath:
                result = compute_fingerprint(filepath)
                self.send_resp(result)
            else:
                self.send_resp({"status": "error", "message": "Missing file parameter"})
        elif parsed.path.startswith("/"):
            file_path = parsed.path.lstrip("/")
            if file_path:
                return self.serve_file(file_path)
            else:
                return self.serve_file("frontend/index.html")
    
    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b""
        
        try:
            data = json.loads(post_data.decode('utf-8'))
        except:
            self.send_resp({"status": "error", "message": "Invalid JSON"})
            return
        
        filepath = data.get("file", "")
        params = data.get("params", {})
        
        if parsed.path == "/api/timestamp":
            result = run_timestamp(filepath)
            self.send_resp(result)
        elif parsed.path == "/api/verify-ts":
            result = run_verify_timestamp(filepath)
            self.send_resp(result)
        elif parsed.path == "/api/metadata":
            result = run_metadata(filepath)
            self.send_resp(result)
        elif parsed.path == "/api/watermark-check":
            result = run_watermark_check(filepath)
            self.send_resp(result)
        elif parsed.path == "/api/c2pa-read":
            result = run_c2pa_read(filepath)
            self.send_resp(result)
        elif parsed.path == "/api/audio-stego":
            result = run_audio_stego(filepath, params)
            self.send_resp(result)
        else:
            self.send_resp({"status": "error", "message": "Unknown endpoint"})
    
    def send_resp(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def log_message(self, format, *args):
        print(f"{self.address_string()} {format % args}")
        if hasattr(sys, '_MEIPASS'):
            print(f"  MEIPASS: {sys._MEIPASS}")
    
    def serve_file(self, filepath):
        if hasattr(sys, '_MEIPASS'):
            base_path = sys._MEIPASS
        else:
            base_path = SCRIPT_DIR
        
        full_path = os.path.join(base_path, filepath)
        
        checked_paths = [
            full_path,
            os.path.join(base_path, "_internal", filepath),
            os.path.join(base_path, "_internal", "frontend", os.path.basename(filepath)),
        ]
        
        actual_path = None
        for p in checked_paths:
            if os.path.isfile(p):
                actual_path = p
                break
        
        if actual_path:
            if filepath.endswith(".css"):
                content_type = "text/css"
            elif filepath.endswith(".js"):
                content_type = "application/javascript"
            elif filepath.endswith(".html"):
                content_type = "text/html"
            elif filepath.endswith(".json"):
                content_type = "application/json"
            else:
                content_type = "application/octet-stream"
            
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.end_headers()
            with open(actual_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, f"File not found: {filepath}")

def run_rust_hash(filepath):
    rust_exe = os.path.join(SCRIPT_DIR, "rust_gui", "target", "release", "redosan_backend.exe")
    if os.path.isfile(rust_exe):
        try:
            result = subprocess.run([rust_exe, "hash", filepath], capture_output=True, text=True, timeout=30)
            return {"status": "ok", "message": result.stdout.strip()}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    return {"status": "error", "message": "Rust binary not found"}

def compute_fingerprint(filepath):
    if not os.path.isfile(filepath):
        return {"status": "error", "message": "File not found"}
    try:
        with open(filepath, "rb") as f:
            data = f.read()
        sha256 = hashlib.sha256(data).hexdigest()
        md5 = hashlib.md5(data).hexdigest()
        size = len(data)
        return {
            "status": "ok",
            "fingerprint": {
                "sha256": sha256,
                "md5": md5,
                "size": size,
                "file": os.path.basename(filepath)
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

def run_timestamp(filepath):
    if not os.path.isfile(filepath):
        return {"status": "error", "message": "File not found"}
    try:
        ots_mod = get_module("ots_stamp")
        if ots_mod:
            result = ots_mod.timestamp_file(filepath)
            return {"status": "ok", "message": "Timestamp created", "result": str(result)}
        return {"status": "error", "message": "ots_stamp module not available"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def run_verify_timestamp(filepath):
    ots_file = filepath + ".ots"
    if not os.path.isfile(ots_file):
        return {"status": "error", "message": "No .ots file found"}
    try:
        ots_mod = get_module("ots_stamp")
        if ots_mod:
            result = ots_mod.verify_file(ots_file)
            return {"status": "ok", "message": "Verified", "result": str(result)}
        return {"status": "error", "message": "ots_stamp module not available"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def run_metadata(filepath):
    if not os.path.isfile(filepath):
        return {"status": "error", "message": "File not found"}
    try:
        meta_mod = get_module("exiftool")
        if meta_mod:
            result = meta_mod.read_metadata(filepath)
            return {"status": "ok", "metadata": result}
        return {"status": "error", "message": "exiftool module not available"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def run_watermark_check(filepath):
    if not os.path.isfile(filepath):
        return {"status": "error", "message": "File not found"}
    try:
        wm_mod = get_module("wtype9")
        if wm_mod:
            result = wm_mod.check_watermark(filepath)
            return {"status": "ok", "result": result}
        return {"status": "error", "message": "wtype9 module not available"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def run_c2pa_read(filepath):
    if not os.path.isfile(filepath):
        return {"status": "error", "message": "File not found"}
    try:
        c2pa_mod = get_module("c2pa_read")
        if c2pa_mod:
            result = c2pa_mod.read_c2pa(filepath)
            return {"status": "ok", "c2pa": result}
        return {"status": "error", "message": "c2pa module not available"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def run_audio_stego(filepath, params):
    if not os.path.isfile(filepath):
        return {"status": "error", "message": "File not found"}
    try:
        audio_mod = get_module("audio_stego")
        if audio_mod:
            action = params.get("action", "extract")
            if action == "hide":
                secret = params.get("secret", "")
                result = audio_mod.hide_in_audio(filepath, secret)
            else:
                result = audio_mod.extract_from_audio(filepath)
            return {"status": "ok", "result": result}
        return {"status": "error", "message": "audio_stego module not available"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    if is_port_in_use(PORT):
        print(f"Port {PORT} already in use - connecting to existing server...")
        print(f"Open: http://localhost:{PORT}")
    else:
        print(f"RedoSan Web Server v0.1.0")
        print(f"Open: http://localhost:{PORT}")
        print(f"Press Ctrl+C to stop")
        
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nShutting down...")