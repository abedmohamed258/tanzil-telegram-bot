# Design Document - Tanzil Telegram Bot

## Overview

Tanzil هو بوت تليجرام مبني على Node.js يستخدم مكتبة `node-telegram-bot-api` للتفاعل مع Telegram API و `yt-dlp` (خليفة youtube-dl) لتحميل الفيديوهات من مواقع متعددة. يتبع البوت معمارية modular تفصل بين طبقة التليجرام، منطق معالجة الطلبات، وخدمات التحميل.

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│  Telegram API   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Bot Handler   │  ◄── Command Router
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Download Manager│
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│ yt-dlp │ │ File Mgr │
└────────┘ └──────────┘
```

### Component Layers

1. **Presentation Layer**: Telegram Bot Interface
   - Handles incoming messages and commands
   - Sends responses and files to users
   - Manages inline keyboards for user interaction

2. **Business Logic Layer**: Download Manager
   - Validates URLs and extracts video information
   - Manages download sessions
   - Handles format selection and conversion

3. **Infrastructure Layer**: External Services
   - yt-dlp wrapper for video downloads
   - File system management for temporary storage
   - Logging and error handling

## Components and Interfaces

### 1. Request Queue (`RequestQueue`)

**Responsibilities:**

- Queue incoming download requests to prevent RAM overload
- Process downloads sequentially or with limited concurrency (max 2)
- Track queue position and notify users of their status

**Interface:**

```typescript
interface RequestQueue {
  addRequest(request: DownloadRequest): Promise<string>; // returns queue position
  processNext(): Promise<void>;
  getQueueStatus(userId: number): QueueStatus;
  removeRequest(requestId: string): void;
}

interface DownloadRequest {
  id: string;
  userId: number;
  chatId: number;
  url: string;
  format?: string;
  priority: number;
}

interface QueueStatus {
  position: number;
  totalInQueue: number;
  estimatedWaitTime: number; // in seconds
}
```

### 2. Bot Handler (`BotHandler`)

**Responsibilities:**

- Initialize Telegram bot connection
- Route commands to appropriate handlers
- Manage user sessions and state

**Interface:**

```typescript
interface BotHandler {
  start(): Promise<void>;
  handleMessage(message: TelegramMessage): Promise<void>;
  handleCallbackQuery(query: CallbackQuery): Promise<void>;
  sendMessage(
    chatId: number,
    text: string,
    options?: MessageOptions,
  ): Promise<void>;
  sendFile(chatId: number, file: Buffer, metadata: FileMetadata): Promise<void>;
}
```

### 3. Download Manager (`DownloadManager`)

**Responsibilities:**

- Validate and extract video information
- Manage download process via yt-dlp (executed as external process)
- Handle format conversion
- Support cookies for platforms requiring authentication (Instagram, some YouTube videos)

**Interface:**

```typescript
interface DownloadManager {
  getVideoInfo(url: string, cookies?: string): Promise<VideoInfo>;
  listFormats(url: string): Promise<Format[]>;
  downloadVideo(
    url: string,
    formatId: string,
    outputPath: string,
    cookies?: string,
  ): Promise<DownloadResult>;
  downloadAudio(url: string, outputPath: string): Promise<DownloadResult>;
  cleanup(sessionId: string): Promise<void>;
}

interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  formats: Format[];
}

interface Format {
  formatId: string;
  quality: string;
  extension: string;
  filesize: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
}
```

> [!NOTE]
> **yt-dlp Integration**: yt-dlp должен يتم تشغيله كـ **external process** باستخدام `child_process.spawn()` وليس كـ wrapper مباشر، للحصول على تحكم أفضل في الموارد والأخطاء.

> [!IMPORTANT]
> **Cookies Support**: لتجنب حظر البوتات على Instagram وبعض فيديوهات YouTube الخاصة، يجب توفير آلية لتمرير ملف `cookies.txt` إلى yt-dlp عبر معامل `--cookies`.

### 4. URL Validator (`URLValidator`)

**Responsibilities:**

- Validate URL format
- Check if platform is supported
- Extract platform-specific identifiers

**Interface:**

```typescript
interface URLValidator {
  isValid(url: string): boolean;
  getSupportedPlatforms(): string[];
  extractPlatform(url: string): string | null;
}
```

### 5. File Manager (`FileManager`)

**Responsibilities:**

- Manage temporary file storage
- Clean up old files
- Handle file size validation

**Interface:**

```typescript
interface FileManager {
  createTempPath(sessionId: string): string;
  saveFile(sessionId: string, data: Buffer): Promise<string>;
  deleteFile(path: string): Promise<void>;
  cleanupSession(sessionId: string): Promise<void>;
  getFileSize(path: string): Promise<number>;
}
```

> [!WARNING]
> **Render Ephemeral Disk**: على Render Free Tier، القرص مؤقت (ephemeral). عند إعادة تشغيل البوت، ستختفي جميع الملفات. لا تعتمد على وجود الملفات لفترة طويلة، واحذف الملفات فوراً بعد الإرسال.

### 6. Session Manager (`SessionManager`)

**Responsibilities:**

- Track active download sessions
- Store user state and preferences
- Manage session timeouts

**Interface:**

```typescript
interface SessionManager {
  createSession(userId: number, url: string): Session;
  getSession(sessionId: string): Session | null;
  updateSession(sessionId: string, updates: Partial<Session>): void;
  deleteSession(sessionId: string): void;
  cleanupExpiredSessions(): void;
}

interface Session {
  id: string;
  userId: number;
  url: string;
  videoInfo?: VideoInfo;
  selectedFormat?: string;
  createdAt: Date;
  expiresAt: Date;
}
```

## Data Models

### TelegramMessage

```typescript
interface TelegramMessage {
  messageId: number;
  chatId: number;
  userId: number;
  text?: string;
  date: number;
}
```

### CallbackQuery

```typescript
interface CallbackQuery {
  id: string;
  from: User;
  message: TelegramMessage;
  data: string;
}
```

### FileMetadata

```typescript
interface FileMetadata {
  filename: string;
  title: string;
  duration?: number;
  mimeType: string;
  thumbnail?: Buffer;
}
```

### DownloadProgress

```typescript
interface DownloadProgress {
  sessionId: string;
  percentage: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: number;
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: URL Extraction Consistency

_For any_ message text containing a valid URL, the URL extraction function should successfully identify and extract the URL regardless of its position in the text.
**Validates: Requirements 1.1**

### Property 2: URL Validation Correctness

_For any_ URL from a supported platform, the validation function should return true, and for any URL from an unsupported platform, it should return false.
**Validates: Requirements 1.2**

### Property 3: Quality Options Display Completeness

_For any_ video with available quality options, the display function should include all options in the output.
**Validates: Requirements 2.1**

### Property 4: Quality Option Format Consistency

_For any_ quality option, the displayed text should contain both resolution and file size information.
**Validates: Requirements 2.2**

### Property 5: Button Generation Correspondence

_For any_ set of quality options, the number of generated interactive buttons should equal the number of options plus one for audio-only.
**Validates: Requirements 2.3, 2.5**

### Property 6: Download Initiation Reliability

_For any_ valid format selection, clicking the corresponding button should create a new download session with the correct format ID.
**Validates: Requirements 3.1**

### Property 7: Status Message Consistency

_For any_ download that starts, a status message should be sent to the user before the download begins.
**Validates: Requirements 3.2**

### Property 8: Audio Format Validation

_For any_ audio extraction operation, the resulting file should have an audio-only format (MP3 or M4A) and no video stream.
**Validates: Requirements 4.2, 4.3**

### Property 9: Metadata Inclusion for Videos

_For any_ video file sent to a user, the message should include title and duration metadata.
**Validates: Requirements 5.2**

### Property 10: Metadata Inclusion for Audio

_For any_ audio file sent to a user, the message should include title and duration metadata.
**Validates: Requirements 5.3**

### Property 11: Platform Support Verification

_For any_ URL from YouTube, Facebook, Twitter, or Instagram, the validation function should recognize it as supported.
**Validates: Requirements 6.1**

### Property 12: Unsupported Platform Error Message

_For any_ URL from an unsupported platform, the error message should include a list of supported platforms.
**Validates: Requirements 6.3**

### Property 13: Help Content Completeness

_For any_ help message generated, it should contain both URL examples and a list of supported platforms.
**Validates: Requirements 7.3, 7.4**

### Property 14: Invalid Command Response

_For any_ text that is not a valid command or URL, the bot should respond with a suggestion to use the "/help" command.
**Validates: Requirements 7.5**

### Property 15: Retry Logic Consistency

_For any_ download that fails due to network error, the system should attempt exactly 3 retries before reporting final failure.
**Validates: Requirements 8.4**

### Property 16: Operation Logging Completeness

_For any_ bot operation (message received, download started, file sent), a corresponding log entry should be created.
**Validates: Requirements 9.2**

### Property 17: Error Logging Detail

_For any_ error that occurs, the log entry should include the error message and stack trace.
**Validates: Requirements 9.3**

### Property 18: File Cleanup After Upload

_For any_ file successfully uploaded to Telegram, the file should be deleted from local storage immediately after upload completion.
**Validates: Requirements 10.1**

### Property 19: Session Cleanup Completeness

_For any_ download session that completes or fails, all temporary files associated with that session should be deleted.
**Validates: Requirements 10.2**

### Property 20: Log Privacy Preservation

_For any_ log entry, it should not contain user IDs, chat IDs, or personal information beyond what's necessary for debugging.
**Validates: Requirements 10.4**

### Property 21: Request Independence

_For any_ two consecutive requests from the same user, processing the second request should not be affected by data from the first request.
**Validates: Requirements 10.5**

## Error Handling

### Error Categories

1. **User Input Errors**
   - Invalid URL format
   - Unsupported platform
   - Invalid command
   - Response: User-friendly error message with guidance

2. **External Service Errors**
   - yt-dlp execution failure
   - Network timeout
   - Platform API changes
   - Response: Retry logic (up to 3 attempts), then inform user

3. **System Errors**
   - File system errors
   - Memory limitations
   - Telegram API errors
   - Response: Log error, cleanup resources, notify user

4. **Resource Errors**
   - File too large for Telegram
   - Disk space insufficient
   - Session timeout
   - Response: Clear error message, cleanup, suggest alternatives

### Error Handling Strategy

```typescript
class ErrorHandler {
  async handleError(error: Error, context: ErrorContext): Promise<void> {
    // Log error with context
    logger.error({
      error: error.message,
      stack: error.stack,
      context,
    });

    // Cleanup resources
    await this.cleanup(context.sessionId);

    // Notify user
    await this.notifyUser(context.chatId, this.getUserMessage(error));
  }

  private getUserMessage(error: Error): string {
    if (error instanceof URLValidationError) {
      return 'عذراً، الرابط غير صالح أو من موقع غير مدعوم. استخدم /help لرؤية المواقع المدعومة.';
    }
    if (error instanceof DownloadError) {
      return 'حدث خطأ أثناء التحميل. يرجى المحاولة مرة أخرى.';
    }
    if (error instanceof FileSizeError) {
      return 'حجم الملف كبير جداً لإرساله عبر تليجرام. جرب جودة أقل.';
    }
    return 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.';
  }
}
```

## Testing Strategy

### Unit Testing

سنستخدم **Jest** كإطار عمل للاختبار. الاختبارات الوحدوية ستغطي:

1. **URL Validation Tests**
   - Test valid URLs from supported platforms
   - Test invalid URL formats
   - Test URLs from unsupported platforms

2. **Format Selection Tests**
   - Test quality option parsing
   - Test audio-only format selection
   - Test format filtering logic

3. **File Management Tests**
   - Test temporary file creation
   - Test file cleanup
   - Test file size validation

4. **Session Management Tests**
   - Test session creation and retrieval
   - Test session expiration
   - Test concurrent session handling

### Property-Based Testing

سنستخدم **fast-check** لاختبار الخصائص. كل اختبار خاصية سيتم تشغيله لـ 100 تكرار على الأقل.

**متطلبات اختبار الخصائص:**

- كل اختبار خاصية يجب أن يُشير بوضوح إلى الخاصية من مستند التصميم
- صيغة التعليق: `// Feature: tanzil-telegram-bot, Property X: [property text]`
- كل خاصية صحة يجب أن تُنفذ باختبار خاصية واحد فقط

**أمثلة على اختبارات الخصائص:**

```typescript
// Feature: tanzil-telegram-bot, Property 1: URL Extraction Consistency
test('URL extraction works regardless of position', () => {
  fc.assert(
    fc.property(
      fc.webUrl(),
      fc.string(),
      fc.string(),
      (url, prefix, suffix) => {
        const message = `${prefix} ${url} ${suffix}`;
        const extracted = extractURL(message);
        return extracted === url;
      },
    ),
    { numRuns: 100 },
  );
});

// Feature: tanzil-telegram-bot, Property 2: URL Validation Correctness
test('URL validation correctly identifies supported platforms', () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.constant('youtube.com'),
        fc.constant('facebook.com'),
        fc.constant('twitter.com'),
        fc.constant('instagram.com'),
      ),
      fc.string(),
      (platform, videoId) => {
        const url = `https://${platform}/watch?v=${videoId}`;
        return validateURL(url) === true;
      },
    ),
    { numRuns: 100 },
  );
});
```

### Integration Testing

1. **End-to-End Flow Tests**
   - Test complete download flow from URL to file delivery
   - Test audio extraction flow
   - Test error recovery flows

2. **Telegram API Integration**
   - Test message sending
   - Test file uploading
   - Test inline keyboard interactions

3. **yt-dlp Integration**
   - Test video info extraction
   - Test format listing
   - Test actual downloads (with test videos)

### Test Environment

- **Mock Telegram API** for unit tests
- **Test videos** from public domains for integration tests
- **Temporary directories** for file operations
- **Environment variables** for configuration

## Implementation Notes

### Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5+
- **Bot Framework**: node-telegram-bot-api
- **Download Tool**: yt-dlp (via child_process)
- **Testing**: Jest + fast-check
- **Logging**: Winston
- **Process Management**: PM2 (for production)

### Configuration

```typescript
interface BotConfig {
  telegramToken: string;
  maxFileSize: number; // in bytes
  downloadTimeout: number; // in milliseconds
  tempDirectory: string;
  supportedPlatforms: string[];
  maxConcurrentDownloads: number;
  sessionTimeout: number; // in milliseconds
  retryAttempts: number;
}
```

### Deployment Considerations

#### General Requirements

1. **yt-dlp Installation**: Must be installed and accessible in PATH
2. **Disk Space**: Adequate temporary storage for downloads
3. **Network**: Stable connection for Telegram API and video downloads
4. **Memory**: Sufficient RAM for concurrent downloads
5. **Monitoring**: Log aggregation and error tracking

#### Render Free Tier Specific Constraints

> [!CAUTION]
> **Critical Technical Challenges for Render Free Tier**

**1. Limited Resources (512MB RAM)**

- **Challenge**: Node.js + yt-dlp (Python) + FFmpeg processes consume significant RAM
- **Solution**: Implement `RequestQueue` to process max 1-2 downloads concurrently
- **Monitoring**: Track memory usage and implement circuit breaker if RAM > 90%

**2. Docker Environment Setup**

- **Challenge**: Render doesn't provide Node.js + Python3 + FFmpeg together by default
- **Solution**: Create custom `Dockerfile` installing all three:
  ```dockerfile
  FROM node:18-bullseye
  RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg
  RUN pip3 install yt-dlp
  ```

**3. Service Sleep/Wake (15-minute inactivity timeout)**

- **Challenge**: Free tier services sleep after 15 minutes of no requests
- **Solutions**:
  - **Option A (Recommended)**: Use Telegram **Webhooks** instead of Long Polling. Telegram will wake the service when messages arrive.
  - **Option B**: Use external service like **UptimeRobot** to ping the bot every 10 minutes (requires a simple health endpoint)
  - **Implementation**: Add `/health` endpoint that returns `{"status": "ok"}`

**4. Ephemeral Disk Storage**

- **Challenge**: All files are deleted when service restarts
- **Impact**: Positive - automatic cleanup, no manual deletion logic needed
- **Consideration**: Don't rely on persistent file storage between restarts

**5. Network Speed Variability**

- **Challenge**: Free tier has variable network speeds, large 1080p videos may exceed 10-minute timeout
- **Solution**: Add quality recommendations (suggest 720p for faster downloads) and allow users to configure timeout

**6. Deployment Method**

- **Recommended**: Webhook mode (more reliable on Render)
- **Fallback**: Long Polling + UptimeRobot keep-alive

### Security Considerations

1. **Input Validation**: Strict URL validation to prevent injection attacks
2. **File System**: Sandboxed temporary directory with proper permissions
3. **Resource Limits**: Max file size (2GB for Telegram), timeout limits (10 min), concurrent download limits (2 max)
4. **Data Privacy**: No persistent storage of user data or download history
5. **Token Security**: Telegram bot token, cookies file stored in environment variables/secrets
