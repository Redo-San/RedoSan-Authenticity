#!/usr/bin/env python3
"""
Test script to verify automatic saving functionality
"""
import os
import time

def test_auto_save_functionality():
    """Test that data is automatically saved when fields are changed"""
    
    print("=== اختبار الحفظ التلقائي ===")
    
    # Test 1: Check if files exist and are initially empty
    print("\n1. التحقق من وجود الملفات النصية:")
    files_to_check = [
        "c2pa_data/1_ai_generated.txt",
        "c2pa_data/2_ai_edited.txt",
        "c2pa_data/3_digital_creation.txt",
        "c2pa_data/4_digital_capture.txt",
        "c2pa_data/5_composite.txt",
        "c2pa_data/6_human_edited.txt"
    ]
    
    for file_path in files_to_check:
        if os.path.exists(file_path):
            print(f"✓ {file_path} موجود")
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                if content.strip():
                    print(f"  - يحتوي على: {repr(content[:50])}")
                else:
                    print(f"  - فارغ")
        else:
            print(f"✗ {file_path} غير موجود")
    
    # Test 2: Monitor file changes
    print("\n2. مراقبة التغييرات في الملفات:")
    print("افتح الواجهة الرسومية وقم بتغيير الحقول للتحقق من الحفظ التلقائي")
    
    # Get initial modification times
    initial_times = {}
    for file_path in files_to_check:
        if os.path.exists(file_path):
            initial_times[file_path] = os.path.getmtime(file_path)
    
    print("الأوقات الأولية للملفات:")
    for file_path, mtime in initial_times.items():
        print(f"  {file_path}: {time.ctime(mtime)}")
    
    # Wait for user to test
    input("\nاضغط Enter بعد اختبار الحفظ التلقائي...")
    
    # Check for changes
    print("\n3. التحقق من التغييرات:")
    changed_files = []
    for file_path in files_to_check:
        if os.path.exists(file_path):
            current_mtime = os.path.getmtime(file_path)
            if current_mtime > initial_times.get(file_path, 0):
                changed_files.append(file_path)
                print(f"✓ {file_path} تم تعديله")
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    print(f"  - المحتوى الجديد: {repr(content[:100])}")
            else:
                print(f"- {file_path} لم يتم تعديله")
    
    if changed_files:
        print(f"\n✓ تم تعديل {len(changed_files)} ملفات - الحفظ التلقائي يعمل!")
    else:
        print("\n✗ لم يتم تعديل أي ملفات - قد تكون هناك مشكلة في الحفظ التلقائي")
    
    print("\n=== انتهاء الاختبار ===")

if __name__ == "__main__":
    test_auto_save_functionality()
