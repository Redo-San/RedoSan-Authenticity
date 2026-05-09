#!/usr/bin/env python3
"""
Alternative solution using event binding instead of StringVar trace
"""
import os

def create_alternative_solution():
    """Create an alternative solution using KeyRelease event binding"""
    
    print("=== إنشاء حل بديل باستخدام Event Binding ===")
    
    solution_code = '''
# الحل البديل: استخدام KeyRelease event بدلاً من StringVar trace

# في دالة _build_row_entry، أضف event binding بعد إنشاء الـ CTkEntry:

def _build_row_entry(self, parent, label_text, row):
    """Build a row with label and entry widget"""
    import tkinter as tk
    import customtkinter as ctk
    
    # Create label
    label = ctk.CTkLabel(parent, text=label_text)
    label.grid(row=row, column=0, padx=5, pady=3, sticky="w")
    
    # Create entry
    entry = ctk.CTkEntry(parent, width=200)
    entry.grid(row=row, column=1, padx=5, pady=3, sticky="w")
    
    # Add KeyRelease event binding for automatic saving
    def on_key_release(event=None):
        """Handle key release event for automatic saving"""
        try:
            self._save_current_content_data()
        except:
            pass
    
    entry.bind("<KeyRelease>", on_key_release)
    
    return entry, label

# ثم في دالة _build_c2pa_tab، استخدم الطريقة العادية بدون StringVar:

e, l = self._build_row_entry(ctrl, "Creator Name:", 3)
self._c2pa_entries["creator_name"] = e
self._c2pa_creator_name_label = l

# لا حاجة لـ StringVar أو trace_add
'''
    
    print("الحل المقترح:")
    print("1. استخدام KeyRelease event binding بدلاً من StringVar trace")
    print("2. هذا أكثر موثوقية لأنه لا يعتمد على مزامنة StringVar")
    print("3. يتم الحفظ مباشرة بعد كل ضغطة مفتاح")
    
    print("\nالمميزات:")
    print("- يعمل بشكل مباشر مع CTkEntry")
    print("- لا يحتاج إلى StringVar")
    print("- أكثر استقراراً")
    
    print("\nالعيوب:")
    print("- قد يكون أبطأ قليلاً (يحفظ بعد كل ضغطة مفتاح)")
    print("- قد يسبب حفظاً متكرراً")
    
    return solution_code

if __name__ == "__main__":
    create_alternative_solution()
