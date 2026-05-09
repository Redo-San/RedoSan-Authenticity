import customtkinter as ctk
import os
import tkinter as tk
from tkinter import filedialog

from RedoSan_Authenticity import MODULES, has_module, run_ots

try:
    import redosan_backend as rb
    RUST_AVAILABLE = rb.is_available()
except ImportError:
    rb = None
    RUST_AVAILABLE = False


class FingerprintTabMixin:
    def _build_fingerprint_tab(self):
        tab = self.tabs.add("Fingerprint")
        ctrl = ctk.CTkScrollableFrame(tab)
        ctrl.pack(fill="both", expand=True, padx=5, pady=5)

        ctk.CTkLabel(ctrl, text="Operation:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.fp_mode = ctk.CTkComboBox(ctrl, values=["Generate", "Certify", "Verify"], width=150, state="readonly")
        self.fp_mode.grid(row=0, column=1, columnspan=2, padx=5, pady=5, sticky="w")
        self.fp_mode.set("Generate")
        self.fp_mode.bind("<<ComboboxSelected>>", self._fp_mode_change)

        # File row
        ctk.CTkLabel(ctrl, text="File:").grid(row=1, column=0, padx=5, pady=5, sticky="w")
        self.fp_file_entry = ctk.CTkEntry(ctrl, placeholder_text="Select a file...")
        self.fp_file_entry.grid(row=1, column=1, padx=5, pady=5, sticky="ew")
        self._add_entry_menu(self.fp_file_entry)
        
        ctk.CTkButton(ctrl, text="Browse", width=70, height=28,
                     command=self._browse_file).grid(row=1, column=2, padx=5, pady=5)

        # Keys directory row (initially hidden for Generate)
        self.fp_key_frame = ctk.CTkFrame(ctrl, fg_color="transparent")
        self.fp_key_frame.grid(row=2, column=0, columnspan=3, padx=5, pady=5, sticky="ew")
        self.fp_key_frame.grid_forget()
        
        ctk.CTkLabel(self.fp_key_frame, text="Keys Dir:").pack(side="left")
        self.fp_key_entry = ctk.CTkEntry(self.fp_key_frame, placeholder_text=".keys")
        self.fp_key_entry.pack(side="left", fill="x", expand=True, padx=5)
        self._add_entry_menu(self.fp_key_entry)
        
        ctk.CTkButton(self.fp_key_frame, text="Browse", width=70, height=28,
                     command=self._browse_key_dir).pack(side="left", padx=5)

        ctk.CTkButton(ctrl, text="Run", height=35, command=self._fp_run_click).grid(
            row=3, column=1, pady=10)

    def _add_entry_menu(self, entry):
        """Add right-click menu with Copy/Paste to entry widget"""
        menu = tk.Menu(entry, tearoff=False)
        
        def do_copy():
            try:
                sel = entry.selection_get()
                entry.clipboard_clear()
                entry.clipboard_append(sel)
            except tk.TclError:
                pass
        
        def do_paste():
            try:
                text = entry.clipboard_get()
                entry.delete(0, "end")
                entry.insert(0, text)
            except tk.TclError:
                pass
        
        def do_select_all():
            entry.select_range(0, "end")
        
        menu.add_command(label="Copy", command=do_copy)
        menu.add_command(label="Paste", command=do_paste)
        menu.add_separator()
        menu.add_command(label="Select All", command=do_select_all)
        
        def show_menu(event):
            menu.tk_popup(event.x_root, event.y_root)
        
        entry.bind("<Button-3>", show_menu)

    def _browse_file(self):
        path = filedialog.askopenfilename(title="Select File")
        if path:
            self.fp_file_entry.delete(0, "end")
            self.fp_file_entry.insert(0, path)

    def _browse_key_dir(self):
        path = filedialog.askdirectory(title="Select Keys Directory")
        if path:
            self.fp_key_entry.delete(0, "end")
            self.fp_key_entry.insert(0, path)

    def _fp_mode_change(self, _=None):
        mode = self.fp_mode.get()
        
        if mode == "Generate":
            self.fp_key_frame.grid_forget()
            self.fp_file_entry.configure(placeholder_text="Image/Video/Audio/Document file...")
        elif mode == "Certify":
            self.fp_key_frame.grid(row=2, column=0, columnspan=3, padx=5, pady=5, sticky="ew")
            self.fp_file_entry.configure(placeholder_text="File to certify...")
        elif mode == "Verify":
            self.fp_key_frame.grid(row=2, column=0, columnspan=3, padx=5, pady=5, sticky="ew")
            self.fp_file_entry.configure(placeholder_text=".rsa_certificate file...")

    def _fp_run_click(self):
        self.output_capture.clear()
        import threading
        threading.Thread(target=self._fp_run, daemon=True).start()
    
    def _fp_run(self):
        mode = self.fp_mode.get()
        filepath = self.fp_file_entry.get()
        key_dir = self.fp_key_entry.get() or ".keys"

        if mode == "Generate":
            self._fp_generate(filepath)
        elif mode == "Certify":
            self._fp_certify(filepath, key_dir)
        elif mode == "Verify":
            self._fp_verify(filepath, key_dir)

    def _fp_generate(self, filepath):
        if not filepath or not os.path.isfile(filepath):
            print("ERROR: File not found"); return

        print(f"Generating fingerprint for {os.path.basename(filepath)}...")

        # Show progress if Rust available
        if RUST_AVAILABLE:
            print(rb.progress_bar(10, 100))

        if not has_module("fingerprint"):
            print("ERROR: Fingerprint module not installed")
            print("  Run: python RedoSan_Authenticity.py certify-init")
            return

        fp_mod = MODULES["fingerprint"]

        # Use new forensic format
        package, err = fp_mod.create_forensic_fingerprint(filepath)
        if err:
            print(f"ERROR: {err}")
            return

        # Update progress
        if RUST_AVAILABLE:
            print("\r" + rb.progress_bar(80, 100), end="")
            print()

        fp = package.get("fingerprints", {})
        fi = package.get("file_info", {})
        
        base_name = os.path.splitext(filepath)[0]
        out_path = base_name + ".forensic.json"

        import json
        with open(out_path, "w", encoding="utf-8") as fp_file:
            json.dump(package, fp_file, indent=2, ensure_ascii=False)

        print(f"SUCCESS: Forensic fingerprint saved")
        print(f"  File: {os.path.basename(out_path)}")
        print(f"  SHA256: {fp.get('sha256', '')[:32]}...")
        print(f"  Type: {package.get('file_type')}")
        print(f"  Size: {fi.get('file_size_mb')} MB")
        
        dims = fi.get("dimensions", {})
        if dims:
            print(f"  Dimensions: {dims.get('width')}x{dims.get('height')} ({dims.get('color_mode')})")
        
        # Show all hashes
        print(f"  AHash: {fp.get('ahash')}")
        print(f"  DHash: {fp.get('dhash')}")
        print(f"  PHash: {fp.get('phash')}")
        print(f"  WHash: {fp.get('whash')}")

    def _fp_certify(self, filepath, key_dir):
        if not filepath or not os.path.isfile(filepath):
            print("ERROR: File not found"); return

        if not has_module("certification"):
            print("ERROR: Certification module not installed")
            print("  Run: python RedoSan_Authenticity.py certify-init")
            return

        if not has_module("fingerprint"):
            print("ERROR: Fingerprint module not installed")
            return

        priv_key = os.path.join(key_dir, "cert_private.key")
        pub_key = os.path.join(key_dir, "cert_public.pem")

        if not os.path.isfile(priv_key):
            print(f"ERROR: Private key not found in {key_dir}")
            print("  Run: python RedoSan_Authenticity.py certify-init")
            return

        print(f"Certifying {os.path.basename(filepath)}...")

        fp_mod = MODULES["fingerprint"]
        fp, err = fp_mod.fingerprint_file(filepath)
        if err:
            print(f"ERROR: {err}"); return

        print(f"  Fingerprint: {fp.get('sha256', '')[:32]}...")

        cert_mod = MODULES["certification"]
        cert_path, err = cert_mod.create_certificate_package(
            filepath, fp, priv_key, pub_key, os.path.dirname(filepath) or "."
        )
        if err:
            print(f"ERROR: {err}"); return

        r = run_ots(["stamp", cert_path])
        ots_suffix = ""
        if r.returncode == 0:
            ots_suffix = " + OTS timestamped"

        print(f"SUCCESS: Certificate created{ots_suffix}")
        print(f"  Certificate: {os.path.basename(cert_path)}")

    def _fp_verify(self, filepath, key_dir):
        if not filepath or not os.path.isfile(filepath):
            print("ERROR: File not found"); return

        if not filepath.endswith(".rsa_certificate"):
            print("ERROR: Select a .rsa_certificate file"); return

        if not has_module("certification"):
            print("ERROR: Certification module not installed")
            return

        pub_key = os.path.join(key_dir, "cert_public.pem")
        if not os.path.isfile(pub_key):
            print(f"ERROR: Public key not found in {key_dir}")
            return

        print(f"Verifying certificate...")

        cert_mod = MODULES["certification"]
        is_valid, cert_data = cert_mod.verify_certificate_package(filepath, pub_key)

        if is_valid:
            print("SIGNATURE: VALID")
            print(f"  File: {cert_data.get('file_name', 'N/A')}")
            print(f"  SHA256: {cert_data.get('sha256', '')[:32]}...")
            print(f"  Created: {cert_data.get('created_at', 'N/A')}")
            print(f"  Issuer: {cert_data.get('issuer', 'N/A')}")
        else:
            print("SIGNATURE: INVALID")