import os
import customtkinter as ctk

from RedoSan_Authenticity import save_hashes, run_ots


class TimestampTabMixin:
    def _build_timestamp_tab(self):
        tab = self.tabs.add("Timestamp")
        ctrl = ctk.CTkScrollableFrame(tab)
        ctrl.pack(fill="both", expand=True, padx=5, pady=5)

        ctk.CTkLabel(ctrl, text="Operation:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.ts_mode = ctk.CTkComboBox(ctrl, values=["Timestamp", "Verify"], width=150, state="readonly")
        self.ts_mode.grid(row=0, column=1, padx=5, pady=5, sticky="w")
        self.ts_mode.set("Timestamp")

        self.ts_fields = {}
        self.ts_fields["file"] = self._build_file_row(ctrl, "File:", 1)

        ctk.CTkButton(ctrl, text="Run", height=35, command=lambda: self._run_in_thread(self._ts_run)).grid(
            row=2, column=1, pady=10, sticky="w")

    def _ts_run(self):
        path = self.ts_fields["file"][0].get()
        if self.ts_mode.get() == "Timestamp":
            print(f"Timestamping {path}...")
            s1, s256, s512 = save_hashes(path, path)
            print(f"Hashes saved (.sha1/256/512.txt)")
            r = run_ots(["stamp", path])
            print("SUCCESS: Timestamped!" if r.returncode == 0 else "ERROR: Timestamp failed")
        else:
            print(f"Verifying {path}...")
            r = run_ots(["verify", path])
            if r.returncode != 0:
                print("Verification failed")
