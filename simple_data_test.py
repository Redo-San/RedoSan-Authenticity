#!/usr/bin/env python3
import customtkinter as ctk
import sys
import os

# Add to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

class SimpleDataTest:
    def __init__(self):
        self.root = ctk.CTk()
        self.root.geometry("400x300")
        self.root.title("Simple Data Test")
        
        # Simple data storage
        self.data_storage = {}
        
        # Create widgets
        self.create_widgets()
    
    def create_widgets(self):
        # Content type selector
        ctk.CTkLabel(self.root, text="Content Type:").pack(pady=5)
        self.content_type = ctk.CTkComboBox(
            self.root, 
            values=["Type 1", "Type 2", "Type 3"],
            command=self.on_content_change
        )
        self.content_type.pack(pady=5)
        self.content_type.set("Type 1")
        
        # Text field
        ctk.CTkLabel(self.root, text="Data:").pack(pady=5)
        self.text_field = ctk.CTkEntry(self.root, width=300)
        self.text_field.pack(pady=5)
        
        # Test buttons
        button_frame = ctk.CTkFrame(self.root)
        button_frame.pack(pady=10)
        
        ctk.CTkButton(button_frame, text="Save Current", 
                     command=self.save_current).pack(side="left", padx=5)
        ctk.CTkButton(button_frame, text="Clear Field", 
                     command=self.clear_field).pack(side="left", padx=5)
        ctk.CTkButton(button_frame, text="Show Storage", 
                     command=self.show_storage).pack(side="left", padx=5)
    
    def save_current(self):
        """Save current data"""
        current_type = self.content_type.get()
        current_data = self.text_field.get()
        
        if current_type not in self.data_storage:
            self.data_storage[current_type] = {}
        
        self.data_storage[current_type]['text'] = current_data
        print(f"Saved '{current_data}' for {current_type}")
    
    def clear_field(self):
        """Clear the text field"""
        self.text_field.delete(0, 'end')
        print("Field cleared")
    
    def on_content_change(self, choice):
        """Handle content type change"""
        # Save current data first
        self.save_current()
        
        # Clear field
        self.clear_field()
        
        # Load new data if exists
        if choice in self.data_storage and 'text' in self.data_storage[choice]:
            self.text_field.insert(0, self.data_storage[choice]['text'])
            print(f"Loaded '{self.data_storage[choice]['text']}' for {choice}")
    
    def show_storage(self):
        """Show all stored data"""
        print("\n=== Current Storage ===")
        for content_type, data in self.data_storage.items():
            text = data.get('text', '')
            print(f"{content_type}: '{text}'")
        print("========================\n")
    
    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    app = SimpleDataTest()
    app.run()
