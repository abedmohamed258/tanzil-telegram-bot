import TelegramBot, { Message, CallbackQuery } from 'node-telegram-bot-api';
import { StorageManager } from '../utils/storage';
import { RequestQueue } from '../queue/requestQueue';
import { DownloadManager } from '../download/downloadManager';
import { FileManager } from '../utils/fileManager';
import { URLValidator } from '../utils/urlValidator';
import { AdminConfig, DownloadRequest } from '../types';
import { logger } from '../utils/logger';

// Services
import { AdminService } from './services/AdminService';
import { UserService } from './services/UserService';
import { DownloadService } from './services/DownloadService';
import { StoryService } from './services/StoryService';

export class BotHandler {
    private bot: TelegramBot;
    private adminConfig: AdminConfig;
    private storage: StorageManager;
    private queue: RequestQueue;

    // Services
    private adminService: AdminService;
    private userService: UserService;
    public downloadService: DownloadService; // Public for queue callback
    private storyService: StoryService;

    constructor(
        token: string,
        storage: StorageManager,
        queue: RequestQueue,
        downloadManager: DownloadManager,
        fileManager: FileManager,
        urlValidator: URLValidator,
        adminConfig: AdminConfig
    ) {
        this.bot = new TelegramBot(token, { polling: false }); // Polling started manually
        this.adminConfig = adminConfig;
        this.storage = storage;
        this.queue = queue;

        // Initialize Services
        this.adminService = new AdminService(this.bot, storage, queue, downloadManager, fileManager, adminConfig);
        this.userService = new UserService(this.bot, storage, urlValidator, adminConfig);
        this.downloadService = new DownloadService(this.bot, storage, queue, downloadManager, fileManager, urlValidator, adminConfig);

        // Initialize Story Service
        const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
        const apiHash = process.env.TELEGRAM_API_HASH || '';
        const sessionString = process.env.TELEGRAM_SESSION || '';
        const tempDir = adminConfig.tempDirectory || './temp';

        this.storyService = new StoryService(apiId, apiHash, sessionString, tempDir);
        this.downloadService.setStoryService(this.storyService);

        // Link Services
        this.userService.setDownloadService(this.downloadService);

        // Link Queue to DownloadService
        queue.setProcessingCallback((req: DownloadRequest) => this.downloadService.processDownloadRequest(req));
        queue.setOnQueueChange((q) => this.downloadService.handleQueueChange(q));

        this.setupHandlers();
    }

    getBot(): TelegramBot {
        return this.bot;
    }

    private setupHandlers(): void {
        // User Commands
        this.bot.onText(/\/start/, (msg) => this.userService.handleStart(msg));
        this.bot.onText(/\/help/, (msg) => this.userService.handleHelp(msg));
        this.bot.onText(/\/admin/, (msg) => this.adminService.handleAdminDashboard(msg));

        // Events
        this.bot.on('message', (msg) => this.handleMessage(msg));
        this.bot.on('callback_query', (query) => this.handleCallbackQuery(query));

        logger.info('✅ Bot handlers setup complete (Service Architecture)');
    }

    private async handleMessage(msg: Message): Promise<void> {
        if (msg.text?.startsWith('/')) return; // Ignore commands

        const userId = msg.from?.id;
        const chatId = msg.chat.id;
        if (!userId) return;

        // Maintenance Mode Check (Top Priority)
        if (this.storage.isMaintenanceMode() && chatId !== this.adminConfig.adminGroupId) {
            await this.bot.sendMessage(chatId, '🚧 ⚠️ System is currently in maintenance mode. Please try again later.');
            return;
        }

        // Ban Check
        const user = this.storage.getUser(userId);
        if (user?.isBanned) {
            await this.bot.sendMessage(chatId, '🚫 *عذراً، تم حظرك من استخدام البوت.*\nتواصل مع الإدارة إذا كنت تعتقد أن هذا خطأ.', { parse_mode: 'Markdown' });
            return;
        }

        // 1. Check Admin States
        if (this.adminService.hasPendingState(userId)) {
            await this.adminService.handlePendingState(msg);
            return;
        }

        // 2. Check User States (Scheduling, etc.)
        if (this.userService.hasPendingState(userId)) {
            await this.userService.handleStateInput(msg);
            return;
        }

        // 3. Delegate to DownloadService (URLs, Playlists, etc.)
        await this.downloadService.handleMessage(msg);
    }

    private async handleCallbackQuery(query: CallbackQuery): Promise<void> {
        if (!query.data || !query.message) return;

        const chatId = query.message.chat.id;
        const userId = query.from.id;

        // Maintenance Mode Check
        if (this.storage.isMaintenanceMode() && chatId !== this.adminConfig.adminGroupId) {
            await this.bot.answerCallbackQuery(query.id, {
                text: '🚧 System in maintenance mode',
                show_alert: true
            });
            return;
        }

        // Ban Check
        const user = this.storage.getUser(userId);
        if (user?.isBanned) {
            await this.bot.answerCallbackQuery(query.id, {
                text: '🚫 تم حظرك من استخدام البوت.',
                show_alert: true
            });
            return;
        }

        const [action, ...params] = query.data.split(':');

        try {
            if (action === 'admin') {
                await this.adminService.handleCallback(query, params);
            } else if (action === 'user') {
                // Pass the subAction (params[0]) and potentially other params if needed
                // For now, UserService handles parsing subAction like 'tz:3'
                await this.userService.handleCallback(query, params.join(':'));
            } else if (action === 'dl' || action === 'cancel') {
                if (action === 'cancel') {
                    await this.downloadService.handleCallback(query, 'cancel', params);
                } else {
                    const uuid = params[0];
                    const format = params[1];
                    await this.downloadService.handleCallback(query, uuid, [format]);
                }
            }
        } catch (error: unknown) {
            logger.error('Callback Error', { error: (error as Error).message, data: query.data });
        }
    }

    async startPolling(): Promise<void> {
        await this.bot.startPolling();
        logger.info('🤖 Bot started in polling mode');
    }

    async stop(): Promise<void> {
        logger.info('🛑 Stopping bot...');

        // 1. Stop Polling first
        await this.bot.stopPolling();

        // 2. Stop Services
        this.adminService.stop();
        this.userService.stop();
        this.downloadService.stop();

        // 3. Stop Queue
        this.queue.stop();

        logger.info('✅ Bot polling and services stopped');
    }
}
