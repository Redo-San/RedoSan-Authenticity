#!/usr/bin/env python3
"""
Simple test to verify automatic saving is working
"""
import os

def check_files():
    """Check current state of all data files"""
    print("=== التحقق من حالة الملفات ===")
    
    files = [
        "c2pa_data/1_ai_generated.txt",
        "c2pa_data/2_ai_edited.txt", 
        "c2pa_data/3_digital_creation.txt",
        "c2pa_data/4_digital_capture.txt",
        "c2pa_data/5_composite.txt",
        "c2pa_data/6_human_edited.txt"
    ]
    
    for file_path in files:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                print(f"\n{file_path}:")
                lines = content.split('\n')
                for line in lines[:7]:  # Show first 7 lines
                    if line.strip():
                        print(f"  {line}")
                    else:
                        print("  (فارغ)")
        else:
            print(f"\n{file_path}: غير موجود")

if __name__ == "__main__":
    check_files()
