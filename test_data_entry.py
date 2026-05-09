#!/usr/bin/env python3
"""
Test script to simulate data entry and verify automatic saving
"""
import os
import time

def write_test_data():
    """Write test data to verify automatic saving"""
    
    print("=== كتابة بيانات اختبار للتحقق من الحفظ التلقائي ===")
    
    # Write test data to AI Generated file
    test_data = """creator_name: Test Creator
creator_id: https://example.com/test
ai_model: GPT-4 Test Model
description: This is a test description for automatic saving
rights_holder: Test Rights Holder
copyright: © 2024 Test Copyright
license: https://example.com/license
"""
    
    with open("c2pa_data/1_ai_generated.txt", "w", encoding="utf-8") as f:
        f.write(test_data)
    
    print("✓ تم كتابة بيانات اختبار في ملف 1_ai_generated.txt")
    
    # Write different data to AI Edited file
    test_data2 = """creator_name: Edited Test Creator
creator_id: https://edited.example.com/test
ai_model: Claude-3 Test Model
description: This is an edited test description
rights_holder: Edited Rights Holder
copyright: © 2024 Edited Copyright
license: https://edited.example.com/license
"""
    
    with open("c2pa_data/2_ai_edited.txt", "w", encoding="utf-8") as f:
        f.write(test_data2)
    
    print("✓ تم كتابة بيانات اختبار في ملف 2_ai_edited.txt")
    
    print("\nالآن افتح الواجهة الرسومية وتحقق من:")
    print("1. عند اختيار '1. AI Generated' يجب أن ترى البيانات الأولى")
    print("2. عند اختيار '2. AI Edited' يجب أن ترى البيانات الثانية")
    print("3. عند تغيير أي حقل يجب أن يتم الحفظ تلقائياً")

if __name__ == "__main__":
    write_test_data()
