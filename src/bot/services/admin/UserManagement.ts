import { Telegraf } from 'telegraf';
import { SupabaseManager } from '../../../database/SupabaseManager';
import { BlockService } from '../BlockService';
import { RequestQueue } from '../../../queue/RequestQueue';
import { DownloadManager } from '../../../download/DownloadManager';

/**
 * UserManagement - إدارة المستخدمين
 * مسؤول عن: ملفات المستخدمين، الحظر، الرسائل، السجلات
 */
export class UserManagement {
  private bot: Telegraf;
  private storage: SupabaseManager;
  private blockService: BlockService;
  private queue: RequestQueue;
  private downloadManager: DownloadManager;

  constructor(
    bot: Telegraf,
    storage: SupabaseManager,
    blockService: BlockService,
    queue: RequestQueue,
    downloadManager: DownloadManager,
  ) {
    this.bot = bot;
    this.storage = storage;
    this.blockService = blockService;
    this.queue = queue;
    this.downloadManager = downloadManager;
  }

  /**
   * عرض ملف مستخدم مفصل
   */
  public async showUserProfile(
    chatId: number,
    threadId: number | undefined,
    targetId: number,
    messageIdToEdit?: number,
  ): Promise<void> {
    const user = await this.storage.getUser(targetId);
    if (!user) {
      await this.bot.telegram.sendMessage(
        chatId,
        `❌ المستخدم \`${targetId}\` غير موجود.`,
        { parse_mode: 'Markdown', message_thread_id: threadId },
      );
      return;
    }

    // التحقق من حالة البوت
    let botStatus = '⚪ غير معروف';
    try {
      await this.bot.telegram.sendChatAction(targetId, 'typing');
      botStatus = '🟢 نشط';
    } catch (error: unknown) {
      const err = error as any;
      if (err.response?.statusCode === 403) {
        botStatus = '🔴 حظر البوت';
      }
    }

    const isBlocked = await this.blockService.isBlocked(user.id);
    const blockDetails = await this.blockService.getBlockDetails(user.id);

    // حساب الأيام منذ الانضمام
    const daysSinceJoin = Math.floor(
      (Date.now() - new Date(user.joinedAt).getTime()) / 86400000
    );

    // حساب آخر نشاط
    const lastActiveAgo = this.getTimeAgo(new Date(user.lastActive));

    // جلب عدد التحميلات من قاعدة البيانات
    const downloadHistory = await this.storage.getDownloadHistory(user.id);
    const downloadCount = downloadHistory.length;

    const profileMsg = `
👤 *مركز التحكم بالمستخدم*
━━━━━━━━━━━━━━━━━━━━━

🆔 *المعرف:* \`${user.id}\`
👤 *الاسم:* ${this.escapeMarkdown(user.firstName)}
🔗 *اليوزر:* ${user.username ? `@${this.escapeMarkdown(user.username)}` : 'لا يوجد'}

📊 *الحالة:*
├ الحساب: ${isBlocked ? '🔴 محظور' : '🟢 نشط'}${blockDetails ? `\n├ سبب الحظر: ${blockDetails.reason}` : ''}
├ حالة البوت: ${botStatus}
└ آخر نشاط: ${lastActiveAgo}

📅 *معلومات العضوية:*
├ الانضمام: ${new Date(user.joinedAt).toLocaleDateString('ar-SA')}
├ عمر العضوية: ${daysSinceJoin} يوم
└ المنطقة الزمنية: GMT${user.timezone >= 0 ? '+' : ''}${user.timezone}

📥 *إحصائيات التحميل:*
├ إجمالي التحميلات: ${downloadCount}
└ الرصيد: ${user.credits.used}/${100} (المتبقي: ${100 - user.credits.used})

━━━━━━━━━━━━━━━━━━━━━
`.trim();

    const keyboard = [
      [
        { text: '📜 سجل التحميلات', callback_data: `admin:history:${user.id}` },
        { text: '📩 إرسال رسالة', callback_data: `admin:dm:${user.id}` },
      ],
      [
        isBlocked
          ? { text: '✅ إلغاء الحظر', callback_data: `admin:unban:${user.id}` }
          : { text: '🚫 حظر المستخدم', callback_data: `admin:ban:${user.id}` },
      ],
      [
        { text: '🔄 إعادة الرصيد', callback_data: `admin:reset_credits:${user.id}` },
      ],
      [{ text: '🔙 رجوع للقائمة', callback_data: 'admin:users' }],
    ];

    try {
      if (messageIdToEdit) {
        await this.editMessage(chatId, messageIdToEdit, profileMsg, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard },
        });
      } else {
        await this.sendToChat(chatId, threadId, profileMsg, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard },
        });
      }
    } catch {
      await this.sendToChat(chatId, threadId, profileMsg, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  }

  /**
   * تنفيذ حظر مستخدم
   */
  public async executeBlock(
    chatId: number,
    threadId: number | undefined,
    targetId: number,
    reason: string,
    duration?: string,
    messageIdToUpdate?: number,
  ): Promise<void> {
    await this.blockService.blockUser(targetId, reason, duration, chatId);
    this.queue.purgeUser(targetId);
    await this.downloadManager.cancelUserDownloads(targetId);

    const durationText = duration ? ` لمدة ${duration}` : ' بشكل دائم';
    const msg = `🚫 تم حظر المستخدم \`${targetId}\`${durationText}.\n📝 السبب: ${reason}`;

    if (messageIdToUpdate) {
      await this.showUserProfile(chatId, threadId, targetId, messageIdToUpdate);
    } else {
      await this.sendToChat(chatId, threadId, msg, { parse_mode: 'Markdown' });
    }
  }

  /**
   * تنفيذ إلغاء حظر مستخدم
   */
  public async executeUnban(
    chatId: number,
    threadId: number | undefined,
    targetId: number,
    messageIdToUpdate?: number,
  ): Promise<void> {
    await this.blockService.unblockUser(targetId, chatId);

    if (messageIdToUpdate) {
      await this.showUserProfile(chatId, threadId, targetId, messageIdToUpdate);
    } else {
      await this.sendToChat(chatId, threadId, `✅ تم إلغاء حظر المستخدم \`${targetId}\`.`, {
        parse_mode: 'Markdown',
      });
    }
  }

  /**
   * عرض سجل التحميلات
   */
  public async executeHistory(
    chatId: number,
    _threadId: number | undefined,
    targetId: number,
    messageId: number,
    page: number = 0,
  ): Promise<void> {
    // جلب السجل من قاعدة البيانات مباشرة (وليس من الكاش)
    const allHistory = await this.storage.getDownloadHistory(targetId);

    const PAGE_SIZE = 8;
    const totalPages = Math.ceil(allHistory.length / PAGE_SIZE) || 1;
    const startIndex = page * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, allHistory.length);
    const pageHistory = allHistory.slice(startIndex, endIndex);

    let historyMsg = `📂 *سجل التحميلات*\n`;
    historyMsg += `👤 المستخدم: \`${targetId}\`\n`;
    historyMsg += `━━━━━━━━━━━━━━━━\n\n`;

    if (allHistory.length === 0) {
      historyMsg += '❌ لا توجد تحميلات مسجلة في قاعدة البيانات.';
    } else {
      for (let i = 0; i < pageHistory.length; i++) {
        const h = pageHistory[i];
        const num = startIndex + i + 1;
        const date = new Date(h.date).toLocaleDateString('ar-SA');
        const title = (h.title || h.filename || 'ملف').substring(0, 30);
        const format = h.format === 'audio' ? '🎧' : '🎬';
        historyMsg += `${num}. ${format} [${this.escapeMarkdown(title)}](${h.url})\n   📅 ${date}\n\n`;
      }
      historyMsg += `━━━━━━━━━━━━━━━━\n`;
      historyMsg += `📄 صفحة ${page + 1} من ${totalPages} (${allHistory.length} تحميل)`;
    }

    const keyboard: any[][] = [];

    // أزرار التنقل
    if (totalPages > 1) {
      const navRow: any[] = [];
      if (page > 0) {
        navRow.push({ text: '◀️ السابق', callback_data: `admin:history:${targetId}:${page - 1}` });
      }
      navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: 'noop' });
      if (page < totalPages - 1) {
        navRow.push({ text: 'التالي ▶️', callback_data: `admin:history:${targetId}:${page + 1}` });
      }
      keyboard.push(navRow);
    }

    keyboard.push([{ text: '🔙 رجوع للملف', callback_data: `admin:profile:${targetId}` }]);

    await this.editMessage(chatId, messageId, historyMsg, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  /**
   * إرسال رسالة خاصة لمستخدم
   */
  public async executeDM(
    chatId: number,
    threadId: number | undefined,
    targetId: number,
    text: string,
  ): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(
        targetId,
        `📩 *رسالة من الإدارة*\n\n${text}`,
        { parse_mode: 'Markdown' },
      );
      await this.sendToChat(chatId, threadId, `✅ تم إرسال الرسالة للمستخدم \`${targetId}\`.`, {
        parse_mode: 'Markdown',
      });
    } catch {
      await this.sendToChat(
        chatId,
        threadId,
        `❌ فشل إرسال الرسالة. ربما حظر المستخدم البوت.`,
      );
    }
  }

  /**
   * إعادة تعيين رصيد مستخدم
   */
  public async executeResetCredits(
    chatId: number,
    threadId: number | undefined,
    targetId: number,
    messageIdToUpdate?: number,
  ): Promise<void> {
    await this.storage.resetCredits(targetId);

    if (messageIdToUpdate) {
      await this.showUserProfile(chatId, threadId, targetId, messageIdToUpdate);
    } else {
      await this.sendToChat(
        chatId,
        threadId,
        `✅ تم إعادة تعيين رصيد المستخدم \`${targetId}\`.`,
        { parse_mode: 'Markdown' },
      );
    }
  }

  // === المساعدات الخاصة ===

  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'الآن';
    if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
    if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
    if (seconds < 604800) return `منذ ${Math.floor(seconds / 86400)} يوم`;
    return new Date(date).toLocaleDateString('ar-SA');
  }

  private async sendToChat(
    chatId: number,
    threadId: number | undefined,
    text: string,
    options: any = {},
  ): Promise<any> {
    try {
      return await this.bot.telegram.sendMessage(chatId, text, {
        ...options,
        message_thread_id: threadId,
      });
    } catch (error: unknown) {
      const err = error as any;
      // Fallback إذا لم يوجد التوبيك
      if (err?.response?.description?.includes('thread not found')) {
        return this.bot.telegram.sendMessage(chatId, text, options);
      }
      throw error;
    }
  }

  private async editMessage(
    chatId: number,
    messageId: number,
    text: string,
    options: any = {},
  ): Promise<any> {
    return this.bot.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      text,
      options,
    );
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }
}
