import customtkinter as ctk

from RedoSan_Authenticity import MODULES, has_module


class MetadataTabMixin:
    def _build_metadata_tab(self):
        tab = self.tabs.add("Metadata")
        ctrl = ctk.CTkScrollableFrame(tab)
        ctrl.pack(fill="both", expand=True, padx=5, pady=5)

        ctk.CTkLabel(ctrl, text="Operation:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.meta_mode = ctk.CTkComboBox(ctrl, values=["Read", "Write"], width=150, state="readonly")
        self.meta_mode.grid(row=0, column=1, padx=5, pady=5, sticky="w")
        self.meta_mode.set("Read")
        self.meta_mode.bind("<<ComboboxSelected>>", self._meta_mode_change)

        self.meta_fields = {}
        self.meta_fields["file"] = self._build_file_row(ctrl, "File:", 1)
        e, _ = self._build_row_entry(ctrl, "Title:", 2)
        self.meta_fields["title"] = e
        e, _ = self._build_row_entry(ctrl, "Artist:", 3)
        self.meta_fields["artist"] = e
        e, _ = self._build_row_entry(ctrl, "Copyright:", 4)
        self.meta_fields["copyright"] = e
        self.meta_fields["output"] = self._build_file_row(ctrl, "Output:", 5, save=True)

        self._meta_mode_change()

        ctk.CTkButton(ctrl, text="Run", height=35, command=lambda: self._run_in_thread(self._meta_run)).grid(
            row=6, column=1, pady=10, sticky="w")

    def _meta_mode_change(self, _=None):
        wr = self.meta_mode.get() == "Write"
        self.meta_fields["title"].configure(state="normal" if wr else "disabled")
        self.meta_fields["artist"].configure(state="normal" if wr else "disabled")
        self.meta_fields["copyright"].configure(state="normal" if wr else "disabled")
        self.meta_fields["output"][0].configure(state="normal" if wr else "disabled")

    def _meta_run(self):
        if not has_module("metadata"):
            print("ERROR: Metadata module not available"); return
        meta_mod = MODULES["metadata"]
        f = self.meta_fields
        path = f["file"][0].get()

        if self.meta_mode.get() == "Read":
            print(f"Reading metadata from {path}...")
            meta, err = meta_mod.read_metadata(path)
            if meta:
                meta_mod.print_metadata(meta)
                print("Checking for C2PA provenance...")
                c2pa, c2pa_err = meta_mod.c2pa_read(path)
                if c2pa:
                    meta_mod.c2pa_print(c2pa, path)
                elif c2pa_err and "No C2PA" not in c2pa_err:
                    print(f"C2PA check: {c2pa_err}")
                else:
                    print("No C2PA manifest found")
            else:
                print(f"ERROR: {err}")
        else:
            data = {}
            for k in ("title", "artist", "copyright"):
                v = f[k].get().strip()
                if v: data[k] = v
            if not data: print("No fields entered"); return
            out = f["output"][0].get() or None
            ok, msg = meta_mod.write_metadata(path, data, out)
            print(f"{'SUCCESS' if ok else 'ERROR'}: {msg}")
