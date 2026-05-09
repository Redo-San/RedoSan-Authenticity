import os
import customtkinter as ctk

from RedoSan_Authenticity import MODULES, has_module, save_hashes, run_java, run_ots


class OpenStegoTabMixin:
    def _build_openstego_tab(self):
        tab = self.tabs.add("Open Stego")
        ctrl = ctk.CTkScrollableFrame(tab)
        ctrl.pack(fill="both", expand=True, padx=5, pady=5)
        ctrl.grid_columnconfigure(0, weight=0)
        ctrl.grid_columnconfigure(1, weight=1)
        ctrl.grid_columnconfigure(2, weight=0)

        ctk.CTkLabel(ctrl, text="Media:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.os_media = ctk.CTkComboBox(ctrl, values=["Image", "Audio", "Video"], width=120, state="readonly",
                                         command=self._os_media_change)
        self.os_media.grid(row=0, column=1, padx=5, pady=5, sticky="w")
        self.os_media.set("Image")

        ctk.CTkLabel(ctrl, text="Operation:").grid(row=1, column=0, padx=5, pady=5, sticky="w")
        self.os_mode = ctk.CTkComboBox(ctrl, values=[
            "Hide + Timestamp", "Extract + Verify",
        ], width=200, state="readonly")
        self.os_mode.grid(row=1, column=1, padx=5, pady=5, sticky="w")
        self.os_mode.set("Hide + Timestamp")
        self.os_mode.bind("<<ComboboxSelected>>", self._os_mode_change)

        self.os_fields = {}
        self.os_labels = {}
        r = 2
        e, b, l = self._build_file_row(ctrl, "Cover Image:", r)
        self.os_fields["input1"] = (e, b); self.os_labels["input1"] = l
        e, b, l = self._build_file_row(ctrl, "Secret File:", r + 1)
        self.os_fields["secret"] = (e, b); self.os_labels["secret"] = l
        e, b, l = self._build_file_row(ctrl, "Signature:", r + 2)
        self.os_fields["sig"] = (e, b); self.os_labels["sig"] = l
        e, b, l = self._build_file_row(ctrl, "Output:", r + 3, save=True)
        self.os_fields["output"] = (e, b); self.os_labels["output"] = l
        e, b, l = self._build_file_row(ctrl, "Stego Image:", r + 4)
        self.os_fields["stego"] = (e, b); self.os_labels["stego"] = l
        e, b, l = self._build_file_row(ctrl, "Extract Dir:", r + 5, browse_dir=True)
        self.os_fields["outdir"] = (e, None); self.os_labels["outdir"] = l
        e, l = self._build_row_entry(ctrl, "Password:", r + 6)
        self.os_fields["password"] = (e, None); self.os_labels["password"] = l

        self._os_media_change()
        self._os_mode_change()

        ctk.CTkButton(ctrl, text="Run", height=35, command=lambda: self._run_in_thread(self._os_run)).grid(
            row=r + 7, column=1, pady=10, sticky="w")

    def _os_media_change(self, choice=None):
        media = self.os_media.get()
        if media == "Image":
            ops = ["Hide + Timestamp", "Extract + Verify", "Watermark + Timestamp", "Gen Signature", "Check Watermark"]
        else:
            ops = ["Hide + Timestamp", "Extract + Verify"]
        self.os_mode.configure(values=ops)
        self.os_mode.set(ops[0])

        lbl_in = {"Image": "Cover Image:", "Audio": "WAV File:", "Video": "Video File:"}[media]
        lbl_stego = {"Image": "Stego Image:", "Audio": "Stego Audio:", "Video": "Stego Video:"}[media]
        lbl_out = {"Image": "Output:", "Audio": "Output WAV:", "Video": "Output:"}[media]

        self.os_labels["input1"].configure(text=lbl_in)
        self.os_labels["stego"].configure(text=lbl_stego)
        self.os_labels["output"].configure(text=lbl_out)

        self._os_refresh_layout()

    def _os_refresh_layout(self):
        """Show/hide fields based on current media + mode."""
        media = self.os_media.get()
        mode = self.os_mode.get()
        is_image = media == "Image"

        show = {}
        show["input1"] = mode not in ("Gen Signature", "Check Watermark")
        show["secret"] = mode == "Hide + Timestamp"
        show["sig"] = mode in ("Gen Signature", "Check Watermark", "Watermark + Timestamp") and is_image
        show["output"] = mode in ("Hide + Timestamp", "Watermark + Timestamp")
        show["stego"] = mode in ("Extract + Verify", "Check Watermark")
        show["outdir"] = mode == "Extract + Verify"
        show["password"] = mode != "Check Watermark"

        for key in self.os_fields:
            entry = self.os_fields[key][0]
            btn = self.os_fields[key][1] if len(self.os_fields[key]) > 1 else None
            label = self.os_labels.get(key)
            visible = show.get(key, True)
            method = "grid" if visible else "grid_remove"
            if label and hasattr(label, "grid_info"):
                getattr(label, method)()
            if hasattr(entry, "grid_info"):
                getattr(entry, method)()
            if btn and hasattr(btn, "grid_info"):
                getattr(btn, method)()

    def _os_mode_change(self, _=None):
        self._os_refresh_layout()

    def _os_run(self):
        media = self.os_media.get()
        mode = self.os_mode.get()
        f = self.os_fields
        pw = f["password"][0].get().strip()

        if media == "Image":
            self._os_run_image(mode, f, pw)
        elif media == "Audio":
            self._os_run_audio(mode, f, pw)
        else:
            self._os_run_video(mode, f, pw)

    def _os_run_image(self, mode, f, pw):
        jar = self.jar
        if not jar:
            print("ERROR: OpenStego not found")
            return

        if mode == "Hide + Timestamp":
            cover = f["input1"][0].get()
            secret = f["secret"][0].get()
            out = f["output"][0].get() or None
            if not out:
                out = os.path.splitext(cover)[0] + "_stego" + os.path.splitext(cover)[1]
            print(f"Hiding secret in {cover}...")
            print(f"  Watermark type: Spatial LSB (type 1)")
            args = ["embed", "-a", "RandomLSB", "-mf", secret, "-cf", cover, "-sf", out]
            if pw: args += ["-e", "-p", pw]
            r = run_java(jar, args)
            if r.returncode != 0:
                print(f"ERROR: {r.stderr.strip()}")
                return
            print(f"Done: {out}")
            save_hashes(out, out)
            print(f"Saved hashes (.sha1/256/512.txt)")
            r2 = run_ots(["stamp", out])
            print("Timestamped!" if r2.returncode == 0 else "OTS stamp failed")

        elif mode == "Extract + Verify":
            stego = f["stego"][0].get()
            outdir = f["outdir"][0].get() or os.path.dirname(stego) or "."
            print(f"Verifying timestamp...")
            if os.path.exists(stego + ".ots"):
                r = run_ots(["verify", stego])
                if r.returncode != 0:
                    print("Verification failed")
            print(f"Extracting to {outdir}...")
            args = ["extract", "-a", "RandomLSB", "-sf", stego, "-xd", outdir]
            if pw: args += ["-p", pw]
            r = run_java(jar, args)
            print("Done" if r.returncode == 0 else f"ERROR: {r.stderr.strip()}")

        elif mode == "Watermark + Timestamp":
            sig = f["sig"][0].get()
            cover = f["input1"][0].get()
            out = f["output"][0].get() or None
            if not out:
                out = os.path.splitext(cover)[0] + "_wm" + os.path.splitext(cover)[1]
            print(f"Watermarking {cover}...")
            print(f"  Watermark type: Frequency DWT (type 2)")
            r = run_java(jar, ["embedmark", "-a", "DWTDugad", "-gf", sig, "-cf", cover, "-sf", out])
            if r.returncode != 0:
                print(f"ERROR: {r.stderr.strip()}")
                return
            print(f"Done: {out}")
            save_hashes(out, out)
            r2 = run_ots(["stamp", out])
            print("Timestamped!" if r2.returncode == 0 else "OTS stamp failed")

        elif mode == "Gen Signature":
            sig = f["sig"][0].get()
            if not sig: print("ERROR: No signature path"); return
            print(f"Generating signature...")
            args = ["gensig", "-a", "DWTDugad", "-gf", sig]
            if pw: args += ["-p", pw]
            r = run_java(jar, args)
            print("Done" if r.returncode == 0 else f"ERROR: {r.stderr.strip()}")

        elif mode == "Check Watermark":
            sig = f["sig"][0].get()
            stego = f["stego"][0].get()
            r = run_java(jar, ["checkmark", "-a", "DWTDugad", "-gf", sig, "-sf", stego])
            print(r.stdout.strip() or "Done")
            if r.stderr: print(r.stderr.strip())

    def _os_run_audio(self, mode, f, pw):
        if not has_module("audio"):
            print("ERROR: Audio module not available"); return
        wav = f["input1"][0].get()

        if mode == "Hide + Timestamp":
            secret = f["secret"][0].get()
            out = f["output"][0].get() or None
            if not out: out = os.path.splitext(wav)[0] + "_stego.wav"
            print(f"Hiding in {wav}...")
            ok, msg = MODULES["audio"].embed(wav, secret, out, pw)
            print(f"{'SUCCESS' if ok else 'ERROR'}: {msg}")
            if not ok: return
            save_hashes(out, out)
            print("Hashes saved (.sha1/256/512.txt)")
            r = run_ots(["stamp", out])
            print("Timestamped!" if r.returncode == 0 else "ERROR: Timestamp failed")
        else:
            outdir = f["outdir"][0].get() or os.path.dirname(wav) or "."
            if os.path.exists(wav + ".ots"):
                print("Verifying timestamp...")
                r = run_ots(["verify", wav])
                if r.returncode != 0:
                    print("Verification failed")
                    return
            print(f"Extracting from {wav}...")
            ok, msg = MODULES["audio"].extract(wav, outdir, pw)
            print(f"{'SUCCESS' if ok else 'ERROR'}: {msg}")

    def _os_run_video(self, mode, f, pw):
        if not has_module("video"):
            print("ERROR: Video module not available"); return
        vid = f["input1"][0].get()

        if mode == "Hide + Timestamp":
            secret = f["secret"][0].get()
            out = f["output"][0].get() or None
            if not out: out = os.path.splitext(vid)[0] + "_stego" + os.path.splitext(vid)[1]
            print(f"Hiding in {vid}...")
            ok, msg = MODULES["video"].embed(vid, secret, out, pw)
            print(f"{'SUCCESS' if ok else 'ERROR'}: {msg}")
            if not ok: return
            save_hashes(out, out)
            print("Hashes saved (.sha1/256/512.txt)")
            r = run_ots(["stamp", out])
            print("Timestamped!" if r.returncode == 0 else "ERROR: Timestamp failed")
        else:
            outdir = f["outdir"][0].get() or os.path.dirname(vid) or "."
            if os.path.exists(vid + ".ots"):
                print("Verifying timestamp...")
                r = run_ots(["verify", vid])
                if r.returncode != 0:
                    print("Verification failed")
                    return
            print(f"Extracting from {vid}...")
            ok, msg = MODULES["video"].extract(vid, outdir, pw)
            print(f"{'SUCCESS' if ok else 'ERROR'}: {msg}")
