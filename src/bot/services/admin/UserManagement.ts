import { Telegraf } from 'telegraf';
import { SupabaseManager } from '../../../database/SupabaseManager';
import { BlockService } from '../BlockService';
import { RequestQueue } from '../../../queue/RequestQueue';
import { DownloadManager } from '../../../download/DownloadManager';


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
        `❌ User \`${targetId}\` not found.`,
        { parse_mode: 'Markdown', message_thread_id: threadId },
      );
      return;
    }

    let blockStatus = '❓ Unknown';
    try {
      await this.bot.telegram.sendChatAction(targetId, 'typing');
      blockStatus = '🟢 Active';
    } catch (error: unknown) {
      const err = error as any;
      if (err.response?.statusCode === 403) blockStatus = '🔴 Blocked Bot';
    }

    const isBlocked = await this.blockService.isBlocked(user.id);
    const blockDetails = await this.blockService.getBlockDetails(user.id);
    const blockReason = blockDetails
      ? `\n• Block Reason: ${blockDetails.reason}`
      : '';

    const profileMsg = `
👤 *User Control Center*

🆔 *ID:* \`${user.id}\`
👤 *Name:* ${this.escapeMarkdown(user.firstName)}
🔗 *Handle:* ${user.username ? `@${this.escapeMarkdown(user.username)}` : 'None'}

📊 *Status:*
• Account: ${isBlocked ? '🔴 BLOCKED' : '🟢 Active'}${blockReason}
• Bot State: ${blockStatus}
• Joined: ${new Date(user.joinedAt).toLocaleDateString()}
• Downloads: ${user.downloadHistory.length}
• Credits: ${user.credits.used}/${100} (Remaining: ${100 - user.credits.used})
        `.trim();

    const keyboard = [
      [
        { text: '📜 History', callback_data: `admin:history:${user.id}` },
        { text: '📩 Send Msg', callback_data: `admin:dm:${user.id}` },
      ],
      [
        isBlocked
          ? { text: '✅ Unban User', callback_data: `admin:unban:${user.id}` }
          : { text: '🚫 Ban User', callback_data: `admin:ban:${user.id}` },
      ],
      [
        {
          text: '🔄 Reset Credits',
          callback_data: `admin:reset_credits:${user.id}`,
        },
      ],
      [{ text: '🔙 Back to List', callback_data: 'admin:users' }],
    ];

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
  }

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

    const durationText = duration ? ` for ${duration}` : ' permanently';
    const msg = `🚫 User \`${targetId}\` blocked${durationText}.\n📝 Reason: ${reason}`;

    if (messageIdToUpdate) {
      await this.showUserProfile(chatId, threadId, targetId, messageIdToUpdate);
    } else {
      await this.sendToChat(chatId, threadId, msg, { parse_mode: 'Markdown' });
    }
  }

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
      await this.sendToChat(chatId, threadId, `✅ User \`${targetId}\` unbanned.`, {
        parse_mode: 'Markdown',
      });
    }
  }

  public async executeHistory(
    chatId: number,
    _threadId: number | undefined,
    targetId: number,
    messageId: number,
    page: number = 0,
  ): Promise<void> {
    const user = await this.storage.getUser(targetId);
    if (!user) return;

    const allHistory = [...user.downloadHistory].reverse();
    const PAGE_SIZE = 10;
    const totalPages = Math.ceil(allHistory.length / PAGE_SIZE) || 1;
    const startIndex = page * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, allHistory.length);
    const pageHistory = allHistory.slice(startIndex, endIndex);

    let historyMsg = `📂 *Download History for* \`${targetId}\`\n`;
    historyMsg += `📊 (${allHistory.length > 0 ? startIndex + 1 : 0}-${endIndex}/${allHistory.length})\n\n`;

    if (allHistory.length === 0) {
      historyMsg += 'No downloads recorded.';
    } else {
      pageHistory.forEach((h, i) => {
        const num = startIndex + i + 1;
        const date = new Date(h.date).toLocaleDateString();
        historyMsg += `${num}. [${h.title}](${h.url}) - 📅 ${date}\n`;
      });
    }

    const keyboard: any[][] = [];

    // Pagination buttons
    if (totalPages > 1) {
      const navRow: any[] = [];
      if (page > 0) {
        navRow.push({ text: '◀️ Prev', callback_data: `admin:history:${targetId}:${page - 1}` });
      }
      navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: 'noop' });
      if (page < totalPages - 1) {
        navRow.push({ text: 'Next ▶️', callback_data: `admin:history:${targetId}:${page + 1}` });
      }
      keyboard.push(navRow);
    }

    keyboard.push([{ text: '🔙 Back to Profile', callback_data: `admin:profile:${targetId}` }]);

    await this.editMessage(chatId, messageId, historyMsg, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  public async executeDM(
    chatId: number,
    threadId: number | undefined,
    targetId: number,
    text: string,
  ): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(
        targetId,
        `📩 *Message from Admin*\n\n${text}`,
        { parse_mode: 'Markdown' },
      );
      await this.sendToChat(chatId, threadId, `✅ Message sent to \`${targetId}\`.`, {
        parse_mode: 'Markdown',
      });
    } catch (e) {
      await this.sendToChat(
        chatId,
        threadId,
        `❌ Failed to send message. User might have blocked the bot.`,
      );
    }
  }

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
        `✅ Credits reset for user \`${targetId}\`.`,
        { parse_mode: 'Markdown' },
      );
    }
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
      // Fallback to main chat if thread not found
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
