import { Telegraf } from 'telegraf';
import { Message, CallbackQuery } from 'telegraf/typings/core/types/typegram';
import { SupabaseManager } from '../../database/SupabaseManager';
import { RequestQueue } from '../../queue/RequestQueue';
import { DownloadManager } from '../../download/DownloadManager';
import { FileManager } from '../../utils/FileManager';
import { AdminConfig } from '../../types';
import { BlockService } from './BlockService';
import { InputValidator } from '../../utils/InputValidator';

// الخدمات الفرعية
import { UserManagement } from './admin/UserManagement';
import { SystemAdmin } from './admin/SystemAdmin';

interface AdminState {
  action: string;
  data?: number;
  timestamp: number;
}

/**
 * AdminService - خدمة إدارة البوت الرئيسية
 * تنسق بين SystemAdmin و UserManagement
 */
export class AdminService {
  private bot: Telegraf;
  private adminConfig: AdminConfig;
  private adminStates: Map<number, AdminState>;
  private cleanupInterval: NodeJS.Timeout;
  private readonly STATE_TTL = 300000; // 5 دقائق بدلاً من ساعة

  // الخدمات الفرعية
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

    // تهيئة الخدمات الفرعية
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

    // بدء تنظيف الحالات المنتهية
    this.cleanupInterval = setInterval(
      () => this.cleanupStates(),
      60000, // كل دقيقة
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

  // === واجهة عامة ===

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

  // === معالجات الأوامر ===

  /**
   * استخراج threadId من الرسالة
   */
  private getThreadId(msg: Message): number | undefined {
    return (msg as any).message_thread_id;
  }

  public async handleAdminDashboard(msg: Message): Promise<void> {
    if (!this.isAdmin(msg)) return;
    const threadId = this.getThreadId(msg);
    await this.systemAdmin.showAdminDashboard(msg.chat.id, threadId);
  }

  public async handleBroadcast(msg: Message, text: string): Promise<void> {
    if (!this.isAdmin(msg) || !text) return;
    await this.systemAdmin.performBroadcast(text);
  }

  public async handleBlock(msg: Message, text: string): Promise<void> {
    if (!this.isAdmin(msg) || !text) return;
    const threadId = this.getThreadId(msg);

    const args = text.split(' ');
    const targetId = InputValidator.validateUserId(args[0]);

    if (!targetId) {
      await this.bot.telegram.sendMessage(
        msg.chat.id,
        '❌ صيغة المعرف غير صحيحة.\n📝 الاستخدام: `/block <المعرف> <السبب> [المدة]`',
        { parse_mode: 'Markdown', message_thread_id: threadId },
      );
      return;
    }

    const duration = args.find(a => /^\d+[mhdw]$/.test(a));
    const reasonParts = args.filter(a => a !== args[0] && a !== duration);
    const reason = InputValidator.sanitizeText(reasonParts.join(' ')) || 'بدون سبب';

    await this.userManagement.executeBlock(
      msg.chat.id,
      threadId,
      targetId,
      reason,
      duration,
    );
  }

  public async handleUnblock(msg: Message, text: string): Promise<void> {
    if (!this.isAdmin(msg) || !text) return;
    const threadId = this.getThreadId(msg);
    const targetId = InputValidator.validateUserId(text);
    if (!targetId) {
      await this.bot.telegram.sendMessage(
        msg.chat.id,
        '❌ صيغة معرف المستخدم غير صحيحة.',
        { message_thread_id: threadId },
      );
      return;
    }
    await this.userManagement.executeUnban(msg.chat.id, threadId, targetId);
  }

  public async handleIsBlocked(msg: Message, text: string): Promise<void> {
    if (!this.isAdmin(msg) || !text) return;
    const threadId = this.getThreadId(msg);
    const targetId = InputValidator.validateUserId(text);
    if (!targetId) {
      await this.bot.telegram.sendMessage(
        msg.chat.id,
        '❌ صيغة معرف المستخدم غير صحيحة.',
        { message_thread_id: threadId },
      );
      return;
    }
    await this.userManagement.showUserProfile(msg.chat.id, threadId, targetId);
  }

  public async handleSend(msg: Message, text: string): Promise<void> {
    if (!this.isAdmin(msg) || !text) return;
    const threadId = this.getThreadId(msg);
    const parts = text.split(' ');
    const targetId = InputValidator.validateUserId(parts[0]);
    const messageToSend = parts.slice(1).join(' ');
    if (!targetId) {
      await this.bot.telegram.sendMessage(
        msg.chat.id,
        '❌ صيغة معرف المستخدم غير صحيحة.',
        { message_thread_id: threadId },
      );
      return;
    }
    const sanitizedMessage = InputValidator.sanitizeText(messageToSend);
    if (!sanitizedMessage) {
      await this.bot.telegram.sendMessage(
        msg.chat.id,
        '❌ محتوى الرسالة غير صالح.',
        { message_thread_id: threadId },
      );
      return;
    }
    await this.userManagement.executeDM(msg.chat.id, threadId, targetId, sanitizedMessage);
  }

  public async handleForceClean(msg: Message): Promise<void> {
    if (!this.isAdmin(msg)) return;
    await this.systemAdmin.handleForceClean(msg);
  }

  public async handleSysStats(msg: Message): Promise<void> {
    if (!this.isAdmin(msg)) return;
    const threadId = this.getThreadId(msg);
    await this.systemAdmin.showAdminDashboard(msg.chat.id, threadId);
  }

  public async handleUserDetails(msg: Message, targetUserId: number): Promise<void> {
    if (!this.isAdmin(msg)) return;
    const threadId = this.getThreadId(msg);
    await this.userManagement.showUserProfile(msg.chat.id, threadId, targetUserId);
  }

  // === معالجة الحالات ===

  public async handleStateInput(msg: Message, state: AdminState): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id || 0;
    const text = (msg as any).text || '';

    this.adminStates.delete(userId); // مسح الحالة

    switch (state.action) {
      case 'WAITING_FOR_BROADCAST': {
        const sanitizedText = InputValidator.sanitizeText(text);
        if (!sanitizedText) {
          await this.bot.telegram.sendMessage(chatId, '❌ محتوى البث غير صالح.');
          return;
        }
        await this.systemAdmin.performBroadcast(sanitizedText);
        break;
      }
      case 'WAITING_FOR_USER_ID': {
        const validatedUserId = InputValidator.validateUserId(text);
        if (!validatedUserId) {
          await this.bot.telegram.sendMessage(chatId, '❌ صيغة معرف المستخدم غير صحيحة.');
          return;
        }
        await this.userManagement.showUserProfile(chatId, undefined, validatedUserId);
        break;
      }
      case 'WAITING_FOR_BAN': {
        const validatedUserId = InputValidator.validateUserId(text);
        if (!validatedUserId) {
          await this.bot.telegram.sendMessage(chatId, '❌ صيغة معرف المستخدم غير صحيحة.');
          return;
        }
        await this.userManagement.executeBlock(chatId, undefined, validatedUserId, 'حظر إداري');
        break;
      }
      case 'WAITING_DM': {
        if (!state.data) return;
        const sanitizedText = InputValidator.sanitizeText(text);
        if (!sanitizedText) {
          await this.bot.telegram.sendMessage(chatId, '❌ محتوى الرسالة غير صالح.');
          return;
        }
        await this.userManagement.executeDM(chatId, undefined, state.data, sanitizedText);
        break;
      }
    }
  }

  // === معالجة الـ Callbacks ===

  public async handleCallback(query: CallbackQuery, params: string[]): Promise<void> {
    const msg = query.message;
    if (!msg || !this.isAdmin(msg as Message)) {
      return;
    }

    const chatId = msg.chat.id;
    const messageId = msg.message_id;
    const userId = query.from.id;
    const subAction = params[0];

    // الرد على الـ callback
    try {
      await this.bot.telegram.answerCbQuery(query.id);
    } catch {
      // تجاهل خطأ الـ callback منتهي الصلاحية
    }

    switch (subAction) {
      // === التنقل الأساسي ===
      case 'close':
        await this.safeDeleteMessage(chatId, messageId);
        break;

      case 'back':
        await this.systemAdmin.showAdminDashboard(chatId, undefined, messageId);
        break;

      // === الإحصائيات ===
      case 'sys':
        await this.systemAdmin.updateSysStats(chatId, undefined, messageId);
        break;

      case 'live_activity':
        await this.systemAdmin.showLiveActivityMonitor(chatId, messageId);
        break;

      // === المستخدمون ===
      case 'users':
        await this.systemAdmin.updateUserList(chatId, undefined, messageId);
        break;

      case 'users_page':
        await this.systemAdmin.updateUserList(chatId, undefined, messageId, parseInt(params[1]) || 0);
        break;

      case 'profile':
        await this.userManagement.showUserProfile(chatId, undefined, parseInt(params[1]), messageId);
        break;

      case 'history':
        await this.userManagement.executeHistory(
          chatId,
          undefined,
          parseInt(params[1]),
          messageId,
          parseInt(params[2]) || 0,
        );
        break;

      case 'ban':
        await this.userManagement.executeBlock(
          chatId,
          undefined,
          parseInt(params[1]),
          'حظر إداري',
          undefined,
          messageId,
        );
        break;

      case 'unban':
        await this.userManagement.executeUnban(chatId, undefined, parseInt(params[1]), messageId);
        break;

      case 'reset_credits':
        await this.userManagement.executeResetCredits(chatId, undefined, parseInt(params[1]), messageId);
        break;

      case 'dm':
        this.adminStates.set(userId, {
          action: 'WAITING_DM',
          data: parseInt(params[1]),
          timestamp: Date.now(),
        });
        await this.bot.telegram.sendMessage(
          chatId,
          `📩 *إرسال رسالة للمستخدم ${params[1]}*\n\nأرسل محتوى الرسالة:`,
          { reply_markup: { force_reply: true }, parse_mode: 'Markdown' },
        );
        break;

      // === المهام المجدولة ===
      case 'scheduled':
        await this.systemAdmin.handleScheduledTasks(chatId, undefined, messageId);
        break;

      case 'cancel_task_ask':
        await this.systemAdmin.showTaskCancelMenu(chatId, messageId);
        break;

      case 'cancel_task':
        await this.systemAdmin.cancelTask(chatId, messageId, params[1], query.id);
        break;

      // === الإعدادات ===
      case 'maintenance_toggle':
        await this.systemAdmin.toggleMaintenance(chatId, undefined, messageId);
        break;

      case 'clean':
        await this.systemAdmin.runCleanup();
        try {
          await this.bot.telegram.answerCbQuery(query.id, '✅ تم التنظيف بنجاح!', { show_alert: true });
        } catch {
          // تجاهل
        }
        break;

      // === المطالبات ===
      case 'broadcast_prompt':
        this.adminStates.set(userId, {
          action: 'WAITING_FOR_BROADCAST',
          timestamp: Date.now(),
        });
        await this.bot.telegram.sendMessage(
          chatId,
          '📢 *وضع البث*\n\nأرسل محتوى الرسالة المراد بثها:',
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
          '🔍 *فحص مستخدم*\n\nأرسل معرف المستخدم:',
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
          '🚫 *حظر مستخدم*\n\nأرسل معرف المستخدم المراد حظره:',
          { reply_markup: { force_reply: true }, parse_mode: 'Markdown' },
        );
        break;

      // === تجاهل ===
      case 'noop':
        break;

      default:
        // تسجيل الـ callback غير المعروف للتصحيح
        console.warn(`Unknown admin callback: ${subAction}`);
    }
  }

  // === المساعدات الخاصة ===

  private async safeDeleteMessage(chatId: number, messageId: number): Promise<void> {
    try {
      await this.bot.telegram.deleteMessage(chatId, messageId);
    } catch {
      // تجاهل خطأ الحذف
    }
  }
}
