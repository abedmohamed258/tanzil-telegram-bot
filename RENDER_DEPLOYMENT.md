# دليل النشر على Render - Tanzil Bot

## مقدمة

هذا الدليل يوضح خطوة بخطوة كيفية نشر بوت Tanzil على **Render Free Tier**، مع التركيز على التحديات التقنية الخاصة بالبيئة المجانية (512MB RAM).

> [!WARNING]
> **Render Free Tier** له قيود صارمة على الموارد. يجب اتباع هذا الدليل بدقة لتجنب توقف البوت عن العمل.

## المتطلبات الأساسية

- [ ] حساب على [Render](https://render.com)
- [ ] حساب بوت تليجرام (احصل على Token من [@BotFather](https://t.me/botfather))
- [ ] Git repository (GitHub/GitLab) يحتوي على كود البوت
- [ ] فهم أساسي لـ Docker و Node.js

---

## الخطوة 1: إنشاء Dockerfile (إلزامي)

Render Free Tier لا يوفر بيئة تحتوي على Node.js + Python + FFmpeg معاً بشكل افتراضي. يجب إنشاء `Dockerfile` مخصص.

### Dockerfile

```dockerfile
# Use Node.js 18 with Debian Bullseye (stable)
FROM node:18-bullseye

# Install Python3, pip, and FFmpeg
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally
RUN pip3 install --no-cache-dir yt-dlp

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build TypeScript (if using TypeScript)
RUN npm run build || true

# Expose port for health checks (if using webhooks)
EXPOSE 3000

# Start the bot
CMD ["node", "dist/index.js"]
```

> [!NOTE]
> إذا كنت تستخدم JavaScript مباشرة (بدون TypeScript)، غيّر `CMD` إلى:
> ```dockerfile
> CMD ["node", "src/index.js"]
> ```

### .dockerignore

```
node_modules
npm-debug.log
.env
.git
.gitignore
README.md
*.md
```

---

## الخطوة 2: إعداد متغيرات البيئة

### .env.example

```bash
# Telegram Bot Token (from @BotFather)
BOT_TOKEN=your_bot_token_here

# Maximum file size in bytes (2GB for Telegram limit)
MAX_FILE_SIZE=2147483648

# Maximum concurrent downloads (CRITICAL: 2 max for 512MB RAM)
MAX_CONCURRENT_DOWNLOADS=2

# Download timeout in milliseconds (10 minutes)
DOWNLOAD_TIMEOUT=600000

# Webhook URL (only needed if using webhook mode)
WEBHOOK_URL=https://your-app-name.onrender.com/webhook

# Port for Express server (if using webhooks)
PORT=3000

# Temp directory for downloads
TEMP_DIR=/tmp/tanzil-downloads

# Log level (info, debug, error)
LOG_LEVEL=info
```

> [!IMPORTANT]
> لا تضع القيم الحقيقية في `.env.example`! استخدمها كقالب فقط.

---

## الخطوة 3: اختيار طريقة الاتصال (Webhook vs Long Polling)

### Option A: Webhooks (موصى به لـ Render ⭐)

**المزايا:**
- لا ينام السيرفر عند وصول رسائل من Telegram
- أكثر كفاءة في استخدام الموارد
- استجابة أسرع

**العيوب:**
- يتطلب Express server إضافي
- تكوين أكثر تعقيداً

#### تنفيذ Webhook Mode

**1. إنشاء Express Server**

```typescript
// src/server.ts
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Telegram bot
const bot = new TelegramBot(process.env.BOT_TOKEN!, { polling: false });

// Middleware
app.use(express.json());

// Health endpoint (للـ keep-alive checks)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Webhook endpoint
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Set webhook
bot.setWebHook(`${WEBHOOK_URL}/webhook`);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook set to: ${WEBHOOK_URL}/webhook`);
});

export { bot };
```

**2. تحديث package.json**

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "node-telegram-bot-api": "^0.64.0"
  }
}
```

---

### Option B: Long Polling + UptimeRobot

**المزايا:**
- أسهل في التنفيذ
- لا يتطلب Express server

**العيوب:**
- يحتاج خدمة خارجية (UptimeRobot) لمنع السكون
- استهلاك أكثر للموارد

#### تنفيذ Long Polling Mode

```typescript
// src/index.ts
import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.BOT_TOKEN!, { polling: true });

// Handle messages
bot.on('message', async (msg) => {
  // Your bot logic here
});

console.log('Bot is running in polling mode...');
```

#### إعداد UptimeRobot

1. افتح حساب على [UptimeRobot](https://uptimerobot.com)
2. أنشئ **HTTP(S) Monitor**
3. URL to Monitor: `https://your-app-name.onrender.com/health`
4. Monitoring Interval: **5 minutes**

---

## الخطوة 4: إنشاء render.yaml

ملف تكوين تلقائي للنشر على Render.

```yaml
services:
  - type: web
    name: tanzil-bot
    env: docker
    plan: free
    region: singapore # أو oregon (اختر الأقرب لك)
    
    # Build settings
    dockerfilePath: ./Dockerfile
    dockerContext: .
    
    # Environment variables
    envVars:
      - key: BOT_TOKEN
        sync: false # ستضيفها يدوياً في لوحة Render
      
      - key: MAX_FILE_SIZE
        value: 2147483648
      
      - key: MAX_CONCURRENT_DOWNLOADS
        value: 2
      
      - key: DOWNLOAD_TIMEOUT
        value: 600000
      
      - key: PORT
        value: 3000
      
      - key: TEMP_DIR
        value: /tmp/tanzil-downloads
      
      - key: LOG_LEVEL
        value: info
    
    # Health check endpoint (if using webhooks)
    healthCheckPath: /health
    
    # Auto-deploy on push
    autoDeploy: true
```

---

## الخطوة 5: النشر على Render

### A. من GitHub

1. **Push الكود إلى GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/tanzil-bot.git
   git push -u origin main
   ```

2. **ربط Render بـ GitHub**
   - اذهب إلى [Render Dashboard](https://dashboard.render.com)
   - اضغط **New +** → **Web Service**
   - اختر **Connect Git repository**
   - اخترGitHub repository الخاص بك

3. **تكوين الخدمة**
   - **Name**: `tanzil-bot`
   - **Environment**: `Docker`
   - **Plan**: `Free`
   - **Branch**: `main`

4. **إضافة Environment Variables**
   - اضغط **Advanced** → **Add Environment Variable**
   - أضف `BOT_TOKEN` بقيمته الحقيقية

5. **Deploy**
   - اضغط **Create Web Service**
   - انتظر حتى ينتهي البناء (5-10 دقائق)

### B. يدوياً (من الكود المحلي)

```bash
# Install Render CLI
npm install -g render-cli

# Login
render login

# Deploy
render deploy
```

---

## الخطوة 6: تفعيل Webhook (إذا اخترت Option A)

بعد نجاح النشر:

1. احصل على URL الخاص بخدمتك من Render Dashboard:
   ```
   https://tanzil-bot-xxxxx.onrender.com
   ```

2. **أضف متغير بيئة جديد:**
   - Key: `WEBHOOK_URL`
   - Value: `https://tanzil-bot-xxxxx.onrender.com`

3. **أعد تشغيل الخدمة** من لوحة Render

4. **تحقق من Webhook:**
   ```bash
   curl https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
   ```
   يجب أن ترى:
   ```json
   {
     "ok": true,
     "result": {
       "url": "https://tanzil-bot-xxxxx.onrender.com/webhook",
       "has_custom_certificate": false,
       "pending_update_count": 0
     }
   }
   ```

---

## الخطوة 7: مراقبة الموارد (CRITICAL)

### تنفيذ Circuit Breaker

```typescript
// src/utils/resourceMonitor.ts
export class ResourceMonitor {
  private readonly RAM_LIMIT = 512 * 1024 * 1024; // 512MB
  private readonly THRESHOLD = 0.9; // 90%

  checkMemory(): boolean {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed;
    const percentage = heapUsed / this.RAM_LIMIT;

    if (percentage > this.THRESHOLD) {
      console.error(`⚠️ RAM usage critical: ${(percentage * 100).toFixed(2)}%`);
      return false; // Circuit breaker activated
    }

    return true;
  }

  async cleanup(): Promise<void> {
    if (global.gc) {
      global.gc();
      console.log('🗑️ Manual garbage collection triggered');
    }
  }
}
```

### استخدام الـ Monitor في Queue

```typescript
// src/queue/requestQueue.ts
import { ResourceMonitor } from '../utils/resourceMonitor';

export class RequestQueue {
  private monitor = new ResourceMonitor();

  async processNext(): Promise<void> {
    // Check memory before processing
    if (!this.monitor.checkMemory()) {
      console.warn('⏸️ Queue paused due to high memory usage');
      await this.monitor.cleanup();
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      return;
    }

    // Process download...
  }
}
```

---

## استكشاف الأخطاء وحلها

### مشكلة 1: البوت لا يستجيب

**الأعراض:** لا يرد البوت على الرسائل

**الحلول:**
1. تحقق من Logs في Render Dashboard
2. تأكد من صحة `BOT_TOKEN`
3. إذا كنت تستخدم Webhook، تحقق من `getWebhookInfo`:
   ```bash
   curl https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
   ```
4. إذا كان Webhook معطّل، أعد تعيينه:
   ```bash
   curl https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-app.onrender.com/webhook
   ```

---

### مشكلة 2: البوت يتوقف بعد 15 دقيقة

**الأعراض:** البوت يعمل ثم يتوقف فجأة

**السبب:** Render Free Tier يُدخل الخدمة في وضع السكون بعد 15 دقيقة من عدم النشاط

**الحلول:**
- **إذا كنت تستخدم Webhook:** تأكد من أن Webhook مفعّل بشكل صحيح. Telegram سيوقظ السيرفر تلقائياً.
- **إذا كنت تستخدم Long Polling:** استخدم UptimeRobot (انظر الخطوة 3B)

---

### مشكلة 3: خطأ "Out of Memory"

**الأعراض:** البوت يتوقف مع رسالة خطأ OOM (Out of Memory)

**الأسباب:**
- تحميل عدة فيديوهات كبيرة في نفس الوقت
- عدم تنظيف الملفات المؤقتة

**الحلول:**
1. **تأكد من Queue System يعمل بشكل صحيح:**
   - `MAX_CONCURRENT_DOWNLOADS` يجب أن يكون `1` أو `2` فقط
2. **تفعيل Garbage Collection:**
   ```bash
   # في Dockerfile، غيّر CMD إلى:
   CMD ["node", "--expose-gc", "dist/index.js"]
   ```
3. **تنظيف عدواني للملفات:**
   ```typescript
   // بعد كل تحميل ناجح:
   await fileManager.deleteFile(filePath);
   ```

---

### مشكلة 4: yt-dlp لا يعمل

**الأعراض:** أخطاء عند تشغيل yt-dlp

**الحلول:**
1. تأكد من أن Dockerfile يحتوي على:
   ```dockerfile
   RUN pip3 install --no-cache-dir yt-dlp
   ```
2. تحقق من PATH:
   ```typescript
   const { execSync } = require('child_process');
   const ytdlpPath = execSync('which yt-dlp').toString().trim();
   console.log('yt-dlp path:', ytdlpPath);
   ```

---

### مشكلة 5: Instagram/YouTube Private Videos

**الأعراض:** خطأ "Sign in to confirm your age" أو "Video unavailable"

**الحل:** إضافة Cookies Support

```typescript
// src/download/downloadManager.ts
import fs from 'fs';

export class DownloadManager {
  async downloadVideo(url: string, format: string): Promise<string> {
    const cookiesPath = '/app/cookies.txt'; // ضع ملف cookies في الـ repo
    
    const args = [
      '-f', format,
      '--cookies', cookiesPath, // إضافة cookies
      '-o', outputPath,
      url
    ];
    
    // Execute yt-dlp...
  }
}
```

**كيفية الحصول على cookies.txt:**
1. استخدم browser extension مثل "Get cookies.txt" (Chrome/Firefox)
2. سجّل دخول إلى Instagram/YouTube
3. صدّر ملف `cookies.txt`
4. ضعه في مجلد المشروع (لا تدفعه إلى Git!)

---

## Monitoring & Logging

### تفعيل Structured Logging

```typescript
// src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Usage:
logger.info('Download started', { userId, url, format });
logger.error('Download failed', { userId, error: err.message });
```

### مراقبة الأداء

```typescript
// src/utils/metrics.ts
export class Metrics {
  private static downloads = 0;
  private static failures = 0;
  
  static recordDownload(success: boolean): void {
    if (success) {
      this.downloads++;
    } else {
      this.failures++;
    }
    
    console.log(`📊 Stats - Success: ${this.downloads}, Failed: ${this.failures}`);
  }
}
```

---

## Best Practices للـ Free Tier

1. **استخدم Queue System دائماً** - لا تسمح بأكثر من تحميلين متزامنين
2. **نظّف الملفات فوراً** - احذف الملف مباشرة بعد الإرسال
3. **استخدم Webhooks** - أكثر موثوقية من Long Polling
4. **راقب الذاكرة** - أضف circuit breaker عند 90% استخدام
5. **حدّد حجم الملف** - لا تسمح بتحميل ملفات > 500MB
6. **استخدم Timeout** - أوقف التحميل بعد 10 دقائق
7. **لا تخزّن البيانات** - استخدم ephemeral storage فقط

---

## الخلاصة

بهذا الدليل أصبح لديك كل ما تحتاجه لنشر بوت Tanzil على Render Free Tier بنجاح. تذكّر:

- ✅ استخدم Dockerfile المخصص
- ✅ نفّذ Queue System
- ✅ استخدم Webhooks (موصى به)
- ✅ راقب استهلاك الذاكرة
- ✅ نظّف الملفات المؤقتة

**حظاً موفقاً! 🚀**
