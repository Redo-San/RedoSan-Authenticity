import customtkinter as ctk
from tkinter import messagebox

from RedoSan_Authenticity import MODULES, has_module


class C2paTabMixin:
    def __init__(self):
        # Initialize data storage for each content type
        self._c2pa_content_data = {
            "1. AI Generated": {},
            "2. AI Edited": {},
            "3. Digital Creation": {},
            "4. Digital Capture": {},
            "5. Composite": {},
            "6. Human Edited": {}
        }
        # Track current content type to avoid unnecessary saves
        self._c2pa_current_type = None
    
    def _build_c2pa_tab(self):
        # Initialize data storage if not already done
        if not hasattr(self, '_c2pa_content_data'):
            self._c2pa_content_data = {
                "1. AI Generated": {},
                "2. AI Edited": {},
                "3. Digital Creation": {},
                "4. Digital Capture": {},
                "5. Composite": {},
                "6. Human Edited": {}
            }
            self._c2pa_current_type = None
        
        tab = self.tabs.add("C2PA")
        ctrl = ctk.CTkScrollableFrame(tab)
        ctrl.pack(fill="both", expand=True, padx=5, pady=5)
        ctrl.grid_columnconfigure(0, weight=0)
        ctrl.grid_columnconfigure(1, weight=1)
        ctrl.grid_columnconfigure(2, weight=0)

        # Mode selector
        ctk.CTkLabel(ctrl, text="Operation:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.c2pa_mode = ctk.CTkComboBox(ctrl, values=["Read", "Write", "Init Cert"], width=150, state="readonly",
                                          command=self._c2pa_mode_change)
        self.c2pa_mode.grid(row=0, column=1, padx=5, pady=5, sticky="w")
        self.c2pa_mode.set("Read")

        # Store entries for easy access
        self._c2pa_entries = {}

        # File field - row 1 (for Read & Write)
        e, b, l = self._build_file_row(ctrl, "File:", 1)
        self._c2pa_entries["file"] = e
        self._c2pa_file_label = l
        self._c2pa_file_btn = b

        # Section 1: Identity - rows 2-4 (Write only)
        lbl = ctk.CTkLabel(ctrl, text="=== SECTION 1: IDENTITY ===", font=ctk.CTkFont(size=11, weight="bold"), text_color="cyan")
        lbl.grid(row=2, column=0, columnspan=3, padx=5, pady=(8, 3), sticky="w")
        self._c2pa_sec1_label = lbl

        e, l = self._build_row_entry(ctrl, "Creator Name:", 3)
        self._c2pa_entries["creator_name"] = e
        self._c2pa_creator_name_label = l
        
        # Create StringVar for reliable automatic saving
        import tkinter as tk
        self._c2pa_creator_name_var = tk.StringVar()
        e.configure(textvariable=self._c2pa_creator_name_var)
        self._c2pa_creator_name_var.trace_add('write', lambda *args: self._auto_save_field())
        
        e, l = self._build_row_entry(ctrl, "Creator ID (URL/ISNI):", 4)
        self._c2pa_entries["creator_id"] = e
        self._c2pa_creator_id_label = l
        
        # Create StringVar for reliable automatic saving
        self._c2pa_creator_id_var = tk.StringVar()
        e.configure(textvariable=self._c2pa_creator_id_var)
        self._c2pa_creator_id_var.trace_add('write', lambda *args: self._auto_save_field())

        # Section 2: Content Origin - rows 5-8 (Write only)
        lbl = ctk.CTkLabel(ctrl, text="=== SECTION 2: CONTENT ORIGIN ===", font=ctk.CTkFont(size=11, weight="bold"), text_color="cyan")
        lbl.grid(row=5, column=0, columnspan=3, padx=5, pady=(8, 3), sticky="w")
        self._c2pa_sec2_label = lbl

        # Content Type as ComboBox
        ctk.CTkLabel(ctrl, text="Content Type:").grid(row=6, column=0, padx=5, pady=3, sticky="w")
        self.c2pa_content_type = ctk.CTkComboBox(ctrl, values=[
            "1. AI Generated", "2. AI Edited", "3. Digital Creation",
            "4. Digital Capture", "5. Composite", "6. Human Edited"
        ], width=200, state="readonly", command=self._c2pa_content_type_change)
        self.c2pa_content_type.grid(row=6, column=1, padx=5, pady=3, sticky="w")
        self.c2pa_content_type.set("1. AI Generated")
        self._c2pa_content_type_label = ctrl.grid_slaves(row=6, column=0)[0]

        e, l = self._build_row_entry(ctrl, "AI Model:", 7)
        self._c2pa_entries["ai_model"] = e
        self._c2pa_ai_model_label = l
        
        # Create StringVar for reliable automatic saving
        self._c2pa_ai_model_var = tk.StringVar()
        e.configure(textvariable=self._c2pa_ai_model_var)
        self._c2pa_ai_model_var.trace_add('write', lambda *args: self._auto_save_field())

        e, l = self._build_row_entry(ctrl, "Description:", 8)
        self._c2pa_entries["description"] = e
        self._c2pa_desc_label = l
        
        # Create StringVar for reliable automatic saving
        self._c2pa_description_var = tk.StringVar()
        e.configure(textvariable=self._c2pa_description_var)
        self._c2pa_description_var.trace_add('write', lambda *args: self._auto_save_field())

        # Section 3: Copyright - rows 9-12 (Write only)
        lbl = ctk.CTkLabel(ctrl, text="=== SECTION 3: COPYRIGHT ===", font=ctk.CTkFont(size=11, weight="bold"), text_color="cyan")
        lbl.grid(row=9, column=0, columnspan=3, padx=5, pady=(8, 3), sticky="w")
        self._c2pa_sec3_label = lbl

        e, l = self._build_row_entry(ctrl, "Rights Holder:", 10)
        self._c2pa_entries["rights_holder"] = e
        self._c2pa_rights_label = l
        
        # Create StringVar for reliable automatic saving
        self._c2pa_rights_holder_var = tk.StringVar()
        e.configure(textvariable=self._c2pa_rights_holder_var)
        self._c2pa_rights_holder_var.trace_add('write', lambda *args: self._auto_save_field())

        e, l = self._build_row_entry(ctrl, "Copyright Notice:", 11)
        self._c2pa_entries["copyright"] = e
        self._c2pa_copyright_label = l
        
        # Create StringVar for reliable automatic saving
        self._c2pa_copyright_var = tk.StringVar()
        e.configure(textvariable=self._c2pa_copyright_var)
        self._c2pa_copyright_var.trace_add('write', lambda *args: self._auto_save_field())

        e, l = self._build_row_entry(ctrl, "License URL:", 12)
        self._c2pa_entries["license"] = e
        self._c2pa_license_label = l
        
        # Create StringVar for reliable automatic saving
        self._c2pa_license_var = tk.StringVar()
        e.configure(textvariable=self._c2pa_license_var)
        self._c2pa_license_var.trace_add('write', lambda *args: self._auto_save_field())

        # Section 4: AI Training - rows 13-14 (Write only)
        lbl = ctk.CTkLabel(ctrl, text="=== SECTION 4: AI TRAINING ===", font=ctk.CTkFont(size=11, weight="bold"), text_color="cyan")
        lbl.grid(row=13, column=0, columnspan=3, padx=5, pady=(8, 3), sticky="w")
        self._c2pa_sec4_label = lbl

        self.c2pa_opt_out = ctk.CTkCheckBox(ctrl, text="Opt-out of AI training (do not train)")
        self.c2pa_opt_out.grid(row=14, column=0, columnspan=3, padx=5, pady=5, sticky="w")

        # Save button
        ctk.CTkButton(ctrl, text="Save Data", height=35, 
                     command=self._save_current_content_data).grid(
            row=16, column=1, pady=5, sticky="w")

        # Run button
        ctk.CTkButton(ctrl, text="Run", height=35, 
                     command=lambda: self._run_in_thread(self._c2pa_run)).grid(
            row=17, column=1, pady=10, sticky="w")

        # Store controller for refresh
        self._c2pa_ctrl = ctrl


        self._c2pa_refresh_layout()

    def _c2pa_mode_change(self, choice=None):
        self._c2pa_refresh_layout()

    def _auto_save_field(self):
        """Auto save field data when StringVar changes"""
        try:
            self._save_current_content_data()
        except Exception as e:
            print(f"DEBUG: Auto save error: {e}")
    
    def _save_current_content_data(self):
        """Save current field data for current content type to text file"""
        if not hasattr(self, 'c2pa_content_type'):
            print("DEBUG: No c2pa_content_type attribute")
            return
            
        try:
            content_type = self.c2pa_content_type.get()
            print(f"DEBUG: Saving data for content type: {content_type}")
        except Exception as e:
            print(f"DEBUG: Error getting content type: {e}")
            return
            
        # Map content type to file name
        file_mapping = {
            "1. AI Generated": "1_ai_generated.txt",
            "2. AI Edited": "2_ai_edited.txt",
            "3. Digital Creation": "3_digital_creation.txt",
            "4. Digital Capture": "4_digital_capture.txt",
            "5. Composite": "5_composite.txt",
            "6. Human Edited": "6_human_edited.txt"
        }
        
        if content_type not in file_mapping:
            print(f"DEBUG: Content type not in file_mapping: {content_type}")
            return
            
        # Get current field values
        saved_data = {}
        for field_name in ['creator_name', 'creator_id', 'ai_model', 'description', 'rights_holder', 'copyright', 'license']:
            field = self._c2pa_entries.get(field_name)
            if field:
                value = field.get()
                saved_data[field_name] = value
                print(f"DEBUG: {field_name} = {repr(value)}")
            else:
                saved_data[field_name] = ''
                print(f"DEBUG: {field_name} field not found")
        
        # Save to text file
        import os
        file_path = os.path.join("c2pa_data", file_mapping[content_type])
        print(f"DEBUG: Saving to file: {file_path}")
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(f"creator_name: {saved_data['creator_name']}\n")
                f.write(f"creator_id: {saved_data['creator_id']}\n")
                f.write(f"ai_model: {saved_data['ai_model']}\n")
                f.write(f"description: {saved_data['description']}\n")
                f.write(f"rights_holder: {saved_data['rights_holder']}\n")
                f.write(f"copyright: {saved_data['copyright']}\n")
                f.write(f"license: {saved_data['license']}\n")
            print(f"DEBUG: Successfully saved to {file_path}")
        except Exception as e:
            print(f"DEBUG: Error saving to file: {e}")
    
    def _load_content_data(self, content_type):
        """Load field data for specified content type from text file"""
        print(f"DEBUG: Loading data for content type: {content_type}")
        
        # Map content type to file name
        file_mapping = {
            "1. AI Generated": "1_ai_generated.txt",
            "2. AI Edited": "2_ai_edited.txt",
            "3. Digital Creation": "3_digital_creation.txt",
            "4. Digital Capture": "4_digital_capture.txt",
            "5. Composite": "5_composite.txt",
            "6. Human Edited": "6_human_edited.txt"
        }
        
        if content_type not in file_mapping:
            print(f"DEBUG: Content type not in file_mapping: {content_type}")
            return
            
        # Load data from text file
        import os
        file_path = os.path.join("c2pa_data", file_mapping[content_type])
        print(f"DEBUG: Loading from file: {file_path}")
        data = {}
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if ':' in line:
                        key, value = line.split(':', 1)
                        data[key.strip()] = value.strip()
                        print(f"DEBUG: Loaded {key.strip()} = {repr(value.strip())}")
        except FileNotFoundError:
            print(f"DEBUG: File not found: {file_path}")
            # Default empty data if file doesn't exist
            data = {
                'creator_name': '', 'creator_id': '', 'ai_model': '',
                'description': '', 'rights_holder': '', 'copyright': '', 'license': ''
            }
        except Exception as e:
            print(f"DEBUG: Error loading from file: {e}")
            data = {
                'creator_name': '', 'creator_id': '', 'ai_model': '',
                'description': '', 'rights_holder': '', 'copyright': '', 'license': ''
            }
        
        # Load all field values using StringVar for reliable synchronization
        if hasattr(self, '_c2pa_creator_name_var'):
            self._c2pa_creator_name_var.set(data.get('creator_name', ''))
        elif self._c2pa_entries.get('creator_name'):
            self._c2pa_entries['creator_name'].delete(0, 'end')
            self._c2pa_entries['creator_name'].insert(0, data.get('creator_name', ''))
            
        if hasattr(self, '_c2pa_creator_id_var'):
            self._c2pa_creator_id_var.set(data.get('creator_id', ''))
        elif self._c2pa_entries.get('creator_id'):
            self._c2pa_entries['creator_id'].delete(0, 'end')
            self._c2pa_entries['creator_id'].insert(0, data.get('creator_id', ''))
            
        if hasattr(self, '_c2pa_ai_model_var'):
            self._c2pa_ai_model_var.set(data.get('ai_model', ''))
        elif self._c2pa_entries.get('ai_model'):
            self._c2pa_entries['ai_model'].delete(0, 'end')
            self._c2pa_entries['ai_model'].insert(0, data.get('ai_model', ''))
            
        if hasattr(self, '_c2pa_description_var'):
            self._c2pa_description_var.set(data.get('description', ''))
        elif self._c2pa_entries.get('description'):
            self._c2pa_entries['description'].delete(0, 'end')
            self._c2pa_entries['description'].insert(0, data.get('description', ''))
            
        if hasattr(self, '_c2pa_rights_holder_var'):
            self._c2pa_rights_holder_var.set(data.get('rights_holder', ''))
        elif self._c2pa_entries.get('rights_holder'):
            self._c2pa_entries['rights_holder'].delete(0, 'end')
            self._c2pa_entries['rights_holder'].insert(0, data.get('rights_holder', ''))
            
        if hasattr(self, '_c2pa_copyright_var'):
            self._c2pa_copyright_var.set(data.get('copyright', ''))
        elif self._c2pa_entries.get('copyright'):
            self._c2pa_entries['copyright'].delete(0, 'end')
            self._c2pa_entries['copyright'].insert(0, data.get('copyright', ''))
            
        if hasattr(self, '_c2pa_license_var'):
            self._c2pa_license_var.set(data.get('license', ''))
        elif self._c2pa_entries.get('license'):
            self._c2pa_entries['license'].delete(0, 'end')
            self._c2pa_entries['license'].insert(0, data.get('license', ''))

    def _c2pa_content_type_change(self, choice=None):
        """Handle content type change to show/hide relevant fields"""
        content_type = self.c2pa_content_type.get()
        print(f"DEBUG: Content type changed to: {content_type}")
        
        # Get current mode to ensure we're in Write mode
        mode = self.c2pa_mode.get()
        if mode != "Write":
            print(f"DEBUG: Not in Write mode, current mode: {mode}")
            return
        
        # Save current data before switching
        print("DEBUG: Saving current content data...")
        self._save_current_content_data()
        print("DEBUG: Current content data saved")
        
        # Clear all fields before loading new data
        print("DEBUG: Clearing all fields...")
        for field_name in ['creator_name', 'creator_id', 'ai_model', 'description', 'rights_holder', 'copyright', 'license']:
            field = self._c2pa_entries.get(field_name)
            if field:
                field.delete(0, 'end')
                print(f"DEBUG: Cleared {field_name}")
        print("DEBUG: All fields cleared")
            
        # Define field requirements for each content type
        ai_types = ["1. AI Generated", "2. AI Edited"]
        
        # Handle AI Model field - only for AI-related types
        if content_type in ai_types:
            self._c2pa_ai_model_label.grid(row=7, column=0, padx=5, pady=3, sticky="ew")
            self._c2pa_entries["ai_model"].grid(row=7, column=1, padx=5, pady=3, sticky="ew", columnspan=2)
        else:
            self._c2pa_entries["ai_model"].delete(0, 'end')
            self._c2pa_ai_model_label.grid_forget()
            self._c2pa_entries["ai_model"].grid_forget()
        
        # Clear ALL fields before loading new data
        for field_name in ['creator_name', 'creator_id', 'ai_model', 'description', 'rights_holder', 'copyright', 'license']:
            if self._c2pa_entries.get(field_name):
                self._c2pa_entries[field_name].delete(0, 'end')
        
        # Handle Description field - always show but update label text based on type
        if content_type == "1. AI Generated":
            self._c2pa_desc_label.configure(text="Description:")
        elif content_type == "2. AI Edited":
            self._c2pa_desc_label.configure(text="Edit Description:")
        elif content_type == "3. Digital Creation":
            self._c2pa_desc_label.configure(text="Creation Details:")
        elif content_type == "4. Digital Capture":
            self._c2pa_desc_label.configure(text="Capture Details:")
        elif content_type == "5. Composite":
            self._c2pa_desc_label.configure(text="Composite Details:")
        elif content_type == "6. Human Edited":
            self._c2pa_desc_label.configure(text="Manual Edit Details:")
        
        # Handle Creator fields - always show but update label based on type
        if content_type == "1. AI Generated":
            self._c2pa_creator_name_label.configure(text="AI Operator:")
            self._c2pa_creator_id_label.configure(text="Organization ID:")
        elif content_type == "2. AI Edited":
            self._c2pa_creator_name_label.configure(text="Editor:")
            self._c2pa_creator_id_label.configure(text="Editor ID:")
        elif content_type == "3. Digital Creation":
            self._c2pa_creator_name_label.configure(text="Artist/Designer:")
            self._c2pa_creator_id_label.configure(text="Portfolio URL:")
        elif content_type == "4. Digital Capture":
            self._c2pa_creator_name_label.configure(text="Photographer:")
            self._c2pa_creator_id_label.configure(text="Camera ID:")
        elif content_type == "5. Composite":
            self._c2pa_creator_name_label.configure(text="Composite Artist:")
            self._c2pa_creator_id_label.configure(text="Artist ID:")
        elif content_type == "6. Human Edited":
            self._c2pa_creator_name_label.configure(text="Manual Editor:")
            self._c2pa_creator_id_label.configure(text="Editor ID:")
        
        # Load data for new content type
        self._load_content_data(content_type)

    def _c2pa_refresh_layout(self):
        mode = self.c2pa_mode.get()
        
        if mode == "Read":
            # Show only file field
            self._c2pa_file_label.grid(row=1, column=0, padx=5, pady=3, sticky="ew")
            self._c2pa_entries["file"].grid(row=1, column=1, padx=5, pady=3, sticky="ew")
            if self._c2pa_file_btn:
                self._c2pa_file_btn.grid(row=1, column=2, padx=5, pady=3)
            
            # Hide all write sections (including content_type combo)
            for w in [self._c2pa_sec1_label, self._c2pa_creator_name_label, self._c2pa_entries["creator_name"],
                      self._c2pa_creator_id_label, self._c2pa_entries["creator_id"],
                      self._c2pa_sec2_label, self._c2pa_content_type_label, self.c2pa_content_type,
                      self._c2pa_ai_model_label, self._c2pa_entries["ai_model"],
                      self._c2pa_desc_label, self._c2pa_entries["description"],
                      self._c2pa_sec3_label, self._c2pa_rights_label, self._c2pa_entries["rights_holder"],
                      self._c2pa_copyright_label, self._c2pa_entries["copyright"],
                      self._c2pa_license_label, self._c2pa_entries["license"],
                      self._c2pa_sec4_label, self.c2pa_opt_out]:
                if w and hasattr(w, 'grid_info'):
                    w.grid_forget()

        elif mode == "Write":
            # Show file field
            self._c2pa_file_label.grid(row=1, column=0, padx=5, pady=3, sticky="ew")
            self._c2pa_entries["file"].grid(row=1, column=1, padx=5, pady=3, sticky="ew")
            if self._c2pa_file_btn:
                self._c2pa_file_btn.grid(row=1, column=2, padx=5, pady=3)
            
            # Section 1: Identity - rows 2-4
            self._c2pa_sec1_label.grid(row=2, column=0, columnspan=3, padx=5, pady=(8, 3), sticky="w")
            self._c2pa_creator_name_label.grid(row=3, column=0, padx=5, pady=3, sticky="ew")
            self._c2pa_entries["creator_name"].grid(row=3, column=1, padx=5, pady=3, sticky="ew", columnspan=2)
            self._c2pa_creator_id_label.grid(row=4, column=0, padx=5, pady=3, sticky="ew")
            self._c2pa_entries["creator_id"].grid(row=4, column=1, padx=5, pady=3, sticky="ew", columnspan=2)
            
            # Section 2: Content Origin - rows 5-8
            self._c2pa_sec2_label.grid(row=5, column=0, columnspan=3, padx=5, pady=(8, 3), sticky="w")
            self._c2pa_content_type_label.grid(row=6, column=0, padx=5, pady=3, sticky="w")
            self.c2pa_content_type.grid(row=6, column=1, padx=5, pady=3, sticky="w")
            self._c2pa_ai_model_label.grid(row=7, column=0, padx=5, pady=3, sticky="ew")
            self._c2pa_entries["ai_model"].grid(row=7, column=1, padx=5, pady=3, sticky="ew", columnspan=2)
            self._c2pa_desc_label.grid(row=8, column=0, padx=5, pady=3, sticky="ew")
            self._c2pa_entries["description"].grid(row=8, column=1, padx=5, pady=3, sticky="ew", columnspan=2)
            
            # Trigger content type change to update fields
            self._c2pa_content_type_change()
            
            # Section 3: Copyright - rows 9-12
            self._c2pa_sec3_label.grid(row=9, column=0, columnspan=3, padx=5, pady=(8, 3), sticky="w")
            self._c2pa_rights_label.grid(row=10, column=0, padx=5, pady=3, sticky="ew")
            self._c2pa_entries["rights_holder"].grid(row=10, column=1, padx=5, pady=3, sticky="ew", columnspan=2)
            self._c2pa_copyright_label.grid(row=11, column=0, padx=5, pady=3, sticky="ew")
            self._c2pa_entries["copyright"].grid(row=11, column=1, padx=5, pady=3, sticky="ew", columnspan=2)
            self._c2pa_license_label.grid(row=12, column=0, padx=5, pady=3, sticky="ew")
            self._c2pa_entries["license"].grid(row=12, column=1, padx=5, pady=3, sticky="ew", columnspan=2)
            
            # Section 4: AI Training - rows 13-14
            self._c2pa_sec4_label.grid(row=13, column=0, columnspan=3, padx=5, pady=(8, 3), sticky="w")
            self.c2pa_opt_out.grid(row=14, column=0, columnspan=3, padx=5, pady=5, sticky="w")

        # Init Cert: only run button visible

    def _c2pa_run(self):
        if not has_module("metadata"):
            print("ERROR: Metadata module not available"); return
        meta_mod = MODULES["metadata"]
        mode = self.c2pa_mode.get()
        e = self._c2pa_entries

        if mode == "Read":
            path = e["file"].get()
            if not path:
                print("ERROR: No file selected"); return
            meta, err = meta_mod.c2pa_read(path)
            if err:
                print(f"WARN: {err}")
            if meta:
                meta_mod.c2pa_print(meta, path)
            else:
                print("No C2PA manifest found")

        elif mode == "Write":
            path = e["file"].get()
            if not path:
                print("ERROR: No file selected"); return

            # Content type mapping (ComboBox to value)
            content_type_map = {
                "1. AI Generated": "ai_generated",
                "2. AI Edited": "ai_edited",
                "3. Digital Creation": "digital_creation",
                "4. Digital Capture": "digital_capture",
                "5. Composite": "composite",
                "6. Human Edited": "human_edited",
            }
            content_type = content_type_map.get(self.c2pa_content_type.get(), "ai_generated")

            creator_name = e["creator_name"].get().strip()
            creator_id = e["creator_id"].get().strip()
            ai_model = e["ai_model"].get().strip()
            description = e["description"].get().strip()
            rights_holder = e["rights_holder"].get().strip()
            copyright_notice = e["copyright"].get().strip()
            license_url = e["license"].get().strip()
            opt_out = self.c2pa_opt_out.get() == 1

            print(f"Writing C2PA provenance...")
            print(f"  Creator: {creator_name or '(not set)'}")
            print(f"  Creator ID: {creator_id or '(not set)'}")
            print(f"  Content Type: {content_type} (input: {self.c2pa_content_type.get()})")
            print(f"  AI Model: {ai_model or '(not set)'}")
            print(f"  Description: {description or '(not set)'}")
            print(f"  Rights Holder: {rights_holder or '(not set)'}")
            print(f"  Copyright: {copyright_notice or '(not set)'}")
            print(f"  License: {license_url or '(not set)'}")
            print(f"  Opt-out AI Training: {opt_out}")

            manifest = meta_mod.c2pa_build_manifest(
                creator_name=creator_name if creator_name else None,
                creator_id=creator_id if creator_id else None,
                digital_source=content_type,
                ai_model=ai_model if ai_model else None,
                description=description if description else None,
                rights_holder=rights_holder if rights_holder else None,
                copyright_notice=copyright_notice if copyright_notice else None,
                license_url=license_url if license_url else None,
                opt_out_ai_training=opt_out
            )

            out, err = meta_mod.c2pa_write(path, manifest)
            if err:
                print(f"ERROR: {err}")
            else:
                print(f"SUCCESS: C2PA provenance written to {out}")
                print(f"  Verify with: RedoSan_Authenticity.py --verify-c2pa {out}")

        else:
            force = messagebox.askyesno("Init C2PA", "Force regenerate certificate?")
            ok, msg = meta_mod.c2pa_init(force=force)
            if ok:
                print(f"OK: {msg}")
                print(f"Certificate: {meta_mod.CERT_FILE}")
            else:
                print(f"FAIL: {msg}")