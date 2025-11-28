import TelegramBot, { Message, CallbackQuery, SendMessageOptions } from 'node-telegram-bot-api';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { StorageManager } from '../../utils/storage';
import { RequestQueue } from '../../queue/requestQueue';
import { DownloadManager } from '../../download/downloadManager';
import { FileManager } from '../../utils/fileManager';
import { URLValidator } from '../../utils/urlValidator';
import { AdminConfig, DownloadRequest, ScheduledTask } from '../../types';
import { logger, logError, logOperation, logToTopic } from '../../utils/logger';
import { calculateCost, parsePlaylistSelection } from '../../utils/logicHelpers';
import { StoryService } from './StoryService';

interface CallbackState {
    timestamp: number;
    url: string;
    userId: number;
}

export class DownloadService {
    private bot: TelegramBot;
    private storage: StorageManager;
    private queue: RequestQueue;
    private downloadManager: DownloadManager;
    private fileManager: FileManager;
    private urlValidator: URLValidator;
    private adminConfig: AdminConfig;
    private storyService?: StoryService;

    private callbackMap: Map<string, CallbackState>;
    private readonly CALLBACK_TTL = 3600000; // 1 hour
    private readonly maxFileSize = 2000 * 1024 * 1024; // 2GB
    private readonly MAX_DURATION = 10800; // 3 hours in seconds

    private schedulerInterval?: NodeJS.Timeout;
    private cleanupInterval?: NodeJS.Timeout;

    constructor(
        bot: TelegramBot,
        storage: StorageManager,
        queue: RequestQueue,
        downloadManager: DownloadManager,
        fileManager: FileManager,
        urlValidator: URLValidator,
        adminConfig: AdminConfig
    ) {
        this.bot = bot;
        this.storage = storage;
        this.queue = queue;
        this.downloadManager = downloadManager;
        this.fileManager = fileManager;
        this.urlValidator = urlValidator;
        this.adminConfig = adminConfig;
        this.callbackMap = new Map();

        // Start Scheduler
        this.startScheduler();
        // Start Cleanup Loop
        this.cleanupInterval = setInterval(() => this.cleanupCallbacks(), this.CALLBACK_TTL);
    }

    public stop(): void {
        if (this.schedulerInterval) clearInterval(this.schedulerInterval);
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    }

    public setStoryService(storyService: StoryService) {
        this.storyService = storyService;
    }

    private async sendToChat(chatId: number, threadId: number | undefined, text: string, options: SendMessageOptions = {}): Promise<Message> {
        const finalOptions = { ...options };
        if (threadId && threadId !== 1) {
            finalOptions.message_thread_id = threadId;
        }
        return this.bot.sendMessage(chatId, text, finalOptions);
    }

    private async safeDeleteMessage(chatId: number, messageId: number): Promise<void> {
        try {
            await this.bot.deleteMessage(chatId, messageId);
        } catch (error: unknown) { /* Ignore */ }
    }

    private cleanupCallbacks(): void {
        const now = Date.now();
        for (const [key, value] of this.callbackMap.entries()) {
            if (now - value.timestamp > this.CALLBACK_TTL) this.callbackMap.delete(key);
        }
    }

    public async handleMessage(msg: Message): Promise<void> {
        const chatId = msg.chat.id;
        const threadId = msg.message_thread_id;
        const text = msg.text;
        const userId = msg.from?.id;

        if (!text || !userId) return;

        // Playlist Selection State
        const userProfile = this.storage.getUser(userId);
        if (userProfile?.activePlaylist?.state === 'WAITING_FOR_SELECTION') {
            await this.handlePlaylistSelection(msg);
            return;
        }

        const extractedUrl = this.urlValidator.extractURL(text);
        if (extractedUrl && this.urlValidator.isValid(extractedUrl)) {
            // Check for Playlist
            if (extractedUrl.includes('playlist') || extractedUrl.includes('&list=')) {
                await this.handlePlaylistDetection(msg, extractedUrl);
            } else if (extractedUrl.includes('/s/') && extractedUrl.includes('t.me')) {
                // Telegram Story
                await this.handleStoryDownload(chatId, threadId, userId, extractedUrl);
            } else {
                // Fetch video info to check duration and calculate cost
                try {
                    const info = await this.downloadManager.getVideoInfo(extractedUrl);

                    // Duration Limit Check
                    if (info.duration > this.MAX_DURATION) {
                        const hours = Math.floor(info.duration / 3600);
                        await this.sendToChat(chatId, threadId,
                            `❌ Video too long (${hours}h ${Math.floor((info.duration % 3600) / 60)}m).\nMaximum allowed: 3 hours.`);
                        return;
                    }

                    await this.showQualityOptions(chatId, threadId, userId, extractedUrl, info);
                } catch (e: unknown) {
                    await this.sendToChat(chatId, threadId, `❌ Failed to fetch video info: ${(e as Error).message}`);
                }
            }
        } else {
            // Ignore non-URL messages (could be chat)
        }
    }

    // Playlist Logic
    private async handlePlaylistDetection(msg: Message, url: string): Promise<void> {
        const chatId = msg.chat.id;
        const userId = msg.from?.id!;

        await this.sendToChat(chatId, msg.message_thread_id, '🔎 جاري فحص القائمة...');

        try {
            const playlistInfo = await this.downloadManager.getPlaylistInfo(url);
            if (!playlistInfo || playlistInfo.videos.length === 0) {
                await this.sendToChat(chatId, msg.message_thread_id, '❌ لم يتم العثور على فيديوهات في هذه القائمة.');
                return;
            }

            await this.storage.setPlaylistSession(userId, {
                url,
                totalVideos: playlistInfo.videos.length,
                state: 'WAITING_FOR_SELECTION',
                indices: [],
                threadId: msg.message_thread_id
            });

            const message = `📂 *تم اكتشاف قائمة تشغيل*\nعدد الفيديوهات: ${playlistInfo.videos.length}\n\n` +
                `الرجاء اختيار الفيديوهات:\n` +
                `- اكتب \`all\` لتحميل الكل.\n` +
                `- اكتب \`1-5\` لتحميل من 1 إلى 5.\n` +
                `- اكتب \`1,3,5\` لتحميل أرقام محددة.`;

            await this.sendToChat(chatId, msg.message_thread_id, message, { parse_mode: 'Markdown' });

        } catch (e: unknown) {
            await this.sendToChat(chatId, msg.message_thread_id, `❌ خطأ في فحص القائمة: ${(e as Error).message}`);
        }
    }

    private async handlePlaylistSelection(msg: Message): Promise<void> {
        const userId = msg.from?.id!;
        const text = msg.text!;
        const session = this.storage.getUser(userId)?.activePlaylist;

        if (!session) return;

        const indices = parsePlaylistSelection(text, session.totalVideos);

        if (indices.length === 0) {
            await this.sendToChat(msg.chat.id, msg.message_thread_id, '❌ اختيار غير صحيح. حاول مرة أخرى.');
            return;
        }

        // 1. Shift first index BEFORE saving
        const firstIndex = indices.shift();

        // 2. Save REMAINING indices to session
        await this.storage.setPlaylistSession(userId, {
            ...session,
            state: 'PROCESSING',
            indices: [...indices]
        });

        // 3. Send confirmation
        const totalSelected = indices.length + (firstIndex ? 1 : 0);
        await this.sendToChat(
            msg.chat.id,
            msg.message_thread_id,
            `✅ تم اختيار ${totalSelected} فيديو. سيتم التحميل بالتتابع.`
        );

        // 4. Queue first item
        if (firstIndex !== undefined) {
            await this.queueNextPlaylistItem(
                msg.chat.id,
                userId,
                session.url,
                firstIndex,
                session.threadId
            );
        }
    }

    private async queueNextPlaylistItem(chatId: number, userId: number, playlistUrl: string, index: number, threadId?: number): Promise<void> {
        try {
            const videoUrl = await this.downloadManager.getVideoUrlFromPlaylist(playlistUrl, index);
            if (videoUrl) {
                // Calculate Cost (Assume average duration if unknown, or fetch info)
                // For playlist items, we might need to fetch info first.
                const info = await this.downloadManager.getVideoInfo(videoUrl);
                const cost = calculateCost(info.duration, false);

                // Reserve Credits
                if (!(await this.storage.useCredits(userId, cost))) {
                    const { remaining } = this.storage.getCredits(userId);
                    await this.sendToChat(chatId, threadId, `❌ رصيدك غير كافٍ لتحميل الفيديو رقم ${index}. (المطلوب: ${cost}, المتبقي: ${remaining})`);
                    // Stop playlist
                    await this.storage.setPlaylistSession(userId, null);
                    return;
                }

                // Queue it
                // Queue it
                if (this.storage.getUser(userId)) {
                    await this.handleVideoDownload(chatId, threadId, userId, videoUrl, 'best', cost);
                }
            }
        } catch (e: unknown) {
            logger.error('Error queuing playlist item', { userId, index, error: (e as Error).message });
            await this.sendToChat(chatId, threadId, `⚠️ تخطي الفيديو رقم ${index} بسبب خطأ: ${(e as Error).message}`);

            // Skip & Continue
            const userProfile = this.storage.getUser(userId);
            if (userProfile?.activePlaylist && userProfile.activePlaylist.indices.length > 0) {
                const nextIndex = userProfile.activePlaylist.indices.shift();
                this.storage.save();
                if (nextIndex !== undefined) {
                    // Recursive call with delay to prevent stack overflow/spam
                    setTimeout(() => {
                        this.queueNextPlaylistItem(chatId, userId, playlistUrl, nextIndex, threadId);
                    }, 1000);
                }
            }
        }
    }

    // Download Logic
    private async showQualityOptions(
        chatId: number,
        threadId: number | undefined,
        userId: number,
        url: string,
        videoInfo: { title: string; duration: number }
    ): Promise<void> {
        const uuid = uuidv4().substring(0, 8);
        this.callbackMap.set(uuid, { timestamp: Date.now(), url, userId });

        // Calculate costs
        const videoCost = calculateCost(videoInfo.duration, false);
        const audioCost = calculateCost(videoInfo.duration, true);

        const message = `🎥 *Found:* \`${this.escapeMarkdown(videoInfo.title)}\`\n` +
            `⏱ *Duration:* ${Math.floor(videoInfo.duration / 60)}m ${videoInfo.duration % 60}s\n` +
            `━━━━━━━━━━━━\n` +
            `👇 *اختر الجودة المطلوبة:*`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: `🎬 فيديو عالي (${videoCost}ن)`, callback_data: `dl:${uuid}:best` },
                    { text: `🎵 صوت فقط (${audioCost}ن)`, callback_data: `dl:${uuid}:audio` }
                ],
                [{ text: '❌ إلغاء', callback_data: `cancel:${uuid}` }]
            ]
        };

        await this.sendToChat(chatId, threadId, message, { reply_markup: keyboard, parse_mode: 'Markdown' });
    }

    private escapeMarkdown(text: string): string {
        return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    }

    public async handleCallback(query: CallbackQuery, subAction: string, params: string[]): Promise<void> {
        if (!query.message) return;
        const chatId = query.message.chat.id;
        const threadId = query.message.message_thread_id;
        const userId = query.from.id;
        const messageId = query.message.message_id;

        await this.bot.answerCallbackQuery(query.id);

        if (subAction === 'cancel') {
            // Handle Cancel
            const sessionId = params[0]; // Could be uuid or request id
            // Check if it's a queue cancel or option cancel
            if (sessionId.includes('-')) {
                // Likely UUID for request
                const removed = this.queue.removeRequest(sessionId);
                if (removed) {
                    // It was in queue, so we can confirm cancellation immediately
                    await this.bot.editMessageText('🛑 تم إلغاء التحميل (من القائمة).', { chat_id: chatId, message_id: messageId });
                } else {
                    // It might be processing, try to kill it
                    await this.downloadManager.cancelDownload(sessionId);
                    // Do NOT edit message here, let processDownloadRequest handle it to avoid race conditions
                }
            } else {
                // Option cancel
                this.callbackMap.delete(sessionId);
                await this.safeDeleteMessage(chatId, messageId);
            }
            return;
        }

        // Handle Download Selection
        const uuid = subAction; // dl:UUID:format
        const format = params[0];
        const state = this.callbackMap.get(uuid);

        if (!state) {
            await this.bot.sendMessage(chatId, '❌ انتهت صلاحية هذا الطلب.');
            return;
        }

        this.callbackMap.delete(uuid);
        await this.safeDeleteMessage(chatId, messageId);

        // Credit Check & Reservation
        try {
            const info = await this.downloadManager.getVideoInfo(state.url);
            const isAudio = format === 'audio';
            const cost = calculateCost(info.duration, isAudio);

            // Reserve Credits
            if (!(await this.storage.useCredits(userId, cost))) {
                const { remaining } = this.storage.getCredits(userId);
                await this.sendToChat(chatId, threadId, `❌ رصيدك غير كافٍ. (المطلوب: ${cost}, المتبقي: ${remaining})`);
                return;
            }

            if (isAudio) {
                await this.handleAudioDownload(chatId, threadId, userId, state.url, cost);
            } else {
                await this.handleVideoDownload(chatId, threadId, userId, state.url, format, cost);
            }

        } catch (e: unknown) {
            await this.sendToChat(chatId, threadId, `❌ خطأ في جلب المعلومات: ${(e as Error).message}`);
        }
    }

    private async handleVideoDownload(chatId: number, threadId: number | undefined, userId: number, url: string, formatId: string, cost: number): Promise<void> {
        const requestId = uuidv4();
        const statusMsg = await this.sendToChat(chatId, threadId, `📥 *جاري إضافة طلبك للقائمة...*\n(التكلفة: ${cost} نقطة)`);

        try {
            this.queue.addRequest({
                id: requestId,
                userId,
                chatId,
                url,
                format: formatId,
                priority: 0,
                createdAt: new Date(),
                statusMessageId: statusMsg.message_id,
                reservedCredits: cost
            });
        } catch (error) {
            // Refund credits on failure
            this.storage.refundCredits(userId, cost);
            await this.bot.editMessageText('❌ حدث خطأ أثناء إضافة الطلب للقائمة. تم استرجاع النقاط.', {
                chat_id: chatId,
                message_id: statusMsg.message_id
            });
            logError(error as Error, { operation: 'queue_add_failed', userId, url });
        }
    }

    private async handleAudioDownload(chatId: number, threadId: number | undefined, userId: number, url: string, cost: number): Promise<void> {
        const requestId = uuidv4();
        const statusMsg = await this.sendToChat(chatId, threadId, `📥 *جاري إضافة طلب الصوت للقائمة...*\n(التكلفة: ${cost} نقطة)`);

        try {
            this.queue.addRequest({
                id: requestId,
                userId,
                chatId,
                url,
                format: 'audio',
                priority: 0,
                createdAt: new Date(),
                statusMessageId: statusMsg.message_id,
                reservedCredits: cost
            });
        } catch (error) {
            // Refund credits on failure
            this.storage.refundCredits(userId, cost);
            await this.bot.editMessageText('❌ حدث خطأ أثناء إضافة الطلب للقائمة. تم استرجاع النقاط.', {
                chat_id: chatId,
                message_id: statusMsg.message_id
            });
            logError(error as Error, { operation: 'queue_add_failed', userId, url });
        }
    }

    public async processDownloadRequest(request: DownloadRequest): Promise<void> {
        const { chatId, userId, url, format, id: sessionId, statusMessageId } = request;

        const updateStatus = async (text: string, showCancelButton: boolean = true) => {
            if (statusMessageId) {
                try {
                    const options: any = { chat_id: chatId, message_id: statusMessageId, parse_mode: 'Markdown' };
                    if (showCancelButton) options.reply_markup = { inline_keyboard: [[{ text: '❌ إلغاء التحميل', callback_data: `cancel:${sessionId}` }]] };
                    await this.bot.editMessageText(text, options);
                } catch (e) {
                    // Log error but don't fail the download
                    logger.debug('Failed to update status message', {
                        error: (e as Error).message,
                        chatId,
                        messageId: statusMessageId
                    });
                }
            }
        };

        try {
            let lastUpdate = 0;
            const updateProgress = async (percent: number) => {
                const now = Date.now();
                if (now - lastUpdate > 4000 || percent === 100) {
                    lastUpdate = now;
                    const filled = Math.round((percent / 100) * 10);
                    const progressBar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
                    await updateStatus(`⬇️ جاري التحميل...\n${progressBar} ${percent.toFixed(0)}%`, true);
                }
            };

            await updateStatus('⬇️ جاري التحميل من المصدر...', true);

            let result;
            if (format === 'audio') {
                result = await this.downloadManager.downloadAudio(url, sessionId, userId);
            } else {
                result = await this.downloadManager.downloadVideo(url, format!, sessionId, userId, undefined, updateProgress);
            }

            if (result.success && result.filePath) {
                await updateStatus('📤 جاري رفع الملف إليك...', false);
                const fileSize = await this.fileManager.getFileSize(result.filePath);

                if (fileSize > this.maxFileSize) {
                    await this.bot.sendMessage(chatId, `❌ حجم الملف كبير جداً (${(fileSize / 1024 / 1024).toFixed(1)}MB).`);
                } else {
                    if (format === 'audio') {
                        await this.bot.sendAudio(chatId, result.filePath);
                    } else {
                        await this.bot.sendVideo(chatId, result.filePath);
                    }
                    await this.safeDeleteMessage(chatId, statusMessageId!);
                    logOperation('download_success', { userId, sessionId });

                    // Log to Admin
                    const videoTitle = request.videoInfo?.title ? `[${request.videoInfo.title}](${url})` : `[Link](${url})`;
                    logToTopic(this.bot, this.adminConfig.adminGroupId, this.adminConfig.topicLogs,
                        `✅ *New Download*\n👤 User: \`${userId}\`\n📹 Video: ${videoTitle}\n💾 Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

                    this.storage.addDownload(userId, {
                        title: request.videoInfo?.title || 'Unknown',
                        url,
                        format: format || 'default',
                        date: new Date().toISOString(),
                        timestamp: Date.now(),
                        filename: path.basename(result.filePath || '')
                    });

                    // Deduct Credits (Already reserved, just logging/notifying)
                    const cost = request.reservedCredits || 0;
                    if (cost > 0) {
                        const { remaining } = this.storage.getCredits(userId);
                        await this.sendToChat(chatId, undefined, `💳 تم خصم ${cost} نقطة. المتبقي: ${remaining}`);
                    }
                }
                await this.fileManager.deleteFile(result.filePath);
            } else {
                // Refund on Failure
                const cost = request.reservedCredits || 0;
                if (cost > 0) {
                    this.storage.refundCredits(userId, cost);
                    await this.sendToChat(chatId, undefined, `↩️ تم استرجاع ${cost} نقطة بسبب فشل التحميل.`);
                }

                if (result.error?.includes('إلغاء') || result.error?.includes('cancelled')) {
                    await updateStatus('🛑 *تم إلغاء التحميل بواسطة المستخدم.*', false);
                } else {
                    await updateStatus(`❌ فشل التحميل:\n${result.error || 'خطأ غير معروف'}`, false);
                }
                logToTopic(this.bot, this.adminConfig.adminGroupId, this.adminConfig.topicErrors, `❌ *Download Error*\nUser: \`${userId}\`\nError: ${result.error}`);
            }
            // Sequential Playlist Logic (MOVED from finally block)
            if (result.success) {
                const userProfile = this.storage.getUser(userId);
                if (userProfile?.activePlaylist && userProfile.activePlaylist.indices.length > 0) {
                    const nextIndex = userProfile.activePlaylist.indices.shift();
                    this.storage.save();

                    if (nextIndex !== undefined) {
                        logger.info('🔄 Auto-queuing next playlist item', { userId, nextIndex });
                        try {
                            // Add small delay to prevent race conditions
                            setTimeout(async () => {
                                await this.queueNextPlaylistItem(chatId, userId, userProfile.activePlaylist!.url, nextIndex, userProfile.activePlaylist!.threadId);
                            }, 2000);
                        } catch (e) {
                            logger.error('Failed to queue next playlist item', { userId, error: e });
                        }
                    } else {
                        await this.sendToChat(chatId, userProfile.activePlaylist.threadId, '✅ تم الانتهاء من تحميل القائمة المختارة.');
                        await this.storage.setPlaylistSession(userId, null);
                    }
                }
            } else {
                // Stop Playlist on Failure
                const userProfile = this.storage.getUser(userId);
                if (userProfile?.activePlaylist) {
                    await this.sendToChat(chatId, userProfile.activePlaylist.threadId, '🛑 *تم إيقاف القائمة بسبب فشل التحميل الحالي.*', { parse_mode: 'Markdown' });
                    await this.storage.setPlaylistSession(userId, null);
                }
            }
        } catch (error: unknown) {
            // Refund on Error
            const cost = request.reservedCredits || 0;
            if (cost > 0) {
                this.storage.refundCredits(userId, cost);
                await this.sendToChat(chatId, undefined, `↩️ تم استرجاع ${cost} نقطة بسبب خطأ غير متوقع.`);
            }

            await updateStatus(`❌ حدث خطأ:\n${(error as Error).message}`, false);
            logError(error as Error, { userId, sessionId });

            // Stop Playlist on Error
            const userProfile = this.storage.getUser(userId);
            if (userProfile?.activePlaylist) {
                await this.sendToChat(chatId, userProfile.activePlaylist.threadId, '🛑 *تم إيقاف القائمة بسبب خطأ غير متوقع.*', { parse_mode: 'Markdown' });
                await this.storage.setPlaylistSession(userId, null);
            }
        } finally {
            await this.downloadManager.cleanup(sessionId);
        }
    }

    // Rate Limiting Protection: Last queue update timestamp
    private lastQueueUpdate: number = 0;
    private readonly QUEUE_UPDATE_DEBOUNCE = 5000; // 5 seconds minimum between updates
    private readonly MAX_QUEUE_NOTIFICATIONS = 3; // Only notify first 3 users

    public async handleQueueChange(queue: DownloadRequest[]): Promise<void> {
        const now = Date.now();

        // Debounce: Skip if updated too recently
        if (now - this.lastQueueUpdate < this.QUEUE_UPDATE_DEBOUNCE) {
            logger.debug('Queue update skipped (debounced)', {
                timeSinceLastUpdate: now - this.lastQueueUpdate
            });
            return;
        }

        this.lastQueueUpdate = now;

        // Only update the first N users to prevent rate limiting
        const usersToNotify = queue.slice(0, this.MAX_QUEUE_NOTIFICATIONS);

        // Use Promise.allSettled to prevent cascading failures
        const updatePromises = usersToNotify.map(async (request, index) => {
            if (request.statusMessageId) {
                try {
                    await this.bot.editMessageText(
                        `⏳ تم إضافة طلبك للقائمة (الدور: ${index + 1})... سيتم البدء قريباً.`,
                        {
                            chat_id: request.chatId,
                            message_id: request.statusMessageId
                        }
                    );
                } catch (e) {
                    logger.debug('Failed to update queue message', {
                        userId: request.userId,
                        position: index + 1
                    });
                }
            }
        });

        await Promise.allSettled(updatePromises);

        logger.debug('Queue notifications sent', {
            notifiedCount: usersToNotify.length,
            totalInQueue: queue.length
        });
    }

    // Scheduling
    public async handleSetTimezone(msg: Message, match: RegExpExecArray | null): Promise<void> {
        const chatId = msg.chat.id;
        const userId = msg.from?.id;
        if (!userId || !match) return;

        const offset = parseInt(match[1]);
        if (isNaN(offset) || offset < -12 || offset > 14) {
            await this.sendToChat(chatId, msg.message_thread_id, '❌ الرجاء إدخال توقيت صحيح (مثال: +3 أو -5).');
            return;
        }

        this.storage.setTimezone(userId, offset);
        await this.sendToChat(chatId, msg.message_thread_id, `✅ تم ضبط توقيتك بنجاح: GMT${offset >= 0 ? '+' : ''}${offset}`);
    }

    public async scheduleTask(userId: number, chatId: number, threadId: number | undefined, url: string, timeStr: string): Promise<string> {
        const user = this.storage.getUser(userId);
        const timezone = user?.timezone || 0;

        const [hours, minutes] = timeStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            throw new Error('صيغة الوقت غير صحيحة. استخدم HH:MM (مثال: 14:30).');
        }

        const now = new Date();
        let targetDate = new Date();
        targetDate.setUTCHours(hours - timezone, minutes, 0, 0);

        if (targetDate.getTime() <= now.getTime()) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        const task: ScheduledTask = {
            id: uuidv4(),
            userId,
            url,
            executeAt: targetDate.getTime(),
            options: { chatId, threadId }
        };

        this.storage.addScheduledTask(task);
        return `✅ تم جدولة التحميل الساعة ${timeStr} (بتوقيتك).\n🔗 الرابط: ${url}`;
    }

    private startScheduler(): void {
        setInterval(async () => {
            const tasks = this.storage.getScheduledTasks();
            const now = Date.now();

            for (const task of tasks) {
                if (task.executeAt <= now) {
                    try {
                        logger.info('⏰ Executing scheduled task', { taskId: task.id, userId: task.userId });

                        const videoInfo = await this.downloadManager.getVideoInfo(task.url);
                        const cost = calculateCost(videoInfo.duration, false);
                        const { remaining } = this.storage.getCredits(task.userId);

                        if (await this.storage.useCredits(task.userId, cost)) {
                            const requestId = uuidv4();
                            this.queue.addRequest({
                                id: requestId,
                                userId: task.userId,
                                chatId: task.options.chatId,
                                url: task.url,
                                format: 'best',
                                priority: 0,
                                createdAt: new Date(),
                                user: { id: task.userId, firstName: 'Scheduled' },
                                reservedCredits: cost
                            });

                            await this.sendToChat(task.options.chatId, task.options.threadId, `⏰ بدأ تنفيذ جدولتك للرابط: ${task.url}`);
                        } else {
                            await this.sendToChat(task.options.chatId, task.options.threadId, `❌ فشل تنفيذ الجدولة: رصيدك غير كافٍ (${remaining} < ${cost}).`);
                        }

                    } catch (e: unknown) {
                        logger.error('Failed to execute scheduled task', { taskId: task.id, error: (e as Error).message });
                        await this.sendToChat(task.options.chatId, task.options.threadId, `❌ فشل تنفيذ الجدولة: ${(e as Error).message}`);
                    }

                    this.storage.removeScheduledTask(task.id);
                }
            }
        }, 60000);
    }



    private async handleStoryDownload(chatId: number, threadId: number | undefined, userId: number, url: string): Promise<void> {
        if (!this.storyService) {
            await this.sendToChat(chatId, threadId, '❌ خدمة تحميل الستوريات غير مفعلة حالياً.');
            return;
        }

        const statusMsg = await this.sendToChat(chatId, threadId, '📥 *جاري تحميل الستوري...*');

        try {
            const result = await this.storyService.downloadStory(url);

            if (!result) {
                throw new Error('فشل التحميل');
            }

            // Send File
            if (result.filePath.endsWith('.jpg') || result.filePath.endsWith('.jpeg') || result.filePath.endsWith('.png')) {
                await this.bot.sendPhoto(chatId, result.filePath, { caption: result.caption, message_thread_id: threadId });
            } else {
                await this.bot.sendVideo(chatId, result.filePath, { caption: result.caption, message_thread_id: threadId });
            }

            await this.safeDeleteMessage(chatId, statusMsg.message_id);

            // Cleanup
            await this.fileManager.deleteFile(result.filePath);

            // Log
            logOperation('story_download_success', { userId, url });
            this.storage.addDownload(userId, {
                title: 'Telegram Story',
                url,
                format: 'story',
                date: new Date().toISOString(),
                timestamp: Date.now(),
                filename: path.basename(result.filePath)
            });

        } catch (error) {
            await this.bot.editMessageText(`❌ فشل تحميل الستوري: ${(error as Error).message}`, {
                chat_id: chatId,
                message_id: statusMsg.message_id
            });
            logError(error as Error, { operation: 'story_download_failed', userId, url });
        }
    }
}
