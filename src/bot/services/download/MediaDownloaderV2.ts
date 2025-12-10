import { Telegraf } from 'telegraf';

import { randomUUID } from 'crypto';
import { SupabaseManager } from '../../../database/SupabaseManager';
import { DownloadOrchestrator, DownloadProgress } from '../../../download';
import { RequestQueue } from '../../../queue/RequestQueue';
import { FileManager } from '../../../utils/FileManager';
import { DownloadRequest } from '../../../types';
import { logger, logToTopic } from '../../../utils/logger';
import { retryWithBackoff } from '../../../utils/retryHelper';
import { CookiesManager } from '../../../utils/CookiesManager';

export class MediaDownloader {
    private bot: Telegraf;
    private storage: SupabaseManager;
    private orchestrator: DownloadOrchestrator;
    private queue: RequestQueue;
    private fileManager: FileManager;

    constructor(
        bot: Telegraf,
        storage: SupabaseManager,
        orchestrator: DownloadOrchestrator,
        queue: RequestQueue,
        fileManager: FileManager,
    ) {
        this.bot = bot;
        this.storage = storage;
        this.orchestrator = orchestrator;
        this.queue = queue;
        this.fileManager = fileManager;
    }

    public async handleVideoDownload(
        chatId: number,
        threadId: number | undefined,
        userId: number,
        url: string,
        formatId: string,
        cost: number,
        messageIdToEdit?: number,
    ): Promise<void> {
        const requestId = randomUUID();
        let statusMessageId = messageIdToEdit;

        if (statusMessageId) {
            await this.bot.telegram.editMessageText(
                chatId,
                statusMessageId,
                undefined,
                `📥 تم استلام طلبك\n━━━━━━━━━━━━━━━\n📊 الترتيب في القائمة: ${this.queue.getQueueLength() + 1}\n⏳ الحالة: جاري الانتظار...`,
            );
        } else {
            const msg = await this.sendToChat(
                chatId,
                threadId,
                `📥 تم استلام طلبك\n━━━━━━━━━━━━━━━\n📊 الترتيب في القائمة: ${this.queue.getQueueLength() + 1}\n⏳ الحالة: جاري الانتظار...`,
            );
            statusMessageId = msg.message_id;
        }

        try {
            this.queue.addRequest({
                id: requestId,
                userId,
                chatId,
                url,
                format: formatId,
                priority: 0,
                createdAt: new Date(),
                statusMessageId: statusMessageId!,
                reservedCredits: cost,
            });
        } catch (error) {
            await this.storage.refundCredits(userId, cost);
            if (statusMessageId) {
                await this.bot.telegram.editMessageText(
                    chatId,
                    statusMessageId,
                    undefined,
                    '❌ فشل في إضافة الطلب.',
                );
            } else {
                await this.sendToChat(chatId, threadId, '❌ فشل في إضافة الطلب.');
            }
        }
    }

    public async handleAudioDownload(
        chatId: number,
        threadId: number | undefined,
        userId: number,
        url: string,
        cost: number,
        messageIdToEdit?: number,
    ): Promise<void> {
        const requestId = randomUUID();
        let statusMessageId = messageIdToEdit;

        if (statusMessageId) {
            await this.bot.telegram.editMessageText(
                chatId,
                statusMessageId,
                undefined,
                `📥 تم استلام طلبك\n━━━━━━━━━━━━━━━\n📊 الترتيب في القائمة: ${this.queue.getQueueLength() + 1}\n⏳ الحالة: جاري الانتظار...`,
            );
        } else {
            const msg = await this.sendToChat(
                chatId,
                threadId,
                `📥 تم استلام طلبك\n━━━━━━━━━━━━━━━\n📊 الترتيب في القائمة: ${this.queue.getQueueLength() + 1}\n⏳ الحالة: جاري الانتظار...`,
            );
            statusMessageId = msg.message_id;
        }

        try {
            this.queue.addRequest({
                id: requestId,
                userId,
                chatId,
                url,
                format: 'audio',
                priority: 0,
                createdAt: new Date(),
                statusMessageId: statusMessageId!,
                reservedCredits: cost,
            });
        } catch (error) {
            await this.storage.refundCredits(userId, cost);
            if (statusMessageId) {
                await this.bot.telegram.editMessageText(
                    chatId,
                    statusMessageId,
                    undefined,
                    '❌ فشل في إضافة الطلب.',
                );
            } else {
                await this.sendToChat(chatId, threadId, '❌ فشل في إضافة الطلب.');
            }
        }
    }

    public async processDownloadRequest(request: DownloadRequest): Promise<void> {
        const {
            chatId,
            userId,
            url,
            format: requestFormat,
            id: sessionId,
            statusMessageId,
        } = request;
        const format = requestFormat || 'best';

        const updateStatus = this.createStatusUpdater(
            chatId,
            statusMessageId,
            sessionId,
        );

        try {
            const updateProgress = this.createProgressUpdater(updateStatus);
            const isAudio = format === 'audio';

            const result = await this.performDownload(
                url,
                format,
                sessionId,
                userId,
                chatId,
                isAudio,
                updateProgress,
            );

            if (!result.filePath) {
                throw new Error('مسار الملف غير موجود');
            }

            const filePath = result.filePath;

            await updateStatus('📤 جاري رفع الملف...', false);

            const { fileName, title, caption } =
                await this.prepareFileMetadata(filePath);
            await this.uploadToTelegram(chatId, filePath, isAudio, title, caption);
            await this.logDownloadHistory(
                userId,
                url,
                format,
                fileName,
                title,
                isAudio,
            );
            await this.cleanup(sessionId, chatId, statusMessageId);
        } catch (error: unknown) {
            await this.handleDownloadError(
                error,
                sessionId,
                userId,
                request.reservedCredits,
                updateStatus,
            );
        }
    }

    private createStatusUpdater(
        chatId: number,
        statusMessageId: number | undefined,
        sessionId: string,
    ) {
        return async (text: string, showCancelButton: boolean = true) => {
            if (!statusMessageId) return;

            try {
                const options: any = {
                    parse_mode: 'Markdown',
                };
                if (showCancelButton) {
                    options.reply_markup = {
                        inline_keyboard: [
                            [
                                {
                                    text: '❌ إلغاء التحميل',
                                    callback_data: `cancel:${sessionId}`,
                                },
                            ],
                        ],
                    };
                }
                await this.bot.telegram.editMessageText(
                    chatId,
                    statusMessageId,
                    undefined,
                    text,
                    options,
                );
            } catch (e) {
                logger.debug('Failed to update status message', {
                    error: (e as Error).message,
                    chatId,
                    messageId: statusMessageId,
                });
            }
        };
    }

    private createProgressUpdater(
        updateStatus: (text: string, showCancelButton?: boolean) => Promise<void>,
    ) {
        let lastUpdate = 0;
        const MIN_UPDATE_INTERVAL = 300;
        const loadingPhrases = [
            'جاري التحميل...',
            'جاري استرجاع البيانات...',
            'جاري معالجة الملف...',
            'جاري إنهاء العملية...',
        ];

        return async (progress: DownloadProgress) => {
            const now = Date.now();
            const percent = progress.percentage;

            if (percent === 100 || now - lastUpdate > MIN_UPDATE_INTERVAL) {
                lastUpdate = now;
                const progressBar = this.createProgressBar(percent);
                const statusText = this.getLoadingPhrase(percent, loadingPhrases);

                try {
                    await updateStatus(
                        `⏳ جاري التحميل\n━━━━━━━━━━━━━━━\n${progressBar} ${percent.toFixed(0)}%\n📋 ${statusText}`,
                    );
                } catch (e) {
                    /* Ignore */
                }
            }
        };
    }

    private createProgressBar(percent: number): string {
        const filled = Math.round((percent / 100) * 10);
        return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
    }

    private getLoadingPhrase(percent: number, phrases: string[]): string {
        if (percent === 100) return '✅ اكتمل التحميل، جاري رفع الملف...';
        if (percent > 70) return phrases[2];
        if (percent > 30) return phrases[1];
        return phrases[0];
    }

    private async performDownload(
        url: string,
        format: string,
        sessionId: string,
        userId: number,
        chatId: number,
        isAudio: boolean,
        updateProgress: (progress: DownloadProgress) => Promise<void>,
    ): Promise<{ success: boolean; filePath: string; error?: string }> {
        const result = await retryWithBackoff(
            async () => {
                const cookies = CookiesManager.getCookiesForUrl(url);

                // Use the new DownloadOrchestrator
                const downloadResult = isAudio
                    ? await this.orchestrator.downloadAudio(
                        url,
                        sessionId,
                        userId,
                        chatId,
                        { cookies },
                    )
                    : await this.orchestrator.downloadVideo(
                        url,
                        format || 'best',
                        sessionId,
                        userId,
                        chatId,
                        { cookies },
                        updateProgress,
                    );

                if (!downloadResult.success || !downloadResult.filePath) {
                    throw new Error(downloadResult.error || 'فشل التحميل');
                }

                return downloadResult;
            },
            3,
            1000,
        );

        return result as { success: boolean; filePath: string; error?: string };
    }

    private async prepareFileMetadata(filePath: string) {
        const path = await import('path');
        const fileName = path.basename(filePath);
        const title = fileName.substring(0, fileName.lastIndexOf('.'));
        const caption = `@Tanzil_Downloader_bot`;

        return { fileName, title, caption };
    }

    private async uploadToTelegram(
        chatId: number,
        filePath: string,
        isAudio: boolean,
        title: string,
        caption: string,
    ) {
        await retryWithBackoff(
            async () => {
                if (isAudio) {
                    await this.bot.telegram.sendAudio(
                        chatId,
                        { source: filePath },
                        { title, caption },
                    );
                } else {
                    await this.bot.telegram.sendVideo(
                        chatId,
                        { source: filePath },
                        { caption },
                    );
                }
            },
            3,
            1000,
        );
    }

    private async logDownloadHistory(
        userId: number,
        url: string,
        format: string,
        fileName: string,
        title: string,
        isAudio: boolean,
    ) {
        await this.storage.addDownload(userId, {
            title,
            url,
            format: format || 'video',
            filename: fileName,
            date: new Date().toISOString(),
            timestamp: Date.now(),
            metadata: { isAudio },
        });

        const adminGroupId = parseInt(process.env.ADMIN_GROUP_ID || '0');
        const topicLogs = parseInt(process.env.TOPIC_LOGS || '0');
        if (adminGroupId && topicLogs) {
            const user = await this.storage.getUser(userId);
            const userName = user?.firstName || 'مستخدم';
            const timestamp = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });
            const shortUrl = url.length > 40 ? url.substring(0, 40) + '...' : url;

            await logToTopic(
                this.bot,
                adminGroupId,
                topicLogs,
                `📥 *تحميل مكتمل*\n━━━━━━━━━━━━━━━\n👤 ${userName} (\`${userId}\`)\n📁 ${fileName.substring(0, 30)}\n🔗 ${shortUrl}\n🎬 ${isAudio ? 'صوت' : 'فيديو'}\n⏰ ${timestamp}`,
            );
        }
    }

    private async cleanup(
        sessionId: string,
        chatId: number,
        statusMessageId: number | undefined,
    ) {
        await this.fileManager.cleanupSession(sessionId);
        if (statusMessageId) {
            await this.bot.telegram.deleteMessage(chatId, statusMessageId);
        }
    }

    private async handleDownloadError(
        error: unknown,
        sessionId: string,
        userId: number,
        reservedCredits: number | undefined,
        updateStatus: (text: string, showCancelButton?: boolean) => Promise<void>,
    ) {
        const errorMessage = (error as Error).message;
        logger.error('Download processing failed', {
            requestId: sessionId,
            error: errorMessage,
        });

        await this.storage.refundCredits(userId, reservedCredits || 0);
        await updateStatus(
            `❌ فشل التحميل\n━━━━━━━━━━━━━━━\n📋 السبب: ${errorMessage}`,
            false,
        );
        await this.fileManager.cleanupSession(sessionId);

        const adminGroupId = parseInt(process.env.ADMIN_GROUP_ID || '0');
        const topicErrors = parseInt(process.env.TOPIC_ERRORS || '0');
        if (adminGroupId && topicErrors) {
            const user = await this.storage.getUser(userId);
            const userName = user?.firstName || 'مستخدم';
            const timestamp = new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });

            await logToTopic(
                this.bot,
                adminGroupId,
                topicErrors,
                `❌ *فشل تحميل*\n━━━━━━━━━━━━━━━\n👤 ${userName} (\`${userId}\`)\n📋 ${errorMessage.substring(0, 100)}\n⏰ ${timestamp}`,
            );
        }
    }

    private async sendToChat(
        chatId: number,
        _threadId: number | undefined,
        text: string,
        options: any = {},
    ): Promise<any> {
        return this.bot.telegram.sendMessage(chatId, text, options);
    }
}
