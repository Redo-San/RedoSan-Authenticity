"""
Creative Process Log Module - Track and document creative workflow
Creates a verifiable chain of edits for any work from creation to final publish
"""
import os, json, datetime, hashlib
from pathlib import Path
from typing import Optional, List, Dict, Any

try:
    from modules import certification as _cert_mod
    HAS_CERT = True
except ImportError:
    HAS_CERT = False


def _get_file_hash(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class CreativeLog:
    def __init__(self, initial_file: str, description: str = ""):
        self.initial_file = initial_file
        self.initial_hash = _get_file_hash(initial_file)
        self.initial_size = os.path.getsize(initial_file)
        self.initial_created = datetime.datetime.fromtimestamp(
            os.path.getctime(initial_file)
        ).isoformat()
        
        self.steps: List[Dict] = []
        self.log_path = initial_file + ".creative_log.json"
        
        self.data = {
            "version": "1.0",
            "initial_info": {
                "file_path": initial_file,
                "file_name": os.path.basename(initial_file),
                "file_size": self.initial_size,
                "sha256": self.initial_hash,
                "created_at": self.initial_created,
                "description": description
            },
            "editing_steps": [],
            "final_file_info": None,
            "signature_chain": {
                "intermediate_signatures": [],
                "final_signature": None
            },
            "created_at": _now_iso(),
            "updated_at": _now_iso()
        }
    
    def add_step(self, action: str, tool: str, description: str = "", file_path: str = None):
        if file_path is None:
            file_path = self.data.get("initial_info", {}).get("file_path", "")
        
        if not file_path:
            return None
        
        step_hash = _get_file_hash(file_path)
        
        step_data = {
            "step_number": len(self.steps) + 1,
            "action": action,
            "tool": tool,
            "description": description,
            "file_path": file_path,
            "file_name": os.path.basename(file_path),
            "sha256": step_hash,
            "timestamp": _now_iso()
        }
        
        self.steps.append(step_data)
        self.data["editing_steps"].append(step_data)
        self.data["updated_at"] = _now_iso()
        
        return step_data
    
    def set_final(self, final_file: str):
        self.data["final_file_info"] = {
            "file_path": final_file,
            "file_name": os.path.basename(final_file),
            "file_size": os.path.getsize(final_file),
            "sha256": _get_file_hash(final_file),
            "completed_at": _now_iso()
        }
        self.data["updated_at"] = _now_iso()
    
    def sign_log(self, private_key_path: str):
        if not HAS_CERT:
            return False, "Certification module not available"
        
        if not os.path.isfile(private_key_path):
            return False, "Private key not found"
        
        json_str = json.dumps(self.data, indent=2)
        signature = _cert_mod.sign_data(json_str, private_key_path)
        
        if signature:
            self.data["signature_chain"]["intermediate_signatures"] = [
                s["signature"] for s in self.steps if "signature" in s
            ]
            self.data["signature_chain"]["final_signature"] = signature
            self.data["updated_at"] = _now_iso()
            return True, signature
        
        return False, "Signing failed"
    
    def save(self, path: str = None):
        if path is None:
            path = self.log_path
        
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, indent=2, ensure_ascii=False)
        
        return path
    
    @staticmethod
    def load(path: str):
        if not os.path.isfile(path):
            return None, "Log file not found"
        
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            log = object.__new__(CreativeLog)
            log.data = data
            log.steps = data.get("editing_steps", [])
            log.log_path = path
            return log, None
        except Exception as e:
            return None, str(e)
    
    def verify(self, public_key_path: str = None):
        if not HAS_CERT:
            return False, "Certification module not available"
        
        final_sig = self.data.get("signature_chain", {}).get("final_signature")
        if not final_sig:
            return False, "No signature to verify"
        
        if not public_key_path or not os.path.isfile(public_key_path):
            return False, "Public key not found"
        
        json_str = json.dumps(self.data, indent=2)
        return _cert_mod.verify_signature(json_str, final_sig, public_key_path)
    
    def to_text(self):
        lines = [
            "=" * 55,
            "CREATIVE PROCESS LOG",
            "=" * 55,
            "",
            f"Initial File: {self.data['initial_info']['file_name']}",
            f"SHA256: {self.data['initial_info']['sha256'][:32]}...",
            f"Created: {self.data['created_at']}",
            "",
            "EDITING STEPS:",
            "-" * 40
        ]
        
        for step in self.steps:
            lines.append(f"  Step {step['step_number']}: {step['action']}")
            lines.append(f"    Tool: {step['tool']}")
            lines.append(f"    File: {step['file_name']}")
            lines.append(f"    SHA256: {step['sha256'][:32]}...")
            lines.append(f"    Time: {step['timestamp']}")
            if step.get("description"):
                lines.append(f"    Note: {step['description']}")
            lines.append("")
        
        if self.data.get("final_file_info"):
            info = self.data["final_file_info"]
            lines.append("-" * 40)
            lines.append(f"FINAL FILE: {info['file_name']}")
            lines.append(f"SHA256: {info['sha256'][:32]}...")
            lines.append(f"Completed: {info['completed_at']}")
        
        sig = self.data.get("signature_chain", {}).get("final_signature")
        if sig:
            lines.append("")
            lines.append("SIGNATURE: " + sig[:40] + "...")
        
        return "\n".join(lines)


def create_log(initial_file: str, description: str = "") -> tuple:
    if not os.path.isfile(initial_file):
        return None, "File not found"
    
    log = CreativeLog(initial_file, description)
    path = log.save()
    
    return path, None


def add_step_to_log(log_path: str, action: str, tool: str, description: str = "", file_path: str = None) -> tuple:
    log, err = CreativeLog.load(log_path)
    if err:
        return None, err
    
    log.add_step(action, tool, description, file_path)
    path = log.save()
    
    return path, None


def set_final_file(log_path: str, final_file: str) -> tuple:
    log, err = CreativeLog.load(log_path)
    if err:
        return None, err
    
    log.set_final(final_file)
    path = log.save()
    
    return path, None


def sign_log(log_path: str, private_key_path: str) -> tuple:
    log, err = CreativeLog.load(log_path)
    if err:
        return None, err
    
    ok, msg = log.sign_log(private_key_path)
    if ok:
        path = log.save()
        return path, None
    else:
        return None, msg


def verify_log(log_path: str, public_key_path: str = ".keys/cert_public.pem") -> tuple:
    log, err = CreativeLog.load(log_path)
    if err:
        return err, False
    
    ok = log.verify(public_key_path)
    return ok, None if ok else "Invalid signature"


def export_log(log_path: str, format: str = "json") -> tuple:
    log, err = CreativeLog.load(log_path)
    if err:
        return None, err
    
    if format == "text":
        return log.to_text(), None
    elif format == "json":
        return json.dumps(log.data, indent=2), None
    else:
        return None, "Unknown format"