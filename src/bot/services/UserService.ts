import TelegramBot, { Message, SendMessageOptions } from 'node-telegram-bot-api';
import { StorageManager } from '../../utils/storage';
import { logOperation } from '../../utils/logger';
import { DownloadService } from './DownloadService';
import { URLValidator } from '../../utils/urlValidator';

interface UserState {
    action: 'WAITING_SCHEDULE_LINK' | 'WAITING_SCHEDULE_TIME' | 'WAITING_SUPPORT_MESSAGE';
    data?: any;
    timestamp: number;
}

import { AdminConfig } from '../../types';

export class UserService {
    private bot: TelegramBot;
    private storage: StorageManager;
    private urlValidator: URLValidator;
    private adminConfig: AdminConfig;
    private downloadService?: DownloadService;
    private userStates: Map<number, UserState>;
    private cleanupInterval: NodeJS.Timeout;
    private readonly STATE_TTL = 3600000; // 1 Hour

    constructor(bot: TelegramBot, storage: StorageManager, urlValidator: URLValidator, adminConfig: AdminConfig) {
        this.bot = bot;
        this.storage = storage;
        this.urlValidator = urlValidator;
        this.adminConfig = adminConfig;
        this.userStates = new Map();

        // Start cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanupStates(), this.STATE_TTL);
    }

    public stop(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }

    public setDownloadService(downloadService: DownloadService) {
        this.downloadService = downloadService;
    }

    private cleanupStates(): void {
        const now = Date.now();
        for (const [userId, state] of this.userStates.entries()) {
            if (now - state.timestamp > this.STATE_TTL) {
                this.userStates.delete(userId);
            }
        }
    }

    private async sendToChat(chatId: number, threadId: number | undefined, text: string, options: SendMessageOptions = {}): Promise<Message> {
        const finalOptions = { ...options };
        if (threadId && threadId !== 1) {
            finalOptions.message_thread_id = threadId;
        }
        return this.bot.sendMessage(chatId, text, finalOptions);
    }

    public hasPendingState(userId: number): boolean {
        return this.userStates.has(userId);
    }

    public async handleStateInput(msg: Message): Promise<void> {
        const userId = msg.from?.id;
        if (!userId) return;

        const state = this.userStates.get(userId);
        if (!state) return;

        const chatId = msg.chat.id;
        const threadId = msg.message_thread_id;
        const text = msg.text?.trim();

        if (!text) return;

        // Update timestamp on activity
        state.timestamp = Date.now();

        if (state.action === 'WAITING_SCHEDULE_LINK') {
            // Validate URL using URLValidator
            const extractedUrl = this.urlValidator.extractURL(text);
            if (!extractedUrl || !this.urlValidator.isValid(extractedUrl)) {
                await this.sendToChat(chatId, threadId, '❌ رابط غير صحيح. الرجاء إرسال رابط فيديو صالح (YouTube, Facebook, TikTok, etc).');
                return;
            }

            this.userStates.set(userId, { action: 'WAITING_SCHEDULE_TIME', data: { url: extractedUrl }, timestamp: Date.now() });

            const options: SendMessageOptions = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'بعد ساعة 🕐', callback_data: 'user:sched_time:1h' }, { text: 'بعد 3 ساعات 🕒', callback_data: 'user:sched_time:3h' }],
                        [{ text: 'صباح الغد (8:00) ☀️', callback_data: 'user:sched_time:08:00' }, { text: 'مساء الغد (20:00) 🌙', callback_data: 'user:sched_time:20:00' }],
                        [{ text: '❌ إلغاء', callback_data: 'user:sched_cancel' }]
                    ]
                }
            };
            await this.sendToChat(chatId, threadId, `🔗 *تم استلام الرابط!* ✅\n\n⏰ *متى تريد أن أرسل لك الفيديو؟*\nاختر من الأزرار أو اكتب الوقت يدوياً (مثال: \`14:30\`):`, options);

        } else if (state.action === 'WAITING_SCHEDULE_TIME') {
            await this.finalizeSchedule(chatId, userId, threadId, state.data.url, text);
        } else if (state.action === 'WAITING_SUPPORT_MESSAGE') {
            // Forward to Admin Group
            // We need AdminConfig here. Since we don't have it directly injected, we can use a hardcoded ID or better, inject it.
            // For now, let's assume we can get it or just send to a known admin ID if available.
            // Actually, we should inject AdminConfig into UserService.
            // BUT, to avoid changing constructor signature too much right now, let's use a workaround or just log it if we can't send.
            // Wait, we can use this.storage.getSettings() if we had it.
            // Let's assume we can pass the admin group ID via a method or just use a placeholder for now and fix injection later?
            // No, let's do it right. We need to forward to the admin group.
            // Let's check if we can get the admin group ID.
            // It seems UserService doesn't have AdminConfig.
            // Let's add a method to set Admin Group ID or just use a generic "Support" log for now?
            // User requested "Professional".
            // Let's add `adminGroupId` to UserService.

            // For this specific edit, I will assume I can add a property to UserService later.
            // Let's just send a confirmation for now and I will add the forwarding logic in a separate method/edit.

            // Actually, I can use `this.bot.sendMessage` to the admin group if I knew the ID.
            // Let's add `adminGroupId` to the class and constructor in a separate step.
            // For now, let's implement the logic assuming `this.adminGroupId` exists.

            // Wait, I can't use a property that doesn't exist.
            // I will add the property in the next step.

            await this.handleSupportMessage(msg, text);
        }
    }

    private async handleSupportMessage(msg: Message, text: string): Promise<void> {
        const userId = msg.from?.id!;
        const chatId = msg.chat.id;
        const threadId = msg.message_thread_id;

        // Clear state
        this.userStates.delete(userId);

        // Send to User
        await this.sendToChat(chatId, threadId, '✅ *تم إرسال رسالتك للدعم الفني.*\nسيقوم أحد المشرفين بالرد عليك قريباً.', { parse_mode: 'Markdown' });

        // Forward to Admin
        await this.forwardToAdmin(msg, text);
    }

    private async forwardToAdmin(msg: Message, content: string): Promise<void> {
        const user = msg.from;
        const text = `📩 *رسالة دعم فني جديدة*\n\n👤 *من:* ${user?.first_name} (@${user?.username || 'NoUser'})\n🆔 *ID:* \`${user?.id}\`\n\n📝 *الرسالة:* ${content}`;

        try {
            await this.bot.sendMessage(this.adminConfig.adminGroupId, text, {
                message_thread_id: this.adminConfig.topicControl,
                parse_mode: 'Markdown'
            });
        } catch (error) {
            logOperation('support_forward_fail', { error });
        }
    }

    private async finalizeSchedule(chatId: number, userId: number, threadId: number | undefined, url: string, timeStr: string): Promise<void> {
        if (!this.downloadService) {
            await this.sendToChat(chatId, threadId, '❌ خطأ داخلي: خدمة التحميل غير مرتبطة.');
            return;
        }

        try {
            const response = await this.downloadService.scheduleTask(userId, chatId, threadId, url, timeStr);
            this.userStates.delete(userId);
            await this.sendToChat(chatId, threadId, response);
        } catch (error: any) {
            await this.sendToChat(chatId, threadId, `❌ ${error.message}`);
        }
    }

    public async handleStart(msg: Message): Promise<void> {
        const userId = msg.from?.id;
        if (!userId) return;

        logOperation('command_start', { userId });

        // Ensure user exists
        this.storage.updateUser({
            id: userId,
            first_name: msg.from?.first_name || 'Unknown',
            last_name: msg.from?.last_name,
            username: msg.from?.username
        });

        const { remaining, limit } = this.storage.getCredits(userId);

        // Premium Dashboard Design
        const welcomeMessage = `👋 *مرحباً بك، ${msg.from?.first_name || 'يا صديقي'}!*

💎 *لوحة التحكم:*
━━━━━━━━━━━━
💰 *الرصيد:* \`${remaining}/${limit}\` نقطة
📊 *التحميلات:* \`${this.storage.getUser(userId)?.downloadHistory.length || 0}\` فيديو
━━━━━━━━━━━━

🚀 *جاهز للتحميل؟*
فقط أرسل رابط الفيديو هنا (YouTube, TikTok, Instagram...) وسأقوم بالباقي! 😉`;

        const options: SendMessageOptions = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📅 جدولة تحميل', callback_data: 'user:schedule' }, { text: '⚙️ الإعدادات', callback_data: 'user:settings' }],
                    [{ text: '📜 سجل تحميلاتي', callback_data: 'user:history' }, { text: '📚 دليل الاستخدام', callback_data: 'user:help' }],
                    [{ text: 'ℹ️ عن البوت', callback_data: 'user:about' }, { text: '📞 الدعم', callback_data: 'user:support' }]
                ]
            }
        };

        await this.sendToChat(msg.chat.id, msg.message_thread_id, welcomeMessage, options);
    }

    public async handleHelp(msg: Message): Promise<void> {
        await this.sendToChat(msg.chat.id, msg.message_thread_id, this.getHelpMessage(), { parse_mode: 'Markdown' });
    }

    public async handleCallback(query: TelegramBot.CallbackQuery, subAction: string): Promise<void> {
        if (!query.message) return;
        const chatId = query.message.chat.id;
        const threadId = query.message.message_thread_id;
        const userId = query.from.id;

        await this.bot.answerCallbackQuery(query.id);

        if (subAction === 'settings') {
            await this.handleSettings(chatId, userId, threadId);
        } else if (subAction === 'set_timezone') {
            await this.handleTimezoneSelection(chatId, threadId);
        } else if (subAction.startsWith('tz:')) {
            const offset = parseInt(subAction.split(':')[1]);
            this.storage.setTimezone(userId, offset);
            await this.sendToChat(chatId, threadId, `✅ تم تحديث منطقتك الزمنية إلى: UTC${offset >= 0 ? '+' : ''}${offset}`);
            await this.handleSettings(chatId, userId, threadId);
        } else if (subAction === 'schedule') {
            this.userStates.set(userId, { action: 'WAITING_SCHEDULE_LINK', timestamp: Date.now() });
            await this.sendToChat(chatId, threadId, '📅 *جدولة تحميل جديد*\n\nأرسل رابط الفيديو الذي تريد جدولته الآن: 👇', { reply_markup: { force_reply: true }, parse_mode: 'Markdown' });
        } else if (subAction === 'sched_cancel') {
            this.userStates.delete(userId);
            await this.bot.deleteMessage(chatId, query.message.message_id);
            await this.sendToChat(chatId, threadId, '❌ تم إلغاء الجدولة.');
        } else if (subAction.startsWith('sched_time:')) {
            const timeParam = subAction.substring('sched_time:'.length);
            const state = this.userStates.get(userId);
            if (state && state.action === 'WAITING_SCHEDULE_TIME' && state.data?.url) {
                let timeStr = timeParam;
                if (timeParam === '1h') {
                    const d = new Date(); d.setHours(d.getHours() + 1);
                    timeStr = `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
                } else if (timeParam === '3h') {
                    const d = new Date(); d.setHours(d.getHours() + 3);
                    timeStr = `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
                }
                await this.finalizeSchedule(chatId, userId, threadId, state.data.url, timeStr);
            } else {
                await this.sendToChat(chatId, threadId, '❌ انتهت صلاحية الجلسة. ابدأ من جديد.');
            }
        } else {
            switch (subAction) {
                case 'history':
                    await this.handleHistory(chatId, userId, threadId);
                    break;
                case 'support':
                    this.userStates.set(userId, { action: 'WAITING_SUPPORT_MESSAGE', timestamp: Date.now() });
                    await this.sendToChat(chatId, threadId, '📞 *الدعم الفني*\n\nأرسل رسالتك الآن (مشكلة، اقتراح، أو استفسار) وسأقوم بتحويلها للإدارة فوراً. 👇', { reply_markup: { force_reply: true }, parse_mode: 'Markdown' });
                    break;
                case 'help':
                    await this.sendToChat(chatId, threadId, this.getHelpMessage(), { parse_mode: 'Markdown' });
                    break;
                case 'about':
                    const aboutMsg = `🤖 *عن البوت*\n\n` +
                        `بوت *Tanzil* هو أداتك الذكية لتحميل الفيديوهات من جميع منصات التواصل الاجتماعي.\n\n` +
                        `🌟 *المميزات:*` +
                        `\n• تحميل من YouTube, TikTok, Instagram, Facebook` +
                        `\n• دعم جودات متعددة (Video & Audio)` +
                        `\n• جدولة التحميلات` +
                        `\n• إدارة قوائم التشغيل` +
                        `\n\n👨‍💻 *تطوير:* [Dev Name](https://t.me/DevChannel)\n` +
                        `v3.0.0 (Premium Edition)`;
                    await this.sendToChat(chatId, threadId, aboutMsg, { parse_mode: 'Markdown', disable_web_page_preview: true });
                    break;
            }
        }
    }

    private async handleHistory(chatId: number, userId: number, threadId?: number): Promise<void> {
        const user = this.storage.getUser(userId);
        const history = user?.downloadHistory || [];

        if (history.length === 0) {
            await this.sendToChat(chatId, threadId, '📭 *سجل التحميلات فارغ.*');
            return;
        }

        const last5 = history.slice(-5).reverse();
        let msg = '📜 *آخر 5 تحميلات:*\n\n';

        last5.forEach((item, i) => {
            const date = new Date(item.timestamp).toLocaleDateString('en-GB');
            msg += `${i + 1}. [${item.filename || 'Video'}](${item.url}) (${date})\n`;
        });

        await this.sendToChat(chatId, threadId, msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
    }

    private async handleSettings(chatId: number, userId: number, threadId?: number): Promise<void> {
        const user = this.storage.getUser(userId);
        const timezone = user?.timezone || 0;
        const tzString = `UTC${timezone >= 0 ? '+' : ''}${timezone}`;

        const message = `⚙️ *الإعدادات*\n\n` +
            `🌍 *المنطقة الزمنية:* ${tzString}\n` +
            `🔔 *الإشعارات:* مفعلة`;

        const options: SendMessageOptions = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🌍 تغيير المنطقة الزمنية', callback_data: 'user:set_timezone' }],
                    [{ text: '🔙 رجوع', callback_data: 'user:help' }]
                ]
            }
        };

        await this.sendToChat(chatId, threadId, message, options);
    }

    private async handleTimezoneSelection(chatId: number, threadId?: number): Promise<void> {
        const message = '🌍 *اختر منطقتك الزمنية:*';
        const options: SendMessageOptions = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🇸🇦 السعودية (+3)', callback_data: 'user:tz:3' },
                        { text: '🇪🇬 مصر (+2)', callback_data: 'user:tz:2' }
                    ],
                    [
                        { text: '🇦🇪 الإمارات (+4)', callback_data: 'user:tz:4' },
                        { text: '🇩🇿 الجزائر (+1)', callback_data: 'user:tz:1' }
                    ],
                    [
                        { text: '🇲🇦 المغرب (+1)', callback_data: 'user:tz:1' },
                        { text: '🌍 جرينتش (0)', callback_data: 'user:tz:0' }
                    ],
                    [{ text: '🔙 رجوع', callback_data: 'user:settings' }]
                ]
            }
        };

        await this.sendToChat(chatId, threadId, message, options);
    }

    private getHelpMessage(): string {
        return `
📚 *دليل الاستخدام*

1️⃣ *التحميل:*
أرسل رابط الفيديو مباشرة.

2️⃣ *القوائم:*
أرسل رابط قائمة تشغيل (Playlist) لاختيار مقاطع محددة.

3️⃣ *الجدولة:*
اضغط على "📅 جدولة تحميل" من القائمة الرئيسية لجدولة التحميلات لوقت لاحق.
يمكنك ضبط توقيتك من قائمة "⚙️ الإعدادات".
        `.trim();
    }
}
