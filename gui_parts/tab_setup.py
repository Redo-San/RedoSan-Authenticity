import sys, os, subprocess
import customtkinter as ctk

try:
    import redosan_backend as rb
    RUST_AVAILABLE = rb.is_available()
except ImportError:
    rb = None
    RUST_AVAILABLE = False

from RedoSan_Authenticity import has_module, find_ffmpeg, SCRIPT_DIR as _SD


class SetupTabMixin:
    def _build_setup_tab(self):
        tab = self.tabs.add("Setup")
        ctrl = ctk.CTkFrame(tab)
        ctrl.pack(fill="both", expand=True, padx=5, pady=5)

        ctk.CTkLabel(ctrl, text="Dependency Check", font=ctk.CTkFont(size=15, weight="bold")).pack(pady=10)

        info = ctk.CTkTextbox(ctrl, height=200, wrap="word")
        info.pack(fill="x", padx=20, pady=10)

        info.insert("end", f"Python: {sys.version.split()[0]}\n")
        info.insert("end", f"OpenStego: {'Found' if self.jar else 'Not found (optional)'}\n")
        info.insert("end", f"Java: {'Found' if self.java else 'Not found'}\n")
        info.insert("end", f"ffmpeg: {'Found' if find_ffmpeg() else 'Not found (optional)'}\n")
        info.insert("end", f"Rust Backend: {'OK' if RUST_AVAILABLE else 'Not found'}\n")
        info.insert("end", f"Audio module: {'OK' if has_module('audio') else 'Missing'}\n")
        info.insert("end", f"Video module: {'OK' if has_module('video') else 'Missing'}\n")
        info.insert("end", f"Metadata/C2PA: {'OK' if has_module('metadata') else 'Missing'}\n")
        info.insert("end", f"Watermark types: {'OK' if has_module('watermark') else 'Missing'}\n")
        info.insert("end", f"Fingerprint: {'OK' if has_module('fingerprint') else 'Missing'}\n")
        info.insert("end", f"Certification: {'OK' if has_module('certification') else 'Missing'}\n")
        info.insert("end", f"\nInstall dir: {_SD}\n")

        info.configure(state="disabled")

        btn_frame = ctk.CTkFrame(ctrl, fg_color="transparent")
        btn_frame.pack(pady=10)
        ctk.CTkButton(btn_frame, text="Run Setup (install.py)", height=35,
                      command=self._run_setup_gui).pack(side="left", padx=5)
        ctk.CTkButton(btn_frame, text="Run Diagnostics", height=35,
                      command=lambda: self._run_in_thread(self._run_diags)).pack(side="left", padx=5)

    def _run_setup_gui(self):
        self.output_capture.clear()
        print("Running install.py...")
        py = sys.executable if not getattr(sys, 'frozen', False) else 'python'
        p = subprocess.run([py, os.path.join(_SD, "install.py")],
                           capture_output=True, text=True)
        print(p.stdout[-1500:] if len(p.stdout) > 1500 else p.stdout)
        if p.stderr:
            print(f"STDERR: {p.stderr.strip()}")
        print("Done. You may need to restart the app.")

    def _run_diags(self):
        print("Running diagnostics...")
        py = sys.executable if not getattr(sys, 'frozen', False) else 'python'
        for cmd, label in [
            ([py, "--version"], "Python"),
            (["java", "-version"], "Java"),
            ([py, "-m", "pip", "list", "--format=columns"], "Pip packages"),
        ]:
            try:
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                out = (r.stdout or r.stderr).strip()[:300]
                print(f"  {label}: {out}")
            except Exception as e:
                print(f"  {label}: ERROR - {e}")
        print("Diagnostics complete.")
