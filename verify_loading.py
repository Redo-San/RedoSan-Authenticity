#!/usr/bin/env python3
"""
Verify that data loading works correctly by checking the GUI
"""
import os

def verify_data_structure():
    """Verify the data files have the correct structure"""
    
    print("=== التحقق من بنية البيانات ===")
    
    files_to_check = [
        "c2pa_data/1_ai_generated.txt",
        "c2pa_data/2_ai_edited.txt",
        "c2pa_data/3_digital_creation.txt",
        "c2pa_data/4_digital_capture.txt",
        "c2pa_data/5_composite.txt",
        "c2pa_data/6_human_edited.txt"
    ]
    
    expected_fields = [
        "creator_name:",
        "creator_id:",
        "ai_model:",
        "description:",
        "rights_holder:",
        "copyright:",
        "license:"
    ]
    
    all_correct = True
    
    for file_path in files_to_check:
        print(f"\n{file_path}:")
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = [line.strip() for line in content.split('\n') if line.strip()]
                
                # Check if all expected fields are present
                missing_fields = []
                for field in expected_fields:
                    if not any(line.startswith(field) for line in lines):
                        missing_fields.append(field)
                
                if missing_fields:
                    print(f"  ✗ حقول مفقودة: {missing_fields}")
                    all_correct = False
                else:
                    print(f"  ✓ جميع الحقول موجودة")
                
                # Show actual content
                for line in lines:
                    if ':' in line:
                        field, value = line.split(':', 1)
                        print(f"    {field.strip()}: {value.strip()}")
        else:
            print(f"  ✗ الملف غير موجود")
            all_correct = False
    
    if all_correct:
        print("\n✓ جميع الملفات لها البية الصحيحة")
    else:
        print("\n✗ بعض الملفات بها مشاكل في البية")
    
    print("\n=== تعليمات الاختبار ===")
    print("1. افتح الواجهة الرسومية")
    print("2. اختر '1. AI Generated' - يجب أن ترى 'Test Creator' في حقل Creator Name")
    print("3. اختر '2. AI Edited' - يجب أن ترى 'Edited Test Creator' في حقل Creator Name")
    print("4. اختر '4. Digital Capture' - يجب أن ترى 'test 1' في جميع الحقول")
    print("5. اختر '3. Digital Creation' - يجب أن تكون جميع الحقول فارغة")
    print("6. قم بتغيير أي حقل وتحقق من الحفظ التلقائي")

if __name__ == "__main__":
    verify_data_structure()
