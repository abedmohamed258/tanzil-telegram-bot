import { Telegraf } from 'telegraf';
import {
  CallbackQuery,
  Message,
} from 'telegraf/typings/core/types/typegram';
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';
import { SupabaseManager } from '../../../database/SupabaseManager';
import { DownloadManager } from '../../../download/DownloadManager';
import { calculateCost } from '../../../utils/logicHelpers';
import { logger } from '../../../utils/logger';
import { eventBus, BotEvents } from '../../../utils/EventBus';
import { retryWithBackoff } from '../../../utils/retryHelper';
import { CookiesManager } from '../../../utils/CookiesManager';

// Import DownloadService type to avoid circular dependency
// We use a minimal interface instead
interface IDownloadService {
  handleAudioDownload(
    chatId: number,
    threadId: number | undefined,
    userId: number,
    url: string,
    cost: number,
    messageIdToEdit?: number,
  ): Promise<void>;
  handleVideoDownload(
    chatId: number,
    threadId: number | undefined,
    userId: number,
    url: string,
    formatId: string,
    cost: number,
    messageIdToEdit?: number,
  ): Promise<void>;
}

export class PlaylistManager {
  private bot: Telegraf;
  private storage: SupabaseManager;
  private downloadManager: DownloadManager;
  private downloadService: IDownloadService;

  constructor(
    bot: Telegraf,
    storage: SupabaseManager,
    downloadManager: DownloadManager,
    downloadService: IDownloadService,
  ) {
    this.bot = bot;
    this.storage = storage;
    this.downloadManager = downloadManager;
    this.downloadService = downloadService;
  }

  public async handlePlaylistDetection(
    msg: Message,
    url: string,
    messageIdToEdit: number,
    initialMode: 'download' | 'schedule' = 'download',
  ): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    if (!userId) {
      await this.bot.telegram.editMessageText(
        chatId,
        messageIdToEdit,
        undefined,
        '❌ لم أستطع تحديد هوية المستخدم.',
      );
      return;
    }

    await this.bot.telegram.editMessageText(
      chatId,
      messageIdToEdit,
      undefined,
      '📋 *جاري معالجة قائمة التشغيل...*',
      {
        parse_mode: 'Markdown',
      },
    );

    try {
      // Use retry logic for getting playlist info
      const playlistInfo = await retryWithBackoff(
        () => this.downloadManager.getPlaylistInfo(url, CookiesManager.getCookiesPath()),
        3,
        1000,
      );

      if (!playlistInfo || playlistInfo.videos.length === 0) {
        await this.bot.telegram.editMessageText(
          chatId,
          messageIdToEdit,
          undefined,
          '❌ لم يتم العثور على فيديوهات في هذه القائمة.',
        );
        return;
      }

      // Initialize Session
      await this.storage.setPlaylistSession(userId, {
        url,
        totalVideos: playlistInfo.videos.length,
        state: 'WAITING_FOR_SELECTION',
        indices: [],
        menuMessageId: messageIdToEdit,
        mode: initialMode,
      });

      // Render First Page
      await this.renderPlaylistPage(chatId, userId, 1);
    } catch (e: unknown) {
      await this.bot.telegram.editMessageText(
        chatId,
        messageIdToEdit,
        undefined,
        `❌ خطأ في فحص القائمة: ${(e as Error).message}`,
      );
    }
  }

  public async renderPlaylistPage(
    chatId: number,
    userId: number,
    page: number,
  ): Promise<void> {
    const user = await this.storage.getUser(userId);
    const session = user?.activePlaylist;
    if (!session) return;

    const ITEMS_PER_PAGE = 5;
    const totalPages = Math.ceil(session.totalVideos / ITEMS_PER_PAGE);
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, session.totalVideos);

    const message =
      `📺 قائمة التشغيل\n━━━━━━━━━━━━━━━\n` +
      `📊 الإجمالي: ${session.totalVideos} فيديو\n` +
      `📄 الصفحة: ${page}/${totalPages}\n` +
      `✅ المحدد: ${session.indices.length}\n\n` +
      `👇 اضغط للاختيار:`;

    const keyboard: InlineKeyboardButton[][] = [];

    for (let i = 0; i < endIdx - startIdx; i++) {
      const realIdx = startIdx + i + 1;
      const isSelected = session.indices.includes(realIdx);
      const icon = isSelected ? '✅' : '⬜';
      const title = `فيديو ${realIdx}`;

      keyboard.push([
        {
          text: `${icon} ${title}`,
          callback_data: `dl:pl:toggle:${realIdx}:${page}`,
        },
      ]);
    }

    // Navigation Row
    const navRow: InlineKeyboardButton[] = [];
    if (page > 1)
      navRow.push({
        text: '⬅️ السابق',
        callback_data: `dl:pl:page:${page - 1}`,
      });
    if (page < totalPages)
      navRow.push({
        text: 'التالي ➡️',
        callback_data: `dl:pl:page:${page + 1}`,
      });
    if (navRow.length > 0) keyboard.push(navRow);

    // Action Row
    const actionText =
      session.mode === 'schedule'
        ? `📅 متابعة الجدولة (${session.indices.length})`
        : `📥 تحميل (${session.indices.length})`;
    keyboard.push([{ text: actionText, callback_data: 'dl:pl:done' }]);

    if (session.mode === 'download') {
      keyboard.push([{ text: `📅 جدولة`, callback_data: 'dl:pl:sched_ask' }]);
    }

    keyboard.push([{ text: '🗑 إلغاء', callback_data: 'dl:pl:cancel' }]);

    if (session.indices.length !== session.totalVideos) {
      keyboard.push([{ text: '✅ تحديد الكل', callback_data: `dl:pl:all` }]);
    }

    const editOpts = {
      parse_mode: 'Markdown' as const,
      reply_markup: { inline_keyboard: keyboard },
    };

    try {
      await this.bot.telegram.editMessageText(
        chatId,
        session.menuMessageId,
        undefined,
        message,
        editOpts,
      );
    } catch (e) {
      const sendOpts: any = {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard },
      };
      const msg = await this.bot.telegram.sendMessage(
        chatId,
        message,
        sendOpts,
      );
      session.menuMessageId = msg.message_id;
      await this.storage.setPlaylistSession(userId, session);
    }
  }

  public async handlePlaylistCallback(
    query: CallbackQuery,
    params: string[],
  ): Promise<void> {
    const msg = query.message;
    if (!msg) {
      await this.bot.telegram.answerCbQuery(query.id, '❌ رسالة غير موجودة');
      return;
    }
    const userId = query.from.id;
    const chatId = msg.chat.id;
    const action = params[0];

    const user = await this.storage.getUser(userId);
    const session = user?.activePlaylist;
    if (!session) {
      await this.bot.telegram.answerCbQuery(query.id, '❌ انتهت صلاحية الجلسة');
      return;
    }

    if (!session.menuMessageId && query.message) {
      session.menuMessageId = query.message.message_id;
      await this.storage.setPlaylistSession(userId, session);
    }

    // Route to appropriate handler
    switch (action) {
      case 'toggle':
        await this.handleToggleVideo(query, params, userId, chatId, session);
        break;
      case 'page':
        await this.handlePageNavigation(query, params, userId, chatId);
        break;
      case 'done':
        await this.handleDoneSelection(query, userId, chatId, session);
        break;
      case 'fmt_ask':
        await this.handleFormatSelection(
          query,
          params,
          userId,
          chatId,
          session,
        );
        break;
      case 'qual':
        await this.handleQualitySelection(
          query,
          params,
          userId,
          chatId,
          session,
        );
        break;
      case 'sched_ask':
        await this.handleScheduleRequest(query, userId, chatId, session);
        break;

      case 'sched_fmt':
        const format = params[1];
        // Save session before emitting event to ensure data availability
        await this.storage.setPlaylistSession(userId, session);

        eventBus.emit(BotEvents.SCHEDULE_REQUESTED, {
          userId,
          chatId,
          url: session.url,
          isPlaylist: true,
          indices: session.indices,
          format: format,
        });

        await this.bot.telegram.editMessageText(
          chatId,
          session.menuMessageId,
          undefined,
          `✅ تم اختيار الصيغة: ${format === 'audio' ? 'صوت' : 'فيديو'}\n` +
          `📋 عدد الفيديوهات: ${session.indices.length}\n\n` +
          `⏰ *أرسل وقت الجدولة بصيغة 24 ساعة (مثال: 15:30):*\n` +
          `أو استخدم الأزرار التالية:`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'بعد ساعة 🕐', callback_data: 'user:sched_time:1h' },
                  {
                    text: 'بعد 3 ساعات 🕒',
                    callback_data: 'user:sched_time:3h',
                  },
                ],
                [
                  {
                    text: 'غداً (8:00) ☀️',
                    callback_data: 'user:sched_time:08:00',
                  },
                  { text: 'إلغاء ❌', callback_data: 'user:sched_cancel' },
                ],
              ],
            },
          },
        );
        break;

      case 'cancel':
        await this.storage.setPlaylistSession(userId, null);
        if (query.message) {
          await this.bot.telegram.deleteMessage(
            chatId,
            query.message.message_id,
          );
        }
        await this.bot.telegram.answerCbQuery(query.id, '❌ تم الإلغاء');
        break;

      case 'all':
        const allIndices = Array.from(
          { length: session.totalVideos },
          (_, i) => i + 1,
        );
        session.indices = allIndices;
        await this.storage.setPlaylistSession(userId, session);
        await this.renderPlaylistPage(chatId, userId, 1);
        await this.bot.telegram.answerCbQuery(query.id, '✅ تم اختيار الكل');
        break;
    }
  }

  private async handleToggleVideo(
    query: CallbackQuery,
    params: string[],
    userId: number,
    chatId: number,
    session: any,
  ): Promise<void> {
    const idx = parseInt(params[1]);
    const currentPage = parseInt(params[2]);

    if (session.indices.includes(idx)) {
      session.indices = session.indices.filter((i: number) => i !== idx);
    } else {
      session.indices.push(idx);
    }
    await this.storage.setPlaylistSession(userId, session);
    await this.renderPlaylistPage(chatId, userId, currentPage);
    await this.bot.telegram.answerCbQuery(query.id, session.indices.includes(idx) ? '✅ Selected' : '❌ Removed');
  }

  private async handlePageNavigation(
    query: CallbackQuery,
    params: string[],
    userId: number,
    chatId: number,
  ): Promise<void> {
    const newPage = parseInt(params[1]);
    await this.renderPlaylistPage(chatId, userId, newPage);
    await this.bot.telegram.answerCbQuery(query.id);
  }

  private async handleDoneSelection(
    query: CallbackQuery,
    _userId: number,
    chatId: number,
    session: any,
  ): Promise<void> {
    if (session.indices.length === 0) {
      await this.bot.telegram.answerCbQuery(query.id, '⚠️ اختر فيديو واحد على الأقل!');
      return;
    }

    if (session.mode === 'schedule') {
      await this.showScheduleFormatMenu(chatId, session.menuMessageId);
      return;
    }

    await this.showDownloadFormatMenu(chatId, session.menuMessageId);
  }

  private async showScheduleFormatMenu(
    chatId: number,
    messageId: number,
  ): Promise<void> {
    const kb = {
      inline_keyboard: [
        [
          { text: '🎥 فيديو', callback_data: 'dl:pl:sched_fmt:best' },
          { text: '🎧 صوت', callback_data: 'dl:pl:sched_fmt:audio' },
        ],
        [{ text: '🔙 رجوع', callback_data: 'dl:pl:page:1' }],
      ],
    };
    await this.bot.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      '📅 *اختر صيغة التحميل للجدولة:*',
      {
        parse_mode: 'Markdown',
        reply_markup: kb,
      },
    );
  }

  private async showDownloadFormatMenu(
    chatId: number,
    messageId: number,
  ): Promise<void> {
    const kbFmt = {
      inline_keyboard: [
        [
          { text: '🎥 فيديو', callback_data: 'dl:pl:fmt_ask:video' },
          { text: '🎧 صوت', callback_data: 'dl:pl:fmt_ask:audio' },
        ],
        [{ text: '🗑 إلغاء', callback_data: 'dl:pl:cancel' }],
      ],
    };
    await this.bot.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      '🎬 *اختر الصيغة:*',
      {
        parse_mode: 'Markdown',
        reply_markup: kbFmt,
      },
    );
  }

  private async handleFormatSelection(
    query: CallbackQuery,
    params: string[],
    userId: number,
    chatId: number,
    session: any,
  ): Promise<void> {
    const fmt = params[1];
    if (fmt === 'audio') {
      if (query.message) {
        await this.bot.telegram.deleteMessage(chatId, query.message.message_id);
      }
      await this.processPlaylistSelection(
        chatId,
        userId,
        session.indices,
        'audio',
      );
      await this.storage.setPlaylistSession(userId, null);
      await this.bot.telegram.answerCbQuery(query.id, '⏳ جاري بدء التحميل...');
    } else {
      await this.showQualityMenu(chatId, session.menuMessageId);
    }
  }

  private async showQualityMenu(
    chatId: number,
    messageId: number,
  ): Promise<void> {
    const kbQual = {
      inline_keyboard: [
        [
          { text: '💎 Best', callback_data: 'dl:pl:qual:best' },
          { text: '📺 1080p', callback_data: 'dl:pl:qual:1080p' },
        ],
        [
          { text: '📺 720p', callback_data: 'dl:pl:qual:720p' },
          { text: '📺 480p', callback_data: 'dl:pl:qual:480p' },
        ],
        [{ text: '🗑 إلغاء', callback_data: 'dl:pl:cancel' }],
      ],
    };
    await this.bot.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      '🎬 *اختر الجودة:*',
      {
        parse_mode: 'Markdown',
        reply_markup: kbQual,
      },
    );
  }

  private async handleQualitySelection(
    query: CallbackQuery,
    params: string[],
    userId: number,
    chatId: number,
    session: any,
  ): Promise<void> {
    const qual = params[1];
    if (query.message) {
      await this.bot.telegram.deleteMessage(chatId, query.message.message_id);
    }
    await this.processPlaylistSelection(
      chatId,
      userId,
      session.indices,
      'video',
      qual,
    );
    await this.storage.setPlaylistSession(userId, null);
    await this.bot.telegram.answerCbQuery(query.id, '⏳ جاري بدء التحميل...');
  }

  private async handleScheduleRequest(
    query: CallbackQuery,
    _userId: number,
    chatId: number,
    session: any,
  ): Promise<void> {
    if (session.indices.length === 0) {
      await this.bot.telegram.answerCbQuery(query.id, '⚠️ اختر فيديو واحد على الأقل للجدولة!');
      return;
    }
    await this.showScheduleFormatMenu(chatId, session.menuMessageId);
  }

  public async processPlaylistSelection(
    chatId: number,
    userId: number,
    indices: number[],
    format: 'video' | 'audio' = 'video',
    quality: string = 'best',
  ): Promise<void> {
    const user = await this.storage.getUser(userId);
    const session = user?.activePlaylist;
    if (!session) return;

    indices.sort((a, b) => a - b);

    await this.bot.telegram.sendMessage(
      chatId,
      `✅ تم الاختيار\n━━━━━━━━━━━━━━━\n📊 عدد الفيديوهات: ${indices.length}\n⏳ جاري إضافتها لقائمة التحميل...`,
    );

    // Queue ALL items immediately
    for (const index of indices) {
      await this.queuePlaylistItem(
        chatId,
        userId,
        session.url,
        index,
        format,
        quality,
      );
      // Small delay to prevent rate limits/race conditions
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  private async queuePlaylistItem(
    chatId: number,
    userId: number,
    playlistUrl: string,
    index: number,
    format: 'video' | 'audio',
    quality: string,
    threadId?: number,
  ): Promise<void> {
    try {
      // Use retry logic for getting video URL from playlist
      const videoUrl = await retryWithBackoff(
        () => this.downloadManager.getVideoUrlFromPlaylist(playlistUrl, index),
        3,
        1000,
      );

      if (videoUrl) {
        // Use retry logic for getting video info
        const info = await retryWithBackoff(
          () => this.downloadManager.getVideoInfo(videoUrl, CookiesManager.getCookiesPath()),
          3,
          1000,
        );
        const cost = calculateCost(info.duration, false);

        if (format === 'audio') {
          await this.downloadService.handleAudioDownload(
            chatId,
            threadId,
            userId,
            videoUrl,
            cost,
          );
        } else {
          await this.downloadService.handleVideoDownload(
            chatId,
            threadId,
            userId,
            videoUrl,
            quality,
            cost,
          );
        }
      }
    } catch (e: unknown) {
      logger.error('Error queuing playlist item', {
        userId,
        index,
        error: (e as Error).message,
      });
      await this.bot.telegram.sendMessage(
        chatId,
        `⚠️ تم تخطي فيديو ${index}\n📋 السبب: ${(e as Error).message}`,
      );
    }
  }
}
