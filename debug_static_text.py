#!/usr/bin/env python3
"""
Debug script to investigate why text is static in all fields
"""
import os

def debug_static_text():
    """Debug why text appears static in all fields"""
    
    print("=== تشخيص مشكلة النص الثابت في كل الحقول ===")
    
    # Check current file contents
    files_to_check = [
        "c2pa_data/1_ai_generated.txt",
        "c2pa_data/2_ai_edited.txt",
        "c2pa_data/3_digital_creation.txt",
        "c2pa_data/4_digital_capture.txt",
        "c2pa_data/5_composite.txt",
        "c2pa_data/6_human_edited.txt"
    ]
    
    print("\n1. التحقق من محتويات الملفات:")
    for file_path in files_to_check:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                print(f"\n{file_path}:")
                if content:
                    lines = content.split('\n')
                    for line in lines[:3]:  # Show first 3 lines
                        if ':' in line:
                            field, value = line.split(':', 1)
                            print(f"  {field.strip()}: {repr(value.strip())}")
                else:
                    print("  (فارغ)")
        else:
            print(f"\n{file_path}: غير موجود")
    
    print("\n2. المشكلة المحتملة:")
    print("- قد يكون هناك مشكلة في KeyRelease event binding")
    print("- قد يتم حفظ نفس البيانات في جميع الملفات")
    print("- قد يكون هناك مشكلة في تحديد نوع المحتوى الحالي")
    
    print("\n3. الحل المقترح:")
    print("استخدام FocusOut event بدلاً من KeyRelease")
    print("FocusOut يتم تشغيله عندما يغادر المستخدم الحقل")
    print("هذا أكثر كفاءة وموثوقية من KeyRelease")
    
    print("\n4. تعليمات الاختبار:")
    print("1. تحقق من محتويات الملفات أعلاه")
    print("2. إذا كانت جميع الملفات تحتوي على نفس البيانات، فهذا هو المشكلة")
    print("3. سنقوم بتغيير طريقة الحفظ إلى FocusOut event")

if __name__ == "__main__":
    debug_static_text()
