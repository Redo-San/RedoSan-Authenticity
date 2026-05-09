import os
import customtkinter as ctk

from RedoSan_Authenticity import MODULES, has_module, module_error


class WatermarkTabMixin:
    WT_FIELDS = {
        1: {"needs_msg": True, "needs_pw": True},
        2: {"needs_msg": True, "needs_pw": True},
        3: {"needs_msg": True, "needs_pw": True},
        4: {"needs_msg": True, "needs_pw": True},
        5: {"needs_msg": False, "needs_pw": False},
        6: {"needs_msg": True, "needs_pw": True},
        7: {"needs_msg": True, "needs_pw": True},
        8: {"needs_msg": False, "needs_pw": False},
        9: {"needs_msg": True, "needs_pw": True},
    }

    def _build_watermark_tab(self):
        tab = self.tabs.add("Watermark Types")
        ctrl = ctk.CTkScrollableFrame(tab)
        ctrl.pack(fill="both", expand=True, padx=5, pady=5)
        ctrl.grid_columnconfigure(0, weight=0)
        ctrl.grid_columnconfigure(1, weight=1)
        ctrl.grid_columnconfigure(2, weight=0)

        if not has_module("watermark"):
            err = module_error("watermark")
            msg = "Watermark module not available"
            if err:
                msg += f"\n\nError:\n{err}"
            ctk.CTkLabel(ctrl, text=msg, text_color="red").pack(pady=20)
            return

        wt_mod = MODULES["watermark"]
        type_choices = [f"{t['id']}. {t['name']}" for t in wt_mod.WATERMARK_TYPES]

        ctk.CTkLabel(ctrl, text="Operation:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.wt_mode = ctk.CTkComboBox(ctrl, values=["Read", "Write"],
                                        width=200, state="readonly",
                                        command=self._wt_mode_change)
        self.wt_mode.grid(row=0, column=1, padx=5, pady=5, sticky="w")
        self.wt_mode.set("Write")

        ctk.CTkLabel(ctrl, text="Type:").grid(row=1, column=0, padx=5, pady=5, sticky="w")
        self.wt_type_combo = ctk.CTkComboBox(ctrl, values=type_choices, width=400, state="readonly",
                                              command=self._wt_on_type_change)
        self.wt_type_combo.grid(row=1, column=1, padx=5, pady=5, sticky="w")
        self.wt_type_combo.set(type_choices[0])

        self.wt_desc_label = ctk.CTkLabel(ctrl, text="", font=ctk.CTkFont(size=11), anchor="w", justify="left")
        self.wt_desc_label.grid(row=2, column=1, padx=5, pady=(0,5), sticky="w")

        self.wt_msg_hint = ctk.CTkLabel(ctrl, text="", font=ctk.CTkFont(size=10), anchor="w",
                                         text_color="gray")
        self.wt_msg_hint.grid(row=2, column=2, padx=5, pady=(0,5), sticky="w")

        self.wt_fields = {}
        self.wt_labels = {}
        r = 3
        e, b, l = self._build_file_row(ctrl, "Host Image:", r)
        self.wt_fields["cover"] = (e, b); self.wt_labels["cover"] = l
        e, b, l = self._build_file_row(ctrl, "Message File:", r + 1)
        self.wt_fields["secret"] = (e, b); self.wt_labels["secret"] = l
        e, b, l = self._build_file_row(ctrl, "Output:", r + 2, save=True)
        self.wt_fields["output"] = (e, b); self.wt_labels["output"] = l
        e, b, l = self._build_file_row(ctrl, "Watermarked Image:", r + 3)
        self.wt_fields["stego"] = (e, b); self.wt_labels["stego"] = l
        e, l = self._build_row_entry(ctrl, "Password:", r + 4)
        self.wt_fields["password"] = (e, None); self.wt_labels["password"] = l

        self._wt_refresh_layout()

        ctk.CTkButton(ctrl, text="Run", height=35, command=lambda: self._run_in_thread(self._wt_run)).grid(
            row=r + 5, column=1, pady=10, sticky="w")

    WT_MSG_HINTS = {
        1: "Any file (.txt, .bin, etc.)",
        2: "Any file (.txt, .bin, etc.)",
        3: "Any file (.txt, .bin, etc.)",
        4: "Any file (.txt, .bin, etc.)",
        5: "No message file needed (zero-bit signature)",
        6: "Any file (.txt, .bin, etc.)",
        7: "Any file (.txt, .bin, etc.)",
        8: "No message file needed (pixel hash)",
        9: "Any file (.txt, .bin, etc.)",
    }

    def _wt_on_type_change(self, choice=None):
        if not has_module("watermark"):
            return
        txt = self.wt_type_combo.get()
        try:
            tid = int(txt.split(".")[0])
            desc = MODULES["watermark"].describe_watermark(tid)
            self.wt_desc_label.configure(text=desc)
            hint = self.WT_MSG_HINTS.get(tid, "")
            self.wt_msg_hint.configure(text=hint)
        except (ValueError, IndexError):
            self.wt_desc_label.configure(text="")
            self.wt_msg_hint.configure(text="")
        self._wt_refresh_layout()

    def _get_wt_type(self):
        txt = self.wt_type_combo.get()
        try:
            return int(txt.split(".")[0])
        except (ValueError, IndexError):
            return 1

    def _wt_mode_change(self, choice=None):
        self._wt_refresh_layout()

    def _wt_refresh_layout(self):
        mode = self.wt_mode.get()
        is_read = mode == "Read"
        wtype = self._get_wt_type()
        cfg = self.WT_FIELDS.get(wtype, {"needs_msg": True, "needs_pw": True})

        show = {}
        show["cover"] = not is_read
        show["secret"] = (not is_read) and cfg["needs_msg"]
        show["output"] = not is_read
        show["stego"] = is_read
        show["password"] = (not is_read) and cfg["needs_pw"]

        for key in self.wt_fields:
            entry = self.wt_fields[key][0]
            btn = self.wt_fields[key][1] if len(self.wt_fields[key]) > 1 else None
            label = self.wt_labels.get(key)
            visible = show.get(key, True)
            method = "grid" if visible else "grid_remove"
            if label and hasattr(label, "grid_info"):
                getattr(label, method)()
            if hasattr(entry, "grid_info"):
                getattr(entry, method)()
            if btn and hasattr(btn, "grid_info"):
                getattr(btn, method)()

    def _wt_run(self):
        if not has_module("watermark"):
            print("ERROR: Watermark module not available"); return
        wt = MODULES["watermark"]
        mode = self.wt_mode.get()
        f = self.wt_fields
        wtype = self._get_wt_type()
        is_read = mode == "Read"

        if is_read:
            stego = f["stego"][0].get()
            if not os.path.exists(stego):
                print(f"ERROR: File not found: {stego}"); return
            print(f"Reading type {wtype}...")
            ok, msg = wt.extract(wtype, stego, os.path.dirname(stego), None)
            print(f"\n  {'SUCCESS' if ok else 'ERROR'}: {msg}")
            return

        cover = f["cover"][0].get()
        output = f["output"][0].get()
        if not output:
            output = os.path.splitext(cover)[0] + "_wm" + os.path.splitext(cover)[1]
        if not os.path.exists(cover):
            print(f"ERROR: Host image not found: {cover}"); return

        cfg = self.WT_FIELDS.get(wtype, {"needs_msg": True, "needs_pw": True})

        if cfg["needs_msg"]:
            secret = f["secret"][0].get()
            if not os.path.exists(secret):
                print(f"ERROR: Message file not found: {secret}"); return
        else:
            secret = ""

        pw = f["password"][0].get().strip() or None if cfg["needs_pw"] else None

        print(f"Embedding type {wtype}...")
        ok, msg = wt.embed(wtype, cover, secret, output, pw)
        print(f"\n  {'SUCCESS' if ok else 'ERROR'}: {msg}")
