#!/usr/bin/env python3
import customtkinter as ctk
import sys
import os

# Add the project directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gui_parts.tab_c2pa import C2paTabMixin

class TestApp(C2paTabMixin):
    def __init__(self):
        super().__init__()
        self.setup_test_ui()
    
    def setup_test_ui(self):
        self.root = ctk.CTk()
        self.root.geometry("600x400")
        self.root.title("Test Data Storage")
        
        # Create a simple frame to simulate the tab structure
        self.tabs = ctk.CTkTabview(self.root)
        self.tabs.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Build the C2PA tab
        self._build_c2pa_tab()
        
        # Add test buttons
        test_frame = ctk.CTkFrame(self.tabs.tab("C2PA"))
        test_frame.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkButton(test_frame, text="Test Save/Load", 
                     command=self.test_save_load).pack(pady=5)
        ctk.CTkButton(test_frame, text="Print Current Data", 
                     command=self.print_current_data).pack(pady=5)
        ctk.CTkButton(test_frame, text="Clear All Data", 
                     command=self.clear_all_data).pack(pady=5)
    
    def test_save_load(self):
        """Test the save and load functionality"""
        print("\n=== Testing Save/Load Functionality ===")
        
        # Get current content type
        current_type = self.c2pa_content_type.get()
        print(f"Current content type: {current_type}")
        
        # Save some test data
        if self._c2pa_entries.get('creator_name'):
            self._c2pa_entries['creator_name'].delete(0, 'end')
            self._c2pa_entries['creator_name'].insert(0, f"Test Name for {current_type}")
        
        if self._c2pa_entries.get('creator_id'):
            self._c2pa_entries['creator_id'].delete(0, 'end')
            self._c2pa_entries['creator_id'].insert(0, f"Test ID for {current_type}")
        
        # Manually save the data
        self._save_current_content_data()
        print(f"Saved data for {current_type}")
        
        # Switch to another content type
        types = ["1. AI Generated", "2. AI Edited", "3. Digital Creation"]
        current_index = types.index(current_type) if current_type in types else 0
        next_type = types[(current_index + 1) % len(types)]
        
        print(f"Switching to: {next_type}")
        self.c2pa_content_type.set(next_type)
        self._c2pa_content_type_change()
        
        # Check if data was loaded correctly
        print(f"Data loaded for {next_type}")
        print(f"Creator name: {self._c2pa_entries.get('creator_name', {}).get() if self._c2pa_entries.get('creator_name') else 'N/A'}")
        print(f"Creator ID: {self._c2pa_entries.get('creator_id', {}).get() if self._c2pa_entries.get('creator_id') else 'N/A'}")
    
    def print_current_data(self):
        """Print all stored data"""
        print("\n=== Current Stored Data ===")
        for content_type, data in self._c2pa_content_data.items():
            print(f"\n{content_type}:")
            for field, value in data.items():
                print(f"  {field}: {value}")
            if not data:
                print("  (empty)")
    
    def clear_all_data(self):
        """Clear all stored data"""
        print("\n=== Clearing All Data ===")
        for content_type in self._c2pa_content_data:
            self._c2pa_content_data[content_type] = {}
        print("All data cleared")
    
    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    app = TestApp()
    app.run()
