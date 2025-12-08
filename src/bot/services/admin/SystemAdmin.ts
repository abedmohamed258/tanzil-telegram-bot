import { Telegraf } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';
import { SupabaseManager } from '../../../database/SupabaseManager';
import { RequestQueue } from '../../../queue/RequestQueue';
import { FileManager } from '../../../utils/FileManager';
import { AdminConfig } from '../../../types';
import { logToTopic } from '../../../utils/logger';
import { BlockService } from '../BlockService';

/**
 * SystemAdmin - إدارة النظام ولوحة التحكم الرئيسية
 * مسؤول عن: الإحصائيات، الصيانة، البث، المهام المجدولة
 */
export class SystemAdmin {
  private bot: Telegraf;
  private storage: SupabaseManager;
  private queue: RequestQueue;
  private fileManager: FileManager;
  private adminConfig: AdminConfig;
  private blockService: BlockService;

  constructor(
    bot: Telegraf,
    storage: SupabaseManager,
    queue: RequestQueue,
    fileManager: FileManager,
    adminConfig: AdminConfig,
    blockService: BlockService,
  ) {
    this.bot = bot;
    this.storage = storage;
    this.queue = queue;
    this.fileManager = fileManager;
    this.adminConfig = adminConfig;
    this.blockService = blockService;
  }

  /**
   * عرض لوحة التحكم الرئيسية
   */
  public async showAdminDashboard(
    chatId: number,
    threadId?: number,
    messageId?: number,
  ): Promise<void> {
    const isMaintenanceMode = await this.storage.isMaintenanceMode();
    const stats = await this.storage.getStats();
    const queueStats = this.queue.getStats();
    const scheduledTasks = await this.storage.getScheduledTasks();
    const users = await this.storage.getAllUsers();

    // حساب المستخدمين النشطين (آخر 24 ساعة)
    const now = Date.now();
    const activeUsers = users.filter(
      u => now - new Date(u.lastActive || 0).getTime() < 86400000
    ).length;

    // حساب وقت التشغيل
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    const dashboardMsg = `
🛠 *لوحة تحكم الأدمن*
━━━━━━━━━━━━━━━━━━━━━

📊 *الإحصائيات العامة:*
├ 👥 المستخدمون: ${users.length || 0}
├ 🟢 النشطون (24 س): ${activeUsers}
├ 📥 إجمالي التحميلات: ${stats.totalDownloads || 0}
└ 💰 الرصيد المستخدم: ${stats.creditsUsed || 0}

⚡ *الحالة الفورية:*
├ 📤 قيد التحميل: ${queueStats.processing}
├ ⏳ في الانتظار: ${queueStats.queued}
└ 📅 مهام مجدولة: ${scheduledTasks.length}

🖥 *النظام:*
├ ⏱ وقت التشغيل: ${hours} س ${minutes} د
├ 🚧 الصيانة: ${isMaintenanceMode ? '🔴 مفعّلة' : '🟢 معطّلة'}
└ 🤖 البوت: 🟢 يعمل

━━━━━━━━━━━━━━━━━━━━━
`.trim();

    const options = {
      parse_mode: 'Markdown' as const,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 إحصائيات مفصلة', callback_data: 'admin:sys' },
            { text: '👥 المستخدمون', callback_data: 'admin:users' },
          ],
          [
            { text: '📈 مراقبة حية', callback_data: 'admin:live_activity' },
            { text: '📅 المهام المجدولة', callback_data: 'admin:scheduled' },
          ],
          [
            {
              text: isMaintenanceMode ? '✅ إيقاف الصيانة' : '🚧 تفعيل الصيانة',
              callback_data: 'admin:maintenance_toggle',
            },
          ],
          [
            { text: '📢 إرسال بث', callback_data: 'admin:broadcast_prompt' },
            { text: '🧹 تنظيف الملفات', callback_data: 'admin:clean' },
          ],
          [
            { text: '🔍 فحص مستخدم', callback_data: 'admin:inspect_prompt' },
            { text: '🚫 حظر مستخدم', callback_data: 'admin:ban_prompt' },
          ],
          [{ text: '❌ إغلاق', callback_data: 'admin:close' }],
        ],
      },
    };

    try {
      if (messageId) {
        await this.editMessage(chatId, messageId, dashboardMsg, options);
      } else {
        await this.sendToChat(chatId, dashboardMsg, { ...options, message_thread_id: threadId });
      }
    } catch (error) {
      // إذا فشل التعديل، أرسل رسالة جديدة
      await this.sendToChat(chatId, dashboardMsg, { ...options, message_thread_id: threadId });
    }
  }

  /**
   * عرض المهام المجدولة
   */
  public async handleScheduledTasks(
    chatId: number,
    _threadId: number | undefined,
    messageId: number,
  ): Promise<void> {
    const tasks = await this.storage.getScheduledTasks();

    if (tasks.length === 0) {
      await this.editMessage(
        chatId,
        messageId,
        '📅 *المهام المجدولة*\n━━━━━━━━━━━━━━━━\n\n❌ لا توجد مهام مجدولة حالياً.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 رجوع', callback_data: 'admin:back' }],
            ],
          },
        },
      );
      return;
    }

    let msg = `📅 *المهام المجدولة (${tasks.length})*\n━━━━━━━━━━━━━━━━\n\n`;

    for (const task of tasks.slice(0, 10)) {
      const user = await this.storage.getUser(task.userId);
      const userName = user ? this.escapeMarkdown(user.firstName) : 'غير معروف';
      const timezone = user?.timezone || 0;
      const country = this.getCountryFlag(timezone);
      const time = new Date(task.executeAt).toLocaleString('ar-SA', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
      });

      msg += `👤 [${userName}](tg://user?id=${task.userId})\n`;
      msg += `🌍 ${country} | ⏰ ${time}\n`;
      msg += `🔗 ${task.url.substring(0, 35)}${task.url.length > 35 ? '...' : ''}\n`;
      msg += `━━━━━━━━━━━━━━━━\n`;
    }

    if (tasks.length > 10) {
      msg += `\n📌 يتم عرض أول 10 مهام من ${tasks.length}`;
    }

    await this.editMessage(chatId, messageId, msg, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ إلغاء مهمة', callback_data: 'admin:cancel_task_ask' }],
          [
            { text: '🔄 تحديث', callback_data: 'admin:scheduled' },
            { text: '🔙 رجوع', callback_data: 'admin:back' },
          ],
        ],
      },
    });
  }

  /**
   * عرض إحصائيات النظام المفصلة
   */
  public async updateSysStats(
    chatId: number,
    _threadId: number | undefined,
    messageId: number,
  ): Promise<void> {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    const queueStats = this.queue.getStats();
    const stats = await this.storage.getStats();

    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const statsMsg = `
📊 *إحصائيات النظام المفصلة*
━━━━━━━━━━━━━━━━━━━━━

⏱ *وقت التشغيل:*
└ ${hours} ساعة ${minutes} دقيقة ${seconds} ثانية

💾 *الذاكرة:*
├ المستخدمة: ${this.formatBytes(memory.heapUsed)}
├ المخصصة: ${this.formatBytes(memory.heapTotal)}
└ الخارجية: ${this.formatBytes(memory.external)}

📥 *قائمة الانتظار:*
├ قيد التنفيذ: ${queueStats.processing}
└ في الانتظار: ${queueStats.queued}

📈 *إحصائيات التحميل:*
├ الناجحة: ${stats.successfulDownloads || 0}
├ الفاشلة: ${stats.failedDownloads || 0}
└ الإجمالي: ${stats.totalDownloads || 0}

💿 *البيانات المحملة:*
└ ${this.formatBytes(stats.totalBytesDownloaded || 0)}

━━━━━━━━━━━━━━━━━━━━━
⏰ آخر تحديث: ${new Date().toLocaleTimeString('ar-SA')}
`.trim();

    await this.editMessage(chatId, messageId, statsMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 تحديث', callback_data: 'admin:sys' },
            { text: '🔙 رجوع', callback_data: 'admin:back' },
          ],
        ],
      },
    });
  }

  /**
   * عرض قائمة المستخدمين
   */
  public async updateUserList(
    chatId: number,
    _threadId: number | undefined,
    messageId: number,
    page: number = 0,
  ): Promise<void> {
    const users = await this.storage.getAllUsers();
    const blockedCount = (
      await Promise.all(users.map(u => this.blockService.isBlocked(u.id)))
    ).filter(Boolean).length;

    // ترتيب حسب آخر نشاط
    users.sort(
      (a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    );

    const PAGE_SIZE = 15;
    const totalPages = Math.ceil(users.length / PAGE_SIZE) || 1;
    const startIndex = page * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, users.length);
    const pageUsers = users.slice(startIndex, endIndex);

    let listMsg = `👥 <b>دليل المستخدمين</b>\n`;
    listMsg += `📊 (${users.length} مستخدم | ${blockedCount} محظور)\n`;
    listMsg += `━━━━━━━━━━━━━━━━\n\n`;

    for (let i = 0; i < pageUsers.length; i++) {
      const u = pageUsers[i];
      const isBlocked = await this.blockService.isBlocked(u.id);
      const status = isBlocked ? '🔴' : '🟢';
      const name = this.escapeHtml(u.firstName);
      const num = startIndex + i + 1;
      listMsg += `${num}. ${status} <a href="tg://user?id=${u.id}">${name}</a>\n`;
    }

    listMsg += `\n━━━━━━━━━━━━━━━━\n`;
    listMsg += `📄 صفحة ${page + 1} من ${totalPages}\n`;
    listMsg += `💡 اضغط على زر المستخدم للتفاصيل`;

    const keyboard: any[][] = [];

    // أزرار المستخدمين - جميع المستخدمين في الصفحة (15 بحد أقصى)
    const userButtons = pageUsers.map((u, i) => ({
      text: `${startIndex + i + 1}. ${u.firstName.substring(0, 10)}`,
      callback_data: `admin:profile:${u.id}`,
    }));

    // تقسيم الأزرار لصفوف (3 أزرار في كل صف)
    for (let i = 0; i < userButtons.length; i += 3) {
      keyboard.push(userButtons.slice(i, i + 3));
    }

    // أزرار التنقل
    if (totalPages > 1) {
      const navRow: any[] = [];
      if (page > 0) {
        navRow.push({ text: '◀️ السابق', callback_data: `admin:users_page:${page - 1}` });
      }
      if (page < totalPages - 1) {
        navRow.push({ text: 'التالي ▶️', callback_data: `admin:users_page:${page + 1}` });
      }
      if (navRow.length > 0) keyboard.push(navRow);
    }

    keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin:back' }]);

    await this.editMessage(chatId, messageId, listMsg, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  /**
   * إرسال بث لجميع المستخدمين
   */
  public async performBroadcast(text: string): Promise<void> {
    const users = await this.storage.getAllUsers();
    let successCount = 0;
    let failCount = 0;

    await logToTopic(
      this.bot,
      this.adminConfig.adminGroupId,
      this.adminConfig.topicControl,
      `📢 جاري إرسال البث إلى ${users.length} مستخدم...`,
    );

    for (const user of users) {
      try {
        await this.bot.telegram.sendMessage(
          user.id,
          `📢 *إعلان من الإدارة*\n\n${text}`,
          { parse_mode: 'Markdown' },
        );
        successCount++;
        // تأخير لتجنب حدود Telegram
        await new Promise(resolve => setTimeout(resolve, 35));
      } catch {
        failCount++;
      }
    }

    await logToTopic(
      this.bot,
      this.adminConfig.adminGroupId,
      this.adminConfig.topicControl,
      `✅ اكتمل البث\n📤 تم الإرسال: ${successCount}/${users.length}\n❌ فشل: ${failCount}`,
    );
  }

  /**
   * تبديل وضع الصيانة
   */
  public async toggleMaintenance(
    chatId: number,
    threadId: number | undefined,
    messageId: number,
  ): Promise<void> {
    const currentMode = await this.storage.isMaintenanceMode();
    await this.storage.setMaintenanceMode(!currentMode);

    await this.showAdminDashboard(chatId, threadId, messageId);

    const status = !currentMode ? 'مفعّل 🔴' : 'معطّل 🟢';
    await logToTopic(
      this.bot,
      this.adminConfig.adminGroupId,
      this.adminConfig.topicGeneral,
      `🚧 *تم تغيير وضع الصيانة: ${status}*`,
    );
  }

  /**
   * تنظيف الملفات القديمة
   */
  public async handleForceClean(msg: Message): Promise<void> {
    const statusMsg = await this.sendToChat(msg.chat.id, '🧹 جاري تنظيف الملفات...');
    try {
      await this.fileManager.cleanupOldFiles(0);
      await this.bot.telegram.editMessageText(
        msg.chat.id,
        statusMsg.message_id,
        undefined,
        '✅ تم تنظيف جميع الملفات المؤقتة بنجاح.',
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.bot.telegram.editMessageText(
        msg.chat.id,
        statusMsg.message_id,
        undefined,
        `❌ فشل التنظيف: ${errorMessage}`,
      );
    }
  }

  /**
   * تشغيل التنظيف التلقائي
   */
  public async runCleanup(): Promise<void> {
    await this.fileManager.cleanupOldFiles(0);
  }

  /**
   * عرض مراقبة الأنشطة الحية
   */
  public async showLiveActivityMonitor(
    chatId: number,
    messageId: number,
  ): Promise<void> {
    const stats = await this.storage.getStats();
    const queueStats = this.queue.getStats();
    const users = await this.storage.getAllUsers();

    const now = Date.now();
    const activeNow = users.filter(
      u => now - new Date(u.lastActive || 0).getTime() < 300000 // 5 دقائق
    ).length;
    const activeHour = users.filter(
      u => now - new Date(u.lastActive || 0).getTime() < 3600000 // ساعة
    ).length;
    const activeDay = users.filter(
      u => now - new Date(u.lastActive || 0).getTime() < 86400000 // يوم
    ).length;

    // حساب معدل النجاح
    const total = (stats.successfulDownloads || 0) + (stats.failedDownloads || 0);
    const successRate = total > 0
      ? Math.round((stats.successfulDownloads || 0) / total * 100)
      : 100;

    const activityMsg = `
📈 *مراقبة الأنشطة الحية*
━━━━━━━━━━━━━━━━━━━━━

⚡ *النشاط الفوري:*
├ 🟢 نشط الآن: ${activeNow}
├ 🕐 آخر ساعة: ${activeHour}
└ 📆 آخر 24 ساعة: ${activeDay}

📥 *التحميلات:*
├ قيد التنفيذ: ${queueStats.processing}
├ في الانتظار: ${queueStats.queued}
└ معدل النجاح: ${successRate}%

📊 *الإجماليات:*
├ ✅ ناجحة: ${stats.successfulDownloads || 0}
├ ❌ فاشلة: ${stats.failedDownloads || 0}
└ 💾 الحجم: ${this.formatBytes(stats.totalBytesDownloaded || 0)}

━━━━━━━━━━━━━━━━━━━━━
⏰ آخر تحديث: ${new Date().toLocaleTimeString('ar-SA')}
`.trim();

    await this.editMessage(chatId, messageId, activityMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 تحديث', callback_data: 'admin:live_activity' },
            { text: '📊 الإحصائيات', callback_data: 'admin:sys' },
          ],
          [{ text: '🔙 رجوع', callback_data: 'admin:back' }],
        ],
      },
    });
  }

  /**
   * عرض قائمة إلغاء المهام
   */
  public async showTaskCancelMenu(
    chatId: number,
    messageId: number,
  ): Promise<void> {
    const tasks = await this.storage.getScheduledTasks();

    if (tasks.length === 0) {
      await this.editMessage(
        chatId,
        messageId,
        '📅 *إلغاء المهام*\n━━━━━━━━━━━━━━━━\n\n❌ لا توجد مهام مجدولة لإلغائها.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 رجوع', callback_data: 'admin:scheduled' }],
            ],
          },
        },
      );
      return;
    }

    let msg = `❌ *اختر المهمة لإلغائها:*\n━━━━━━━━━━━━━━━━\n\n`;
    const keyboard: any[][] = [];

    for (const task of tasks.slice(0, 10)) {
      const user = await this.storage.getUser(task.userId);
      const userName = user ? user.firstName.substring(0, 10) : 'مجهول';
      const time = new Date(task.executeAt).toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
      });
      msg += `⏰ ${time} - ${userName}\n`;
      keyboard.push([
        {
          text: `❌ إلغاء (${time} - ${userName})`,
          callback_data: `admin:cancel_task:${task.id}`,
        },
      ]);
    }

    keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin:scheduled' }]);

    await this.editMessage(chatId, messageId, msg, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  /**
   * إلغاء مهمة محددة
   */
  public async cancelTask(
    chatId: number,
    messageId: number,
    taskId: string,
    queryId?: string,
  ): Promise<void> {
    try {
      await this.storage.removeScheduledTask(taskId);
      if (queryId) {
        await this.bot.telegram.answerCbQuery(queryId, '✅ تم إلغاء المهمة!');
      }
    } catch {
      // تجاهل الخطأ
    }

    // العودة لعرض المهام
    await this.handleScheduledTasks(chatId, undefined, messageId);
  }

  // === المساعدات الخاصة ===

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 بايت';
    const k = 1024;
    const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  private getCountryFlag(timezone: number): string {
    switch (timezone) {
      case 2: return '🇪🇬 مصر';
      case 3: return '🇸🇦 السعودية';
      case 4: return '🇦🇪 الإمارات';
      default: return `GMT${timezone >= 0 ? '+' : ''}${timezone}`;
    }
  }

  private async sendToChat(
    chatId: number,
    text: string,
    options: any = {},
  ): Promise<any> {
    return this.bot.telegram.sendMessage(chatId, text, options);
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

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
