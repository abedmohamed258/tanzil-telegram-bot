import { Telegraf } from 'telegraf';
import { Message, CallbackQuery } from 'telegraf/typings/core/types/typegram';
import { randomUUID } from 'crypto';
import { SupabaseManager } from '../../database/SupabaseManager';
import { RequestQueue } from '../../queue/RequestQueue';
import { DownloadManager } from '../../download/DownloadManager';
import { FileManager } from '../../utils/FileManager';
import { URLValidator } from '../../utils/UrlValidator';
import {
  DownloadRequest,
  ScheduledTask,
  ScheduleStateData,
} from '../../types/index';
import { logger, logError, logToTopic } from '../../utils/logger';
import { StoryService } from './StoryService';
import { retryWithBackoff } from '../../utils/retryHelper';
import { MarkdownSanitizer } from '../../utils/MarkdownSanitizer';
import { calculateCost } from '../../utils/logicHelpers';
import { CookiesManager } from '../../utils/CookiesManager';

// Sub-services
import { PlaylistManager } from './download/PlaylistManager';
import { MenuBuilder, CallbackState } from './download/MenuBuilder';
import { MediaDownloader } from './download/MediaDownloader';

export class DownloadService {
  private bot: Telegraf;
  private storage: SupabaseManager;
  private queue: RequestQueue;
  private downloadManager: DownloadManager;
  private fileManager: FileManager;
  private urlValidator: URLValidator;
  private storyService?: StoryService;

  // Sub-services
  private playlistManager: PlaylistManager;
  private menuBuilder: MenuBuilder;
  private mediaDownloader: MediaDownloader;

  private callbackMap: Map<string, CallbackState>;
  private readonly CALLBACK_TTL = 3600000; // 1 hour
  private readonly MAX_DURATION = 10800; // 3 hours in seconds

  private schedulerInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    bot: Telegraf,
    storage: SupabaseManager,
    queue: RequestQueue,
    downloadManager: DownloadManager,
    fileManager: FileManager,
    urlValidator: URLValidator,
  ) {
    this.bot = bot;
    this.storage = storage;
    this.queue = queue;
    this.downloadManager = downloadManager;
    this.fileManager = fileManager;
    this.urlValidator = urlValidator;
    this.callbackMap = new Map();

    // Initialize Sub-services
    this.playlistManager = new PlaylistManager(
      bot,
      storage,
      downloadManager,
      this,
    );
    this.menuBuilder = new MenuBuilder(bot, storage, this.callbackMap);
    this.mediaDownloader = new MediaDownloader(
      bot,
      storage,
      downloadManager,
      queue,
      fileManager,
    );

    // Start Scheduler (Placeholder for now, logic can be moved to a SchedulerService later)
    this.startScheduler();
    // Start Cleanup Loop
    this.cleanupInterval = setInterval(
      () => this.cleanupCallbacks(),
      this.CALLBACK_TTL,
    );
  }

  public stop(): void {
    if (this.schedulerInterval) clearInterval(this.schedulerInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.downloadManager
      .killAllActiveDownloads()
      .catch((e) => logger.error('Failed to kill downloads on stop', e));
  }

  public setStoryService(storyService: StoryService) {
    this.storyService = storyService;
  }

  private cleanupCallbacks(): void {
    const now = Date.now();
    for (const [key, value] of this.callbackMap.entries()) {
      if (now - value.timestamp > this.CALLBACK_TTL)
        this.callbackMap.delete(key);
    }
  }

  public async handleMessage(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = (msg as any).text;
    const userId = msg.from?.id;

    if (!text || !userId) return;

    const extractedUrl = this.urlValidator.extractURL(text);
    if (!extractedUrl) return;

    const validationResult = this.urlValidator.validate(extractedUrl);
    if (!validationResult.valid) {
      const errorMessage =
        this.urlValidator.getValidationErrorMessage(validationResult);
      await this.sendToChat(chatId, undefined, errorMessage);
      return;
    }

    await this.bot.telegram.sendChatAction(chatId, 'typing');
    const processingMsg = await this.sendToChat(
      chatId,
      undefined,
      '⏳ جاري معالجة الرابط...',
    );

    try {
      await this.processUrl(
        msg,
        chatId,
        userId,
        extractedUrl,
        processingMsg.message_id,
      );
    } catch (e: unknown) {
      await this.handleUrlProcessingError(
        chatId,
        processingMsg.message_id,
        userId,
        extractedUrl,
        e,
      );
    }
  }

  private async processUrl(
    msg: Message,
    chatId: number,
    userId: number,
    url: string,
    messageId: number,
  ): Promise<void> {
    // Check for Playlist
    if (this.isPlaylistUrl(url)) {
      await this.playlistManager.handlePlaylistDetection(
        msg,
        url,
        messageId,
        'download',
      );
      return;
    }

    // Check for Story
    if (this.isStoryUrl(url)) {
      await this.handleStoryUrl(chatId, url, messageId);
      return;
    }

    // Standard Video
    await this.handleStandardVideo(chatId, userId, url, messageId);
  }

  private isPlaylistUrl(url: string): boolean {
    return url.includes('playlist') || url.includes('&list=');
  }

  private isStoryUrl(url: string): boolean {
    return (
      url.includes('/s/') &&
      (url.includes('t.me') || url.includes('telegram.me'))
    );
  }

  private async handleStoryUrl(
    chatId: number,
    url: string,
    messageId: number,
  ): Promise<void> {
    if (!this.storyService) {
      await this.bot.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        '❌ خدمة تحميل القصص غير مفعلة حالياً.',
      );
      return;
    }

    await this.bot.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      '📱 *جاري استرجاع القصة...*',
      {
        parse_mode: 'Markdown',
      },
    );
    await this.handleStoryDownload(chatId, url, messageId);
  }

  private async handleStandardVideo(
    chatId: number,
    userId: number,
    url: string,
    messageId: number,
  ): Promise<void> {
    // Send immediate status update to user
    await this.bot.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      '🔄 *جاري استرجاع البيانات...*',
      { parse_mode: 'Markdown' },
    );

    // Use retry logic for getting video info (2 retries, 300ms delay)
    // If this fails, we let the error propagate to show proper error message
    const info = await retryWithBackoff(
      () => this.downloadManager.getVideoInfo(url, CookiesManager.getCookiesPath()),
      2,
      300,
    );

    if (this.isVideoDurationExceeded(info.duration)) {
      await this.showDurationExceededMessage(chatId, messageId, info.duration);
      return;
    }

    // Check if video has any formats
    if (!info.formats || info.formats.length === 0) {
      await this.bot.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        `❌ *تعذر جلب جودات الفيديو*\n━━━━━━━━━━━━━━━\n📋 السبب: الفيديو قد يكون:\n• خاص أو محذوف\n• محمي بحقوق النشر\n• من موقع غير مدعوم\n\n💡 حاول مرة أخرى أو جرب رابط آخر.`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const autoSelectedQuality = await this.menuBuilder.showQualityOptions(
      chatId,
      userId,
      url,
      info,
      messageId,
    );
    if (!autoSelectedQuality) return;

    await this.processAutoSelectedQuality(
      chatId,
      userId,
      url,
      info,
      autoSelectedQuality,
      messageId,
    );
  }

  private isVideoDurationExceeded(duration: number): boolean {
    return duration > this.MAX_DURATION;
  }

  private async showDurationExceededMessage(
    chatId: number,
    messageId: number,
    duration: number,
  ): Promise<void> {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    await this.bot.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      `❌ الملف يتجاوز الحد المسموح\n━━━━━━━━━━━━━━━\n⏱ المدة: ${hours}س ${minutes}د\n⚠️ الحد الأقصى: 3 ساعات`,
      { parse_mode: 'Markdown' },
    );
  }

  private async processAutoSelectedQuality(
    chatId: number,
    userId: number,
    url: string,
    info: any,
    quality: string,
    messageId: number,
  ): Promise<void> {
    const isAudio = quality === 'audio';
    const cost = calculateCost(info.duration, isAudio);

    if (!(await this.checkAndUseCredits(userId, cost, chatId, messageId))) {
      return;
    }

    await this.bot.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      '📥 *جاري بدء التحميل...*',
      {
        parse_mode: 'Markdown',
      },
    );

    await this.logDownloadStart(userId, url, quality);

    if (isAudio) {
      await this.mediaDownloader.handleAudioDownload(
        chatId,
        undefined,
        userId,
        url,
        cost,
        messageId,
      );
    } else {
      await this.mediaDownloader.handleVideoDownload(
        chatId,
        undefined,
        userId,
        url,
        quality,
        cost,
        messageId,
      );
    }
  }

  private async checkAndUseCredits(
    userId: number,
    cost: number,
    chatId: number,
    messageId: number,
  ): Promise<boolean> {
    if (await this.storage.useCredits(userId, cost)) {
      return true;
    }

    const { remaining } = await this.storage.getCredits(userId);
    await this.bot.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      `❌ الرصيد غير كافي\n━━━━━━━━━━━━━━━\n💰 المطلوب: ${cost} نقطة\n💳 المتبقي: ${remaining} نقطة`,
      {
        parse_mode: 'Markdown',
      },
    );
    return false;
  }

  private async logDownloadStart(
    userId: number,
    url: string,
    quality: string,
  ): Promise<void> {
    const adminGroupId = parseInt(process.env.ADMIN_GROUP_ID || '0');
    const topicLogs = parseInt(process.env.TOPIC_LOGS || '0');

    if (adminGroupId && topicLogs) {
      const user = await this.storage.getUser(userId);
      const userName = user?.firstName || 'مستخدم';
      const shortUrl = url.length > 40 ? url.substring(0, 40) + '...' : url;
      const timestamp = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });

      await logToTopic(
        this.bot,
        adminGroupId,
        topicLogs,
        `▶️ *بدء تحميل*\n━━━━━━━━━━━━━━━\n👤 ${userName} (\`${userId}\`)\n🔗 ${shortUrl}\n🎬 ${quality === 'audio' ? 'صوت' : 'فيديو'}\n⏰ ${timestamp}`,
      );
    }
  }

  private async handleUrlProcessingError(
    chatId: number,
    messageId: number,
    userId: number,
    url: string,
    error: unknown,
  ): Promise<void> {
    const errorMsg = `❌ فشل في معالجة الرابط\n━━━━━━━━━━━━━━━\n📋 السبب: ${(error as Error).message}`;
    await this.bot.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      errorMsg,
      {
        parse_mode: 'Markdown',
      },
    );
    logError(error as Error, { userId, url });
  }

  public async handleCallback(
    query: CallbackQuery,
    subAction: string,
    params: string[],
  ): Promise<void> {
    const msg = query.message;
    if (!msg) return;
    const chatId = msg.chat.id;
    const userId = query.from.id;
    const messageId = msg.message_id;

    if (subAction === 'pl') {
      await this.playlistManager.handlePlaylistCallback(query, params);
      return;
    }

    if (subAction === 'cancel') {
      const sessionId = params[0];
      if (sessionId.includes('-')) {
        const removed = this.queue.removeRequest(sessionId);
        if (removed) {
          await this.bot.telegram.editMessageText(
            chatId,
            messageId,
            undefined,
            '✅ *تم إلغاء العملية*',
            {
              parse_mode: 'Markdown',
            },
          );
          await this.bot.telegram.answerCbQuery(query.id, 'تم الإلغاء');
        } else {
          await this.downloadManager.cancelDownload(sessionId);
          await this.bot.telegram.answerCbQuery(
            query.id,
            'جاري محاولة إلغاء العملية...',
          );
        }
      } else {
        this.callbackMap.delete(sessionId);
        await this.bot.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          '❌ *تم إلغاء العملية*',
          {
            parse_mode: 'Markdown',
          },
        );
        await this.bot.telegram.answerCbQuery(query.id, 'تم الإلغاء');
      }
      return;
    }

    // Handle Selection
    const uuid = subAction;
    const format = params[0];
    const state = this.callbackMap.get(uuid);

    if (!state) {
      await this.bot.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        '❌ *انتهت صلاحية هذا الطلب*\n💡 أرسل الرابط مجدداً',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    await this.bot.telegram.answerCbQuery(
      query.id,
      '✅ تم استقبال أمرك. جاري بدء العملية...',
    );
    this.callbackMap.delete(uuid);

    try {
      // Use retry logic for getting video info
      const info = await retryWithBackoff(
        () => this.downloadManager.getVideoInfo(state.url, CookiesManager.getCookiesPath()),
        3,
        1000,
      );

      const isAudio = format === 'audio';
      const cost = calculateCost(info.duration, isAudio);

      if (!(await this.storage.useCredits(userId, cost))) {
        const { remaining } = await this.storage.getCredits(userId);
        await this.bot.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          `❌ الرصيد غير كافي\n━━━━━━━━━━━━━━━\n💰 المطلوب: ${cost} نقطة\n💳 المتبقي: ${remaining} نقطة`,
          {
            parse_mode: 'Markdown',
          },
        );
        return;
      }

      if (isAudio) {
        await this.mediaDownloader.handleAudioDownload(
          chatId,
          undefined,
          userId,
          state.url,
          cost,
          messageId,
        );
      } else {
        await this.mediaDownloader.handleVideoDownload(
          chatId,
          undefined,
          userId,
          state.url,
          format,
          cost,
          messageId,
        );
      }
    } catch (e: unknown) {
      await this.bot.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        `❌ خطأ: ${(e as Error).message}`,
      );
      logError(e as Error, { userId, url: state.url, format });
    }
  }

  // Delegate to MediaDownloader
  public async handleVideoDownload(
    chatId: number,
    threadId: number | undefined,
    userId: number,
    url: string,
    formatId: string,
    cost: number,
    messageIdToEdit?: number,
  ): Promise<void> {
    return this.mediaDownloader.handleVideoDownload(
      chatId,
      threadId,
      userId,
      url,
      formatId,
      cost,
      messageIdToEdit,
    );
  }

  public async handleAudioDownload(
    chatId: number,
    threadId: number | undefined,
    userId: number,
    url: string,
    cost: number,
    messageIdToEdit?: number,
  ): Promise<void> {
    return this.mediaDownloader.handleAudioDownload(
      chatId,
      threadId,
      userId,
      url,
      cost,
      messageIdToEdit,
    );
  }

  public async processDownloadRequest(request: DownloadRequest): Promise<void> {
    return this.mediaDownloader.processDownloadRequest(request);
  }

  public async handleQueueChange(_: DownloadRequest[]): Promise<void> {
    // Optional: Notify admin or update stats
  }

  private async handleStoryDownload(
    chatId: number,
    url: string,
    messageIdToEdit: number,
  ): Promise<void> {
    if (!this.storyService) return;
    try {
      const result = await this.storyService.downloadStory(url);
      if (result && result.filePath) {
        await this.bot.telegram.sendVideo(
          chatId,
          { source: result.filePath },
          {
            caption: result.caption || '@Tanzil_Downloader_bot',
          },
        );
        await this.bot.telegram.deleteMessage(chatId, messageIdToEdit);
        await this.fileManager.deleteFile(result.filePath);
      } else {
        throw new Error('Failed to download story');
      }
    } catch (e) {
      await this.bot.telegram.editMessageText(
        chatId,
        messageIdToEdit,
        undefined,
        `❌ فشل تحميل الستوري: ${(e as Error).message}`,
      );
    }
  }

  public async handlePlaylistSchedule(
    msg: Message,
    url: string,
  ): Promise<void> {
    const chatId = msg.chat.id;

    await this.bot.telegram.sendChatAction(chatId, 'typing');
    const processingMsg = await this.sendToChat(
      chatId,
      undefined,
      '⏳ *جاري فحص قائمة الملفات المجدولة...*',
      { parse_mode: 'Markdown' },
    );

    await this.playlistManager.handlePlaylistDetection(
      msg,
      url,
      processingMsg.message_id,
      'schedule',
    );
  }

  private async sendToChat(
    chatId: number,
    _threadId: number | undefined,
    text: string,
    options: any = {},
  ): Promise<any> {
    return this.bot.telegram.sendMessage(chatId, text, options);
  }

  public async scheduleTask(
    userId: number,
    chatId: number,
    threadId: number | undefined,
    url: string,
    timeStr: string,
    format: string,
    meta: ScheduleStateData,
  ): Promise<string> {
    // Parse timeStr (HH:MM)
    const [hours, minutes] = timeStr.split(':').map(Number);

    // Get User Timezone
    const user = await this.storage.getUser(userId);
    const userOffset = user?.timezone || 0; // e.g., +3 for KSA

    const now = new Date();
    const scheduledTime = new Date(now);
    scheduledTime.setUTCHours(hours - userOffset, minutes, 0, 0);

    if (meta.forceTomorrow || scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const task: ScheduledTask = {
      id: randomUUID(),
      userId,
      url,
      executeAt: scheduledTime.toISOString(),
      options: { chatId, threadId, format, meta },
    };

    await this.storage.addScheduledTask(task);
    logger.info('Task scheduled', {
      userId,
      chatId,
      url,
      time: scheduledTime,
      format,
    });

    const adminGroupId = parseInt(process.env.ADMIN_GROUP_ID || '0');
    const topicGeneral = parseInt(process.env.TOPIC_GENERAL_ID || '0');

    if (adminGroupId && topicGeneral) {
      await logToTopic(
        this.bot,
        adminGroupId,
        topicGeneral,
        `📅 *New Task Scheduled*\nUser: ${userId}\nTime: ${scheduledTime.toLocaleString()}\nURL: ${url}`,
      );
    }

    const dateStr = scheduledTime.toLocaleDateString('en-GB'); // DD/MM/YYYY

    let message = `✅ *تمت الجدولة بنجاح!*

`;
    if (meta.isPlaylist && meta.indices) {
      message += `📋 *قائمة تشغيل:* ${meta.indices.length} فيديو\n`;
    } else {
      message += `🎥 *فيديو مفرد*\n`;
    }
    message += `📅 *التاريخ:* ${dateStr}\n`;
    message += `⏰ *الوقت:* ${timeStr} (توقيتك)\n`;
    message += `🎬 *الصيغة:* ${format === 'audio' ? 'صوت' : 'فيديو'}\n\n`;
    message += `💡 *ملاحظة:* سيتم إرسال التحميل تلقائياً في الموعد المحدد.`;

    return message;
  }

  private startScheduler() {
    // Check every 10 seconds for more accurate scheduling (start of minute, not end)
    this.schedulerInterval = setInterval(
      () => this.checkScheduledTasks(),
      10000,
    );
  }

  private async checkScheduledTasks() {
    try {
      const tasks = await this.storage.getScheduledTasks();
      const now = new Date();

      for (const task of tasks) {
        const executeTime = new Date(task.executeAt);
        if (executeTime <= now) {
          // CRITICAL: Remove task BEFORE executing to prevent duplicate runs
          // The scheduler runs every 10 seconds, so if we don't remove first,
          // the same task will be picked up multiple times during execution
          await this.storage.removeScheduledTask(task.id);

          // Now execute (fire and forget - errors handled inside)
          this.executeScheduledTask(task).catch(error => {
            logger.error('Scheduled task execution failed', {
              taskId: task.id,
              error: (error as Error).message
            });
          });
        }
      }
    } catch (error) {
      logger.error('Scheduler Error', error);
    }
  }

  private async executeScheduledTask(task: ScheduledTask): Promise<void> {
    const { userId, url, options } = task;
    const { chatId, threadId, format, meta } = options;

    try {
      const safeUrl = MarkdownSanitizer.sanitizeUrl(url);
      await MarkdownSanitizer.tryMarkdownOrFallback(
        this.bot,
        chatId,
        `⏰ *حان وقت التحميل المجدول!*
معالجة الرابط: ${safeUrl}`,
        {},
      );

      if (meta?.isPlaylist && meta.indices) {
        const indices = meta.indices as number[];
        await MarkdownSanitizer.tryMarkdownOrFallback(
          this.bot,
          chatId,
          `📋 *بدء تحميل قائمة تشغيل (${indices.length} فيديو)...*`,
          {},
        );

        for (const index of indices) {
          try {
            const videoUrl = await this.downloadManager.getVideoUrlFromPlaylist(
              url,
              index,
            );
            if (videoUrl) {
              const info = await this.downloadManager.getVideoInfo(videoUrl, CookiesManager.getCookiesPath());
              const cost = calculateCost(info.duration, format === 'audio');

              if (await this.storage.useCredits(userId, cost)) {
                if (format === 'audio') {
                  await this.mediaDownloader.handleAudioDownload(
                    chatId,
                    threadId,
                    userId,
                    videoUrl,
                    cost,
                  );
                } else {
                  await this.mediaDownloader.handleVideoDownload(
                    chatId,
                    threadId,
                    userId,
                    videoUrl,
                    format || 'best',
                    cost,
                  );
                }
              } else {
                await this.sendToChat(
                  chatId,
                  undefined,
                  `❌ رصيد غير كاف للفيديو رقم ${index}`,
                );
              }
            }
          } catch (e) {
            logger.error(`Failed to schedule playlist item ${index}`, {
              error: e,
            });
            await this.sendToChat(chatId, undefined, `⚠️ فشل تحميل فيديو رقم ${index}`);
          }
        }
      } else {
        const info = await this.downloadManager.getVideoInfo(url, CookiesManager.getCookiesPath());
        const cost = calculateCost(info.duration, format === 'audio');

        if (await this.storage.useCredits(userId, cost)) {
          if (format === 'audio') {
            await this.mediaDownloader.handleAudioDownload(
              chatId,
              threadId,
              userId,
              url,
              cost,
            );
          } else {
            await this.mediaDownloader.handleVideoDownload(
              chatId,
              threadId,
              userId,
              url,
              format || 'best',
              cost,
            );
          }
        } else {
          await this.sendToChat(chatId, undefined, `❌ رصيد غير كاف للتحميل المجدول.`);
        }
      }

      // Task already removed before execution, so just log success
      logger.info('Scheduled task completed', { taskId: task.id });
    } catch (e) {
      await this.sendToChat(
        chatId,
        undefined,
        `❌ فشل تنفيذ التحميل المجدول: ${(e as Error).message}`,
      );
      logger.error('Scheduled Task Failed', { taskId: task.id, error: e });
      // Task already removed, no need to remove again
    }
  }
}
