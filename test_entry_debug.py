#!/usr/bin/env python3
import customtkinter as ctk

app = ctk.CTk()
app.geometry("400x200")

def test_entry():
    entry = ctk.CTkEntry(app, placeholder_text="Test entry")
    entry.pack(pady=20)
    
    # Print entry structure
    print(f"Entry type: {type(entry)}")
    print(f"Entry attributes with 'entry': {[attr for attr in dir(entry) if 'entry' in attr.lower()]}")
    print(f"Entry attributes with 'canvas': {[attr for attr in dir(entry) if 'canvas' in attr.lower()]}")
    print(f"Entry attributes with 'text': {[attr for attr in dir(entry) if 'text' in attr.lower()]}")
    
    # Try to find internal components
    for attr in dir(entry):
        if not attr.startswith('__'):
            try:
                value = getattr(entry, attr)
                if hasattr(value, 'selection_range') or hasattr(value, 'select_range'):
                    print(f"Found selection-capable attribute: {attr} -> {type(value)}")
            except:
                pass
    
    # Test Ctrl+A binding
    def handle_ctrl_a(event):
        print(f"Ctrl+A pressed on: {type(event.widget)}")
        widget = event.widget
        
        # Try different methods
        if hasattr(widget, '_entry'):
            print("Trying _entry method")
            internal = widget._entry
            internal.selection_range(0, 'end')
            internal.focus_set()
        elif hasattr(widget, 'entry'):
            print("Trying entry method")
            internal = widget.entry
            internal.selection_range(0, 'end')
            internal.focus_set()
        else:
            print("Trying direct method")
            try:
                widget.select_range(0, 'end')
                widget.focus_set()
            except:
                print("Direct method failed")
                try:
                    widget.event_generate('<Control-a>')
                except:
                    print("Event generation failed")
        return 'break'
    
    entry.bind('<Control-a>', handle_ctrl_a)
    entry.bind('<Control-A>', handle_ctrl_a)
    
    return entry

entry = test_entry()

app.mainloop()
