# 🚀 Manual GitHub Publishing Guide

## 🎯 **النشر اليدوي للمشروع في حساب Redo-San**

### 📋 **المتطلبات:**
- حساب GitHub: Redo-San
- Git مثبت على الجهاز
- مجلد المشروع جاهز

---

## 🔧 **الخطوات التفصيلية:**

### **الخطوة 1: تثبيت GitHub CLI**
```bash
# تحميل GitHub CLI
# اذهب إلى: https://cli.github.com/
# حمل وتثبيت للويندوز
```

### **الخطوة 2: تسجيل الدخول**
```bash
# افتح Git Bash أو PowerShell
gh auth login

# اختر:
# 1. GitHub.com
# 2. HTTPS
# 3. Paste token
# 4. اذهب إلى GitHub → Settings → Developer settings → Personal access tokens
# 5. Generate new token
# 6. اختر: repo, write:repo
# 7. انسخ Token والصقه هنا
```

### **الخطوة 3: تهيئة المستودع**
```bash
# في مجلد المشروع
cd "f:\RedoSan Authenticity"

# تهيئة Git
git init

# إضافة الملفات
git add .

# أول commit
git commit -m "Initial commit - Beta Release v1.0.0"

# تعيين الفرع الرئيسي
git branch -M main
```

### **الخطوة 4: إنشاء المستودع على GitHub**
```bash
# إنشاء مستودع جديد
gh repo create RedoSan-Authenticity --public --description "Steganography + OpenTimestamps + C2PA"
```

### **الخطوة 5: ربط المستودع**
```bash
# ربط بالمستودع البعيد
git remote add origin https://github.com/Redo-San/RedoSan-Authenticity.git
```

### **الخطوة 6: رفع الملفات**
```bash
# رفع إلى GitHub
git push -u origin main
```

### **الخطوة 7: إنشاء الإصدار التجريبي**
```bash
# إنشاء tag
git tag -a v1.0.0-beta -m "Beta Release v1.0.0"

# رفع الـ tag
git push origin v1.0.0-beta

# إنشاء release
gh release create v1.0.0-beta --title "Beta Release v1.0.0" --notes "Beta Release of RedoSan Authenticity with enhanced data persistence system."
```

### **الخطوة 8: إنشاء ملفات التنزيل**
```bash
# إنشاء ملف ZIP
git archive --format zip --output RedoSan_Authenticity_v1.0.0-beta.zip main

# إنشاء ملف TAR.GZ
git archive --format tar.gz --output RedoSan_Authenticity_v1.0.0-beta.tar.gz main

# رفع الملفات
gh release upload v1.0.0-beta RedoSan_Authenticity_v1.0.0-beta.zip
gh release upload v1.0.0-beta RedoSan_Authenticity_v1.0.0-beta.tar.gz
```

---

## 🔍 **التحقق من النشر:**

### **التحقق من المستودع:**
```bash
# عرض معلومات المستودع
gh repo view Redo-San/RedoSan-Authenticity
```

### **التحقق عبر المتصفح:**
- المستودع: https://github.com/Redo-San/RedoSan-Authenticity
- الإصدار: https://github.com/Redo-San/RedoSan-Authenticity/releases/tag/v1.0.0-beta
- التنزيل: https://github.com/Redo-San/RedoSan-Authenticity/releases

---

## 🚨 **مشاكل شائعة وحلولها:**

### **مشكلة: gh auth login فشل**
```bash
# الحل: استخدام token صحيح
# 1. اذهب إلى GitHub → Settings → Developer settings → Personal access tokens
# 2. Tokens (classic) → Generate new token
# 3. الاسم: RedoSan Publishing
# 4. اختر: repo, write:repo
# 5. اضغط Generate token
# 6. انسخ Token فوراً (لن يظهر مرة أخرى)
```

### **مشكلة: git push فشل**
```bash
# الحل: التحقق من remote URL
git remote -v

# إذا خاطئ، قم بتعديله
git remote set-url origin https://github.com/Redo-San/RedoSan-Authenticity.git
```

### **مشكلة: المستودع موجود بالفعل**
```bash
# الحل: استخدام المستودع الموجود
gh repo view Redo-San/RedoSan-Authenticity

# إذا لم يكن موجوداً، قم بإنشائه
gh repo create RedoSan-Authenticity --public --description "Steganography + OpenTimestamps + C2PA"
```

---

## 📋 **قائمة التحقق النهائية:**

- [ ] GitHub CLI مثبت ومسجل الدخول
- [ ] Git مهيأ في مجلد المشروع
- [ ] المستودع منشور على GitHub
- [ ] الملفات مرفوعة بنجاح
- [ ] الإصدار التجريبي منشور
- [ ] ملفات التنزيل متاحة
- [ ] الروابط تعمل بشكل صحيح

---

## 🎉 **النتيجة المتوقعة:**

بعد إكمال هذه الخطوات، سيكون لديك:
- مستودع عام على GitHub
- إصدار تجريبي v1.0.0-beta
- ملفات تنزيل (ZIP و TAR.GZ)
- روابط للمشاركة مع المجتمع
- إعداد للمساهمات المستقبلية

---

## 📞 **المساعدة:**

### **روابط مفيدة:**
- [GitHub Documentation](https://docs.github.com)
- [GitHub CLI Documentation](https://cli.github.com/)
- [Git Documentation](https://git-scm.com/doc)

### **أوامر سريعة:**
```bash
# عرض المستودعات
gh repo list

# عرض الإصدارات
gh release list

# عرض المستخدم الحالي
gh api user --jq '.login'
```

---

**🚀 اتبع هذه الخطوات بدقة لنجاح النشر!**
