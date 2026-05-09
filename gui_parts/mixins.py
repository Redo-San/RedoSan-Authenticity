import os, sys, queue, threading, tkinter, datetime, json, traceback, subprocess
import customtkinter as ctk
from tkinter import filedialog, messagebox

from RedoSan_Authenticity import (
    MODULES, has_module, module_error, find_openstego_jar, find_java,
    run_java, run_ots, run_ots as _run_ots_verify,
    hash_file, save_hashes, __version__, SCRIPT_DIR as _SD,
)


def _add_copy_paste_menu(widget):
    """Add right-click copy/paste menu to widget"""
    menu = tkinter.Menu(widget, tearoff=False)
    menu.add_command(label="Copy", command=lambda: widget.focus_set() or widget.selection_get() or _copy_selection(widget))
    menu.add_command(label="Paste", command=lambda: _paste_to_widget(widget))
    menu.add_separator()
    menu.add_command(label="Select All", command=lambda: widget.select_range(0, "end"))
    
    def show_menu(event):
        menu.tk_popup(event.x_root, event.y_root)
    
    widget.bind("<Button-3>", show_menu)


def _copy_selection(widget):
    try:
        sel = widget.selection_get()
        widget.clipboard_clear()
        widget.clipboard_append(sel)
    except:
        pass


def _paste_to_widget(widget):
    try:
        text = widget.clipboard_get()
        if widget.selection_present():
            widget.delete("sel.first", "sel.last")
        widget.insert("insert", text)
    except:
        try:
            widget.insert("insert", widget.clipboard_get())
        except:
            pass


class OutputCapture:
    def __init__(self, textbox):
        self.textbox = textbox
        self.queue = queue.Queue()
        self._check_queue()

    def write(self, text):
        self.queue.put(text)

    def flush(self):
        pass

    def _check_queue(self):
        try:
            while True:
                text = self.queue.get_nowait()
                self.textbox.insert("end", text)
                self.textbox.see("end")
        except queue.Empty:
            pass
        self.textbox.after(100, self._check_queue)

    def clear(self):
        self.textbox.delete("1.0", "end")


class SharedGUIMixin:
    def _toggle_mode(self):
        ctk.set_appearance_mode(self.mode_switch.get())

    def _clear_output(self):
        self.output_capture.clear()

    def _copy_output(self, event=None):
        try:
            sel = self.output_box.selection_get()
            self.clipboard_clear()
            self.clipboard_append(sel)
        except Exception:
            pass

    def _show_context_menu(self, event):
        if self._output_menu is None:
            self._output_menu = tkinter.Menu(self, tearoff=False)
            self._output_menu.add_command(label="Copy", command=self._copy_output)
        self._output_menu.tk_popup(event.x_root, event.y_root)

    def _save_output_txt(self):
        content = self.output_box.get("1.0", "end-1c")
        if not content.strip():
            messagebox.showinfo("Export", "No output to save.")
            return
        path = filedialog.asksaveasfilename(
            title="Save output as TXT",
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")]
        )
        if path:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Output saved to {path}")

    def _save_output_json(self):
        content = self.output_box.get("1.0", "end-1c")
        if not content.strip():
            messagebox.showinfo("Export", "No output to save.")
            return
        data = {
            "tool": "RedoSan Authenticity",
            "version": __version__,
            "timestamp": datetime.datetime.now().isoformat(),
            "output": content
        }
        path = filedialog.asksaveasfilename(
            title="Save output as JSON",
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if path:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Output saved to {path}")

    def _log(self, msg):
        print(msg)

    def _log_startup(self):
        print(f"{'='*55}")
        print(f"  RedoSan Authenticity v{__version__}")
        print(f"  Steganography + OpenTimestamps + C2PA")
        print(f"{'='*55}")
        if not self.jar:
            print("  [!] OpenStego not found -- image stego limited")
        if not has_module("metadata"):
            print("  [!] Metadata module not available")
        print()

    def _pick_file(self, entry, title="Select file", types=None):
        if types is None:
            types = [("All files", "*.*")]
        path = filedialog.askopenfilename(title=title, filetypes=types)
        if path:
            entry.delete(0, "end")
            entry.insert(0, path)

    def _pick_dir(self, entry, title="Select directory"):
        path = filedialog.askdirectory(title=title)
        if path:
            entry.delete(0, "end")
            entry.insert(0, path)

    def _pick_save(self, entry, title="Save as", types=None):
        if types is None:
            types = [("All files", "*.*")]
        path = filedialog.asksaveasfilename(title=title, filetypes=types)
        if path:
            entry.delete(0, "end")
            entry.insert(0, path)

    def _build_file_row(self, parent, label, row, browse=True, browse_dir=False, save=False):
        lbl = ctk.CTkLabel(parent, text=label, anchor="e")
        lbl.grid(row=row, column=0, padx=5, pady=3, sticky="ew")
        entry = ctk.CTkEntry(parent)
        entry.grid(row=row, column=1, padx=5, pady=3, sticky="ew")
        parent.grid_columnconfigure(1, weight=1)
        
        # Add right-click menu for copy/paste
        self._add_entry_context_menu(entry)
        
        btn = None
        if browse:
            if browse_dir:
                btn = ctk.CTkButton(parent, text="Browse", width=70, height=28,
                                    command=lambda e=entry: self._pick_dir(e))
            elif save:
                btn = ctk.CTkButton(parent, text="Browse", width=70, height=28,
                                    command=lambda e=entry: self._pick_save(e))
            else:
                btn = ctk.CTkButton(parent, text="Browse", width=70, height=28,
                                    command=lambda e=entry: self._pick_file(e))
            btn.grid(row=row, column=2, padx=5, pady=3)
        return entry, btn, lbl

    def _add_entry_context_menu(self, entry):
        """Add right-click menu with Copy/Paste/Select All to entry widget"""
        menu = tkinter.Menu(entry, tearoff=False)
        
        def do_copy():
            try:
                sel = entry.selection_get()
                entry.clipboard_clear()
                entry.clipboard_append(sel)
            except tkinter.TclError:
                entry.select_range(0, "end")
                entry.after(10, lambda: entry.event_generate("<<Copy>>"))
        
        def do_paste():
            try:
                text = entry.clipboard_get()
                if not text:
                    return
                if entry.selection_present():
                    entry.delete("sel.first", "sel.last")
                else:
                    entry.delete(0, "end")
                entry.insert("insert", text)
            except:
                try:
                    entry.insert("insert", entry.clipboard_get())
                except:
                    pass
        
        def do_cut():
            try:
                sel = entry.selection_get()
                entry.clipboard_clear()
                entry.clipboard_append(sel)
                entry.delete("sel.first", "sel.last")
            except tkinter.TclError:
                pass
        
        def do_select_all(event=None):
            try:
                # For customtkinter CTkEntry, use the internal _entry (tkinter.Entry)
                if hasattr(entry, '_entry'):
                    internal_entry = entry._entry
                    internal_entry.selection_range(0, 'end')
                    internal_entry.focus_set()
                else:
                    # Fallback for regular tkinter entries
                    entry.selection_range(0, 'end')
                    entry.focus_set()
            except Exception:
                pass
            return "break"
        
        menu.add_command(label="Copy", command=do_copy)
        menu.add_command(label="Paste", command=do_paste)
        menu.add_command(label="Cut", command=do_cut)
        menu.add_separator()
        menu.add_command(label="Select All", command=do_select_all)
        
        def show_menu(event):
            menu.tk_popup(event.x_root, event.y_root)
        
        entry.bind("<Button-3>", show_menu)
        entry.bind("<Control-a>", do_select_all)
        entry.bind("<Control-A>", do_select_all)

    def _build_row_entry(self, parent, label, row):
        lbl = ctk.CTkLabel(parent, text=label, anchor="e")
        lbl.grid(row=row, column=0, padx=5, pady=3, sticky="ew")
        entry = ctk.CTkEntry(parent, show="*" if "assword" in label else "")
        entry.grid(row=row, column=1, padx=5, pady=3, sticky="ew", columnspan=2)
        parent.grid_columnconfigure(1, weight=1)
        
        # Add right-click menu for copy/paste
        self._add_entry_context_menu(entry)
        
        return entry, lbl

    def _run_in_thread(self, target, args=()):
        self.output_capture.clear()
        def _wrapped(*a):
            try:
                target(*a)
            except Exception as e:
                print(f"\nUNEXPECTED ERROR: {e}")
                traceback.print_exc()
        threading.Thread(target=_wrapped, args=args, daemon=True).start()
