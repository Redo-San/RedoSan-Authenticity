#!/usr/bin/env python3
"""
Debug script to investigate the data saving issue
"""
import os
import time

def debug_save_issue():
    """Debug why data is not being saved properly"""
    
    print("=== تشخيص مشكلة الحفظ ===")
    
    # Check current file states
    files_to_check = [
        "c2pa_data/1_ai_generated.txt",
        "c2pa_data/2_ai_edited.txt",
        "c2pa_data/3_digital_creation.txt",
        "c2pa_data/4_digital_capture.txt",
        "c2pa_data/5_composite.txt",
        "c2pa_data/6_human_edited.txt"
    ]
    
    print("\n1. التحقق من حالة الملفات الحالية:")
    for file_path in files_to_check:
        if os.path.exists(file_path):
            mtime = os.path.getmtime(file_path)
            print(f"  {file_path}: آخر تعديل {time.ctime(mtime)}")
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    lines = content.split('\n')[:3]  # Show first 3 lines
                    for line in lines:
                        if ':' in line:
                            field, value = line.split(':', 1)
                            print(f"    {field}: {repr(value.strip())}")
                else:
                    print("    (فارغ)")
        else:
            print(f"  {file_path}: غير موجود")
    
    print("\n2. اختبار الحفظ اليدوي:")
    
    # Test manual save
    test_data = """creator_name: Manual Test
creator_id: manual://test
ai_model: Manual Model
description: Manual test description
rights_holder: Manual Rights
copyright: © 2024 Manual
license: manual://license
"""
    
    # Save to first file
    with open("c2pa_data/1_ai_generated.txt", "w", encoding="utf-8") as f:
        f.write(test_data)
    
    print("✓ تم حفظ بيانات اختبار يدوي في 1_ai_generated.txt")
    
    # Check if it was saved
    with open("c2pa_data/1_ai_generated.txt", "r", encoding="utf-8") as f:
        saved_content = f.read()
    
    if saved_content.strip() == test_data.strip():
        print("✓ الحفظ اليدوي يعمل بشكل صحيح")
    else:
        print("✗ الحفظ اليدوي به مشكلة")
    
    print("\n3. تعليمات الاختبار:")
    print("الآن افتح الواجهة الرسومية وقم بالآتي:")
    print("1. اختر '1. AI Generated' - يجب أن ترى 'Manual Test' في Creator Name")
    print("2. غيّر Creator Name إلى 'User Test 123'")
    print("3. انتقل إلى '2. AI Edited'")
    print("4. عد إلى '1. AI Generated'")
    print("5. تحقق من أن 'User Test 123' لا يزال موجود")
    print("\nإذا اختفى، فهذا يعني أن هناك مشكلة في:")
    print("- دالة الحفظ التلقائي")
    print("- دالة التحميل")
    print("- أو توقيت استدعاء هذه الدوال")

if __name__ == "__main__":
    debug_save_issue()
