import TelegramBot, { Message, CallbackQuery, EditMessageTextOptions, SendMessageOptions } from 'node-telegram-bot-api';
import { StorageManager } from '../../utils/storage';
import { RequestQueue } from '../../queue/requestQueue';
import { DownloadManager } from '../../download/downloadManager';
import { FileManager } from '../../utils/fileManager';
import { AdminConfig } from '../../types';
import { logger, logToTopic } from '../../utils/logger';

interface AdminState {
    action: string;
    data?: number;
    timestamp: number;
}

export class AdminService {
    private bot: TelegramBot;
    private storage: StorageManager;
    private queue: RequestQueue;
    private downloadManager: DownloadManager;
    private fileManager: FileManager;
    private adminConfig: AdminConfig;
    private adminStates: Map<number, AdminState>;
    private cleanupInterval: NodeJS.Timeout;
    private readonly STATE_TTL = 3600000; // 1 Hour

    constructor(
        bot: TelegramBot,
        storage: StorageManager,
        queue: RequestQueue,
        downloadManager: DownloadManager,
        fileManager: FileManager,
        adminConfig: AdminConfig
    ) {
        this.bot = bot;
        this.storage = storage;
        this.queue = queue;
        this.downloadManager = downloadManager;
        this.fileManager = fileManager;
        this.adminConfig = adminConfig;
        this.adminStates = new Map();

        // Start cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanupStates(), this.STATE_TTL);
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

    private isAdmin(msg: Message): boolean {
        return msg.chat.id === this.adminConfig.adminGroupId && msg.message_thread_id === this.adminConfig.topicControl;
    }

    private async sendToChat(chatId: number, threadId: number | undefined, text: string, options: SendMessageOptions = {}): Promise<Message> {
        const finalOptions = { ...options };
        if (threadId && threadId !== 1) {
            finalOptions.message_thread_id = threadId;
        }
        return this.bot.sendMessage(chatId, text, finalOptions);
    }

    private async editMessage(chatId: number, messageId: number, text: string, options: EditMessageTextOptions = {}): Promise<boolean | Message> {
        return this.bot.editMessageText(text, { ...options, chat_id: chatId, message_id: messageId });
    }

    private async safeDeleteMessage(chatId: number, messageId: number): Promise<void> {
        try {
            await this.bot.deleteMessage(chatId, messageId);
        } catch (error: any) {
            if (!error.message?.includes('message to delete not found') && !error.message?.includes('message can\'t be deleted')) {
                logger.warn('Failed to delete message', { chatId, messageId, error: error.message });
            }
        }
    }

    private escapeMarkdown(text: string): string {
        return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    }

    /**
     * Check if user has pending admin state
     */
    public hasPendingState(userId: number): boolean {
        return this.adminStates.has(userId);
    }

    /**
     * Handle pending admin state for user
     */
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
        await this.showAdminDashboard(msg.chat.id, msg.message_thread_id, undefined);
    }

    public async handleBroadcast(msg: Message, match: RegExpExecArray | null): Promise<void> {
        if (!this.isAdmin(msg) || !match) return;
        await this.performBroadcast(match[1]);
    }

    public async handleBan(msg: Message, match: RegExpExecArray | null): Promise<void> {
        if (!this.isAdmin(msg) || !match) return;
        await this.executeBan(msg.chat.id, msg.message_thread_id, parseInt(match[1]));
    }

    public async handleUnban(msg: Message, match: RegExpExecArray | null): Promise<void> {
        if (!this.isAdmin(msg) || !match) return;
        await this.executeUnban(msg.chat.id, msg.message_thread_id, parseInt(match[1]));
    }

    public async handleSend(msg: Message, match: RegExpExecArray | null): Promise<void> {
        if (!this.isAdmin(msg) || !match) return;
        await this.executeDM(msg.chat.id, msg.message_thread_id, parseInt(match[1]), match[2]);
    }

    public async handleForceClean(msg: Message): Promise<void> {
        if (!this.isAdmin(msg)) return;
        await this.sendToChat(msg.chat.id, msg.message_thread_id, '🧹 Starting cleanup...');
        try {
            await this.fileManager.cleanupOldFiles(0);
            await this.sendToChat(msg.chat.id, msg.message_thread_id, '✅ Cleanup complete.');
        } catch (e: any) {
            await this.sendToChat(msg.chat.id, msg.message_thread_id, `❌ Cleanup failed: ${e.message}`);
        }
    }

    public async handleListUsers(msg: Message): Promise<void> {
        if (!this.isAdmin(msg)) return;
        const users = this.storage.getAllUsers();
        const activeUsers = users.filter(u => !u.isBanned).length;
        const listMsg = `👥 *User Directory* (${activeUsers}/${users.length})\nUse /admin -> Users List for interactive view.`;
        await this.sendToChat(msg.chat.id, msg.message_thread_id, listMsg, { parse_mode: 'Markdown' });
    }

    public async handleUserProfile(msg: Message, match: RegExpExecArray | null): Promise<void> {
        if (!this.isAdmin(msg) || !match) return;
        await this.showUserProfile(msg.chat.id, msg.message_thread_id, parseInt(match[1]));
    }

    public async handleSysStats(msg: Message): Promise<void> {
        if (!this.isAdmin(msg)) return;
        const uptime = process.uptime();
        const memory = process.memoryUsage();
        const statsMsg = `📊 *System Statistics*\n⏱ Uptime: ${Math.floor(uptime / 60)}m\n💾 Memory: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`;
        await this.sendToChat(msg.chat.id, msg.message_thread_id, statsMsg, { parse_mode: 'Markdown' });
    }

    // State Handling
    public async handleStateInput(msg: Message, state: AdminState): Promise<void> {
        const chatId = msg.chat.id;
        const threadId = msg.message_thread_id;
        const userId = msg.from?.id || 0;

        this.adminStates.delete(userId); // Clear state

        if (state.action === 'WAITING_FOR_BROADCAST') {
            await this.performBroadcast(msg.text || '');
        } else if (state.action === 'WAITING_FOR_USER_ID') {
            await this.inspectUser(msg.text || '', chatId, threadId);
        } else if (state.action === 'WAITING_FOR_BAN') {
            const targetId = msg.text?.trim();
            if (targetId && /^\d+$/.test(targetId)) {
                await this.executeBan(chatId, threadId, parseInt(targetId));
            } else {
                await this.sendToChat(chatId, threadId, '❌ Invalid ID format.');
            }
        } else if (state.action === 'WAITING_DM' && state.data) {
            await this.executeDM(chatId, threadId, state.data, msg.text || '');
        }
    }

    // Callback Handling
    public async handleCallback(query: CallbackQuery, params: string[]): Promise<void> {
        if (!query.message || !this.isAdmin(query.message)) {
            logger.warn('Admin callback rejected', {
                userId: query.from.id,
                chatId: query.message?.chat.id,
                threadId: query.message?.message_thread_id,
                expectedGroup: this.adminConfig.adminGroupId,
                expectedTopic: this.adminConfig.topicControl
            });
            return;
        }

        const chatId = query.message.chat.id;
        const threadId = query.message.message_thread_id;
        const messageId = query.message.message_id;
        const userId = query.from.id;
        const subAction = params[0];

        await this.bot.answerCallbackQuery(query.id);

        switch (subAction) {
            case 'close': await this.safeDeleteMessage(chatId, messageId); break;
            case 'sys': await this.updateSysStats(chatId, threadId, messageId); break;
            case 'maintenance_toggle': await this.toggleMaintenance(chatId, threadId, messageId); break;
            case 'users': await this.updateUserList(chatId, threadId, messageId); break;
            case 'back': await this.showAdminDashboard(chatId, threadId, messageId); break;
            case 'clean':
                await this.fileManager.cleanupOldFiles(0);
                await this.bot.answerCallbackQuery(query.id, { text: '✅ Cleanup Complete!', show_alert: true });
                break;
            case 'broadcast_prompt':
                this.adminStates.set(userId, { action: 'WAITING_FOR_BROADCAST', timestamp: Date.now() });
                await this.sendToChat(chatId, threadId, '📢 *Broadcast Mode*\n\nReply with content.', { reply_markup: { force_reply: true }, parse_mode: 'Markdown' });
                break;
            case 'inspect_prompt':
                this.adminStates.set(userId, { action: 'WAITING_FOR_USER_ID', timestamp: Date.now() });
                await this.sendToChat(chatId, threadId, '🔍 *Inspect User*\n\nSend User ID.', { reply_markup: { force_reply: true }, parse_mode: 'Markdown' });
                break;
            case 'ban_prompt':
                this.adminStates.set(userId, { action: 'WAITING_FOR_BAN', timestamp: Date.now() });
                await this.sendToChat(chatId, threadId, '🚫 *Ban User*\n\nSend User ID.', { reply_markup: { force_reply: true }, parse_mode: 'Markdown' });
                break;
            case 'ban': await this.executeBan(chatId, threadId, parseInt(params[1]), messageId); break;
            case 'unban': await this.executeUnban(chatId, threadId, parseInt(params[1]), messageId); break;
            case 'history': await this.executeHistory(chatId, threadId, parseInt(params[1]), messageId); break;
            case 'dm':
                this.adminStates.set(userId, { action: 'WAITING_DM', data: parseInt(params[1]), timestamp: Date.now() });
                await this.sendToChat(chatId, threadId, `📩 *Send Message to ${params[1]}*\n\nReply with message.`, { reply_markup: { force_reply: true }, parse_mode: 'Markdown' });
                break;
            case 'reset_credits': await this.executeResetCredits(chatId, threadId, parseInt(params[1]), messageId); break;
            case 'profile': await this.showUserProfile(chatId, threadId, parseInt(params[1]), messageId); break;
        }
    }

    // Logic Implementation
    private async showAdminDashboard(chatId: number, threadId: number | undefined, messageId?: number): Promise<void> {
        const isMaintenanceMode = this.storage.isMaintenanceMode();
        const dashboardMsg = `🛠 *Admin Command Center*\n🚧 Maintenance: ${isMaintenanceMode ? 'ON 🔴' : 'OFF 🟢'}\n\nSelect an action below:`;

        const options = {
            parse_mode: 'Markdown' as const,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📊 System Status', callback_data: 'admin:sys' }, { text: '👥 Users List', callback_data: 'admin:users' }],
                    [
                        {
                            text: isMaintenanceMode ? '✅ Disable Maintenance' : '🚧 Enable Maintenance',
                            callback_data: 'admin:maintenance_toggle'
                        }
                    ],
                    [{ text: '📢 Broadcast', callback_data: 'admin:broadcast_prompt' }, { text: '🧹 Force Clean', callback_data: 'admin:clean' }],
                    [{ text: '🔍 Inspect User', callback_data: 'admin:inspect_prompt' }, { text: '🚫 Ban User', callback_data: 'admin:ban_prompt' }],
                    [{ text: '❌ Close', callback_data: 'admin:close' }]
                ]
            }
        };

        if (messageId) {
            await this.editMessage(chatId, messageId, dashboardMsg, options);
        } else {
            await this.sendToChat(chatId, threadId, dashboardMsg, options);
        }
    }

    private async updateSysStats(chatId: number, _threadId: number | undefined, messageId: number): Promise<void> {
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
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin:back' }]] }
        });
    }

    private async updateUserList(chatId: number, _threadId: number | undefined, messageId: number): Promise<void> {
        const users = this.storage.getAllUsers();
        const activeUsers = users.filter(u => !u.isBanned).length;
        users.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
        const topUsers = users.slice(0, 20);

        let listMsg = `👥 *User Directory* (${activeUsers}/${users.length})\n\n`;
        topUsers.forEach(u => {
            const status = u.isBanned ? '🔴' : '🟢';
            const name = this.escapeMarkdown(u.firstName);
            const username = u.username ? `(@${this.escapeMarkdown(u.username)})` : '';
            listMsg += `${status} [${name}](tg://user?id=${u.id}) ${username} | 🔗 /user\\_${u.id}\n`;
        });

        await this.editMessage(chatId, messageId, listMsg, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin:back' }]] }
        });
    }

    public async showUserProfile(chatId: number, threadId: number | undefined, targetId: number, messageIdToEdit?: number): Promise<void> {
        const user = this.storage.getUser(targetId);
        if (!user) {
            await this.sendToChat(chatId, threadId, `❌ User \`${targetId}\` not found.`, { parse_mode: 'Markdown' });
            return;
        }

        let blockStatus = '❓ Unknown';
        try {
            await this.bot.sendChatAction(targetId, 'typing');
            blockStatus = '🟢 Active';
        } catch (error: any) {
            if (error.response?.statusCode === 403) blockStatus = '🔴 Blocked Bot';
        }

        const profileMsg = `
👤 *User Control Center*

🆔 *ID:* \`${user.id}\`
👤 *Name:* ${this.escapeMarkdown(user.firstName)}
🔗 *Handle:* ${user.username ? `@${this.escapeMarkdown(user.username)}` : 'None'}

📊 *Status:*
• Account: ${user.isBanned ? '🔴 BANNED' : '🟢 Active'}
• Bot State: ${blockStatus}
• Joined: ${new Date(user.joinedAt).toLocaleDateString()}
• Downloads: ${user.downloadHistory.length}
• Credits: ${user.credits.used}/${100} (Remaining: ${100 - user.credits.used})
        `.trim();

        const keyboard = [
            [
                { text: '📜 History', callback_data: `admin:history:${user.id}` },
                { text: '📩 Send Msg', callback_data: `admin:dm:${user.id}` }
            ],
            [
                user.isBanned
                    ? { text: '✅ Unban User', callback_data: `admin:unban:${user.id}` }
                    : { text: '🚫 Ban User', callback_data: `admin:ban:${user.id}` }
            ],
            [
                { text: '🔄 Reset Credits', callback_data: `admin:reset_credits:${user.id}` }
            ],
            [
                { text: '🔙 Back to List', callback_data: 'admin:users' }
            ]
        ];

        if (messageIdToEdit) {
            await this.editMessage(chatId, messageIdToEdit, profileMsg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
        } else {
            await this.sendToChat(chatId, threadId, profileMsg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
        }
    }

    private async executeBan(chatId: number, threadId: number | undefined, targetId: number, messageIdToUpdate?: number): Promise<void> {
        await this.storage.banUser(targetId);
        this.queue.purgeUser(targetId);
        await this.downloadManager.cancelUserDownloads(targetId);

        if (messageIdToUpdate) {
            await this.showUserProfile(chatId, threadId, targetId, messageIdToUpdate);
        } else {
            await this.sendToChat(chatId, threadId, `🚫 User \`${targetId}\` banned and active downloads killed.`, { parse_mode: 'Markdown' });
        }
    }

    private async executeUnban(chatId: number, threadId: number | undefined, targetId: number, messageIdToUpdate?: number): Promise<void> {
        await this.storage.unbanUser(targetId);
        if (messageIdToUpdate) {
            await this.showUserProfile(chatId, threadId, targetId, messageIdToUpdate);
        } else {
            await this.sendToChat(chatId, threadId, `✅ User \`${targetId}\` unbanned.`, { parse_mode: 'Markdown' });
        }
    }

    private async executeHistory(chatId: number, _threadId: number | undefined, targetId: number, messageId: number): Promise<void> {
        const user = this.storage.getUser(targetId);
        if (!user) return;

        let historyMsg = `📂 *Download History for* \`${targetId}\`\n\n`;
        const recentHistory = user.downloadHistory.slice(-10).reverse();

        if (recentHistory.length === 0) {
            historyMsg += 'No downloads recorded.';
        } else {
            recentHistory.forEach((h, i) => {
                const date = new Date(h.date).toLocaleDateString();
                historyMsg += `${i + 1}. [${h.title}](${h.url}) - 📅 ${date}\n`;
            });
        }

        await this.editMessage(chatId, messageId, historyMsg, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Profile', callback_data: `admin:profile:${targetId}` }]] }
        });
    }

    private async executeDM(chatId: number, threadId: number | undefined, targetId: number, text: string): Promise<void> {
        try {
            await this.bot.sendMessage(targetId, `📩 *Message from Admin*\n\n${text}`, { parse_mode: 'Markdown' });
            await this.sendToChat(chatId, threadId, `✅ Message sent to \`${targetId}\`.`, { parse_mode: 'Markdown' });
        } catch (e) {
            await this.sendToChat(chatId, threadId, `❌ Failed to send message. User might have blocked the bot.`);
        }
    }

    private async executeResetCredits(chatId: number, threadId: number | undefined, targetId: number, messageIdToUpdate?: number): Promise<void> {
        this.storage.resetCredits(targetId);
        if (messageIdToUpdate) {
            await this.showUserProfile(chatId, threadId, targetId, messageIdToUpdate);
        } else {
            await this.sendToChat(chatId, threadId, `✅ Credits reset for user \`${targetId}\`.`, { parse_mode: 'Markdown' });
        }
    }

    private async inspectUser(userIdStr: string, chatId: number, threadId: number | undefined): Promise<void> {
        const targetId = parseInt(userIdStr.trim());
        if (isNaN(targetId)) {
            await this.sendToChat(chatId, threadId, '❌ Invalid ID format.');
            return;
        }
        await this.showUserProfile(chatId, threadId, targetId);
    }

    private async performBroadcast(text: string): Promise<void> {
        const users = this.storage.getAllUsers();
        let successCount = 0;
        await logToTopic(this.bot, this.adminConfig.adminGroupId, this.adminConfig.topicControl, `📢 Broadcasting to ${users.length} users...`);

        for (const user of users) {
            try {
                await this.bot.sendMessage(user.id, `📢 *Announcement*\n\n${text}`, { parse_mode: 'Markdown' });
                successCount++;
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (e) { /* Ignore */ }
        }
        await logToTopic(this.bot, this.adminConfig.adminGroupId, this.adminConfig.topicControl, `✅ Broadcast complete. Sent to ${successCount}/${users.length} users.`);
    }

    private async toggleMaintenance(chatId: number, threadId: number | undefined, messageId: number): Promise<void> {
        const currentMode = this.storage.isMaintenanceMode();
        await this.storage.setMaintenanceMode(!currentMode);

        // Refresh dashboard to show new status
        await this.showAdminDashboard(chatId, threadId, messageId);

        // Notify in admin group
        const status = !currentMode ? 'ENABLED 🔴' : 'DISABLED 🟢';
        await logToTopic(this.bot, this.adminConfig.adminGroupId, this.adminConfig.topicGeneral,
            `🚧 *Maintenance Mode ${status}*`);
    }
}
