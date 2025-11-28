# Implementation Plan

- [ ] 1. إعداد بنية المشروع والتكوين الأساسي
  - إنشاء مشروع Node.js مع TypeScript
  - تثبيت المكتبات المطلوبة (node-telegram-bot-api, yt-dlp wrapper)
  - إعداد ملفات التكوين (tsconfig.json, package.json)
  - إنشاء بنية المجلدات (src/bot, src/download, src/utils, src/types)
  - إعداد متغيرات البيئة (.env.example)
  - _Requirements: 9.4_

- [ ] 2. تنفيذ نظام التحقق من الروابط واستخراجها
- [ ] 2.1 إنشاء URLValidator class
  - كتابة دالة استخراج الروابط من النصوص
  - كتابة دالة التحقق من صحة الروابط
  - كتابة دالة التعرف على المنصات المدعومة
  - _Requirements: 1.1, 1.2, 6.1_

- [ ]* 2.2 كتابة اختبار خاصية لاستخراج الروابط
  - **Property 1: URL Extraction Consistency**
  - **Validates: Requirements 1.1**

- [ ]* 2.3 كتابة اختبار خاصية للتحقق من الروابط
  - **Property 2: URL Validation Correctness**
  - **Validates: Requirements 1.2**

- [ ]* 2.4 كتابة اختبار خاصية لدعم المنصات
  - **Property 11: Platform Support Verification**
  - **Validates: Requirements 6.1**

- [ ] 3. تنفيذ مدير التحميل (DownloadManager)
- [ ] 3.1 إنشاء DownloadManager class
  - كتابة دالة الحصول على معلومات الفيديو
  - كتابة دالة عرض الجودات المتاحة
  - كتابة دالة تحميل الفيديو
  - كتابة دالة تحميل الصوت فقط
  - تنفيذ منطق إعادة المحاولة عند الفشل
  - _Requirements: 1.3, 2.1, 3.1, 4.2, 8.4_

- [ ]* 3.2 كتابة اختبار خاصية لمنطق إعادة المحاولة
  - **Property 15: Retry Logic Consistency**
  - **Validates: Requirements 8.4**

- [ ]* 3.3 كتابة اختبار خاصية لصيغة الصوت
  - **Property 8: Audio Format Validation**
  - **Validates: Requirements 4.2, 4.3**

- [ ] 4. تنفيذ مدير الملفات (FileManager)
- [ ] 4.1 إنشاء FileManager class
  - كتابة دالة إنشاء مسارات مؤقتة
  - كتابة دالة حفظ الملفات
  - كتابة دالة حذف الملفات
  - كتابة دالة تنظيف الجلسات
  - كتابة دالة التحقق من حجم الملف
  - _Requirements: 5.4, 10.1, 10.2_

- [ ]* 4.2 كتابة اختبار خاصية لتنظيف الملفات بعد الرفع
  - **Property 18: File Cleanup After Upload**
  - **Validates: Requirements 10.1**

- [ ]* 4.3 كتابة اختبار خاصية لتنظيف الجلسات
  - **Property 19: Session Cleanup Completeness**
  - **Validates: Requirements 10.2**

- [ ] 5. تنفيذ مدير الجلسات (SessionManager)
- [ ] 5.1 إنشاء SessionManager class
  - كتابة دالة إنشاء جلسة جديدة
  - كتابة دالة استرجاع الجلسة
  - كتابة دالة تحديث الجلسة
  - كتابة دالة حذف الجلسة
  - كتابة دالة تنظيف الجلسات المنتهية
  - _Requirements: 3.1, 8.5_

- [ ]* 5.2 كتابة اختبار خاصية لاستقلالية الطلبات
  - **Property 21: Request Independence**
  - **Validates: Requirements 10.5**

- [ ] 6. تنفيذ معالج الأخطاء (ErrorHandler)
- [ ] 6.1 إنشاء ErrorHandler class
  - كتابة دالة معالجة الأخطاء العامة
  - كتابة دالة تحويل الأخطاء لرسائل مستخدم
  - كتابة دالة تنظيف الموارد عند الخطأ
  - تعريف أنواع الأخطاء المخصصة
  - _Requirements: 1.4, 1.5, 3.5, 4.5, 6.5_

- [ ]* 6.2 كتابة اختبار خاصية لرسائل الخطأ للمنصات غير المدعومة
  - **Property 12: Unsupported Platform Error Message**
  - **Validates: Requirements 6.3**

- [ ] 7. تنفيذ نظام السجلات (Logging)
- [ ] 7.1 إعداد Winston logger
  - تكوين مستويات السجلات
  - إعداد تنسيق السجلات
  - تنفيذ تصفية المعلومات الحساسة
  - _Requirements: 9.2, 9.3, 10.4_

- [ ]* 7.2 كتابة اختبار خاصية لاكتمال السجلات
  - **Property 16: Operation Logging Completeness**
  - **Validates: Requirements 9.2**

- [ ]* 7.3 كتابة اختبار خاصية لتفاصيل سجلات الأخطاء
  - **Property 17: Error Logging Detail**
  - **Validates: Requirements 9.3**

- [ ]* 7.4 كتابة اختبار خاصية لخصوصية السجلات
  - **Property 20: Log Privacy Preservation**
  - **Validates: Requirements 10.4**

- [ ] 8. تنفيذ معالج البوت (BotHandler)
- [ ] 8.1 إنشاء BotHandler class
  - تهيئة اتصال البوت بـ Telegram
  - كتابة معالج الرسائل النصية
  - كتابة معالج أزرار الاختيار (CallbackQuery)
  - كتابة دالة إرسال الرسائل
  - كتابة دالة إرسال الملفات مع البيانات الوصفية
  - _Requirements: 2.3, 3.2, 5.1, 5.2, 5.3_

- [ ]* 8.2 كتابة اختبار خاصية لرسائل الحالة
  - **Property 7: Status Message Consistency**
  - **Validates: Requirements 3.2**

- [ ]* 8.3 كتابة اختبار خاصية للبيانات الوصفية للفيديو
  - **Property 9: Metadata Inclusion for Videos**
  - **Validates: Requirements 5.2**

- [ ]* 8.4 كتابة اختبار خاصية للبيانات الوصفية للصوت
  - **Property 10: Metadata Inclusion for Audio**
  - **Validates: Requirements 5.3**

- [ ] 9. تنفيذ معالجات الأوامر
- [ ] 9.1 إنشاء Command Handlers
  - كتابة معالج أمر /start
  - كتابة معالج أمر /help
  - كتابة معالج الأوامر غير الصالحة
  - _Requirements: 7.1, 7.2, 7.5_

- [ ]* 9.2 كتابة اختبارات للأوامر الأساسية
  - اختبار أمر /start
  - اختبار أمر /help
  - _Requirements: 7.1, 7.2_

- [ ]* 9.3 كتابة اختبار خاصية لمحتوى المساعدة
  - **Property 13: Help Content Completeness**
  - **Validates: Requirements 7.3, 7.4**

- [ ]* 9.4 كتابة اختبار خاصية للأوامر غير الصالحة
  - **Property 14: Invalid Command Response**
  - **Validates: Requirements 7.5**

- [ ] 10. تنفيذ تدفق عرض الجودات واختيارها
- [ ] 10.1 إنشاء Quality Display Handler
  - كتابة دالة تنسيق خيارات الجودة
  - كتابة دالة إنشاء أزرار الاختيار
  - كتابة دالة معالجة اختيار الجودة
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1_

- [ ]* 10.2 كتابة اختبار خاصية لاكتمال عرض الجودات
  - **Property 3: Quality Options Display Completeness**
  - **Validates: Requirements 2.1**

- [ ]* 10.3 كتابة اختبار خاصية لتنسيق خيارات الجودة
  - **Property 4: Quality Option Format Consistency**
  - **Validates: Requirements 2.2**

- [ ]* 10.4 كتابة اختبار خاصية لتوليد الأزرار
  - **Property 5: Button Generation Correspondence**
  - **Validates: Requirements 2.3, 2.5**

- [ ]* 10.5 كتابة اختبار خاصية لبدء التحميل
  - **Property 6: Download Initiation Reliability**
  - **Validates: Requirements 3.1**

- [ ] 11. تنفيذ تدفق التحميل الكامل
- [ ] 11.1 ربط جميع المكونات معاً
  - دمج URLValidator مع BotHandler
  - دمج DownloadManager مع SessionManager
  - دمج FileManager مع BotHandler
  - تنفيذ تدفق التحميل من البداية للنهاية
  - تنفيذ تحديثات التقدم
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 3.1, 3.2, 3.3, 3.4, 5.1_

- [ ]* 11.2 كتابة اختبارات التكامل للتدفق الكامل
  - اختبار تدفق تحميل الفيديو الكامل
  - اختبار تدفق تحميل الصوت فقط
  - اختبار معالجة الأخطاء
  - _Requirements: 1.1, 3.4, 4.4, 5.1_

- [ ] 12. نقطة تفتيش - التأكد من نجاح جميع الاختبارات
  - التأكد من نجاح جميع الاختبارات، اسأل المستخدم إذا ظهرت أسئلة.

- [ ] 13. تنفيذ نظام طابور الطلبات (Request Queue System)
- [ ] 13.1 إنشاء RequestQueue class
  - كتابة دالة إضافة طلب للطابور
  - كتابة دالة معالجة الطلب التالي
  - كتابة دالة الحصول على حالة الطابور
  - تنفيذ حد أقصى للطلبات المتزامنة (2 بحد أقصى)
  - إضافة تتبع استهلاك الذاكرة
  - _Requirements: 8.3_
  - **CRITICAL**: ضروري لمنع انهيار السيرفر على Render Free Tier (512MB RAM)

- [ ] 14. إعداد ملفات النشر على Render
- [ ] 14.1 إنشاء Dockerfile (إلزامي لـ Render)
  - استخدام Node.js 18 base image (node:18-bullseye)
  - تثبيت Python3 و pip
  - تثبيت FFmpeg من apt
  - تثبيت yt-dlp عبر pip3
  - نسخ الكود وتثبيت dependencies
  - تعريف CMD لتشغيل البوت
  - **CRITICAL**: بدون هذا لن يعمل البوت على Render

- [ ] 14.2 إنشاء ملفات التكوين
  - كتابة README.md مع تعليمات النشر على Render
  - إنشاء .env.example (BOT_TOKEN, MAX_FILE_SIZE, MAX_CONCURRENT_DOWNLOADS=2)
  - كتابة render.yaml للنشر التلقائي
  - توثيق متطلبات الموارد (512MB RAM minimum)

- [ ] 14.3 إعداد Webhook Mode (موصى به لـ Render)
  - إنشاء Express server بسيط
  - إضافة endpoint `/webhook` لاستقبال رسائل Telegram
  - إضافة endpoint `/health` للـ keep-alive checks
  - تكوين Telegram webhook URL
  - **Alternative**: Long Polling + UptimeRobot pinging
  - _Requirements: 9.4_

- [ ] 14.4 تنفيذ آليات مراقبة الموارد
  - إضافة دالة لمراقبة استهلاك RAM
  - إضافة circuit breaker عند RAM > 90%
  - تسجيل تحذيرات عند اقتراب الحدود
  - إضافة cleanup تلقائي للملفات المؤقتة

- [ ] 15. نقطة تفتيش نهائية - التأكد من نجاح جميع الاختبارات
  - التأكد من نجاح جميع الاختبارات
  - التحقق من عمل الـ Dockerfile محلياً
  - اختبار الـ queue system تحت ضغط
  - اسأل المستخدم إذا ظهرت أسئلة
