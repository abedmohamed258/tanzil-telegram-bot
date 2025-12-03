import { Telegraf } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';
import { SupabaseManager } from '../../../database/SupabaseManager';
import { RequestQueue } from '../../../queue/RequestQueue';
import { FileManager } from '../../../utils/FileManager';
import { AdminConfig } from '../../../types';
import { logToTopic } from '../../../utils/logger';
import { BlockService } from '../BlockService';


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

  public async showAdminDashboard(
    chatId: number,
    threadId?: number,
    messageId?: number,
  ): Promise<void> {
    const isMaintenanceMode = await this.storage.isMaintenanceMode();
    const dashboardMsg = `🛠 *Admin Command Center*\n🚧 Maintenance: ${isMaintenanceMode ? 'ON 🔴' : 'OFF 🟢'}\n\nSelect an action below:`;

    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 System Status', callback_data: 'admin:sys' },
            { text: '👥 Users List', callback_data: 'admin:users' },
          ],
          [{ text: '📅 Scheduled Tasks', callback_data: 'admin:scheduled' }],
          [
            {
              text: isMaintenanceMode
                ? '✅ Disable Maintenance'
                : '🚧 Enable Maintenance',
              callback_data: 'admin:maintenance_toggle',
            },
          ],
          [
            { text: '📢 Broadcast', callback_data: 'admin:broadcast_prompt' },
            { text: '🧹 Force Clean', callback_data: 'admin:clean' },
          ],
          [
            { text: '🔍 Inspect User', callback_data: 'admin:inspect_prompt' },
            { text: '🚫 Ban User', callback_data: 'admin:ban_prompt' },
          ],
          [{ text: '❌ Close', callback_data: 'admin:close' }],
        ],
      },
    };

    if (messageId) {
      await this.editMessage(chatId, messageId, dashboardMsg, options);
    } else {
      await this.sendToChat(chatId, dashboardMsg, options);
    }
  }

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
        '📅 *Scheduled Tasks*\n\nNo tasks scheduled.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Back', callback_data: 'admin:back' }],
            ],
          },
        },
      );
      return;
    }

    let msg = `📅 *Scheduled Tasks (${tasks.length})*\n\n`;

    for (const task of tasks) {
      const user = await this.storage.getUser(task.userId);
      const userName = user ? this.escapeMarkdown(user.firstName) : 'Unknown';
      const timezone = user?.timezone || 0;
      const country =
        timezone === 3
          ? '🇸🇦 KSA'
          : timezone === 2
            ? '🇪🇬 EGY'
            : timezone === 4
              ? '🇦🇪 UAE'
              : `GMT${timezone >= 0 ? '+' : ''}${timezone}`;
      const time = new Date(task.executeAt).toLocaleString();

      msg += `👤 *User:* [${userName}](tg://user?id=${task.userId})\n`;
      msg += `🌍 *Loc:* ${country}\n`;
      msg += `⏰ *Time:* ${time}\n`;
      msg += `🔗 *Link:* ${task.url}\n`;
      msg += `━━━━━━━━━━━━━━━━\n`;
    }

    // Split message if too long (Telegram limit 4096)
    if (msg.length > 4000) {
      msg = msg.substring(0, 4000) + '... (truncated)';
    }

    await this.editMessage(chatId, messageId, msg, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ إلغاء مهمة', callback_data: 'admin:cancel_task_ask' }],
          [
            { text: '🔄 تحديث', callback_data: 'admin:scheduled' },
            { text: '🔙 رجوع', callback_data: 'admin:sys' },
          ],
        ],
      },
    });
  }

  public async updateSysStats(
    chatId: number,
    _threadId: number | undefined,
    messageId: number,
  ): Promise<void> {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    const queueStats = this.queue.getStats();
    const statsMsg = `
📊 *System Statistics*
⏱ *Uptime:* ${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s
💾 *Memory:* ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB
📥 *Queue:* Active: ${queueStats.processing} | Waiting: ${queueStats.queued}
        `.trim();
    await this.editMessage(chatId, messageId, statsMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin:back' }]],
      },
    });
  }

  public async updateUserList(
    chatId: number,
    _threadId: number | undefined,
    messageId: number,
  ): Promise<void> {
    const users = await this.storage.getAllUsers();
    const activeUsersCount = (
      await Promise.all(
        users.map(async (u) => !(await this.blockService.isBlocked(u.id))),
      )
    ).filter(Boolean).length;

    users.sort(
      (a, b) =>
        new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime(),
    );
    const topUsers = users.slice(0, 20);

    let listMsg = `👥 *User Directory* (${activeUsersCount}/${users.length})\n\n`;

    for (const u of topUsers) {
      const isBlocked = await this.blockService.isBlocked(u.id);
      const status = isBlocked ? '🔴' : '🟢';
      const name = this.escapeMarkdown(u.firstName);
      const username = u.username
        ? `(@${this.escapeMarkdown(u.username)})`
        : '';
      listMsg += `${status} [${name}](tg://user?id=${u.id}) ${username} | 🔗 /user\\_${u.id}\n`;
    }

    await this.editMessage(chatId, messageId, listMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin:back' }]],
      },
    });
  }

  public async performBroadcast(text: string): Promise<void> {
    const users = await this.storage.getAllUsers();
    let successCount = 0;
    await logToTopic(
      this.bot,
      this.adminConfig.adminGroupId,
      this.adminConfig.topicControl,
      `📢 Broadcasting to ${users.length} users...`,
    );

    for (const user of users) {
      try {
        await this.bot.telegram.sendMessage(
          user.id,
          `📢 *Announcement*\n\n${text}`,
          { parse_mode: 'Markdown' },
        );
        successCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (e) {
        /* Ignore */
      }
    }
    await logToTopic(
      this.bot,
      this.adminConfig.adminGroupId,
      this.adminConfig.topicControl,
      `✅ Broadcast complete. Sent to ${successCount}/${users.length} users.`,
    );
  }

  public async toggleMaintenance(
    chatId: number,
    threadId: number | undefined,
    messageId: number,
  ): Promise<void> {
    const currentMode = await this.storage.isMaintenanceMode();
    await this.storage.setMaintenanceMode(!currentMode);

    await this.showAdminDashboard(chatId, threadId, messageId);

    const status = !currentMode ? 'ENABLED 🔴' : 'DISABLED 🟢';
    await logToTopic(
      this.bot,
      this.adminConfig.adminGroupId,
      this.adminConfig.topicGeneral,
      `🚧 *Maintenance Mode ${status}*`,
    );
  }

  public async handleForceClean(msg: Message): Promise<void> {
    await this.sendToChat(msg.chat.id, '🧹 Starting cleanup...');
    try {
      await this.fileManager.cleanupOldFiles(0);
      await this.sendToChat(msg.chat.id, '✅ Cleanup complete.');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.sendToChat(msg.chat.id, `❌ Cleanup failed: ${errorMessage}`);
    }
  }

  public async runCleanup(): Promise<void> {
    await this.fileManager.cleanupOldFiles(0);
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
}
