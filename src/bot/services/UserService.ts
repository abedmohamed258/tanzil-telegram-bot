import { Telegraf } from 'telegraf';
import { Message, SendMessageOptions } from '../../bot/types';
import { SupabaseManager } from '../../database/SupabaseManager';
import { logOperation } from '../../utils/logger';
import { DownloadService } from './DownloadService';
import { URLValidator } from '../../utils/UrlValidator';
import { AdminConfig } from '../../types';
import { eventBus, BotEvents } from '../../utils/EventBus';

interface UserState {
    action: 'WAITING_SCHEDULE_LINK' | 'WAITING_SCHEDULE_TIME' | 'WAITING_SUPPORT_MESSAGE' | 'WAITING_LOCATION';
    data?: any;
    timestamp: number;
}

export class UserService {
    private bot: Telegraf<any>;
    private storage: SupabaseManager;
    private urlValidator: URLValidator;
    private adminConfig: AdminConfig;
    private downloadService?: DownloadService;
    private userStates: Map<number, UserState>;
    private cleanupInterval: NodeJS.Timeout;
    private readonly STATE_TTL = 3600000; // 1 Hour

    constructor(bot: Telegraf<any>, storage: SupabaseManager, urlValidator: URLValidator, adminConfig: AdminConfig) {
        this.bot = bot;
        this.storage = storage;
        this.urlValidator = urlValidator;
        this.adminConfig = adminConfig;
        this.userStates = new Map();

        this.cleanupInterval = setInterval(() => this.cleanupStates(), this.STATE_TTL);

        // Subscribe to Events
        this.setupEventListeners();
    }

    private setupEventListeners() {
        eventBus.on(BotEvents.SCHEDULE_REQUESTED, (data: any) => {
            this.handleScheduleRequest(data);
        });
    }

    private handleScheduleRequest(data: any) {
        const { userId, chatId: _chatId, threadId: _threadId, url, isPlaylist, indices, format } = data;
        this.setUserState(userId, 'WAITING_SCHEDULE_TIME', {
            url,
            isPlaylist,
            indices,
            format
        });
        // We don't need to send a message here because PlaylistManager already sent one.
        // Or we can send a confirmation if needed.
    }

    public stop(): void {
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    }

    public setDownloadService(downloadService: DownloadService) {
        this.downloadService = downloadService;
    }

    public setUserState(userId: number, action: any, data: any) {
        this.userStates.set(userId, { action, data, timestamp: Date.now() });
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
        if (threadId && threadId !== 1) finalOptions.message_thread_id = threadId;
        return this.bot.telegram.sendMessage(chatId, text, finalOptions as any);
    }

    // UX: دالة لتعديل الرسالة بدلاً من إرسال جديدة
    private async editMessage(chatId: number, messageId: number, text: string, options: any = {}): Promise<void> {
        try {
            await this.bot.telegram.editMessageText(chatId, messageId, undefined, text, options as any);
        } catch (e) {
            // في حال فشل التعديل (الرسالة قديمة جداً)، أرسل رسالة جديدة
            await this.sendToChat(chatId, undefined, text, options);
        }
    }

    public hasPendingState(userId: number): boolean {
        return this.userStates.has(userId);
    }

    public async handleStart(msg: any): Promise<void> {
        const userId = msg.from?.id;
        if (!userId) return;

        logOperation('command_start', { userId });

        await this.storage.updateUser({
            id: userId,
            first_name: msg.from?.first_name || 'Unknown',
            last_name: msg.from?.last_name,
            username: msg.from?.username
        });

        const { remaining, limit } = await this.storage.getCredits(userId);
        const user = await this.storage.getUser(userId);

        const welcomeMessage = `
👋 *مرحباً بك، ${msg.from?.first_name || 'المستخدم'}*
━━━━━━━━━━━━━━━━━━━━━━━
📊 *ملخص حسابك:*
💰 *الرصيد المتاح:* \`${remaining}/${limit}\` نقطة
📥 *عمليات التنزيل:* \`${user?.downloadHistory.length || 0}\` ملف
━━━━━━━━━━━━━━━━━━━━━━━

📝 *الخدمات المتاحة:*
يمكنك إرسال رابط من YouTube أو TikTok أو Instagram أو أي منصة أخرى مدعومة لتحميل المحتوى مباشرة.`;

        const options: SendMessageOptions = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📅 جدولة ذكية', callback_data: 'user:schedule' }, { text: '⚙️ الإعدادات', callback_data: 'user:settings' }],
                    [{ text: '📜 السجل', callback_data: 'user:history' }, { text: '📚 الدليل', callback_data: 'user:help' }],
                    [{ text: '💎 عن البوت', callback_data: 'user:about' }, { text: '📞 الدعم الفني', callback_data: 'user:support' }]
                ]
            }
        };

        await this.sendToChat(msg.chat.id, msg.message_thread_id, welcomeMessage, options);
    }

    public async handleStateInput(msg: any): Promise<void> {
        const userId = msg.from?.id;
        if (!userId) return;

        const state = this.userStates.get(userId);
        if (!state) return;

        const text = (msg as any).text?.trim();
        const chatId = msg.chat.id;

        if (state.action === 'WAITING_SCHEDULE_LINK') {
            if (!text) return;
            const extractedUrl = this.urlValidator.extractURL(text);
            if (!extractedUrl || !this.urlValidator.isValid(extractedUrl)) {
                await this.sendToChat(chatId, msg.message_thread_id, '❌ الرابط المدخل غير صحيح. يرجى التحقق من صحة الرابط والمحاولة مجدداً.');
                return;
            }

            // Check if Playlist
            if (extractedUrl.includes('playlist') || extractedUrl.includes('&list=')) {
                // Delegate to DownloadService to show Playlist Menu (with Schedule button)
                if (this.downloadService) {
                    await this.downloadService.handleMessage(msg as any); // This will detect playlist and show menu
                    this.userStates.delete(userId); // Clear state as DownloadService takes over
                }
                return;
            }

            // Single Video: Ask Format
            this.userStates.set(userId, { action: 'WAITING_SCHEDULE_TIME', data: { url: extractedUrl, isPlaylist: false }, timestamp: Date.now() });

            // Ask Format First (We hijack the state slightly or just ask format and then time)
            // Actually, let's ask format via Inline Keyboard
            const opts: SendMessageOptions = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🎥 فيديو', callback_data: 'user:sched_fmt:best' }, { text: '🎧 صوت', callback_data: 'user:sched_fmt:audio' }],
                        [{ text: '❌ إلغاء', callback_data: 'user:sched_cancel' }]
                    ]
                }
            };
            await this.sendToChat(chatId, msg.message_thread_id, `🔗 *تم استلام الرابط!* \n👇 اختر الصيغة:`, opts);

        } else if (state.action === 'WAITING_SCHEDULE_TIME') {
            if (!text) return;
            // Check if format is selected (if not, default to best)
            const data = state.data;
            const format = data.format || 'best';

            // Validate Time Format (HH:MM)
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(text)) {
                await this.sendToChat(chatId, msg.message_thread_id, '❌ صيغة الوقت غير صحيحة. يرجى استخدام صيغة 24 ساعة (مثال: 14:30).');
                return;
            }

            await this.finalizeSchedule(chatId, userId, msg.message_thread_id, data.url, text, format, data);

        } else if (state.action === 'WAITING_SUPPORT_MESSAGE') {
            if (!text) return;
            await this.forwardToAdmin(msg, text);
            await this.sendToChat(chatId, msg.message_thread_id, '✅ *تم استلام رسالتك بنجاح.* سيتم الرد عليك من قبل فريق الدعم قريباً.', { parse_mode: 'Markdown' });
            this.userStates.delete(userId);
        }
    }

    public async handleCallback(query: any, subAction: string): Promise<void> {
        if (!query.message) return;
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const userId = query.from.id;

        await this.bot.telegram.answerCbQuery(query.id);

        if (subAction === 'settings') {
            await this.handleSettings(chatId, userId, messageId);
        } else if (subAction === 'set_timezone') {
            await this.handleTimezoneSelection(chatId, messageId);
        } else if (subAction === 'tz_auto') {
            this.userStates.set(userId, { action: 'WAITING_LOCATION', timestamp: Date.now() });
            await this.bot.telegram.deleteMessage(chatId, messageId);
            await this.sendToChat(chatId, query.message.message_thread_id, '📍 *اضغط الزر بالأسفل لمشاركة موقعك:*', {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [[{ text: '📍 مشاركة موقعي (تلقائي)', request_location: true }], [{ text: 'إلغاء' }]],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
        } else if (subAction.startsWith('tz:')) {
            const offset = parseInt(subAction.split(':')[1]);
            await this.storage.setTimezone(userId, offset);
            await this.bot.telegram.answerCbQuery(query.id, '✅ تم حفظ التوقيت!');
            await this.handleSettings(chatId, userId, messageId);
        } else if (subAction === 'set_quality') {
            await this.handleQualitySelection(chatId, messageId);
        } else if (subAction.startsWith('quality:')) {
            const quality = subAction.split(':')[1];
            await this.storage.updateUser({ id: userId, preferredQuality: quality });
            await this.bot.telegram.answerCbQuery(query.id, '✅ تم حفظ تفضيلات الجودة!');
            await this.handleSettings(chatId, userId, messageId);
        } else if (subAction === 'schedule') {
            this.userStates.set(userId, { action: 'WAITING_SCHEDULE_LINK', timestamp: Date.now() });
            await this.editMessage(chatId, messageId, '📅 *أرسل رابط الفيديو أو القائمة لجدولتها:*', { parse_mode: 'Markdown' });
        } else if (subAction.startsWith('sched_fmt:')) {
            const format = subAction.split(':')[1];
            const state = this.userStates.get(userId);
            if (state) {
                state.data.format = format;
                this.userStates.set(userId, state);

                const opts: SendMessageOptions = {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'بعد ساعة 🕐', callback_data: 'user:sched_time:1h' }, { text: 'بعد 3 ساعات 🕒', callback_data: 'user:sched_time:3h' }],
                            [{ text: 'غداً (8:00) ☀️', callback_data: 'user:sched_time:08:00' }, { text: 'إلغاء ❌', callback_data: 'user:sched_cancel' }]
                        ]
                    }
                };
                await this.editMessage(chatId, messageId, `✅ الصيغة: ${format === 'audio' ? 'صوت' : 'فيديو'}\n\n⏰ *متى تريد التحميل؟* (أرسل الوقت كتابةً أو اختر):`, opts);
            }
        } else if (subAction.startsWith('sched_time:')) {
            const timeParam = subAction.split(':')[1];
            const state = this.userStates.get(userId);
            if (state?.data?.url) {
                let timeStr = timeParam;
                const d = new Date();
                if (timeParam === '1h') timeStr = `${d.getHours() + 1}:${d.getMinutes()}`;
                else if (timeParam === '3h') timeStr = `${d.getHours() + 3}:${d.getMinutes()}`;

                const format = state.data.format || 'best';
                await this.finalizeSchedule(chatId, userId, query.message.message_thread_id, state.data.url, timeStr, format, state.data);
                await this.bot.telegram.deleteMessage(chatId, messageId); // Clean up menu
            }
        } else if (subAction === 'sched_cancel') {
            this.userStates.delete(userId);
            await this.bot.telegram.deleteMessage(chatId, messageId);
            await this.sendToChat(chatId, query.message.message_thread_id, '❌ تم إلغاء العملية.');
        } else if (subAction === 'history') {
            await this.handleHistory(chatId, userId, messageId);
        } else if (subAction === 'help') {
            await this.editMessage(chatId, messageId, this.getHelpMessage(), {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '🔙 القائمة الرئيسية', callback_data: 'user:start' }]] }
            });
        } else if (subAction === 'about') {
            await this.handleAbout(chatId, messageId);
        } else if (subAction === 'support') {
            this.userStates.set(userId, { action: 'WAITING_SUPPORT_MESSAGE', timestamp: Date.now() });
            await this.editMessage(chatId, messageId, '📝 *أكتب رسالتك الآن (مشكلة أو اقتراح):*', {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '🔙 إلغاء', callback_data: 'user:start' }]] }
            });
        } else if (subAction === 'start') {
            // Return to main menu via Edit
            const { remaining, limit } = await this.storage.getCredits(userId);
            const user = await this.storage.getUser(userId);
            const welcomeMessage = `👋 *مرحباً بك، ${query.from.first_name}!*\n\n💎 *لوحة التحكم:*\n💰 *الرصيد:* \`${remaining}/${limit}\`\n📊 *التحميلات:* \`${user?.downloadHistory.length || 0}\``;

            await this.editMessage(chatId, messageId, welcomeMessage, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📅 جدولة تحميل', callback_data: 'user:schedule' }, { text: '⚙️ الإعدادات', callback_data: 'user:settings' }],
                        [{ text: '📜 سجل تحميلاتي', callback_data: 'user:history' }, { text: '📚 دليل الاستخدام', callback_data: 'user:help' }],
                        [{ text: 'ℹ️ عن البوت', callback_data: 'user:about' }, { text: '📞 الدعم', callback_data: 'user:support' }]
                    ]
                }
            });
        }
    }

    // إتمام الجدولة (الربط الحقيقي)
    private async finalizeSchedule(chatId: number, userId: number, threadId: number | undefined, url: string, timeStr: string, format: string = 'best', meta: any = {}) {
        if (!this.downloadService) return;
        try {
            const response = await this.downloadService.scheduleTask(userId, chatId, threadId, url, timeStr, format, meta);
            await this.sendToChat(chatId, threadId, response, { parse_mode: 'Markdown' });
            this.userStates.delete(userId);
        } catch (e) {
            await this.sendToChat(chatId, threadId, `❌ خطأ في الوقت: ${(e as Error).message}`);
        }
    }

    public async handleLocation(msg: any): Promise<void> {
        if (!msg.location || !msg.from) return;
        const userId = msg.from.id;
        const chatId = msg.chat.id;

        // حساب تقريبي للمنطقة الزمنية (خط الطول / 15 درجة = ساعة)
        const offset = Math.round((msg.location as any).longitude / 15);
        await this.storage.setTimezone(userId, offset);

        this.userStates.delete(userId); // Clear state
        await this.sendToChat(chatId, msg.message_thread_id, `✅ تم تحديد منطقتك الزمنية: GMT${offset >= 0 ? '+' : ''}${offset}`, { reply_markup: { remove_keyboard: true } });

        // العودة للقائمة
        const fakeMsg = { ...msg, text: '/start' };
        await this.handleStart(fakeMsg);
    }

    private async handleSettings(chatId: number, userId: number, messageId: number) {
        const user = await this.storage.getUser(userId);
        const tzString = `UTC${(user?.timezone || 0) >= 0 ? '+' : ''}${user?.timezone || 0}`;

        const text = `
⚙️ *إعدادات النظام الكوني*
━━━━━━━━━━━━━━━━━━━━
🌍 *المنطقة الزمنية:* \`${tzString}\`
🎬 *الجودة المفضلة:* \`${user?.preferredQuality || 'اسألني دائماً'}\`
🆔 *المعرف الرقمي:* \`${userId}\`
━━━━━━━━━━━━━━━━━━━━`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🌍 ضبط التوقيت', callback_data: 'user:set_timezone' }],
                [{ text: '🎬 الجودة الافتراضية', callback_data: 'user:set_quality' }],
                [{ text: '🔙 العودة للقيادة', callback_data: 'user:start' }]
            ]
        };
        await this.editMessage(chatId, messageId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }

    private async handleQualitySelection(chatId: number, messageId: number) {
        const text = '🎬 *اختر الجودة المفضلة للتحميل:*';
        const keyboard = {
            inline_keyboard: [
                [{ text: '❓ اسألني دائماً', callback_data: 'user:quality:ask' }],
                [{ text: '💎 أفضل جودة (Best)', callback_data: 'user:quality:best' }],
                [{ text: '🎧 صوت فقط (Audio)', callback_data: 'user:quality:audio' }],
                [{ text: '📺 1080p', callback_data: 'user:quality:1080p' }, { text: '📺 720p', callback_data: 'user:quality:720p' }],
                [{ text: '🔙 رجوع', callback_data: 'user:settings' }]
            ]
        };
        await this.editMessage(chatId, messageId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }

    private async handleTimezoneSelection(chatId: number, messageId: number) {
        const text = '🌍 *كيف تريد ضبط الوقت؟*';
        const keyboard = {
            inline_keyboard: [
                [{ text: '📍 تحديد تلقائي (GPS)', callback_data: 'user:tz_auto' }],
                [{ text: '🇸🇦 السعودية (+3)', callback_data: 'user:tz:3' }, { text: '🇪🇬 مصر (+2)', callback_data: 'user:tz:2' }],
                [{ text: '🇦🇪 الإمارات (+4)', callback_data: 'user:tz:4' }, { text: '🇩🇿 الجزائر (+1)', callback_data: 'user:tz:1' }],
                [{ text: '🔙 رجوع', callback_data: 'user:settings' }]
            ]
        };
        await this.editMessage(chatId, messageId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }

    private async handleHistory(chatId: number, userId: number, messageId: number) {
        const user = await this.storage.getUser(userId);
        const history = user?.downloadHistory.slice(-5).reverse() || [];

        let text = '📜 *آخر 5 تحميلات:*\n\n';
        if (history.length === 0) text += '📭 السجل فارغ.';
        else history.forEach((h, i) => text += `${i + 1}. [${h.filename}](${h.url})\n`);

        await this.editMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'user:start' }]] }
        });
    }

    private async forwardToAdmin(msg: any, content: string) {
        // إرسال الرسالة لمجموعة الإدارة مع إضافة ID المستخدم للرد
        const text = `📩 *رسالة دعم جديدة*\n\n👤 *من:* ${msg.from?.first_name}\n🆔 *ID:* \`${msg.from?.id}\`\n\n📝 *الرسالة:* ${content}`;
        await this.bot.telegram.sendMessage(this.adminConfig.adminGroupId, text, {
            parse_mode: 'Markdown',
            message_thread_id: this.adminConfig.topicControl
        });
    }

    public async handleHelp(msg: any): Promise<void> {
        await this.sendToChat(msg.chat.id, msg.message_thread_id, this.getHelpMessage(), { parse_mode: 'Markdown' });
    }

    private getHelpMessage(): string {
        return `
📚 *دليل الاستخدام*
━━━━━━━━━━━━━━━━━━━━
1️⃣ *التحميل السريع:*
فقط أرسل الرابط (YouTube, Instagram, TikTok...) وسأقوم بجلبه لك.

2️⃣ *الجدولة الذكية:*
اضغط على "جدولة تحميل" في القائمة الرئيسية لجدولة التحميلات في وقت لاحق.

3️⃣ *الدعم الفني:*
واجهت مشكلة؟ استخدم زر "الدعم" للتواصل مع فريقنا.
━━━━━━━━━━━━━━━━━━━━`;
    }

    private getAboutMessage(): string {
        return `
ℹ️ *عن البوت Tanzil*
━━━━━━━━━━━━━━━━━━━━
🚀 *النسخة:* 1.0.0
📅 *آخر تحديث:* ديسمبر 2025

**الميزات:**
✨ تحميل من 100+ منصة (YouTube, TikTok, Instagram...)
⚡ سرعة عالية جداً بفضل التحسينات
📦 دعم البلاي ليست والقوائم
📅 جدولة ذكية للتحميلات
🎬 اختيار الجودة المفضلة
🌍 دعم المناطق الزمنية

**التطوير:**
• تم تطويره بواسطة فريق مختص
• البوت مفتوح المصدر وآمن تماماً
• بيانات المستخدمين محمية بأعلى معايير الأمان

**المساعدة:**
📞 استخدم زر الدعم للتواصل معنا
━━━━━━━━━━━━━━━━━━━━`;
    }

    private async handleAbout(chatId: number, messageId: number): Promise<void> {
        await this.editMessage(chatId, messageId, this.getAboutMessage(), {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 القائمة الرئيسية', callback_data: 'user:start' }]] }
        });
    }
}
