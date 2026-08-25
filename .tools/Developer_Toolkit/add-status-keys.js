const fs = require("fs");

// Unique keys from the audit (deduplicated)
const KEYS = {
  "face.status.faceRegistryNotInitialized": "Face Registry not initialized.",
  "face.status.webauthnModuleNotLoaded": "WebAuthn module not loaded.",
  "face.status.photoTooLargeMaximumFileSizeIs25MB":
    "Photo too large. Maximum file size is 25 MB.",
  "face.status.faceEngineNotInitialized": "Face Engine not initialized.",
  "face.status.loadingModels": "Loading models...",
  "face.status.detectingFaces": "Detecting faces...",
  "face.status.noFaceDetectedInTheImage": "No face detected in the image.",
  "face.status.generatingDIDKeypair": "Generating DID keypair...",
  "face.status.signingFaceDescriptorWithDID":
    "Signing face descriptor with DID...",
  "face.status.generatingPrivacyIdentifierBiohash":
    "Generating Privacy Identifier (BioHash)...",
  "face.status.generatingFuzzyIdentifier": "Generating Fuzzy identifier...",
  "face.status.verifyingPasskey": "Verifying passkey...",
  "face.status.checkingRegisteredFaces": "Checking registered faces...",
  "face.status.doneAllIdentifiersGenerated":
    "Done. All identifiers generated.",
  "face.status.faceCameraModuleNotLoaded": "Face Camera module not loaded.",
  "face.status.cameraElementNotFound": "Camera element not found.",
  "face.status.startingCamera": "Starting camera...",
  "face.status.cameraStopped": "Camera stopped.",
  "face.status.cameraNotRunningStartTheCameraFirst":
    "Camera not running. Start the camera first.",
  "face.status.faceLivenessModuleNotLoaded":
    "Face Liveness module not loaded.",
  "face.status.capturingFrame": "Capturing frame...",
  "face.status.couldNotCaptureAFrame": "Could not capture a frame.",
  "face.status.generateAPrivacyIdFirstRunThePipeline":
    "Generate a Privacy ID first (run the pipeline).",
  "face.status.privacyIdCopiedToClipboard":
    "Privacy ID copied to clipboard.",
  "face.status.copyFailedSelectTheIDTextManually":
    "Copy failed. Select the ID text manually.",
  "face.status.privacyIdReadyToCopy": "Privacy ID ready to copy.",
};

// AR translations
const AR = {
  "face.status.faceRegistryNotInitialized": "سجل الوجوه غير مهيأ.",
  "face.status.webauthnModuleNotLoaded": "وحدة WebAuthn غير محمّلة.",
  "face.status.photoTooLargeMaximumFileSizeIs25MB":
    "الصورة كبيرة جدًا. الحد الأقصى لحجم الملف 25 ميغابايت.",
  "face.status.faceEngineNotInitialized": "محرك الوجه غير مهيأ.",
  "face.status.loadingModels": "جارٍ تحميل النماذج...",
  "face.status.detectingFaces": "جارٍ اكتشاف الوجوه...",
  "face.status.noFaceDetectedInTheImage": "لم يُكتشف وجه في الصورة.",
  "face.status.generatingDIDKeypair": "جارٍ توليد زوج مفاتيح DID...",
  "face.status.signingFaceDescriptorWithDID":
    "جارٍ توقيع وصف الوجه بـ DID...",
  "face.status.generatingPrivacyIdentifierBiohash":
    "جارٍ توليد معرّف الخصوصية (BioHash)...",
  "face.status.generatingFuzzyIdentifier": "جارٍ توليد المعرف الضبابي...",
  "face.status.verifyingPasskey": "جارٍ التحقق من passkey...",
  "face.status.checkingRegisteredFaces": "جارٍ فحص الوجوه المسجلة...",
  "face.status.doneAllIdentifiersGenerated": "تم توليد جميع المعرفات.",
  "face.status.faceCameraModuleNotLoaded": "وحدة الكاميرا غير محمّلة.",
  "face.status.cameraElementNotFound": "عنصر الكاميرا غير موجود.",
  "face.status.startingCamera": "جارٍ تشغيل الكاميرا...",
  "face.status.cameraStopped": "توقفت الكاميرا.",
  "face.status.cameraNotRunningStartTheCameraFirst":
    "الكاميرا لا تعمل. شغّلها أولًا.",
  "face.status.faceLivenessModuleNotLoaded": "وحدة الحيوية غير محمّلة.",
  "face.status.capturingFrame": "جارٍ التقاط الإطار...",
  "face.status.couldNotCaptureAFrame": "تعذر التقاط إطار.",
  "face.status.generateAPrivacyIdFirstRunThePipeline":
    "ولّد معرّف الخصوصية أولًا (شغّل المسار).",
  "face.status.privacyIdCopiedToClipboard":
    "نُسخ معرّف الخصوصية إلى الحافظة.",
  "face.status.copyFailedSelectTheIDTextManually":
    "فشل النسخ. حدد نص المعرّف يدويًا.",
  "face.status.privacyIdReadyToCopy": "معرّف الخصوصية جاهز للنسخ.",
};

// Add to EN file
let en = fs.readFileSync("Style/lang/i18n-data-en.js", "utf8");
let enCount = 0;
for (const [key, val] of Object.entries(KEYS)) {
  if (!en.includes(`"${key}"`)) {
    en = en.replace(
      /^(};)/m,
      `  "${key}": "${val.replace(/"/g, '\\"')}",\n$1`
    );
    enCount++;
  }
}
fs.writeFileSync("Style/lang/i18n-data-en.js", en, "utf8");
console.log(`EN: added ${enCount} new keys`);

// Add to AR file
let arFile = fs.readFileSync("Style/lang/i18n-data-ar.js", "utf8");
let arCount = 0;
for (const [key, val] of Object.entries(AR)) {
  if (!arFile.includes(`"${key}"`)) {
    arFile = arFile.replace(
      /^(};)/m,
      `  "${key}": "${val.replace(/"/g, '\\"')}",\n$1`
    );
    arCount++;
  }
}
fs.writeFileSync("Style/lang/i18n-data-ar.js", arFile, "utf8");
console.log(`AR: added ${arCount} new keys`);
