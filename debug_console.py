#!/usr/bin/env python3
import customtkinter as ctk
import sys
import os

# Add to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Create a simple console to capture debug messages
class DebugConsole:
    def __init__(self):
        self.root = ctk.CTk()
        self.root.geometry("400x300")
        self.root.title("Debug Console")
        
        # Create text widget to show debug output
        self.text_widget = ctk.CTkTextbox(self.root, height=15, width=50)
        self.text_widget.pack(padx=10, pady=10)
        
        # Add a test button
        ctk.CTkButton(self.root, text="Test C2PA Data Storage", 
                     command=self.test_c2pa).pack(pady=5)
    
    def test_c2pa(self):
        """Test the C2PA data storage functionality"""
        try:
            from gui_parts.tab_c2pa import C2paTabMixin
            
            # Create an instance
            test_instance = C2paTabMixin()
            
            # Initialize data storage manually
            test_instance._c2pa_content_data = {
                "1. AI Generated": {},
                "2. AI Edited": {},
                "3. Digital Creation": {},
                "4. Digital Capture": {},
                "5. Composite": {},
                "6. Human Edited": {}
            }
            
            # Simulate saving data
            test_instance._c2pa_content_data["1. AI Generated"] = {
                'creator_name': 'Test Creator Name',
                'creator_id': 'Test Creator ID',
                'ai_model': 'Test AI Model',
                'description': 'Test Description',
                'rights_holder': 'Test Rights Holder',
                'copyright': 'Test Copyright',
                'license': 'Test License'
            }
            
            self.log("Saved test data for AI Generated")
            
            # Test loading data
            if hasattr(test_instance, '_load_content_data'):
                test_instance._load_content_data("1. AI Generated")
                self.log("Loaded data for AI Generated")
            else:
                self.log("_load_content_data method not found")
                
        except Exception as e:
            self.log(f"Error: {e}")
    
    def log(self, message):
        """Add message to debug console"""
        self.text_widget.insert("end", f"{message}\n")
        self.text_widget.see("end")
        print(message)  # Also print to console
    
    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    console = DebugConsole()
    console.run()
