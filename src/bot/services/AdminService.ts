import { Telegraf } from 'telegraf';
import { Message, CallbackQuery } from 'telegraf/typings/core/types/typegram';
import { SupabaseManager } from '../../database/SupabaseManager';
import { RequestQueue } from '../../queue/RequestQueue';
import { DownloadManager } from '../../download/DownloadManager';
import { FileManager } from '../../utils/FileManager';
import { AdminConfig } from '../../types';
import { BlockService } from './BlockService';
import { InputValidator } from '../../utils/InputValidator';

// Sub-services
import { UserManagement } from './admin/UserManagement';
import { SystemAdmin } from './admin/SystemAdmin';

interface AdminState {
  action: string;
  data?: number;
  timestamp: number;
}

export class AdminService {
  private bot: Telegraf;
  private adminConfig: AdminConfig;
  private adminStates: Map<number, AdminState>;
  private cleanupInterval: NodeJS.Timeout;
  private readonly STATE_TTL = 3600000; // 1 Hour

  // Sub-services
  private userManagement: UserManagement;
  private systemAdmin: SystemAdmin;

  constructor(
    bot: Telegraf,
    storage: SupabaseManager,
    queue: RequestQueue,
    downloadManager: DownloadManager,
    fileManager: FileManager,
    adminConfig: AdminConfig,
    blockService: BlockService,
  ) {
    this.bot = bot;
    this.adminConfig = adminConfig;
    this.adminStates = new Map();

    // Initialize Sub-services
    this.userManagement = new UserManagement(
      bot,
      storage,
      blockService,
      queue,
      downloadManager,
    );
    this.systemAdmin = new SystemAdmin(
      bot,
      storage,
      queue,
      fileManager,
      adminConfig,
      blockService,
    );

    // Start cleanup interval
    this.cleanupInterval = setInterval(
      () => this.cleanupStates(),
      this.STATE_TTL,
    );
  }

  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private cleanupStates(): void {
    const now = Date.now();
    for (const [userId, state] of this.adminStates.entries()) {
      if (now - state.timestamp > this.STATE_TTL) {
        this.adminStates.delete(userId);
      }
    }
  }

  private isAdmin(msg: Message | undefined): boolean {
    if (!msg || !('chat' in msg)) {
      return false;
    }
    return msg.chat.id === this.adminConfig.adminGroupId;
  }

  // --- Public API (Delegators) ---

  public hasPendingState(userId: number): boolean {
    return this.adminStates.has(userId);
  }

  public async handlePendingState(msg: Message): Promise<void> {
    const userId = msg.from?.id;
    if (!userId) return;

    const state = this.adminStates.get(userId);
    if (state) {
      await this.handleStateInput(msg, state);
    }
  }

  // Command Handlers

  public async handleAdminDashboard(msg: Message): Promise<void> {
    if (!this.isAdmin(msg)) return;
    await this.systemAdmin.showAdminDashboard(msg.chat.id, undefined);
  }

  public async handleBroadcast(msg: Message, text: string): Promise<void> {
    if (!this.isAdmin(msg) || !text) return;
    await this.systemAdmin.performBroadcast(text);
  }

  public async handleBlock(msg: Message, text: string): Promise<void> {
    if (!this.isAdmin(msg) || !text) return;

    const args = text.split(' ');
    const targetId = InputValidator.validateUserId(args[0]);

    if (!targetId) {
      await this.bot.telegram.sendMessage(
        msg.chat.id,
        '❌ Invalid ID format.\nUsage: `/block <id> <reason> [duration]`',
      );
      return;
    }

    const duration = args.find((a) => /^\d+[mhdw]$/.test(a));
    const reasonParts = args.filter((a) => a !== args[0] && a !== duration);
    const reason =
      InputValidator.sanitizeText(reasonParts.join(' ')) ||
      'No reason provided';

    await this.userManagement.executeBlock(
      msg.chat.id,
      undefined,
      targetId,
      reason,
      duration,
    );
  }

  public async handleUnblock(msg: Message, text: string): Promise<void> {
    if (!this.isAdmin(msg) || !text) return;
    const targetId = InputValidator.validateUserId(text);
    if (!targetId) {
      await this.bot.telegram.sendMessage(
        msg.chat.id,
        '❌ Invalid user ID format.',
      );
      return;
    }
    await this.userManagement.executeUnban(msg.chat.id, undefined, targetId);
  }

  public async handleIsBlocked(msg: Message, text: string): Promise<void> {
    if (!this.isAdmin(msg) || !text) return;
    const targetId = InputValidator.validateUserId(text);
    if (!targetId) {
      await this.bot.telegram.sendMessage(
        msg.chat.id,
        '❌ Invalid user ID format.',
      );
      return;
    }
    await this.userManagement.showUserProfile(msg.chat.id, undefined, targetId);
  }

  public async handleSend(msg: Message, text: string): Promise<void> {
    if (!this.isAdmin(msg) || !text) return;
    const parts = text.split(' ');
    const targetId = InputValidator.validateUserId(parts[0]);
    const messageToSend = parts.slice(1).join(' ');
    if (!targetId) {
      await this.bot.telegram.sendMessage(
        msg.chat.id,
        '❌ Invalid user ID format.',
      );
      return;
    }
    const sanitizedMessage = InputValidator.sanitizeText(messageToSend);
    if (!sanitizedMessage) {
      await this.bot.telegram.sendMessage(
        msg.chat.id,
        '❌ Invalid message content.',
      );
      return;
    }
    await this.userManagement.executeDM(
      msg.chat.id,
      undefined,
      targetId,
      sanitizedMessage,
    );
  }

  public async handleForceClean(msg: Message): Promise<void> {
    if (!this.isAdmin(msg)) return;
    await this.systemAdmin.handleForceClean(msg);
  }

  public async handleSysStats(msg: Message): Promise<void> {
    if (!this.isAdmin(msg)) return;
    await this.systemAdmin.showAdminDashboard(msg.chat.id);
  }

  // State Handling
  public async handleStateInput(
    msg: Message,
    state: AdminState,
  ): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id || 0;

    this.adminStates.delete(userId); // Clear state

    if (state.action === 'WAITING_FOR_BROADCAST') {
      const sanitizedText = InputValidator.sanitizeText((msg as any).text);
      if (!sanitizedText) {
        await this.bot.telegram.sendMessage(
          chatId,
          '❌ Invalid broadcast message.',
        );
        return;
      }
      await this.systemAdmin.performBroadcast(sanitizedText);
    } else if (state.action === 'WAITING_FOR_USER_ID') {
      const validatedUserId = InputValidator.validateUserId((msg as any).text);
      if (!validatedUserId) {
        await this.bot.telegram.sendMessage(
          chatId,
          '❌ Invalid user ID format.',
        );
        return;
      }
      await this.inspectUser(validatedUserId.toString(), chatId);
    } else if (state.action === 'WAITING_FOR_BAN') {
      const validatedUserId = InputValidator.validateUserId((msg as any).text);
      if (!validatedUserId) {
        await this.bot.telegram.sendMessage(
          chatId,
          '❌ Invalid user ID format.',
        );
        return;
      }
      await this.userManagement.executeBlock(
        chatId,
        undefined,
        validatedUserId,
        'Admin Ban',
      );
    } else if (state.action === 'WAITING_DM' && state.data) {
      const sanitizedText = InputValidator.sanitizeText((msg as any).text);
      if (!sanitizedText) {
        await this.bot.telegram.sendMessage(
          chatId,
          '❌ Invalid message content.',
        );
        return;
      }
      await this.userManagement.executeDM(
        chatId,
        undefined,
        state.data,
        sanitizedText,
      );
    }
  }

  // Callback Handling
  public async handleCallback(
    query: CallbackQuery,
    params: string[],
  ): Promise<void> {
    const msg = query.message;
    if (!msg || !this.isAdmin(msg as Message)) {
      return;
    }

    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const userId = query.from.id;
    const subAction = params[0];

    await this.bot.telegram.answerCbQuery(query.id);

    switch (subAction) {
      case 'close':
        await this.safeDeleteMessage(chatId, messageId);
        break;
      case 'sys':
        await this.systemAdmin.updateSysStats(chatId, undefined, messageId);
        break;
      case 'maintenance_toggle':
        await this.systemAdmin.toggleMaintenance(chatId, undefined, messageId);
        break;
      case 'users':
        await this.systemAdmin.updateUserList(chatId, undefined, messageId);
        break;
      case 'back':
        await this.systemAdmin.showAdminDashboard(chatId, undefined, messageId);
        break;
      case 'clean':
        await this.systemAdmin.runCleanup();
        await this.bot.telegram.answerCbQuery(
          query.id,
          '✅ Cleanup Complete!',
          { show_alert: true },
        );
        break;
      case 'broadcast_prompt':
        this.adminStates.set(userId, {
          action: 'WAITING_FOR_BROADCAST',
          timestamp: Date.now(),
        });
        await this.bot.telegram.sendMessage(
          chatId,
          '📢 *Broadcast Mode*\n\nReply with content.',
          { reply_markup: { force_reply: true }, parse_mode: 'Markdown' },
        );
        break;
      case 'inspect_prompt':
        this.adminStates.set(userId, {
          action: 'WAITING_FOR_USER_ID',
          timestamp: Date.now(),
        });
        await this.bot.telegram.sendMessage(
          chatId,
          '🔍 *Inspect User*\n\nSend User ID.',
          { reply_markup: { force_reply: true }, parse_mode: 'Markdown' },
        );
        break;
      case 'ban_prompt':
        this.adminStates.set(userId, {
          action: 'WAITING_FOR_BAN',
          timestamp: Date.now(),
        });
        await this.bot.telegram.sendMessage(
          chatId,
          '🚫 *Ban User*\n\nSend User ID.',
          { reply_markup: { force_reply: true }, parse_mode: 'Markdown' },
        );
        break;
      case 'ban':
        await this.userManagement.executeBlock(
          chatId,
          undefined,
          parseInt(params[1]),
          'Admin Ban',
          undefined,
          messageId,
        );
        break;
      case 'unban':
        await this.userManagement.executeUnban(
          chatId,
          undefined,
          parseInt(params[1]),
          messageId,
        );
        break;
      case 'history':
        await this.userManagement.executeHistory(
          chatId,
          undefined,
          parseInt(params[1]),
          messageId,
        );
        break;
      case 'dm':
        this.adminStates.set(userId, {
          action: 'WAITING_DM',
          data: parseInt(params[1]),
          timestamp: Date.now(),
        });
        await this.bot.telegram.sendMessage(
          chatId,
          `📩 *Send Message to ${params[1]}*\n\nReply with message.`,
          { reply_markup: { force_reply: true }, parse_mode: 'Markdown' },
        );
        break;
      case 'reset_credits':
        await this.userManagement.executeResetCredits(
          chatId,
          undefined,
          parseInt(params[1]),
          messageId,
        );
        break;
      case 'profile':
        await this.userManagement.showUserProfile(
          chatId,
          undefined,
          parseInt(params[1]),
          messageId,
        );
        break;
      case 'scheduled':
        await this.systemAdmin.handleScheduledTasks(
          chatId,
          undefined,
          messageId,
        );
        break;
    }
  }

  private async inspectUser(
    userIdStr: string,
    chatId: number,
    threadId?: number,
  ): Promise<void> {
    const targetId = InputValidator.validateUserId(userIdStr);
    if (!targetId) {
      await this.bot.telegram.sendMessage(chatId, '❌ Invalid user ID format.');
      return;
    }
    await this.userManagement.showUserProfile(chatId, threadId, targetId);
  }

  private async safeDeleteMessage(
    chatId: number,
    messageId: number,
  ): Promise<void> {
    try {
      await this.bot.telegram.deleteMessage(chatId, messageId);
    } catch {
      /* Ignore */
    }
  }
}
