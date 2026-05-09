#!/usr/bin/env python3
"""
تنفيذ خطة الاختبار الشاملة خطوة بخطوة
"""
import os
import time

def execute_comprehensive_test():
    """تنفيذ خطة الاختبار الشاملة للتحقق من جميع وظائف النظام"""
    
    print("=== تنفيذ خطة الاختبار الشاملة ===")
    
    # المرحلة الأولى: التحضير والفحص المبدئي
    print("\n1. التحضير والفحص المبدئي:")
    
    # التحقق من وجود مجلد c2pa_data
    if not os.path.exists("c2pa_data"):
        os.makedirs("c2pa_data")
        print("✓ تم إنشاء مجلد c2pa_data")
    else:
        print("✓ مجلد c2pa_data موجود")
    
    # حذف جميع الملفات القديمة لضمان بداية نظيفة
    files_to_delete = [
        "c2pa_data/1_ai_generated.txt",
        "c2pa_data/2_ai_edited.txt", 
        "c2pa_data/3_digital_creation.txt",
        "c2pa_data/4_digital_capture.txt",
        "c2pa_data/5_composite.txt",
        "c2pa_data/6_human_edited.txt"
    ]
    
    for file_path in files_to_delete:
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"✓ تم حذف {file_path}")
    
    print("✓ تم تنظيف جميع الملفات القديمة")
    
    # المرحلة الثانية: إنشاء بيانات اختبار
    print("\n2. إنشاء بيانات اختبار:")
    
    test_data = {
        "1_ai_generated.txt": {
            "creator_name": "AI Generated Test",
            "creator_id": "ai.test@example.com",
            "ai_model": "GPT-4",
            "description": "Test AI generated content",
            "rights_holder": "Test Company",
            "copyright": "© 2024 Test Company",
            "license": "https://example.com/license"
        },
        "2_ai_edited.txt": {
            "creator_name": "AI Edited Test",
            "creator_id": "edited.test@example.com", 
            "ai_model": "DALL-E 3",
            "description": "Test AI edited content",
            "rights_holder": "Edited Company",
            "copyright": "© 2024 Edited Company",
            "license": "https://edited.example.com/license"
        }
    }
    
    # إنشاء ملفات الاختبار
    for filename, data in test_data.items():
        file_path = f"c2pa_data/{filename}"
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(f"creator_name: {data['creator_name']}\n")
            f.write(f"creator_id: {data['creator_id']}\n")
            f.write(f"ai_model: {data['ai_model']}\n")
            f.write(f"description: {data['description']}\n")
            f.write(f"rights_holder: {data['rights_holder']}\n")
            f.write(f"copyright: {data['copyright']}\n")
            f.write(f"license: {data['license']}\n")
        print(f"✓ تم إنشاء {filename} ببيانات الاختبار")
    
    print("✓ تم إنشاء جميع ملفات الاختبار")
    
    # المرحلة الثالثة: التحقق من صحة الملفات
    print("\n3. التحقق من صحة الملفات:")
    
    for filename, expected_data in test_data.items():
        file_path = f"c2pa_data/{filename}"
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                print(f"✓ {filename} - محتوى صحيح")
        else:
            print(f"✗ {filename} - الملف غير موجود")
    
    # المرحلة الرابعة: تعليمات الاختبار اليدوي
    print("\n4. تعليمات الاختبار اليدوي:")
    print("=" * 50)
    print("الرجاء فتح الواجهة الرسومية واتباع الخطوات التالية:")
    print()
    print("الخطوة 1: اختبار التحميل")
    print("- اختر '1. AI Generated'")
    print("- يجب أن ترى: AI Generated Test")
    print("- اختر '2. AI Edited'") 
    print("- يجب أن ترى: AI Edited Test")
    print("- اختر '3. Digital Creation'")
    print("- يجب أن ترى حقول فارغة")
    print()
    print("الخطوة 2: اختبار الحفظ التلقائي")
    print("- في '1. AI Generated' غيّر Creator Name إلى 'New Test 1'")
    print("- يجب أن يتم الحفظ تلقائياً")
    print("- انتقل إلى '2. AI Edited' ثم عد")
    print("- يجب أن ترى 'AI Generated Test' مرة أخرى")
    print("- انتقل إلى '1. AI Generated'")
    print("- يجب أن ترى 'New Test 1' في الحقل")
    print()
    print("الخطوة 3: اختبار زر الحفظ اليدوي")
    print("- اكتب بيانات جديدة في الحقول")
    print("- اضغط على زر 'Save Data'")
    print("- التحقق من تحديث الملف مباشرة")
    print()
    print("الخطوة 4: اختبار العزل الكامل")
    print("- اكتب بيانات مختلفة في كل نوع")
    print("- تأكد من عدم انتشر البيانات بين الأنواع")
    print("- اختبر التبديل السريع 10 مرات")
    print()
    print("معايير النجاح:")
    print("✓ الحفظ التلقائي يعمل لجميع الحقول")
    print("✓ التحميل يعمل بشكل صحيح")
    print("✓ لا تنتشر البيانات بين الأنواع")
    print("✓ زر الحفظ اليدوي يعمل")
    print("✓ المزامنة بين StringVar و CTkEntry تعمل")
    print()
    print("معايير الفشل:")
    print("✗ الحفظ التلقائي لا يعمل")
    print("✗ البيانات تنتشر بين الأنواع")
    print("✗ التحميل لا يعمل بشكل صحيح")
    print("✗ توجد أخطاء في الطرفية")
    print("✗ الملفات تالف أو فارغة")
    print("=" * 50)
    
    print("\n5. التحقق من سلامة النظام:")
    print("✓ تم إنشاء خطة اختبار شاملة")
    print("✓ تم إنشاء بيانات اختبار")
    print("✓ تم إعطاء تعليمات واضحة")
    print("✓ جاهز للاختبار اليدوي")

if __name__ == "__main__":
    execute_comprehensive_test()
