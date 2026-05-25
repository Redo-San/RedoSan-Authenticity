(function(){if(typeof window!='undefined'&&window.location&&window.location.protocol!=='file:'&&!/^https?:\/\/(.*\.)?(redo-san\.github\.io|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(window.location.href))throw new Error('RedoSan Authenticity: This script is protected by GPL license.')})();

var ASSISTANT_KB = [
  { id:'welcome', patterns:['hi','hello','hey','helo','helloo','مرحبا','مرحبًا','مرحبا بك','السلام عليكم','وعليكم السلام','السلامو عليكم','هلا','اهلا','hi there','good morning','good evening','good day','gud morning','morning','evening','howdy','yo','sup'],
    contexts:[], response:{ en:'👋 Hello! I\'m your RedoSan Assistant. I can help you with all the tools here.\n\nTry asking me:\n• How does watermarking work?\n• What is file fingerprinting?\n• How to create a timestamp?\n• Privacy & security\n\nWhat would you like to know?',
    ar:'👋 مرحباً! أنا مساعد RedoSan. يمكنني مساعدتك في جميع الأدوات هنا.\n\nجرب أن تسألني:\n• كيف تعمل العلامة المائية؟\n• ما هي بصمة الملف؟\n• كيف ينشئ الطابع الزمني؟\n• الخصوصية والأمان\n\nماذا تريد أن تعرف؟' },
    suggestions:{ en:['How does watermarking work?','What is fingerprinting?','How to timestamp?'], ar:['كيف تعمل العلامة المائية؟','ما هي البصمة الرقمية؟','كيف ينشئ الطابع الزمني؟']}},

  { id:'thanks', patterns:['thanks','thank you','thankyou','شكرا','شكراً','شكرا جزيلا','جزاك الله خيرا','thx','thank','appreciate','much appreciated','my gratitude','tq','merci','danke'],
    contexts:[], response:{ en:'You\'re welcome! 😊 Let me know if you need anything else.',
    ar:'العفو! 😊 أخبرني إذا احتجت أي شيء آخر.' },
    suggestions:{ en:['How does watermarking work?','Privacy & Security','What is C2PA?'], ar:['كيف تعمل العلامة المائية؟','الخصوصية والأمان','ما هو C2PA؟']}},

  { id:'privacy', patterns:['privacy','security','safe','secure','upload','server','private','data stored','is it safe','your privacy','local','browser','data protection','is my data safe','do you store','end to end','encrypt','خصوصية','أمان','آمن','خادم','مرفوع','هل البيانات آمنة','هل موقعك آمن','الخصوصية'],
    contexts:[], response:{ en:'🔒 **Your files never leave your device.**\n\nAll processing happens 100% in your browser using JavaScript. No files, metadata, or any other data are transmitted to any server.\n\nWe load some libraries from CDNs (for PDF/DOCX export), but your file data is never shared with them.\n\nThe source code is open-source on GitHub — you can audit it yourself.',
    ar:'🔒 **ملفاتك لا تغادر جهازك أبداً.**\n\nجميع المعالجة تتم 100% في متصفحك باستخدام JavaScript. لا يتم إرسال أي ملفات أو بيانات وصفية أو أي بيانات أخرى إلى أي خادم.\n\nنقوم بتحميل بعض المكتبات من CDNs (لتصدير PDF/DOCX)، لكن بيانات ملفاتك لا تتم مشاركتها معهم أبداً.\n\nالكود المصدري مفتوح على GitHub — يمكنك مراجعته بنفسك.' },
    suggestions:{ en:['How does watermarking work?','What is OpenTimestamps?','What is C2PA?'], ar:['كيف تعمل العلامة المائية؟','ما هو OpenTimestamps؟','ما هو C2PA؟']}},

  { id:'whatisthis', patterns:['what is this','what does this tool do','what can you do','what is redosan','about this tool','what is authenticity','ما هذه الأداة','ما هو ريدوسان','ماذا تفعل هذه الأداة'],
    contexts:[], response:{ en:'**RedoSan Authenticity** is a free, open-source digital authenticity toolkit that runs entirely in your browser.\n\nIt provides 8 tools:\n💧 **Digital Watermark** — 9 algorithms (LSB, DCT, DWT)\n🔬 **Pixel Injection** — 20+ algorithms\n🔍 **Fingerprint** — SHA-256, BLAKE3, perceptual hashes\n📋 **Metadata** — EXIF reader\n🕒 **Timestamp** — OpenTimestamps\n✨ **C2PA** — Content provenance\n📜 **Digital Passport** — Signed certificates\n🔄 **File Converter** — Image/audio/video conversion\n\nAll 100% client-side, nothing uploaded.',
    ar:'**RedoSan Authenticity** هي أداة أصالة رقمية مجانية ومفتوحة المصدر تعمل بالكامل في متصفحك.\n\nتوفر 8 أدوات:\n💧 **العلامة المائية الرقمية** — 9 خوارزميات (LSB, DCT, DWT)\n🔬 **حقن البكسل** — 20+ خوارزمية\n🔍 **البصمة الرقمية** — SHA-256, BLAKE3\n📋 **البيانات الوصفية** — قارئ EXIF\n🕒 **الطابع الزمني** — OpenTimestamps\n✨ **C2PA** — مصدر المحتوى\n📜 **جواز السفر الرقمي** — شهادات موقعة\n🔄 **محول الملفات** — تحويل الصور/الصوت/الفيديو\n\nكلها 100% على جهازك، لا شيء يُرفع.' },
    suggestions:{ en:['How does watermarking work?','What is fingerprinting?','Privacy & Security'], ar:['كيف تعمل العلامة المائية؟','ما هي البصمة الرقمية؟','الخصوصية والأمان']}},

  { id:'watermark_what', patterns:['what is watermark','how does watermark work','watermarking explained','digital watermark','what is digital watermark','ما هي العلامة المائية','كيف تعمل العلامة المائية','شرح العلامة المائية'],
    contexts:['watermark','home'], response:{ en:'**Digital watermarking** embeds invisible data into images without visibly altering them.\n\nIt works by making tiny modifications to the image pixels that are imperceptible to the human eye but can be detected by software.\n\nRedoSan offers 9 algorithms:\n1. Spatial LSB — simplest, modifies least significant bits\n2. Frequency DCT — works in frequency domain\n3. Neural SS — neural network style\n4. Latent DCT — advanced frequency\n5. Zero-bit — detects presence only\n6. Multi-bit — embeds multiple bits\n7. Forensic — for forensic analysis\n8. Fragile — breaks if modified\n9. Imatag-style — inspired by Imatag\n\nAll algorithms require a password, and most require a secret file to hide.',
    ar:'**العلامة المائية الرقمية** تخفي بيانات غير مرئية داخل الصور دون تغييرها بشكل مرئي.\n\nتعمل عن طريق إجراء تعديلات دقيقة على بكسلات الصورة غير محسوسة للعين البشرية ولكن يمكن اكتشافها بواسطة البرامج.\n\nيقدم RedoSan 9 خوارزميات:\n1. Spatial LSB — الأبسط، يعدل البتات الأقل أهمية\n2. Frequency DCT — يعمل في مجال التردد\n3. Neural SS — نمط الشبكة العصبية\n4. Latent DCT — تردد متقدم\n5. Zero-bit — يكشف الوجود فقط\n6. Multi-bit — يخفي بتات متعددة\n7. Forensic — للتحليل الجنائي\n8. Fragile — ينكسر إذا تعدل\n9. Imatag-style — مستوحى من Imatag\n\nجميع الخوارزميات تتطلب كلمة مرور، ومعظمها يتطلب ملف سري للإخفاء.' },
    suggestions:{ en:['How to embed watermark?','How to extract watermark?','Supported formats'], ar:['كيفية تضمين العلامة المائية؟','كيفية استخراج العلامة المائية؟','الصيغ المدعومة']}},

  { id:'watermark_embed', patterns:['how to embed','how to add watermark','embed watermark','add watermark','how to hide','how to watermark image','كيفية التضمين','كيف أضيف علامة مائية','تضمين العلامة المائية','إخفاء'],
    contexts:['watermark'], response:{ en:'**To embed a watermark:**\n1. Go to the **Watermark** page\n2. Select the embedding **Algorithm** (1-9)\n3. Upload a **Cover image** (PNG or JPEG)\n4. Upload a **Secret file** (the data to hide)\n5. Enter a **Password**\n6. Click **Embed Watermark**\n\nThe result will be a watermarked image that looks identical to the original but contains your hidden data.\n\n💡 Larger images have more capacity. Check the capacity hint below the cover image upload.',
    ar:'**لتضمين علامة مائية:**\n1. اذهب إلى صفحة **العلامة المائية**\n2. اختر **الخوارزمية** (1-9)\n3. ارفع **الصورة الأصلية** (PNG أو JPEG)\n4. ارفع **ملف سري** (البيانات المراد إخفاؤها)\n5. أدخل **كلمة المرور**\n6. انقر **تضمين العلامة المائية**\n\nالنتيجة ستكون صورة بعلامة مائية تبدو مطابقة للأصل ولكنها تحتوي على بياناتك المخفية.\n\n💡 الصور الأكبر لها سعة أكبر. تحقق من تلميح السعة أسفل رفع الصورة.' },
    suggestions:{ en:['How to extract watermark?','What algorithm should I use?','Password help'], ar:['كيفية استخراج العلامة المائية؟','ما الخوارزمية التي يجب استخدامها؟','مساعدة كلمة المرور']}},

  { id:'watermark_extract', patterns:['how to extract','extract watermark','read watermark','get hidden data','retrieve watermark','كيفية الاستخراج','استخراج العلامة المائية','قراءة العلامة المائية','استرجاع'],
    contexts:['watermark'], response:{ en:'**To extract a watermark:**\n1. Go to the **Watermark** page\n2. Switch to the **Extract** tab\n3. Select the **Algorithm** used during embedding\n4. Upload the **Stego image** (watermarked image)\n5. Enter the **Password** (if required)\n6. Click **Extract Watermark**\n\n💡 If you don\'t know the algorithm, click **Auto Detect Algorithm** — it will try all 9 algorithms and tell you which one(s) found data.',
    ar:'**لاستخراج علامة مائية:**\n1. اذهب إلى صفحة **العلامة المائية**\n2. انتقل إلى علامة التبويب **استخراج**\n3. اختر **الخوارزمية** المستخدمة أثناء التضمين\n4. ارفع **الصورة المضغوطة** (الصورة ذات العلامة المائية)\n5. أدخل **كلمة المرور** (إذا لزم الأمر)\n6. انقر **استخراج العلامة المائية**\n\n💡 إذا كنت لا تعرف الخوارزمية، انقر **الكشف التلقائي** — سيحاول جميع الخوارزميات التسع ويخبرك أي منها وجد بيانات.' },
    suggestions:{ en:['How to embed watermark?','What algorithm should I use?','Auto Detect'], ar:['كيفية تضمين العلامة المائية؟','ما الخوارزمية المناسبة؟','الكشف التلقائي']}},

  { id:'watermark_formats', patterns:['what formats','supported formats','watermark formats','png','jpeg','jpg','which images','what images','الصيغ المدعومة','ما هي الصيغ','png','jpeg','jpg'],
    contexts:['watermark'], response:{ en:'**Supported formats for watermarking:**\n\n📥 **Input (cover image):** PNG, JPEG\n📤 **Output:** PNG (to preserve the hidden data)\n\nFor embedding, use **PNG** or **JPEG** as the cover image.\nFor extraction, the stego image is always **PNG**.\n\n💡 JPEG compression may destroy the watermark. Always save watermarked images as PNG.',
    ar:'**الصيغ المدعومة للعلامة المائية:**\n\n📥 **الإدخال (الصورة الأصلية):** PNG, JPEG\n📤 **الإخراج:** PNG (للحفاظ على البيانات المخفية)\n\nللتضمين، استخدم **PNG** أو **JPEG** كصورة أصلية.\nللاستخراج، الصورة المضغوطة تكون دائماً **PNG**.\n\n💡 ضغط JPEG قد يدمر العلامة المائية. احفظ الصور ذات العلامة المائية كـ PNG دائماً.' },
    suggestions:{ en:['How to embed watermark?','How to extract watermark?','Watermark vs Pixel Injection'], ar:['كيفية تضمين العلامة المائية؟','كيفية استخراج العلامة المائية؟','العلامة المائية vs حقن البكسل']}},

  { id:'watermark_password', patterns:['password','forgot password','wrong password','what password','كلمة المرور','نسيت كلمة المرور','كلمة سر'],
    contexts:['watermark'], response:{ en:'**Password is required** for algorithms 1-4 and 6-9.\n\nAlgorithm 5 (Zero-bit) does not use a password.\n\n⚠️ The password is used to encrypt the hidden data. You **must remember the password** — there is no way to recover it. If you lose the password, you cannot extract the watermark.\n\n💡 Choose a strong password but one you won\'t forget! Consider writing it down somewhere safe.',
    ar:'**كلمة المرور مطلوبة** للخوارزميات 1-4 و 6-9.\n\nالخوارزمية 5 (Zero-bit) لا تستخدم كلمة مرور.\n\n⚠️ تستخدم كلمة المرور لتشفير البيانات المخفية. **يجب أن تتذكر كلمة المرور** — لا توجد طريقة لاستعادتها. إذا فقدت كلمة المرور، لا يمكنك استخراج العلامة المائية.\n\n💡 اختر كلمة مرور قوية ولكن لا تنساها! فكر في كتابتها في مكان آمن.' },
    suggestions:{ en:['How to embed watermark?','How to extract watermark?','Auto Detect'], ar:['كيفية تضمين العلامة المائية؟','كيفية استخراج العلامة المائية؟','الكشف التلقائي']}},

  { id:'watermark_capacity', patterns:['capacity','how much data','max size','secret size','file too big','data limit','السعة','كم بيانات','الحد الأقصى','الملف كبير'],
    contexts:['watermark'], response:{ en:'**Capacity** depends on the image size and algorithm:\n\n• Larger images = more capacity\n• A 1920×1080 image can hold roughly 100-500 KB depending on the algorithm\n• The capacity is shown below the cover image upload after you select one\n\n💡 For small logos or text files, any image works. For larger files, use a higher resolution image.\n\nIf your secret file exceeds the capacity, try a larger cover image or a different algorithm.',
    ar:'**السعة** تعتمد على حجم الصورة والخوارزمية:\n\n• الصور الأكبر = سعة أكبر\n• صورة 1920×1080 يمكنها حمل حوالي 100-500 كيلوبايت حسب الخوارزمية\n• تظهر السعة أسفل رفع الصورة الأصلية بعد اختيارها\n\n💡 للشعارات الصغيرة أو ملفات النص، أي صورة تفي بالغرض. للملفات الأكبر، استخدم صورة بدقة أعلى.\n\nإذا تجاوز ملفك السري السعة، جرب صورة أصلية أكبر أو خوارزمية مختلفة.' },
    suggestions:{ en:['How to embed watermark?','Supported formats','What algorithm should I use?'], ar:['كيفية تضمين العلامة المائية؟','الصيغ المدعومة','ما الخوارزمية المناسبة؟']}},

  { id:'watermark_vs_pi', patterns:['difference between watermark and pixel injection','watermark vs pixel injection','what is pixel injection','pixel injection vs watermark','الفرق بين العلامة المائية وحقن البكسل','العلامة المائية vs حقن البكسل','ما هو حقن البكسل'],
    contexts:['watermark','pixel-injection'], response:{ en:'**Watermark vs Pixel Injection:**\n\n💧 **Watermark:** 9 algorithms, designed for robustness. The watermark should survive compression, cropping, and other modifications. Best for copyright protection.\n\n🔬 **Pixel Injection:** 20+ advanced algorithms across 5 categories (Spatial, Frequency, Deep Learning, Professional, Detection). More diverse techniques, including modern deep learning approaches.\n\n**Which to choose?**\n• For copyright protection → **Watermark**\n• For steganography / secret communication → **Pixel Injection**\n• For forensics → Both have forensic tools',
    ar:'**العلامة المائية vs حقن البكسل:**\n\n💧 **العلامة المائية:** 9 خوارزميات، مصممة للمتانة. العلامة المائية يجب أن تتحمل الضغط والقص والتعديلات الأخرى. الأفضل لحماية حقوق النشر.\n\n🔬 **حقن البكسل:** 20+ خوارزمية متقدمة عبر 5 فئات (مكاني، ترددي، تعلم عميق، أدوات احترافية، كشف). تقنيات أكثر تنوعاً، بما في ذلك مناهج التعلم العميق الحديثة.\n\n**ماذا تختار؟**\n• لحماية حقوق النشر → **العلامة المائية**\n• للإخفاء / التواصل السري → **حقن البكسل**\n• للأدلة الجنائية → كلاهما لديه أدوات جنائية' },
    suggestions:{ en:['How does pixel injection work?','Watermark algorithms','Pixel injection categories'], ar:['كيف يعمل حقن البكسل؟','خوارزميات العلامة المائية','فئات حقن البكسل']}},

  { id:'pixel_injection_what', patterns:['pixel injection','steganography','what is pixel injection','how does pixel injection work','حقن البكسل','ما هو حقن البكسل','كيف يعمل حقن البكسل','إخفاء'],
    contexts:['pixel-injection','home'], response:{ en:'**Pixel Injection** is an advanced steganography system with 20+ algorithms across 5 categories:\n\n🔹 **Spatial Domain** — LSB, PVD, Pixel Indicator techniques\n🔹 **Frequency Domain** — DCT, DWT, FFT-based techniques\n🔹 **Deep Learning** — Neural network based steganography\n🔹 **Professional Tools** — Advanced steganography toolkits\n🔹 **Detection & Analysis** — Statistical analysis, RS detection, Chi-square\n\nYou can embed secret files or text messages into images with optional password encryption.',
    ar:'**حقن البكسل** هو نظام إخفاء متقدم مع 20+ خوارزمية عبر 5 فئات:\n\n🔹 **النطاق المكاني** — LSB, PVD, تقنيات مؤشر البكسل\n🔹 **نطاق التردد** — DCT, DWT, تقنيات FFT\n🔹 **التعلم العميق** — إخفاء قائم على الشبكات العصبية\n🔹 **الأدوات الاحترافية** — أدوات إخفاء متقدمة\n🔹 **الكشف والتحليل** — تحليل إحصائي، كشف RS, Chi-square\n\nيمكنك تضمين ملفات سرية أو رسائل نصية في الصور مع تشفير اختياري بكلمة مرور.' },
    suggestions:{ en:['How to inject a message?','How to extract a message?','Algorithm categories'], ar:['كيفية حقن رسالة؟','كيفية استخراج رسالة؟','فئات الخوارزميات']}},

  { id:'fingerprint_what', patterns:['what is fingerprint','fingerprint','file fingerprint','hashing','sha256','sha-256','sha 256','what is hashing','digital fingerprint','blake3','perceptual hash','بصمة','بصمة الملف','ما هي البصمة','التجزئة','sha256','sha-256'],
    contexts:['fingerprint','home'], response:{ en:'**File Fingerprinting** generates cryptographic and perceptual hashes of your files.\n\n🔐 **Cryptographic hashes:**\n• SHA-1, SHA-256, SHA-384, SHA-512\n• SHA3-256, SHA3-512\n• BLAKE2s, BLAKE2b, BLAKE3\n• MD5, RIPEMD-160, Whirlpool\n\n👁️ **Perceptual hashes:**\n• aHash (Average Hash)\n• dHash (Difference Hash)\n• pHash (Perceptual Hash)\n• wHash (Wavelet Hash)\n\nCryptographic hashes detect any change to the file. Perceptual hashes detect similar images (useful for finding duplicates or modified versions).',
    ar:'**بصمة الملف** تنشئ تجزئات تشفيرية وإدراكية لملفاتك.\n\n🔐 **التجزئات التشفيرية:**\n• SHA-1, SHA-256, SHA-384, SHA-512\n• SHA3-256, SHA3-512\n• BLAKE2s, BLAKE2b, BLAKE3\n• MD5, RIPEMD-160, Whirlpool\n\n👁️ **التجزئات الإدراكية:**\n• aHash (Average Hash)\n• dHash (Difference Hash)\n• pHash (Perceptual Hash)\n• wHash (Wavelet Hash)\n\nالتجزئات التشفيرية تكتشف أي تغيير في الملف. التجزئات الإدراكية تكتشف الصور المتشابهة (مفيدة للعثور على النسخ المكررة أو المعدلة).' },
    suggestions:{ en:['What is it used for?','How to generate?','Cryptographic vs perceptual'], ar:['ما فائدتها؟','كيفية إنشائها؟','التشفيرية vs الإدراكية']}},

  { id:'fingerprint_use', patterns:['what is it used for','fingerprint use','why fingerprint','verify integrity','check if file changed','integrity check','file verification','ما فائدتها','التحقق من السلامة','التحقق من الملف','لماذا البصمة'],
    contexts:['fingerprint'], response:{ en:'**File fingerprints** are used for:\n\n✅ **Verify file integrity** — Check if a file has been modified since it was created\n✅ **Deduplication** — Find duplicate files (identical hashes = identical files)\n✅ **Digital forensics** — Prove a file existed at a specific time\n✅ **Perceptual matching** — Find similar images even if resized/recompressed\n✅ **Certificate generation** — The fingerprints are included in your Digital Passport\n\n💡 Generate a fingerprint when you first create/download a file, then re-generate later to verify it hasn\'t changed.',
    ar:'**بصمات الملف** تستخدم لـ:\n\n✅ **التحقق من سلامة الملف** — تحقق مما إذا كان الملف قد تعدل منذ إنشائه\n✅ **إزالة التكرار** — العثور على الملفات المكررة (نفس التجزئة = نفس الملف)\n✅ **الأدلة الجنائية الرقمية** — إثبات وجود ملف في وقت معين\n✅ **المطابقة الإدراكية** — العثور على صور متشابهة حتى لو تم تغيير الحجم/إعادة الضغط\n✅ **إنشاء الشهادة** — يتم تضمين البصمات في جواز سفرك الرقمي\n\n💡 أنشئ بصمة عند إنشاء/تنزيل ملف لأول مرة، ثم أعد إنشائها لاحقاً للتحقق من عدم تغييره.' },
    suggestions:{ en:['How to generate fingerprint?','What algorithms?','Digital Passport'], ar:['كيفية إنشاء البصمة؟','ما الخوارزميات؟','جواز السفر الرقمي']}},

  { id:'metadata_what', patterns:['what is metadata','metadata','exif','what is exif','image metadata','photo metadata','data stored in photos','EXIF','بيانات وصفية','ما هي البيانات الوصفية','معلومات الصورة'],
    contexts:['metadata','home'], response:{ en:'**Metadata** (EXIF data) is information stored inside image files by cameras and editing software.\n\nIt can include:\n📷 **Camera info** — Make, model, lens, aperture, shutter speed, ISO\n📍 **GPS location** — Where the photo was taken\n📅 **Date & time** — When the photo was taken\n🖼️ **Image info** — Dimensions, format, color mode, file size\n\nRedoSan reads all this metadata securely in your browser — nothing is uploaded.',
    ar:'**البيانات الوصفية** (EXIF) هي معلومات مخزنة داخل ملفات الصور بواسطة الكاميرات وبرامج التحرير.\n\nيمكن أن تشمل:\n📷 **معلومات الكاميرا** — الماركة، الموديل، العدسة، فتحة العدسة، سرعة الغالق، ISO\n📍 **موقع GPS** — أين التقطت الصورة\n📅 **التاريخ والوقت** — متى التقطت الصورة\n🖼️ **معلومات الصورة** — الأبعاد، التنسيق، وضع الألوان، حجم الملف\n\nRedoSan يقرأ كل هذه البيانات بأمان في متصفحك — لا شيء يُرفع.' },
    suggestions:{ en:['How to read metadata?','What info is stored?','How to remove metadata?'], ar:['كيفية قراءة البيانات الوصفية؟','ما المعلومات المخزنة؟','كيفية إزالة البيانات الوصفية؟']}},

  { id:'timestamp_what', patterns:['what is timestamp','opentimestamps','ots','what is ots','timestamp','blockchain','proof of existence','what is opentimestamps','طابع زمني','ما هو الطابع الزمني','ots','opentimestamps','blockchain','إثبات الوجود'],
    contexts:['timestamp','home'], response:{ en:'**OpenTimestamps (OTS)** is a free, open protocol for creating blockchain timestamps.\n\nIt creates a cryptographic proof that a file existed at a certain time, without uploading the file itself — only its hash.\n\n**How it works:**\n1. Your file\'s SHA-256 hash is computed locally\n2. The hash is submitted to the OpenTimestamps calendar aggregator\n3. The aggregator includes it in a Bitcoin blockchain transaction\n4. You get a .ots proof file that can be verified anytime\n\n💡 All processing is local. The hash is submitted, NOT your actual file.',
    ar:'**OpenTimestamps (OTS)** هو بروتوكول مفتوح ومجاني لإنشاء الطوابع الزمنية على blockchain.\n\nينشئ إثباتاً تشفيرياً أن ملفاً ما كان موجوداً في وقت معين، دون رفع الملف نفسه — فقط تجزئته.\n\n**كيف يعمل:**\n1. يتم حساب تجزئة SHA-256 لملفك محلياً\n2. يتم إرسال التجزئة إلى مجمع تقويم OpenTimestamps\n3. يقوم المجمع بتضمينها في معاملة Bitcoin blockchain\n4. تحصل على ملف إثبات .ots يمكن التحقق منه في أي وقت\n\n💡 جميع المعالجة محلية. يتم إرسال التجزئة فقط، وليس ملفك الفعلي.' },
    suggestions:{ en:['How to create a timestamp?','How to verify a timestamp?','Blockchain attestation'], ar:['كيفية إنشاء طابع زمني؟','كيفية التحقق من طابع زمني؟','إثبات blockchain']}},

  { id:'timestamp_create', patterns:['how to create a timestamp','create timestamp','make timestamp','how to create ots','create ots','إنشاء طابع زمني','كيفية إنشاء طابع زمني','إنشاء ots'],
    contexts:['timestamp'], response:{ en:'**To create a timestamp:**\n1. Go to the **Timestamp** page\n2. In the **Create .ots** tab, upload your file\n3. Click **Create .ots**\n4. The tool computes SHA-256 locally and submits it to the OTS calendar aggregator\n5. Download your .ots proof file\n\n📱 The .ots file can be verified anytime using the Verify tab or at opentimestamps.org\n\n⚠️ If the calendar is unreachable, you\'ll get an incomplete .ots. You can still complete it later via the OTS website or CLI.',
    ar:'**لإنشاء طابع زمني:**\n1. اذهب إلى صفحة **الطابع الزمني**\n2. في علامة التبويب **إنشاء .ots**، ارفع ملفك\n3. انقر **إنشاء .ots**\n4. تقوم الأداة بحساب SHA-256 محلياً وإرسالها إلى مجمع تقويم OTS\n5. حمّل ملف الإثبات .ots الخاص بك\n\n📱 يمكن التحقق من ملف .ots في أي وقت باستخدام علامة التبويب تحقق أو على opentimestamps.org\n\n⚠️ إذا كان التقويم غير متاح، ستحصل على .ots غير مكتمل. يمكنك إكماله لاحقاً عبر موقع OTS أو واجهة الأوامر.' },
    suggestions:{ en:['How to verify a timestamp?','What is blockchain attestation?','Incomplete .ots'], ar:['كيفية التحقق من طابع زمني؟','ما هو إثبات blockchain؟','ots غير مكتمل']}},

  { id:'timestamp_verify', patterns:['how to verify','verify timestamp','verify ots','check timestamp','validate ots','ots verify','التحقق من الطابع الزمني','التحقق من ots','كيفية التحقق'],
    contexts:['timestamp'], response:{ en:'**To verify a timestamp:**\n1. Go to the **Timestamp** page\n2. Switch to the **Verify .ots** tab\n3. Upload the **original file**\n4. Upload the **.ots proof file**\n5. Click **Verify .ots**\n\nThe tool will compute the SHA-256 of your file and compare it with the one in the .ots proof.\n\n✅ If they match: The file has NOT changed since the timestamp was created.\n❌ If they don\'t: The file has been modified.',
    ar:'**للتحقق من طابع زمني:**\n1. اذهب إلى صفحة **الطابع الزمني**\n2. انتقل إلى علامة التبويب **تحقق .ots**\n3. ارفع **الملف الأصلي**\n4. ارفع **ملف الإثبات .ots**\n5. انقر **تحقق .ots**\n\nستقوم الأداة بحساب SHA-256 لملفك ومقارنته مع الموجود في إثبات .ots.\n\n✅ إذا تطابقا: الملف لم يتغير منذ إنشاء الطابع الزمني.\n❌ إذا لم يتطابقا: تم تعديل الملف.' },
    suggestions:{ en:['How to create a timestamp?','What is blockchain attestation?','Download options'], ar:['كيفية إنشاء طابع زمني؟','ما هو إثبات blockchain؟','خيارات التحميل']}},

  { id:'c2pa_what', patterns:['what is c2pa','c2pa','content provenance','content credentials','what is content provenance','c2pa explained','ما هو c2pa','c2pa','مصدر المحتوى','اعتمادات المحتوى'],
    contexts:['c2pa','home'], response:{ en:'**C2PA** (Coalition for Content Provenance and Authenticity) is an open standard for tracing the origin and history of digital content.\n\nIt allows creators to cryptographically sign their work with information about:\n• Who created it\n• How it was created (camera, AI, edited, composite)\n• What edits were made\n• When it was created\n\n💡 This helps combat misinformation by providing a verifiable chain of custody for digital content. Think of it as a "digital nutrition label" for images.',
    ar:'**C2PA** (تحالف مصدر المحتوى والأصالة) هو معيار مفتوح لتتبع أصل وتاريخ المحتوى الرقمي.\n\nيسمح للمبدعين بتوقيع أعمالهم تشفيرياً بمعلومات عن:\n• من أنشأه\n• كيف أنشئ (كاميرا، ذكاء اصطناعي، تعديل، مركب)\n• ما التعديلات التي أجريت\n• متى أنشئ\n\n💡 هذا يساعد في مكافحة التضليل من خلال توفير سلسلة حيازة قابلة للتحقق للمحتوى الرقمي. اعتبره "بطاقة تغذية رقمية" للصور.' },
    suggestions:{ en:['How to sign with C2PA?','How to read C2PA?','How to verify C2PA?'], ar:['كيفية التوقيع بـ C2PA؟','كيفية قراءة C2PA؟','كيفية التحقق من C2PA؟']}},

  { id:'c2pa_sign', patterns:['how to sign c2pa','sign with c2pa','add c2pa','c2pa signature','how to add c2pa','c2pa write','التوقيع بـ c2pa','إضافة c2pa','توقيع c2pa'],
    contexts:['c2pa'], response:{ en:'**To sign an image with C2PA:**\n1. Go to the **C2PA** page\n2. Switch to the **Sign** tab\n3. Select one or more **Content Types** (Digitally Created, Edited, AI-Generated, etc.)\n4. Optionally add **Social Links** and **Music Links**\n5. Upload the **image** to sign\n6. Click **Sign with C2PA**\n7. Download your signed image\n\n💡 The tool uses a test certificate, suitable for development and testing. For production, use a real C2PA-compliant certificate.',
    ar:'**لتوقيع صورة بـ C2PA:**\n1. اذهب إلى صفحة **C2PA**\n2. انتقل إلى علامة التبويب **توقيع**\n3. اختر واحداً أو أكثر من **أنواع المحتوى** (منشأ رقمياً، معدل، منشأ بالذكاء الاصطناعي، إلخ)\n4. اختر **روابط التواصل** و **روابط الموسيقى** (اختياري)\n5. ارفع **الصورة** للتوقيع\n6. انقر **توقيع بـ C2PA**\n7. حمّل صورتك الموقعة\n\n💡 تستخدم الأداة شهادة اختبار، مناسبة للتطوير والاختبار. للإنتاج، استخدم شهادة C2PA حقيقية.' },
    suggestions:{ en:['How to read C2PA?','How to verify C2PA?','What is C2PA?'], ar:['كيفية قراءة C2PA؟','كيفية التحقق من C2PA؟','ما هو C2PA؟']}},

  { id:'c2pa_read', patterns:['how to read c2pa','read c2pa','check c2pa','view c2pa','c2pa data','what c2pa data','قراءة c2pa','عرض c2pa','بيانات c2pa'],
    contexts:['c2pa'], response:{ en:'**To read C2PA data from an image:**\n1. Go to the **C2PA** page\n2. In the **Read** tab, upload an image with C2PA data\n3. Click **Read C2PA Data**\n4. View detailed provenance info: manifests, assertions, actions, ingredients, signature\n\nYou can download the results as JSON/CSV/TXT/XML/PDF/DOCX using the Download Results button.',
    ar:'**لقراءة بيانات C2PA من صورة:**\n1. اذهب إلى صفحة **C2PA**\n2. في علامة التبويب **قراءة**، ارفع صورة تحتوي على بيانات C2PA\n3. انقر **قراءة بيانات C2PA**\n4. عرض معلومات المصدر التفصيلية: البيانات والتصريحات والإجراءات والمكونات والتوقيع\n\nيمكنك تحميل النتائج كـ JSON/CSV/TXT/XML/PDF/DOCX باستخدام زر تحميل النتائج.' },
    suggestions:{ en:['How to sign with C2PA?','How to verify C2PA?','What is C2PA?'], ar:['كيفية التوقيع بـ C2PA؟','كيفية التحقق من C2PA؟','ما هو C2PA؟']}},

  { id:'c2pa_verify', patterns:['how to verify c2pa','verify c2pa','check c2pa signature','validate c2pa','c2pa verification','التحقق من c2pa','التحقق من توقيع c2pa'],
    contexts:['c2pa'], response:{ en:'**To verify a C2PA signature:**\n1. Go to the **C2PA** page\n2. Switch to the **Verify** tab\n3. Upload the image to verify\n4. Click **Verify C2PA**\n\nThe tool will check if the image has valid C2PA provenance data and display the verification result.',
    ar:'**للتحقق من توقيع C2PA:**\n1. اذهب إلى صفحة **C2PA**\n2. انتقل إلى علامة التبويب **تحقق**\n3. ارفع الصورة للتحقق\n4. انقر **تحقق من C2PA**\n\nستتحقق الأداة مما إذا كانت الصورة تحتوي على بيانات C2PA صالحة وتعرض نتيجة التحقق.' },
    suggestions:{ en:['How to sign with C2PA?','How to read C2PA?','What is C2PA?'], ar:['كيفية التوقيع بـ C2PA؟','كيفية قراءة C2PA؟','ما هو C2PA؟']}},

  { id:'certificate_what', patterns:['what is digital passport','digital passport','certificate','what is certificate','what does certificate contain','digital certificate','جواز السفر الرقمي','الشهادة الرقمية','ما هو جواز السفر الرقمي','محتويات الشهادة'],
    contexts:['certificate','home'], response:{ en:'**Digital Passport** is a signed document that combines:\n📸 Your image\n👤 Your personal info (name, email, phone, website)\n🔗 Social & music links\n💧 Watermark result\n🔬 Pixel injection result\n🔍 Fingerprint hashes\n🕒 Timestamp proof\n\nIt can be exported as **PDF**, **DOCX**, or **EPUB**.\n\n💡 This creates a verifiable chain of authenticity for your digital work.',
    ar:'**جواز السفر الرقمي** هو وثيقة موقعة تجمع:\n📸 صورتك\n👤 معلوماتك الشخصية (الاسم، البريد الإلكتروني، الهاتف، الموقع)\n🔗 روابط التواصل والموسيقى\n💧 نتيجة العلامة المائية\n🔬 نتيجة حقن البكسل\n🔍 بصمات الملف\n🕒 إثبات الطابع الزمني\n\nيمكن تصديرها كـ **PDF** أو **DOCX** أو **EPUB**.\n\n💡 هذا ينشئ سلسلة أصالة قابلة للتحقق لعملك الرقمي.' },
    suggestions:{ en:['How to generate a certificate?','Supported formats','What tools to use together?'], ar:['كيفية إنشاء شهادة؟','الصيغ المدعومة','ما الأدوات المستخدمة معاً؟']}},

  { id:'certificate_generate', patterns:['how to generate certificate','how to create passport','generate digital passport','create certificate','إنشاء شهادة','إنشاء جواز سفر','كيفية إنشاء جواز سفر'],
    contexts:['certificate'], response:{ en:'**To generate a Digital Passport:**\n1. Go to the **Digital Passport** page\n2. Upload your **Image**\n3. Fill in your **Information** (name, email, phone, website)\n4. Optionally add **Social Links** and **Music Links**\n5. Upload **Tool Results** from other sections\n6. Click **Generate Digital Passport**\n7. Choose your format: PDF, DOCX, or EPUB',
    ar:'**لإنشاء جواز سفر رقمي:**\n1. اذهب إلى صفحة **جواز السفر الرقمي**\n2. ارفع **صورتك**\n3. املأ **معلوماتك** (الاسم، البريد الإلكتروني، الهاتف، الموقع)\n4. أضف **روابط التواصل** و **روابط الموسيقى** (اختياري)\n5. ارفع **نتائج الأدوات** من الأقسام الأخرى\n6. انقر **إنشاء جواز السفر الرقمي**\n7. اختر الصيغة: PDF أو DOCX أو EPUB' },
    suggestions:{ en:['What is Digital Passport?','Supported formats','Combine all tools'], ar:['ما هو جواز السفر الرقمي؟','الصيغ المدعومة','دمج جميع الأدوات']}},

  { id:'converter_what', patterns:['what is converter','file converter','convert image','image converter','convert format','محول الملفات','تحويل الصور','تحويل','تغيير الصيغة'],
    contexts:['converter','home'], response:{ en:'**File Converter** converts between various formats:\n\n🖼️ **Images:** PNG, JPEG, WebP, BMP, GIF, TIFF\n🎵 **Audio:** MP3, WAV, OGG, FLAC\n🎬 **Video:** MP4, WebM, AVI\n📄 **Documents:** PDF, DOCX, TXT, HTML, CSV, JSON, XML, MD\n\nJust upload a file and select the target format. All conversion happens in your browser.',
    ar:'**محول الملفات** يحول بين صيغ مختلفة:\n\n🖼️ **الصور:** PNG, JPEG, WebP, BMP, GIF, TIFF\n🎵 **الصوت:** MP3, WAV, OGG, FLAC\n🎬 **الفيديو:** MP4, WebM, AVI\n📄 **المستندات:** PDF, DOCX, TXT, HTML, CSV, JSON, XML, MD\n\nفقط ارفع ملفاً واختر الصيغة المطلوبة. كل التحويل يتم في متصفحك.' },
    suggestions:{ en:['How to convert?','Supported formats','Image conversion'], ar:['كيفية التحويل؟','الصيغ المدعومة','تحويل الصور']}},

  { id:'help', patterns:['help','what can you help','i need help','help me','how to use','how do i','what tools','show tools','what can i do','options','features','capabilities','what are the tools','what do you do','all tools','list tools','مساعدة','ساعدني','كيف أستخدم','ما الأدوات','ماذا يمكنني أن أفعل','الخيارات','الميزات','الإمكانيات','عرض الأدوات'],
    contexts:[], response:{ en:'Here\'s what I can help you with:\n\n💧 **Digital Watermark** — Hide data in images\n🔬 **Pixel Injection** — Advanced steganography\n🔍 **Fingerprint** — Hash files (SHA, BLAKE3, etc.)\n📋 **Metadata** — Read EXIF & image info\n🕒 **Timestamp** — OpenTimestamps proofs\n✨ **C2PA** — Content provenance\n📜 **Digital Passport** — Signed certificates\n🔄 **File Converter** — Change formats\n🔒 **Privacy** — How your data is handled\n\nJust type your question! Or click one of the suggested questions below.',
    ar:'إليك ما يمكنني مساعدتك به:\n\n💧 **العلامة المائية الرقمية** — إخفاء البيانات في الصور\n🔬 **حقن البكسل** — إخفاء متقدم\n🔍 **البصمة الرقمية** — تجزئة الملفات (SHA, BLAKE3, إلخ)\n📋 **البيانات الوصفية** — قراءة EXIF ومعلومات الصورة\n🕒 **الطابع الزمني** — إثباتات OpenTimestamps\n✨ **C2PA** — مصدر المحتوى\n📜 **جواز السفر الرقمي** — شهادات موقعة\n🔄 **محول الملفات** — تغيير الصيغ\n🔒 **الخصوصية** — كيفية معالجة بياناتك\n\nفقط اكتب سؤالك! أو انقر على أحد الأسئلة المقترحة أدناه.' },
    suggestions:{ en:['How does watermarking work?','What is fingerprinting?','Privacy & Security','What is C2PA?'], ar:['كيف تعمل العلامة المائية؟','ما هي البصمة الرقمية؟','الخصوصية والأمان','ما هو C2PA؟']}},

  { id:'simplified', patterns:['simplified mode','simple mode','wizard','step by step','what is simplified','easy mode','الوضع المبسط','الوضع البسيط','المعامل','خطوة بخطوة'],
    contexts:[], response:{ en:'**Simplified Mode** is a step-by-step wizard that guides you through all the tools in sequence:\n\n1️⃣ Upload your file\n2️⃣ Choose if it\'s AI-generated or regular photo\n3️⃣ Sign with C2PA (optional)\n4️⃣ Embed watermark\n5️⃣ Pixel injection\n6️⃣ Create timestamp\n7️⃣ Generate fingerprint\n8️⃣ Download Digital Passport\n\nTo switch to Simplified Mode, click the 🔀 Switch Mode button in the sidebar or top nav.\n\n💡 Great for beginners or quick processing!',
    ar:'**الوضع المبسط** هو معالج خطوة بخطوة يرشدك خلال جميع الأدوات بالتسلسل:\n\n1️⃣ ارفع ملفك\n2️⃣ اختر إذا كان منشأ بالذكاء الاصطناعي أو صورة عادية\n3️⃣ التوقيع بـ C2PA (اختياري)\n4️⃣ تضمين العلامة المائية\n5️⃣ حقن البكسل\n6️⃣ إنشاء طابع زمني\n7️⃣ إنشاء بصمة رقمية\n8️⃣ تنزيل جواز السفر الرقمي\n\nللتبديل إلى الوضع المبسط، انقر على زر 🔀 تبديل الوضع في الشريط الجانبي أو الشريط العلوي.\n\n💡 رائع للمبتدئين أو المعالجة السريعة!' },
    suggestions:{ en:['How to switch to professional?','What is Digital Passport?','Privacy & Security'], ar:['كيفية التبديل إلى المحترف؟','ما هو جواز السفر الرقمي؟','الخصوصية والأمان']}},

  { id:'professional', patterns:['professional mode','pro mode','advanced mode','full access','all tools','what is professional','الوضع المحترف','الوضع المتقدم','جميع الأدوات'],
    contexts:[], response:{ en:'**Professional Mode** gives you full access to all tools with individual pages for each feature.\n\nYou can use any tool in any order:\n• Watermark → Embed or Extract\n• Pixel Injection → Embed, Extract, or Analyze\n• Fingerprint → Generate hashes\n• Metadata → Read EXIF\n• Timestamp → Create or Verify .ots\n• C2PA → Read, Sign, or Verify\n• Digital Passport → Generate certificates\n• File Converter → Convert formats\n\n💡 Switch between tools using the sidebar or the cards on the home page.',
    ar:'**الوضع المحترف** يمنحك وصولاً كاملاً لجميع الأدوات مع صفحات فردية لكل ميزة.\n\nيمكنك استخدام أي أداة بأي ترتيب:\n• العلامة المائية → تضمين أو استخراج\n• حقن البكسل → تضمين أو استخراج أو تحليل\n• البصمة الرقمية → إنشاء تجزئات\n• البيانات الوصفية → قراءة EXIF\n• الطابع الزمني → إنشاء أو تحقق .ots\n• C2PA → قراءة أو توقيع أو تحقق\n• جواز السفر الرقمي → إنشاء شهادات\n• محول الملفات → تحويل الصيغ\n\n💡 انتقل بين الأدوات باستخدام الشريط الجانبي أو البطاقات في الصفحة الرئيسية.' },
    suggestions:{ en:['How to switch to simplified?','What tools are available?','Privacy & Security'], ar:['كيفية التبديل إلى المبسط؟','ما الأدوات المتاحة؟','الخصوصية والأمان']}},

  { id:'opensource', patterns:['open source','github','source code','contribute','license','gpl','code','repository','fork','pull request','issues','bug report','feature request','مفتوح المصدر','github','المصدر','المستودع','رخصة','مساهمة','المساهمة','تطوير','طلب ميزة'],
    contexts:[], response:{ en:'RedoSan Authenticity is **open-source** under the **GPL license**.\n\n🔗 **GitHub:** https://github.com/Redo-San/RedoSan-Authenticity\n\nYou can:\n• View the source code\n• Report bugs via Issues\n• Suggest features\n• Fork and contribute\n\nThe project is built with vanilla JavaScript — no frameworks, no build tools needed.',
    ar:'RedoSan Authenticity هي **مفتوحة المصدر** تحت **رخصة GPL**.\n\n🔗 **GitHub:** https://github.com/Redo-San/RedoSan-Authenticity\n\nيمكنك:\n• عرض الكود المصدري\n• الإبلاغ عن الأخطاء عبر Issues\n• اقتراح ميزات\n• عمل Fork والمساهمة\n\nالمشروع مبني بـ JavaScript نقية — لا أطر عمل، لا أدوات بناء مطلوبة.' },
    suggestions:{ en:['Privacy & Security','How does watermarking work?','What is C2PA?'], ar:['الخصوصية والأمان','كيف تعمل العلامة المائية؟','ما هو C2PA؟']}},

  { id:'contact', patterns:['contact','bug','report','issue','feedback','suggestion','support','email','اتصل','خطأ','بلاغ','اقتراح','دعم'],
    contexts:[], response:{ en:'**Contact & Support:**\n\n🐛 **Report bugs / Request features:**\nhttps://github.com/Redo-San/RedoSan-Authenticity/issues\n\n💻 **Follow the developer:**\nhttps://github.com/Redo-San\n\n📧 You can also find the Contact page in the top nav or footer.',
    ar:'**اتصل بنا والدعم:**\n\n🐛 **الإبلاغ عن الأخطاء / طلب الميزات:**\nhttps://github.com/Redo-San/RedoSan-Authenticity/issues\n\n💻 **متابعة المطور:**\nhttps://github.com/Redo-San\n\n📧 يمكنك أيضاً العثور على صفحة اتصل بنا في الشريط العلوي أو التذييل.' },
    suggestions:{ en:['Privacy & Security','Open source','How does watermarking work?'], ar:['الخصوصية والأمان','مفتوح المصدر','كيف تعمل العلامة المائية؟']}},

  { id:'search', patterns:['search','find','looking for','where is','how to find','بحث','أين','أبحث عن'],
    contexts:[], response:{ en:'You can use the **search bar** in the top navigation! Just type a keyword like "watermark", "fingerprint", "sha256", "timestamp", "c2pa" and press Enter.\n\nOr you can ask me directly — what are you looking for?',
    ar:'يمكنك استخدام **شريط البحث** في الشريط العلوي! فقط اكتب كلمة مثل "علامة مائية"، "بصمة"، "طابع زمني" واضغط Enter.\n\nأو يمكنك سؤالي مباشرة — ما الذي تبحث عنه؟' },
    suggestions:{ en:['How does watermarking work?','What is fingerprinting?','What is C2PA?'], ar:['كيف تعمل العلامة المائية؟','ما هي البصمة الرقمية؟','ما هو C2PA؟']}},

  { id:'getting_started', patterns:['how to use','getting started','get started','beginner','tutorial','guide','walkthrough','start here','how do i start','كيف أستخدم','ابدأ','المبتدئين','دليل','شرح','كيف أبدا'],
    contexts:[], response:{ en:'**Getting Started with RedoSan Authenticity:**\n\nThis tool runs entirely in your browser — no installation needed.\n\n1. Choose **Simplified Mode** for a step-by-step wizard, or **Professional Mode** for full access\n2. Upload an image file\n3. Select a tool: **Watermark**, **Pixel Injection**, **Fingerprint**, **Metadata**, **Timestamp**, **C2PA**, **Digital Passport**, or **File Converter**\n4. Follow the on-screen instructions\n\n💡 Start with **Simplified Mode** if you\'re new!',
    ar:'**بدء استخدام RedoSan Authenticity:**\n\nهذه الأداة تعمل بالكامل في متصفحك — لا حاجة للتثبيت.\n\n1. اختر **الوضع المبسط** للمعالجة خطوة بخطوة، أو **الوضع المحترف** للوصول الكامل\n2. ارفع ملف صورة\n3. اختر أداة: **العلامة المائية**، **حقن البكسل**، **البصمة**، **البيانات الوصفية**، **الطابع الزمني**، **C2PA**، **جواز السفر الرقمي**، أو **محول الملفات**\n4. اتبع التعليمات على الشاشة\n\n💡 ابدأ بـ **الوضع المبسط** إذا كنت جديداً!'},
    suggestions:{ en:['What is Simplified Mode?','What tools are available?','Privacy & Security'], ar:['ما هو الوضع المبسط؟','ما الأدوات المتاحة؟','الخصوصية والأمان']}},

  { id:'algorithm_choice', patterns:['what algorithm','best algorithm','which algorithm','recommended algorithm','algorithm comparison','choose algorithm','what algorithm to use','أي خوارزمية','أفضل خوارزمية','اختيار الخوارزمية','مقارنة الخوارزميات'],
    contexts:[], response:{ en:'**Choosing an Algorithm:**\n\n💧 **Watermark (9 algorithms):**\n• Algorithm 1 (LSB) — Simplest, least robust\n• Algorithm 4 (Latent DCT) — Good balance of capacity & robustness\n• Algorithm 9 (Imatag-style) — Best for copyright\n\n🔬 **Pixel Injection (20+ algorithms):**\n• **Spatial LSB** — Good for beginners\n• **Frequency DCT/DWT** — More robust, better for important data\n• **Deep Learning** — Advanced, experimental\n\n💡 For copyright protection → Watermark. For secret communication → Pixel Injection.',
    ar:'**اختيار الخوارزمية:**\n\n💧 **العلامة المائية (9 خوارزميات):**\n• الخوارزمية 1 (LSB) — الأبسط، الأقل متانة\n• الخوارزمية 4 (Latent DCT) — توازن جيد بين السعة والمتانة\n• الخوارزمية 9 (Imatag-style) — الأفضل لحقوق النشر\n\n🔬 **حقن البكسل (20+ خوارزمية):**\n• **Spatial LSB** — جيد للمبتدئين\n• **Frequency DCT/DWT** — أكثر متانة، أفضل للبيانات المهمة\n• **Deep Learning** — متقدم، تجريبي\n\n💡 لحماية حقوق النشر → العلامة المائية. للتواصل السري → حقن البكسل.'},
    suggestions:{ en:['How does watermarking work?','How does pixel injection work?','Watermark vs Pixel Injection'], ar:['كيف تعمل العلامة المائية؟','كيف يعمل حقن البكسل؟','العلامة المائية vs حقن البكسل']}},

  { id:'free_opensource', patterns:['is it free','how much','pricing','cost','paid','premium','subscription','free vs paid','مجاني','السعر','التكلفة','مدفوع','اشتراك','هل هو مجاني'],
    contexts:[], response:{ en:'RedoSan Authenticity is **100% free and open-source** under the GPL license.\n\n✅ No paid plans\n✅ No premium features\n✅ No subscriptions\n✅ No hidden costs\n\nAll features are available to everyone. The source code is on GitHub for anyone to audit, modify, and share.',
    ar:'RedoSan Authenticity **مجانية 100% ومفتوحة المصدر** تحت رخصة GPL.\n\n✅ لا خطط مدفوعة\n✅ لا ميزات مميزة\n✅ لا اشتراكات\n✅ لا تكاليف خفية\n\nجميع الميزات متاحة للجميع. الكود المصدري على GitHub يمكن لأي شخص مراجعته وتعديله ومشاركته.'},
    suggestions:{ en:['What is this tool?','Open source','Privacy & Security'], ar:['ما هذه الأداة؟','مفتوح المصدر','الخصوصية والأمان']}},

  { id:'abuse', patterns:['stupid','dumb','idiot','fool','moron','loser','shut up','shutup','screw you','fuck','fck','f u','f you','bitch','bastard','crap','shit','damn','asshole','ass hole','suck','wtf','stfu','dumbass','jackass','retard','cunt','nigger','piss off','pissed','bullshit','dick','pussy','motherfucker','douche','غبي','أحمق','حقير','تافه','خرا','خرة','كس','طيز','شرموط','عاهرة','قحبة','منحط','انذل','يلعن','اللعنة','تبا','وسخ','كلب','حمار','خنزير','متخلف','جاهل','نذل','وضيع','سافل','أهبل','سخيف','مغرور','مخبول','con','merde','putain','salope','connard','enculé','fils de pute','scheiße','arschloch','wichser','verpiss dich','idiota','cazzo','stronzo','vaffanculo','mierda','cabrón','pendejo','gilipollas','hijo de puta'],
    contexts:[], response:{ en:'🚫 Please be respectful! I\'m here to help you with RedoSan tools. Let\'s keep the conversation constructive.\n\nIf you have a question about watermarking, fingerprinting, timestamps, or any other tool, I\'d be happy to help! 😊',
    ar:'🚫 من فضلك كن محترماً! أنا هنا لمساعدتك في أدوات RedoSan. دعنا نبقي المحادثة بناءة.\n\nإذا كان لديك سؤال حول العلامة المائية، البصمة الرقمية، الطوابع الزمنية، أو أي أداة أخرى، سأكون سعيداً بالمساعدة! 😊'},
    suggestions:{ en:['How does watermarking work?','What is fingerprinting?','Privacy & Security'], ar:['كيف تعمل العلامة المائية؟','ما هي البصمة الرقمية؟','الخصوصية والأمان']}},

  { id:'mobile_support', patterns:['mobile','phone','tablet','android','ios','iphone','ipad','mobile support','mobile friendly','works on phone','does it work on','جوال','هاتف',' tablet','ios','أندرويد','يدعم الجوال'],
    contexts:[], response:{ en:'**RedoSan Authenticity works on mobile devices** since all processing is done in your browser.\n\nHowever, some features (like Pixel Injection with large images or C2PA signing) may be slower on mobile due to memory limitations.\n\n📱 The Professional mode works on mobile, and the **Simplified Mode** is optimized for smaller screens.',
    ar:'**RedoSan Authenticity يعمل على الأجهزة المحمولة** لأن جميع المعالجة تتم في متصفحك.\n\nومع ذلك، بعض الميزات (مثل حقن البكسل مع الصور الكبيرة أو توقيع C2PA) قد تكون أبطأ على الجوال بسبب محدودية الذاكرة.\n\n📱 الوضع المحترف يعمل على الجوال، و **الوضع المبسط** محسّن للشاشات الصغيرة.'},
    suggestions:{ en:['How to use Professional mode?','What is Simplified Mode?','File size limits'], ar:['كيفية استخدام الوضع المحترف؟','ما هو الوضع المبسط؟','حدود حجم الملف']}},

  { id:'file_limits', patterns:['file size','size limit','max file','file too large','maximum size','large file','memory','limit','big image','حجم الملف','حد الحجم','الملف كبير','الحد الأقصى','ذاكرة'],
    contexts:[], response:{ en:'**File size limits depend on your device\'s memory, not on RedoSan.**\n\n📸 **Images:** Any size works, but very large images (>20MP) may be slow\n🔍 **Fingerprint:** Works on files up to several GB (streaming hash)\n🔬 **Pixel Injection:** Works better with smaller images (<10MB)\n🔄 **Converter:** Depends on the format — audio/video conversion is memory-intensive\n\n💡 For best results, use images under 10MB on mobile and under 50MB on desktop.',
    ar:'**حدود حجم الملف تعتمد على ذاكرة جهازك، وليس على RedoSan.**\n\n📸 **الصور:** أي حجم يعمل، لكن الصور الكبيرة جداً (>20MP) قد تكون بطيئة\n🔍 **البصمة:** يعمل على ملفات حتى عدة GB (تجزئة تدفقية)\n🔬 **حقن البكسل:** يعمل بشكل أفضل مع الصور الصغيرة (<10MB)\n🔄 **المحول:** يعتمد على الصيغة — تحويل الصوت/الفيديو يستهلك ذاكرة\n\n💡 لأفضل النتائج، استخدم صوراً أقل من 10MB على الجوال وأقل من 50MB على الحاسوب.'},
    suggestions:{ en:['What tools are available?','Is it free?','Mobile support'], ar:['ما الأدوات المتاحة؟','هل هو مجاني؟','دعم الجوال']}},

  { id:'smalltalk', patterns:['how are you','how r u','how you doing','whats up','wassup','what\'s up','howdy','good to see you','nice to meet','كيف حالك','كيفك','كيف الحال','الحمد لله','بخير','how is it going','whats new'],
    contexts:[], response:{ en:'I\'m doing great, thanks for asking! 😊\n\nI\'m here to help you with:\n💧 Digital Watermark\n🔬 Pixel Injection\n🔍 Fingerprinting\n📋 Metadata reading\n🕒 Timestamps\n✨ C2PA\n📜 Digital Passport\n🔄 File Converter\n\nWhat would you like to explore?',
    ar:'أنا بخير، شكراً لسؤالك! 😊\n\nأنا هنا لمساعدتك في:\n💧 العلامة المائية الرقمية\n🔬 حقن البكسل\n🔍 البصمة الرقمية\n📋 قراءة البيانات الوصفية\n🕒 الطوابع الزمنية\n✨ C2PA\n📜 جواز السفر الرقمي\n🔄 محول الملفات\n\nماذا تريد أن تستكشف؟'},
    suggestions:{ en:['How does watermarking work?','What is fingerprinting?','What is C2PA?'], ar:['كيف تعمل العلامة المائية؟','ما هي البصمة الرقمية؟','ما هو C2PA؟']}},

  { id:'who_is_redosan', patterns:['who is redosan','what is redosan','من هو ريدو سان','من هو ريدوسان','ريدو سان','redosan','tell me about redosan','about redosan','creator','developer','who made this','who created','من صنع هذا','المطور','المنشئ','صاحب الموقع'],
    contexts:[], response:{ en:'**RedoSan** is the developer behind **RedoSan Authenticity**.\n\nGitHub: https://github.com/Redo-San\n\nRedoSan builds open-source tools focused on digital authenticity, watermarking, and steganography — all running 100% in your browser.\n\nThe name **"RedoSan"** is a digital identity representing a commitment to authenticity, transparency, and open-source values.',
    ar:'**RedoSan** هو المطور الذي يقف وراء **RedoSan Authenticity**.\n\nGitHub: https://github.com/Redo-San\n\nRedoSan يبني أدوات مفتوحة المصدر تركز على الأصالة الرقمية، العلامات المائية، والإخفاء الرقمي — كلها تعمل 100% في متصفحك.\n\nالاسم **"RedoSan"** هو هوية رقمية تمثل التزاماً بالأصالة والشفافية وقيم المصدر المفتوح.'},
    suggestions:{ en:['What is this tool?','Open source','Contact'], ar:['ما هذه الأداة؟','مفتوح المصدر','اتصل بنا']}}
];

var ASSISTANT_FALLBACK = {
  en: 'I\'m not sure I understand. Try asking about:\n• Watermarking (embed, extract, algorithms)\n• Pixel Injection\n• Fingerprint / Hashing\n• Metadata / EXIF\n• OpenTimestamps\n• C2PA Provenance\n• Digital Passport\n• File Converter\n• Privacy & Security\n\nOr type "help" to see all topics.',
  ar: 'لست متأكداً أنني فهمت. جرب أن تسأل عن:\n• العلامة المائية (تضمين، استخراج، خوارزميات)\n• حقن البكسل\n• البصمة الرقمية / التجزئة\n• البيانات الوصفية / EXIF\n• OpenTimestamps\n• C2PA المصدر\n• جواز السفر الرقمي\n• محول الملفات\n• الخصوصية والأمان\n\nأو اكتب "مساعدة" لرؤية جميع المواضيع.'
};

var ASSISTANT_GREETING = {
  en: '👋 Welcome! I\'m your RedoSan assistant. Ask me anything about the tools!',
  ar: '👋 أهلاً بك! أنا مساعد RedoSan. اسألني عن أي شيء بخصوص الأدوات!'
};

function getAssistantLang() {
  try {
    if (typeof i18n !== 'undefined' && i18n && i18n.lang) return i18n.lang;
  } catch(e) {}
  var html = document.documentElement;
  return html.getAttribute('lang') || 'en';
}

function getCurrentContext() {
  var active = document.querySelector('.page.active');
  if (!active) return '';
  var id = active.id || '';
  return id.replace('page-', '');
}

// ── Arabic text normalization ──
function normalizeArabic(t) {
  return t.replace(/[أإآ]/g, 'ا').replace(/[ة]/g, 'ه').replace(/[ى]/g, 'ي').replace(/[ـ]/g, '').replace(/[\u064B-\u0652]/g, '');
}

// ── Levenshtein distance (typo tolerance) ──
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  var m = [];
  for (var i = 0; i <= b.length; i++) m[i] = [i];
  for (var j = 0; j <= a.length; j++) m[0][j] = j;
  for (var i = 1; i <= b.length; i++) {
    for (var j = 1; j <= a.length; j++) {
      var cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[b.length][a.length];
}

// ── Tokenizer with Arabic normalization ──
function assistantTokenize(t) {
  return normalizeArabic(t.toLowerCase()).replace(/[^\w\s\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g, '').split(/\s+/).filter(Boolean);
}

// ── Intelligent intent matcher ──
function matchAssistantIntent(input) {
  var tokens = assistantTokenize(input);
  if (tokens.length === 0) return null;
  var normalized = normalizeArabic(input.toLowerCase());
  var FUZZY_THRESHOLD = 0.72;

  var bestScore = 0;
  var bestMatch = null;

  for (var i = 0; i < ASSISTANT_KB.length; i++) {
    var intent = ASSISTANT_KB[i];
    for (var j = 0; j < intent.patterns.length; j++) {
      var normPattern = normalizeArabic(intent.patterns[j].toLowerCase());
      var patternTokens = normPattern.split(/\s+/);
      if (patternTokens.length === 0) continue;

      // Exact phrase match → 100% confidence
      if (normalized === normPattern) { return intent; }

      // Token-level matching
      var exactMatches = 0;
      var fuzzyMatches = 0;
      var union = {};
      var inTokens = {};

      for (var k = 0; k < tokens.length; k++) union[tokens[k]] = true;
      for (var k = 0; k < patternTokens.length; k++) union[patternTokens[k]] = true;
      for (var k = 0; k < tokens.length; k++) inTokens[tokens[k]] = true;

      for (var k = 0; k < patternTokens.length; k++) {
        if (inTokens[patternTokens[k]]) {
          exactMatches++;
        } else {
          for (var l = 0; l < tokens.length; l++) {
            var maxL = Math.max(patternTokens[k].length, tokens[l].length);
            if (maxL === 0) continue;
            if (1 - levenshtein(patternTokens[k], tokens[l]) / maxL >= FUZZY_THRESHOLD) {
              fuzzyMatches++;
              break;
            }
          }
        }
      }

      var matchedTokens = exactMatches + fuzzyMatches;
      var unionSize = Object.keys(union).length;
      var jaccard = unionSize > 0 ? matchedTokens / unionSize : 0;
      var coverage = patternTokens.length > 0 ? matchedTokens / patternTokens.length : 0;
      var score = jaccard * 0.3 + coverage * 0.7;

      // Substring bonus
      if (normalized.includes(normPattern)) {
        score = Math.max(score, 0.5 + (normPattern.length / Math.max(normalized.length, 1)) * 0.4);
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = intent;
      }
    }
  }
  return bestScore >= 0.28 ? bestMatch : null;
}

function getResponseLang(inputText) {
  return inputText && /[\u0600-\u06FF]/.test(inputText) ? 'ar' : getAssistantLang();
}

function getAssistantResponse(intent, lang) {
  if (!lang) lang = getAssistantLang();
  if (intent && intent.response) {
    return intent.response[lang] || intent.response.en || '';
  }
  return ASSISTANT_FALLBACK[lang] || ASSISTANT_FALLBACK.en;
}

function getAssistantSuggestions(intent, lang) {
  if (!lang) lang = getAssistantLang();
  if (intent && intent.suggestions) {
    return intent.suggestions[lang] || intent.suggestions.en || [];
  }
  return [];
}

function getContextualSuggestions(lang) {
  if (!lang) lang = getAssistantLang();
  var ctx = getCurrentContext();

  var defaults = {
    en: ['How to watermark?', 'What is fingerprint?', 'Privacy & Security'],
    ar: ['كيفية العلامة المائية؟', 'ما هي البصمة؟', 'الخصوصية والأمان']
  };

  var contextMap = {
    'watermark': { en: ['How to embed?', 'How to extract?', 'What algorithm to use?'], ar: ['كيفية التضمين؟', 'كيفية الاستخراج؟', 'ما الخوارزمية المناسبة؟'] },
    'pixel-injection': { en: ['What is pixel injection?', 'How to inject?', 'Algorithm categories'], ar: ['ما هو حقن البكسل؟', 'كيفية الحقن؟', 'فئات الخوارزميات'] },
    'fingerprint': { en: ['What is fingerprint?', 'What algorithms?', 'What is it used for?'], ar: ['ما هي البصمة؟', 'ما الخوارزميات؟', 'ما فائدتها؟'] },
    'metadata': { en: ['What is metadata?', 'What info is stored?', 'How to read?'], ar: ['ما هي البيانات الوصفية؟', 'ما المعلومات المخزنة؟', 'كيفية القراءة؟'] },
    'timestamp': { en: ['How to create?', 'How to verify?', 'What is OTS?'], ar: ['كيفية الإنشاء؟', 'كيفية التحقق؟', 'ما هو OTS؟'] },
    'c2pa': { en: ['What is C2PA?', 'How to sign?', 'How to read?'], ar: ['ما هو C2PA؟', 'كيفية التوقيع؟', 'كيفية القراءة؟'] },
    'certificate': { en: ['What is Digital Passport?', 'How to generate?', 'Supported formats?'], ar: ['ما هو جواز السفر الرقمي؟', 'كيفية الإنشاء؟', 'الصيغ المدعومة؟'] },
    'converter': { en: ['What formats?', 'How to convert?', 'Image conversion'], ar: ['ما الصيغ؟', 'كيفية التحويل؟', 'تحويل الصور'] }
  };

  return contextMap[ctx] ? (contextMap[ctx][lang] || contextMap[ctx].en) : (defaults[lang] || defaults.en);
}

// ── Chat History ──
function loadChatHistory() {
  try {
    var h = localStorage.getItem('redosan_chat');
    return h ? JSON.parse(h) : [];
  } catch(e) { return []; }
}

function saveChatHistory(messages) {
  try {
    localStorage.setItem('redosan_chat', JSON.stringify(messages.slice(-50)));
  } catch(e) {}
}

function clearChatHistory() {
  try { localStorage.removeItem('redosan_chat'); } catch(e) {}
}

// ── UI ──
var ASSISTANT_OPEN = false;
var ASSISTANT_TOGGLE_LOCK = false;

function toggleAssistant() {
  if (ASSISTANT_TOGGLE_LOCK) return;
  ASSISTANT_TOGGLE_LOCK = true;
  setTimeout(function() { ASSISTANT_TOGGLE_LOCK = false; }, 300);
  var panel = document.getElementById('assistantPanel');
  var bubble = document.getElementById('assistantBubble');
  if (!panel || !bubble) return;
  ASSISTANT_OPEN = !ASSISTANT_OPEN;
  if (ASSISTANT_OPEN) {
    panel.classList.add('open');
    bubble.style.display = 'none';
    var msgArea = document.getElementById('assistantMessages');
    if (msgArea && msgArea.children.length === 0) {
      showInitialGreeting();
    }
    var input = document.getElementById('assistantInput');
    if (input) setTimeout(function() { input.focus(); }, 300);
  } else {
    panel.classList.remove('open');
    bubble.style.display = '';
  }
}

function showInitialGreeting() {
  var msgArea = document.getElementById('assistantMessages');
  if (!msgArea) return;
  var ctx = getCurrentContext();
  var lang = getAssistantLang();

  var initialMsg = ctx ? {
    en: '👋 Hi! I see you\'re on the **' + ctx.replace('-', ' ') + '** page. Need help with it?',
    ar: '👋 مرحباً! أراك في صفحة **' + (ctx === 'pixel-injection' ? 'حقن البكسل' : ctx === 'watermark' ? 'العلامة المائية' : ctx === 'fingerprint' ? 'البصمة' : ctx === 'metadata' ? 'البيانات الوصفية' : ctx === 'timestamp' ? 'الطابع الزمني' : ctx === 'c2pa' ? 'C2PA' : ctx === 'certificate' ? 'جواز السفر الرقمي' : ctx === 'converter' ? 'محول الملفات' : ctx) + '**. هل تحتاج مساعدة بها؟'
  } : ASSISTANT_GREETING;

  addMessage((initialMsg[lang] || initialMsg.en), 'bot');
  var suggestions = ctx ? getContextualSuggestions(lang) : getAssistantSuggestions(ASSISTANT_KB[0], lang);
  showSuggestions(suggestions, lang);
}

function showSuggestions(suggestions, lang) {
  var container = document.getElementById('assistantSuggestions');
  if (!container) return;
  container.innerHTML = '';
  if (!suggestions || suggestions.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  for (var i = 0; i < suggestions.length; i++) {
    var chip = document.createElement('button');
    chip.className = 'ast-chip';
    chip.textContent = suggestions[i];
    chip.onclick = function(s, l) { return function() {
      document.getElementById('assistantSuggestions').style.display = 'none';
      addMessage(s, 'user');
      var matched = matchAssistantIntent(s);
      setTimeout(function() {
        addMessage(getAssistantResponse(matched, l), 'bot');
        var sug = matched ? getAssistantSuggestions(matched, l) : getContextualSuggestions(l);
        showSuggestions(sug.length > 0 ? sug : getContextualSuggestions(l), l);
      }, 300);
    };}(suggestions[i], lang || getAssistantLang());
    container.appendChild(chip);
  }
}

function addMessage(text, role) {
  var msgArea = document.getElementById('assistantMessages');
  if (!msgArea) return;
  var div = document.createElement('div');
  div.className = 'ast-msg ast-msg-' + role;
  var isBot = role === 'bot';
  if (isBot) {
    var avatar = document.createElement('span');
    avatar.className = 'ast-avatar';
    div.appendChild(avatar);
  }
  var content = document.createElement('div');
  content.className = 'ast-content';
  content.textContent = '';
  var formatted = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  content.innerHTML = formatted;
  div.appendChild(content);
  msgArea.appendChild(div);
  msgArea.scrollTop = msgArea.scrollHeight;
  return div;
}

function sendAssistantMessage(text) {
  var input = document.getElementById('assistantInput');
  if (!text || text.trim() === '') {
    text = input ? input.value.trim() : '';
    if (!text) return;
    if (input) input.value = '';
  }

  addMessage(text, 'user');
  var history = loadChatHistory();
  history.push({ role: 'user', text: text });
  saveChatHistory(history);

  document.getElementById('assistantSuggestions').style.display = 'none';

  // Show typing indicator
  var typing = document.createElement('div');
  typing.className = 'ast-msg ast-msg-bot ast-typing';
  typing.innerHTML = '<div class="ast-typing-dots"><span></span><span></span><span></span></div>';
  var msgArea = document.getElementById('assistantMessages');
  msgArea.appendChild(typing);
  msgArea.scrollTop = msgArea.scrollHeight;

  // Simulate processing delay
  setTimeout(function() {
    if (typing.parentNode) typing.remove();
    var respLang = getResponseLang(text);
    var matched = matchAssistantIntent(text);
    var response = getAssistantResponse(matched, respLang);
    addMessage(response, 'bot');
    var suggestions = matched
      ? getAssistantSuggestions(matched, respLang)
      : getContextualSuggestions(respLang);
    showSuggestions(suggestions.length > 0 ? suggestions : getContextualSuggestions(respLang), respLang);
    history.push({ role: 'bot', text: response });
    saveChatHistory(history);
  }, 400 + Math.random() * 400);
}

function handleAssistantKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAssistantMessage();
  }
}

function initAssistant() {
  var lang = getAssistantLang();

  // Update i18n labels
  var title = document.querySelector('.ast-title');
  if (title) title.textContent = lang === 'ar' ? '🤖 مساعد RedoSan' : '🤖 RedoSan Assistant';

  var input = document.getElementById('assistantInput');
  if (input) input.placeholder = lang === 'ar' ? 'اكتب سؤالك هنا...' : 'Type your question...';

  var clearBtn = document.querySelector('.ast-clear-btn');
  if (clearBtn) {
    clearBtn.title = lang === 'ar' ? 'مسح المحادثة' : 'Clear chat';
    clearBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('assistantMessages').innerHTML = '';
      clearChatHistory();
      document.getElementById('assistantSuggestions').style.display = 'none';
    });
  }

  var closeBtn = document.querySelector('.ast-close-btn');
  if (closeBtn) {
    closeBtn.title = lang === 'ar' ? 'إغلاق' : 'Close';
    closeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleAssistant();
    });
  }

  var bubble = document.getElementById('assistantBubble');
  if (bubble) {
    bubble.setAttribute('aria-label', lang === 'ar' ? 'فتح المساعد' : 'Open assistant');
    bubble.addEventListener('touchend', function(e) {
      e.preventDefault();
      toggleAssistant();
    });
  }

  var sendBtn = document.querySelector('.ast-send-btn');
  if (sendBtn) sendBtn.addEventListener('click', sendAssistantMessage);

  if (input) {
    input.addEventListener('keydown', handleAssistantKeydown);
    input.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    });
  }

  // Show greeting after short delay
  setTimeout(showInitialGreeting, 1000);
}

// Auto-init
function ready(fn) {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}
ready(initAssistant);
