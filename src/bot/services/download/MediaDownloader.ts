import { Telegraf } from 'telegraf';

import { randomUUID } from 'crypto';
import { SupabaseManager } from '../../../database/SupabaseManager';
import { DownloadManager } from '../../../download/DownloadManager';
import { RequestQueue } from '../../../queue/RequestQueue';
import { FileManager } from '../../../utils/FileManager';
import { DownloadRequest } from '../../../types';
import { logger, logToTopic } from '../../../utils/logger';
import { retryWithBackoff } from '../../../utils/retryHelper';
import { CookiesManager } from '../../../utils/CookiesManager';

export class MediaDownloader {
  private bot: Telegraf;
  private storage: SupabaseManager;
  private downloadManager: DownloadManager;
  private queue: RequestQueue;
  private fileManager: FileManager;

  constructor(
    bot: Telegraf,
    storage: SupabaseManager,
    downloadManager: DownloadManager,
    queue: RequestQueue,
    fileManager: FileManager,
  ) {
    this.bot = bot;
    this.storage = storage;
    this.downloadManager = downloadManager;
    this.queue = queue;
    this.fileManager = fileManager;
  }

  public async handleVideoDownload(
    chatId: number,
    threadId: number | undefined,
    userId: number,
    url: string,
    formatId: string,
    cost: number,
    messageIdToEdit?: number,
  ): Promise<void> {
    const requestId = randomUUID();
    let statusMessageId = messageIdToEdit;

    if (statusMessageId) {
      await this.bot.telegram.editMessageText(
        chatId,
        statusMessageId,
        undefined,
        `📥 تم استلام طلبك\n━━━━━━━━━━━━━━━\n📊 الترتيب في القائمة: ${this.queue.getQueueLength() + 1}\n⏳ الحالة: جاري الانتظار...`,
      );
    } else {
      const msg = await this.sendToChat(
        chatId,
        threadId,
        `📥 تم استلام طلبك\n━━━━━━━━━━━━━━━\n📊 الترتيب في القائمة: ${this.queue.getQueueLength() + 1}\n⏳ الحالة: جاري الانتظار...`,
      );
      statusMessageId = msg.message_id;
    }

    try {
      this.queue.addRequest({
        id: requestId,
        userId,
        chatId,
        url,
        format: formatId,
        priority: 0,
        createdAt: new Date(),
        statusMessageId: statusMessageId!,
        reservedCredits: cost,
      });
    } catch (error) {
      await this.storage.refundCredits(userId, cost);
      if (statusMessageId) {
        await this.bot.telegram.editMessageText(
          chatId,
          statusMessageId,
          undefined,
          '❌ فشل في إضافة الطلب.',
        );
      } else {
        await this.sendToChat(chatId, threadId, '❌ فشل في إضافة الطلب.');
      }
    }
  }

  public async handleAudioDownload(
    chatId: number,
    threadId: number | undefined,
    userId: number,
    url: string,
    cost: number,
    messageIdToEdit?: number,
  ): Promise<void> {
    const requestId = randomUUID();
    let statusMessageId = messageIdToEdit;

    if (statusMessageId) {
      await this.bot.telegram.editMessageText(
        chatId,
        statusMessageId,
        undefined,
        `📥 تم استلام طلبك\n━━━━━━━━━━━━━━━\n📊 الترتيب في القائمة: ${this.queue.getQueueLength() + 1}\n⏳ الحالة: جاري الانتظار...`,
      );
    } else {
      const msg = await this.sendToChat(
        chatId,
        threadId,
        `📥 تم استلام طلبك\n━━━━━━━━━━━━━━━\n📊 الترتيب في القائمة: ${this.queue.getQueueLength() + 1}\n⏳ الحالة: جاري الانتظار...`,
      );
      statusMessageId = msg.message_id;
    }

    try {
      this.queue.addRequest({
        id: requestId,
        userId,
        chatId,
        url,
        format: 'audio',
        priority: 0,
        createdAt: new Date(),
        statusMessageId: statusMessageId!,
        reservedCredits: cost,
      });
    } catch (error) {
      await this.storage.refundCredits(userId, cost);
      if (statusMessageId) {
        await this.bot.telegram.editMessageText(
          chatId,
          statusMessageId,
          undefined,
          '❌ فشل في إضافة الطلب.',
        );
      } else {
        await this.sendToChat(chatId, threadId, '❌ فشل في إضافة الطلب.');
      }
    }
  }

  public async processDownloadRequest(request: DownloadRequest): Promise<void> {
    const {
      chatId,
      userId,
      url,
      format: requestFormat,
      id: sessionId,
      statusMessageId,
    } = request;
    const format = requestFormat || 'best'; // Provide default value

    const updateStatus = this.createStatusUpdater(
      chatId,
      statusMessageId,
      sessionId,
    );

    try {
      const updateProgress = this.createProgressUpdater(updateStatus);
      const isAudio = format === 'audio';

      const result = await this.performDownload(
        url,
        format,
        sessionId,
        userId,
        isAudio,
        updateProgress,
      );

      if (!result.filePath) {
        throw new Error('مسار الملف غير موجود');
      }

      const filePath = result.filePath; // Type narrowing

      await updateStatus('📤 جاري رفع الملف...', false);

      const { fileName, title, caption } =
        await this.prepareFileMetadata(filePath);
      await this.uploadToTelegram(chatId, filePath, isAudio, title, caption);
      await this.logDownloadHistory(
        userId,
        url,
        format,
        fileName,
        title,
        isAudio,
      );
      await this.cleanup(sessionId, chatId, statusMessageId);
    } catch (error: unknown) {
      await this.handleDownloadError(
        error,
        sessionId,
        userId,
        request.reservedCredits,
        updateStatus,
      );
    }
  }

  private createStatusUpdater(
    chatId: number,
    statusMessageId: number | undefined,
    sessionId: string,
  ) {
    return async (text: string, showCancelButton: boolean = true) => {
      if (!statusMessageId) return;

      try {
        const options: any = {
          parse_mode: 'Markdown',
        };
        if (showCancelButton) {
          options.reply_markup = {
            inline_keyboard: [
              [
                {
                  text: '❌ إلغاء التحميل',
                  callback_data: `cancel:${sessionId}`,
                },
              ],
            ],
          };
        }
        await this.bot.telegram.editMessageText(
          chatId,
          statusMessageId,
          undefined,
          text,
          options,
        );
      } catch (e) {
        logger.debug('Failed to update status message', {
          error: (e as Error).message,
          chatId,
          messageId: statusMessageId,
        });
      }
    };
  }

  private createProgressUpdater(
    updateStatus: (text: string, showCancelButton?: boolean) => Promise<void>,
  ) {
    let lastUpdate = 0;
    const MIN_UPDATE_INTERVAL = 300; // Fast progress updates
    const loadingPhrases = [
      'جاري التحميل...',
      'جاري استرجاع البيانات...',
      'جاري معالجة الملف...',
      'جاري إنهاء العملية...',
    ];

    return async (percent: number) => {
      const now = Date.now();
      if (percent === 100 || now - lastUpdate > MIN_UPDATE_INTERVAL) {
        lastUpdate = now;
        const progressBar = this.createProgressBar(percent);
        const statusText = this.getLoadingPhrase(percent, loadingPhrases);

        try {
          await updateStatus(
            `⏳ جاري التحميل\n━━━━━━━━━━━━━━━\n${progressBar} ${percent.toFixed(0)}%\n📋 ${statusText}`,
          );
        } catch (e) {
          /* Ignore */
        }
      }
    };
  }

  private createProgressBar(percent: number): string {
    const filled = Math.round((percent / 100) * 10);
    return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
  }

  private getLoadingPhrase(percent: number, phrases: string[]): string {
    if (percent === 100) return '✅ اكتمل التحميل، جاري رفع الملف...';
    if (percent > 70) return phrases[2];
    if (percent > 30) return phrases[1];
    return phrases[0];
  }

  private async performDownload(
    url: string,
    format: string,
    sessionId: string,
    userId: number,
    isAudio: boolean,
    updateProgress: (p: number) => Promise<void>,
  ): Promise<{ success: boolean; filePath: string; error?: string }> {
    const result = await retryWithBackoff(
      async () => {
        const cookies = CookiesManager.getCookiesPath();
        const downloadResult = isAudio
          ? await this.downloadManager.downloadAudio(
            url,
            sessionId,
            userId,
            cookies,
          )
          : await this.downloadManager.downloadVideo(
            url,
            format || 'best',
            sessionId,
            userId,
            cookies,
            (p) => {
              updateProgress(p).catch(console.error);
            },
          );

        if (!downloadResult.success || !downloadResult.filePath) {
          throw new Error(downloadResult.error || 'فشل التحميل');
        }

        return downloadResult;
      },
      3,
      1000,
    );

    // Type assertion after validation
    return result as { success: boolean; filePath: string; error?: string };
  }

  private async prepareFileMetadata(filePath: string) {
    const path = await import('path');
    const fileName = path.basename(filePath);
    const title = fileName.substring(0, fileName.lastIndexOf('.'));
    const caption = `via @Tanzil_Downloader_bot`;

    return { fileName, title, caption };
  }

  private async uploadToTelegram(
    chatId: number,
    filePath: string,
    isAudio: boolean,
    title: string,
    caption: string,
  ) {
    await retryWithBackoff(
      async () => {
        if (isAudio) {
          await this.bot.telegram.sendAudio(
            chatId,
            { source: filePath },
            { title, caption },
          );
        } else {
          await this.bot.telegram.sendVideo(
            chatId,
            { source: filePath },
            { caption },
          );
        }
      },
      3,
      1000,
    );
  }

  private async logDownloadHistory(
    userId: number,
    url: string,
    format: string,
    fileName: string,
    title: string,
    isAudio: boolean,
  ) {
    await this.storage.addDownload(userId, {
      title,
      url,
      format: format || 'video',
      filename: fileName,
      date: new Date().toISOString(),
      timestamp: Date.now(),
      metadata: { isAudio },
    });

    const adminGroupId = parseInt(process.env.ADMIN_GROUP_ID || '0');
    const topicGeneral = parseInt(process.env.TOPIC_GENERAL_ID || '0');
    if (adminGroupId && topicGeneral) {
      await logToTopic(
        this.bot,
        adminGroupId,
        topicGeneral,
        `📥 *Download Completed*\nUser: \`${userId}\`\nFile: ${fileName}\nURL: ${url}\nFormat: ${format || 'video'}`,
      );
    }
  }

  private async cleanup(
    sessionId: string,
    chatId: number,
    statusMessageId: number | undefined,
  ) {
    await this.fileManager.cleanupSession(sessionId);
    if (statusMessageId) {
      await this.bot.telegram.deleteMessage(chatId, statusMessageId);
    }
  }

  private async handleDownloadError(
    error: unknown,
    sessionId: string,
    userId: number,
    reservedCredits: number | undefined,
    updateStatus: (text: string, showCancelButton?: boolean) => Promise<void>,
  ) {
    logger.error('Download processing failed', {
      requestId: sessionId,
      error: (error as Error).message,
    });
    await this.storage.refundCredits(userId, reservedCredits || 0);
    await updateStatus(
      `❌ فشل التحميل\n━━━━━━━━━━━━━━━\n📋 السبب: ${(error as Error).message}`,
      false,
    );
    await this.fileManager.cleanupSession(sessionId);
  }

  private async sendToChat(
    chatId: number,
    _threadId: number | undefined,
    text: string,
    options: any = {},
  ): Promise<any> {
    return this.bot.telegram.sendMessage(chatId, text, options);
  }
}
