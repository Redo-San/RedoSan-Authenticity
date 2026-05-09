#!/usr/bin/env python3
"""
Debug script to find the root cause of static text issue
"""
import os

def debug_root_cause():
    """Debug the root cause of why text is static across all content types"""
    
    print("=== تشخيص السبب الجذري لمشكلة النص الثابت ===")
    
    # Check current file contents
    files_to_check = [
        "c2pa_data/1_ai_generated.txt",
        "c2pa_data/2_ai_edited.txt",
        "c2pa_data/3_digital_creation.txt",
        "c2pa_data/4_digital_capture.txt",
        "c2pa_data/5_composite.txt",
        "c2pa_data/6_human_edited.txt"
    ]
    
    print("\n1. التحقق من محتويات الملفات الحالية:")
    for file_path in files_to_check:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                print(f"\n{file_path}:")
                if content:
                    lines = content.split('\n')
                    for line in lines[:2]:  # Show first 2 lines
                        if ':' in line:
                            field, value = line.split(':', 1)
                            print(f"  {field.strip()}: {repr(value.strip())}")
                else:
                    print("  (فارغ)")
        else:
            print(f"\n{file_path}: غير موجود")
    
    print("\n2. المشكلة المحتملة:")
    print("- قد يكون هناك مشكلة في دالة _c2pa_content_type_change")
    print("- قد لا يتم تحميل البيانات الصحيحة عند التبديل")
    print("- قد يتم حفظ البيانات في ملف خاطئ")
    
    print("\n3. الحل المقترح:")
    print("إضافة debug prints في دالة _c2pa_content_type_change")
    print("لتحديد ما يحدث بالضبط عند التبديل بين الأنواع")
    
    print("\n4. الخطوات التالية:")
    print("1. إضافة debug prints في _c2pa_content_type_change")
    print("2. إضافة debug prints في _save_current_content_data")
    print("3. إضافة debug prints في _load_content_data")
    print("4. تشغيل الواجهة ومراقبة المخرجات")

if __name__ == "__main__":
    debug_root_cause()
