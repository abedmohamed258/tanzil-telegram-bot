# Tanzil Telegram Bot

<div align="center">
  <img src="logo.png" alt="Tanzil Bot Logo" width="200"/>
  
  <p><strong>بوت تليجرام لتحميل الفيدي وهات من مواقع متعددة</strong></p>
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
</div>

---

## 📋 المحتويات

- [نظرة عامة](#-نظرة-عامة)
- [المميزات](#-المميزات)
- [المتطلبات](#-المتطلبات)
- [التثبيت](#-التثبيت)
- [التكوين](#-التكوين)
- [التشغيل](#-التشغيل)
- [النشر على Render](#-النشر-على-render)
- [البنية المعمارية](#-البنية-المعمارية)
- [الملفات الرئيسية](#-الملفات-الرئيسية)

---

## 🎯 نظرة عامة

**Tanzil** هو بوت تليجرام مبني بـ TypeScript يتيح للمستخدمين تحميل الفيديوهات والصوتيات من مواقع متعددة باستخدام `yt-dlp`. البوت مُحسّن خصيصاً للعمل على **Render Free Tier** مع قيود الذاكرة (512MB RAM).

---

## ✨ المميزات

- ✅ **تحميل من مواقع متعددة**: YouTube, Facebook, Twitter/X, Instagram, TikTok, Vimeo, Dailymotion
- ✅ **خيارات جودة متعددة**: اختر الجودة المناسبة لك
- ✅ **تحميل الصوت فقط**: استخرج الصوت بصيغة MP3
- ✅ **نظام طابور ذكي**: معالجة الطلبات بشكل منظم (حد أقصى 2 تحميلات متزامنة)
- ✅ **مراقبة الموارد**: Circuit breaker لمنع استهلاك الذاكرة الزائد
- ✅ **دعم Webhook & Polling**: مرونة في طريقة الاتصال بـ Telegram
- ✅ **إعادة المحاولة التلقائية**: 3 محاولات عند فشل التحميل
- ✅ **تنظيف تلقائي**: حذف الملفات المؤقتة فوراً بعد الإرسال

---

## 📦 المتطلبات

- **Node.js** >= 18.0.0
- **Python3** (لـ yt-dlp)
- **FFmpeg** (لدمج الصوت والصورة)
- **yt-dlp** (سيتم تثبيته عبر pip3)
- حساب بوت على Telegram (احصل على Token من [@BotFather](https://t.me/botfather))

---

## 🛠 التثبيت

### 1. استنساخ المشروع

```bash
git clone https://github.com/your-username/tanzil-bot.git
cd tanzil-bot
```

### 2. تثبيت المكتبات

```bash
npm install
```

### 3. إعداد البيئة

```bash
cp .env.example .env
```

عدّل ملف `.env` وأضف `BOT_TOKEN` الخاص بك من @BotFather.

---

## ⚙️ التكوين

### ملف `.env`

```bash
BOT_TOKEN=your_bot_token_here
MAX_FILE_SIZE=2147483648              # 2GB
MAX_CONCURRENT_DOWNLOADS=2            # CRITICAL for 512MB RAM
DOWNLOAD_TIMEOUT=600000               # 10 minutes
WEBHOOK_URL=https://your-app.onrender.com  # For webhook mode
PORT=3000
TEMP_DIR=/tmp/tanzil-downloads
LOG_LEVEL=info
USE_WEBHOOK=true                      # Recommended for Render
```

---

## 🚀 التشغيل

### التطوير المحلي (Polling Mode)

```bash
# تثبيت yt-dlp (إذا لم يكن مثبتاً)
pip3 install yt-dlp

# تشغيل البوت
npm run dev
```

### الإنتاج (Production Build)

```bash
npm run build
npm start
```

---

## 🌐 النشر على Render

### خطوات النشر السريع

1. **Push الكود إلى GitHub**

```bash
git init
git add .
git commit -m "Initial commit"
git push origin main
```

2. **إنشاء Web Service على Render**
   - اذهب إلى [Render Dashboard](https://dashboard.render.com)
   - اختر **New** → **Web Service**
   - اربط GitHub repository
   - اختر **Environment**: Docker
   - اختر **Plan**: Free

3. **إضافة Environment Variables**
   - أضف `BOT_TOKEN` بقيمته الحقيقية
   - باقي المتغيرات موجودة في `render.yaml`

4. **Deploy!**
   - اضغط **Create Web Service**
   - انتظر 5-10 دقائق للبناء

للمزيد من التفاصيل، راجع [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md).

---

## 🏗 البنية المعمارية

```
src/
├── bot/
│   └── botHandler.ts          # معالج البوت والرسائل
├── download/
│   └── downloadManager.ts     # إدارة التحميل عبر yt-dlp
├── queue/
│   └── requestQueue.ts        # نظام الطابور (حرج للأداء)
├── utils/
│   ├── config.ts              # تحميل التكوين
│   ├── fileManager.ts         # إدارة الملفات المؤقتة
│   ├── logger.ts              # Winston logging
│   ├── resourceMonitor.ts     # مراقبة الذاكرة وCircuit Breaker
│   └── urlValidator.ts        # التحقق من الروابط
├── types/
│   └── index.ts               # TypeScript interfaces
├── server.ts                  # Express server (Webhooks)
└── index.ts                   # نقطة البداية الرئيسية
```

### مخطط التدفق

```
User → Telegram → Webhook/Polling → BotHandler
                                        ↓
                                  URLValidator
                                        ↓
                                  RequestQueue ← ResourceMonitor
                                        ↓
                                DownloadManager (yt-dlp)
                                        ↓
                                  FileManager
                                        ↓
                                Telegram (Send File)
                                        ↓
                                 Cleanup Files
```

---

## 📁 الملفات الرئيسية

| الملف | الوصف |
|------|-------|
| `Dockerfile` | بناء Docker بـ Node.js + Python + FFmpeg |
| `render.yaml` | تكوين Render التلقائي |
| `requirements.md` | متطلبات المشروع (User Stories) |
| `design.md` | التصميم المعماري والواجهات |
| `tasks.md` | خطة التنفيذ خطوة بخطوة |
| `RENDER_DEPLOYMENT.md` | دليل شامل للنشر على Render |

---

## 🔧 استكشاف الأخطاء

### البوت لا يستجيب

```bash
# تحقق من Webhook status
curl https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
```

### خطأ Out of Memory

- تأكد من `MAX_CONCURRENT_DOWNLOADS=2`
- تحقق من تفعيل garbage collection: `--expose-gc`

للمزيد من الحلول، راجع [RENDER_DEPLOYMENT.md - استكشاف الأخطاء](RENDER_DEPLOYMENT.md#استكشاف-الأخطاء-وحلها).

---

## 📖 المستندات

- [Requirements](requirements.md) - متطلبات المشروع التفصيلية
- [Design Document](design.md) - البنية المعمارية والواجهات
- [Tasks](tasks.md) - خطة التنفيذ
- [Render Deployment Guide](RENDER_DEPLOYMENT.md) - دليل النشر الشامل

---

## 📝 الترخيص

MIT License - راجع [LICENSE](LICENSE) للتفاصيل.

---

## 🤝 المساهمة

المساهمات مرحب بها! افتح Issue أو Pull Request.

---

## 💬 الدعم

للدعم والاستفسارات: [@YourSupportUsername](https://t.me/YourSupportUsername)

---

<div align="center">
  <p>صُنع بـ ❤️ باستخدام TypeScript & yt-dlp</p>
</div>
