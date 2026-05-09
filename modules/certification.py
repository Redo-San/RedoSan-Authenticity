"""
Digital Certificate & Signing Module — X.509 certificates for fingerprint certification
"""

import os, json, datetime, hashlib, base64
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any

try:
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa, padding
    from cryptography.hazmat.primitives.serialization import load_pem_private_key, load_pem_public_key
    from cryptography.x509.oid import NameOID, ExtensionOID
    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False


RSA_BITS = 4096
VALIDITY_DAYS = 365 * 2


@dataclass
class CertificateInfo:
    subject_name: str = "RedoSan Authenticity Certificate"
    issuer_name: str = "RedoSan Certificate Authority"
    organization: str = "RedoSan"
    country: str = "US"
    email: str = ""
    serial_number: int = 1


@dataclass
class CertificationData:
    file_path: str
    file_type: str
    fingerprint_data: dict
    sha256: str
    timestamp: str
    certificate_path: Optional[str] = None
    
    def to_dict(self):
        return {
            "file_path": self.file_path,
            "file_type": self.file_type,
            "fingerprint_data": self.fingerprint_data,
            "sha256": self.sha256,
            "timestamp": self.timestamp,
            "certificate_path": self.certificate_path
        }


def _now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def generate_key_pair(key_dir="."):
    if not HAS_CRYPTOGRAPHY:
        return None, None, "cryptography module not installed"
    
    os.makedirs(key_dir, exist_ok=True)
    
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=RSA_BITS
    )
    
    public_key = private_key.public_key()
    
    private_path = os.path.join(key_dir, "cert_private.key")
    public_path = os.path.join(key_dir, "cert_public.pem")
    
    with open(private_path, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ))
    
    with open(public_path, "wb") as f:
        f.write(public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ))
    
    return private_path, public_path, None


def generate_self_signed_cert(private_key_path, cert_info=None, days=VALIDITY_DAYS):
    if not HAS_CRYPTOGRAPHY:
        return None, "cryptography module not installed"
    
    if not os.path.isfile(private_key_path):
        return None, "Private key not found"
    
    if cert_info is None:
        cert_info = CertificateInfo()
    
    try:
        with open(private_key_path, "rb") as f:
            private_key = load_pem_private_key(f.read(), None)
    except Exception as e:
        return None, f"Failed to load private key: {e}"
    
    subject = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, cert_info.subject_name),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, cert_info.organization),
        x509.NameAttribute(NameOID.COUNTRY_NAME, cert_info.country),
        x509.NameAttribute(NameOID.EMAIL_ADDRESS, cert_info.email),
    ])
    
    issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, cert_info.issuer_name),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, cert_info.organization),
        x509.NameAttribute(NameOID.COUNTRY_NAME, cert_info.country),
    ])
    
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        private_key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow()
    ).not_valid_after(
        datetime.datetime.utcnow() + datetime.timedelta(days=days)
    ).add_extension(
        x509.BasicConstraints(ca=True, path_length=None),
        critical=True,
    ).add_extension(
        x509.KeyUsage(
            digital_signature=True,
            key_encipherment=True,
            key_agreement=False,
            key_cert_sign=True,
            crl_sign=True,
        ),
        critical=True,
    ).sign(private_key, hashes.SHA256())
    
    cert_path = private_key_path.replace(".key", ".pem")
    with open(cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    
    return cert_path, None


def sign_data(data_to_sign: str, private_key_path: str) -> Optional[str]:
    if not HAS_CRYPTOGRAPHY:
        return None
    
    try:
        with open(private_key_path, "rb") as f:
            private_key = load_pem_private_key(f.read(), None)
        
        signature = private_key.sign(
            data_to_sign.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        
        return base64.b64encode(signature).decode("ascii")
    except Exception as e:
        return None


def verify_signature(data_to_verify: str, signature_b64: str, public_key_path: str) -> bool:
    if not HAS_CRYPTOGRAPHY:
        return False
    
    try:
        with open(public_key_path, "rb") as f:
            public_key = load_pem_public_key(f.read())
        
        signature = base64.b64decode(signature_b64)
        
        public_key.verify(
            signature,
            data_to_verify.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        return True
    except Exception as e:
        return False


def create_certificate_package(
    file_path: str,
    fingerprint_data: dict,
    private_key_path: str,
    public_key_path: str,
    output_dir: str = "."
):
    if not HAS_CRYPTOGRAPHY:
        return None, "cryptography module not installed"
    
    file_type = fingerprint_data.get("file_type", "unknown")
    sha256 = fingerprint_data.get("sha256", "")
    
    if not sha256:
        sha256 = hashlib.sha256(open(file_path, "rb").read()).hexdigest()
    
    cert_data = {
        "file_path": file_path,
        "file_name": os.path.basename(file_path),
        "file_type": file_type,
        "sha256": sha256,
        "fingerprint": fingerprint_data,
        "created_at": _now_iso(),
        "issuer": "RedoSan Certificate Authority"
    }
    
    json_str = json.dumps(cert_data, indent=2, ensure_ascii=False)
    signature = sign_data(json_str, private_key_path)
    
    if not signature:
        return None, "Failed to sign data"
    
    cert_package = {
        "certificate": cert_data,
        "signature": signature,
        "public_key_path": public_key_path
    }
    
    output_file = os.path.join(output_dir, file_path + ".rsa_certificate")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(cert_package, f, indent=2, ensure_ascii=False)
    
    return output_file, None


def verify_certificate_package(cert_package_path: str, public_key_path: str) -> tuple:
    try:
        with open(cert_package_path, "r", encoding="utf-8") as f:
            pkg = json.load(f)
        
        cert_data = pkg.get("certificate", {})
        signature = pkg.get("signature", "")
        
        json_str = json.dumps(cert_data, indent=2, ensure_ascii=False)
        
        is_valid = verify_signature(json_str, signature, public_key_path)
        
        return is_valid, cert_data
    except Exception as e:
        return False, str(e)


def init_certification_system(key_dir="."):
    result = {}
    os.makedirs(key_dir, exist_ok=True)
    
    priv_key, pub_key, err = generate_key_pair(key_dir)
    if err:
        return None, err
    
    result["private_key"] = priv_key
    result["public_key"] = pub_key
    
    cert_path, err = generate_self_signed_cert(priv_key)
    if err:
        return result, err
    
    result["certificate"] = cert_path
    
    return result, None


def read_certificate_info(cert_path):
    if not HAS_CRYPTOGRAPHY:
        return None, "cryptography not installed"
    
    try:
        with open(cert_path, "rb") as f:
            cert = x509.load_pem_x509_certificate(f.read())
        
        info = {
            "subject": cert.subject.rfc4514_string(),
            "issuer": cert.issuer.rfc4514_string(),
            "not_before": cert.not_valid_before_utc.isoformat(),
            "not_after": cert.not_valid_after_utc.isoformat(),
            "serial": cert.serial_number,
            "version": cert.version.name
        }
        
        return info, None
    except Exception as e:
        return None, str(e)