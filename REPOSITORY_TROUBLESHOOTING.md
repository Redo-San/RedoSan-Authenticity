# 🔧 Repository Troubleshooting Guide

## 🚨 **المشكلة: المستودع غير موجود أو محذوف**

### 📋 **الأسباب المحتملة:**
1. **المستودع لم يتم إنشاؤه بعد**
2. **المستودع تم حذفه**
3. **خطأ في اسم المستودع**
4. **مشكلة في الصلاحيات**
5. **المستودع خاص وليس عام**

---

## 🔍 **خطوات التشخيص:**

### 1. **التحقق من وجود المستودع**
```bash
# باستخدام GitHub CLI
gh repo view YOUR_USERNAME/RedoSan-Authenticity

# أو عبر المتصفح
# اذهب إلى: https://github.com/YOUR_USERNAME/RedoSan-Authenticity
```

### 2. **التحقق من المستودعات الموجودة**
```bash
# قائمة المستودعات
gh repo list

# أو عبر المتصفح
# اذهب إلى: https://github.com/YOUR_USERNAME?tab=repositories
```

### 3. **التحقق من الصلاحيات**
```bash
# التحقق من الصلاحيات الحالية
gh auth status
```

---

## 🛠️ **الحلول:**

### **الحل 1: إنشاء مستودع جديد**
```bash
# إنشاء مستودع جديد
gh repo create RedoSan-Authenticity --public --description "Steganography + OpenTimestamps + C2PA"

# أو عبر الواجهة:
# 1. اذهب إلى github.com
# 2. اضغط "+" → "New repository"
# 3. الاسم: RedoSan-Authenticity
# 4. الوصف: Steganography + OpenTimestamps + C2PA
# 5. اجعله Public
# 6. اضغط "Create repository"
```

### **الحل 2: ربط المجلد بالمستودع**
```bash
# في مجلد المشروع
git init
git add .
git commit -m "Initial commit - Beta Release v1.0.0"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/RedoSan-Authenticity.git
git push -u origin main
```

### **الحل 3: التحقق من اسم المستخدم**
```bash
# عرض اسم المستخدم الحالي
gh api user --jq '.login'

# أو عبر GitHub CLI
gh auth status
```

### **الحل 4: استخدام Token صحيح**
```bash
# إنشاء Token جديد
# 1. اذهب إلى GitHub → Settings → Developer settings → Personal access tokens
# 2. Tokens (classic) → Generate new token
# 3. الاسم: RedoSan Publishing
# 4. اختر: repo, write:repo
# 5. اضغط "Generate token"
# 6. انسخ واحفظ Token

# استخدام Token
git remote set-url origin https://YOUR_USERNAME:YOUR_TOKEN@github.com/YOUR_USERNAME/RedoSan-Authenticity.git
```

---

## 🔐 **مشاكل المصادقة:**

### **مشكلة: Authentication failed**
```bash
# الحل: إعادة تعيين remote URL
git remote set-url origin https://YOUR_USERNAME:YOUR_TOKEN@github.com/YOUR_USERNAME/RedoSan-Authenticity.git

# التحقق من Token
gh auth login --with-token
```

### **مشكلة: Permission denied**
```bash
# الحل: التحقق من صلاحيات Token
# يجب أن يحتوي على: repo, write:repo

# إعادة تسجيل الدخول
gh auth logout
gh auth login
```

---

## 📂 **مشاكل الملفات:**

### **مشكلة: الملفات لا تظهر**
```bash
# التحقق من حالة Git
git status

# إضافة الملفات
git add .
git commit -m "Add project files"
git push origin main
```

### **مشكلة: مجلد c2pa_data فارغ**
```bash
# إنشاء ملف .gitkeep
touch c2pa_data/.gitkeep
git add c2pa_data/.gitkeep
git commit -m "Add .gitkeep to c2pa_data"
git push origin main
```

---

## 🔄 **استعادة المستودع:**

### **إذا تم حذف المستودع:**
1. **إنشاء مستودع جديد بنفس الاسم**
2. **رفع الملفات مرة أخرى**
3. **استعادة الإصدارات (Releases)**

### **إذا كان المستودع خاص:**
1. **اذهب إلى Settings**
2. **Scroll down إلى "Danger Zone"**
3. **Change repository visibility**
4. **اجعله Public**

---

## 📞 **المساعدة:**

### **الأوامر المفيدة:**
```bash
# عرض المستودعات
gh repo list

# عرض معلومات المستودع
gh repo view YOUR_USERNAME/RedoSan-Authenticity

# إنشاء مستودع جديد
gh repo create RedoSan-Authenticity --public

# عرض الصلاحيات
gh auth status

# تسجيل الخروج والدخول
gh auth logout
gh auth login
```

### **روابط المساعدة:**
- [GitHub Documentation](https://docs.github.com)
- [GitHub CLI Documentation](https://cli.github.com/)
- [Git Documentation](https://git-scm.com/doc)

---

## ✅ **قائمة التحقق النهائية:**

- [ ] المستودع موجود ويمكن الوصول إليه
- [ ] اسم المستخدم صحيح
- [ ] صلاحيات Token صحيحة
- [ ] الملفات مرفوعة بشكل صحيح
- [ ] المستودع عام (Public)
- [ ] Remote URL صحيح

---

## 🎯 **الخطة:**

1. **التحقق من وجود المستودع**
2. **إنشاء مستودع جديد إذا لزم**
3. **رفع الملفات بشكل صحيح**
4. **التحقق من الصلاحيات**
5. **إنشاء الإصدار التجريبي**

---

**🔧 اتبع هذه الخطوات لحل مشكلة المستودع!**
