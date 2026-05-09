#!/usr/bin/env python3
"""
RedoSan Authenticity - Graphical Interface (CustomTkinter)
Run:  python RedoSan_Authenticity_gui.py
"""
import sys, os
import customtkinter as ctk
from tkinter import filedialog, messagebox

if getattr(sys, 'frozen', False):
    SCRIPT_DIR = sys._MEIPASS
else:
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from RedoSan_Authenticity import MODULES, has_module, find_openstego_jar, find_java, __version__

from gui_parts.mixins import OutputCapture, SharedGUIMixin
from gui_parts.tab_openstego import OpenStegoTabMixin
from gui_parts.tab_watermark import WatermarkTabMixin
from gui_parts.tab_metadata import MetadataTabMixin
from gui_parts.tab_c2pa import C2paTabMixin
from gui_parts.tab_timestamp import TimestampTabMixin
from gui_parts.tab_setup import SetupTabMixin
from gui_parts.tab_fingerprint import FingerprintTabMixin

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")


class RedoSanGUI(ctk.CTk, SharedGUIMixin, OpenStegoTabMixin, WatermarkTabMixin,
                 MetadataTabMixin, C2paTabMixin,
                 TimestampTabMixin, SetupTabMixin,
                 FingerprintTabMixin):
    def __init__(self):
        super().__init__()
        self.title(f"RedoSan Authenticity v{__version__}")
        self.geometry("960x720")
        self.minsize(800, 600)

        self.jar = find_openstego_jar()
        self.java = find_java()
        self.output_capture = None
        self._output_menu = None

        self._build_ui()
        self._log_startup()

    def _build_ui(self):
        top = ctk.CTkFrame(self, height=40, corner_radius=0)
        top.pack(fill="x")
        ctk.CTkLabel(top, text=f"RedoSan Authenticity v{__version__}",
                     font=ctk.CTkFont(size=16, weight="bold")).pack(side="left", padx=15)
        self.mode_switch = ctk.CTkSwitch(top, text="Dark Mode", command=self._toggle_mode,
                                          onvalue="dark", offvalue="light")
        self.mode_switch.select()
        self.mode_switch.pack(side="right", padx=15)

        self.tabs = ctk.CTkTabview(self)
        self.tabs.pack(fill="both", expand=True, padx=10, pady=(10, 0))

        self._build_openstego_tab()
        self._build_watermark_tab()
        self._build_metadata_tab()
        self._build_c2pa_tab()
        self._build_timestamp_tab()
        self._build_fingerprint_tab()
        self._build_setup_tab()

        out_frame = ctk.CTkFrame(self)
        out_frame.pack(fill="both", padx=10, pady=(10, 5))

        out_header = ctk.CTkFrame(out_frame, height=28, fg_color="transparent")
        out_header.pack(fill="x")
        ctk.CTkLabel(out_header, text="Output", font=ctk.CTkFont(size=13, weight="bold")).pack(side="left")
        btn_frame = ctk.CTkFrame(out_header, fg_color="transparent")
        btn_frame.pack(side="right")
        ctk.CTkButton(btn_frame, text="Save TXT", width=70, height=22,
                       command=self._save_output_txt).pack(side="left", padx=2)
        ctk.CTkButton(btn_frame, text="Save JSON", width=70, height=22,
                       command=self._save_output_json).pack(side="left", padx=2)
        ctk.CTkButton(btn_frame, text="Clear", width=60, height=22,
                       command=self._clear_output).pack(side="left", padx=2)

        self.output_box = ctk.CTkTextbox(out_frame, height=160, wrap="word")
        self.output_box.pack(fill="both", expand=True, pady=(2, 5))

        self.output_box.bind("<Control-c>", self._copy_output)
        self.output_box.bind("<Button-3>", self._show_context_menu)

        self.output_capture = OutputCapture(self.output_box)
        self._orig_stdout = sys.stdout
        sys.stdout = self.output_capture

    def close(self):
        sys.stdout = self._orig_stdout
        self.destroy()


if __name__ == "__main__":
    app = RedoSanGUI()
    app.protocol("WM_DELETE_WINDOW", app.close)
    app.mainloop()
