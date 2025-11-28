import 'dotenv/config'; // Load .env file if exists
import { loadConfig } from './utils/config';
import { logger } from './utils/logger';
import { FileManager } from './utils/fileManager';
import { StorageManager } from './utils/storage';
import { URLValidator } from './utils/urlValidator';
import { DownloadManager } from './download/downloadManager';
import { RequestQueue } from './queue/requestQueue';
import { BotHandler } from './bot/botHandler';
import { Server } from './server';

/**
 * Main entry point for Tanzil Telegram Bot
 * Wires all components together as specified in design.md
 */
async function main() {
    try {
        logger.info('🚀 Starting Tanzil Telegram Bot...');

        // Load configuration (validates required env vars)
        const config = loadConfig();
        logger.info('✅ Configuration loaded', {
            maxFileSize: `${(config.maxFileSize / 1024 / 1024).toFixed(0)}MB`,
            maxConcurrentDownloads: config.maxConcurrentDownloads,
            useWebhook: config.useWebhook,
            tempDir: config.tempDirectory
        });

        // Initialize core utilities
        const fileManager = new FileManager(config.tempDirectory);
        await fileManager.initialize();

        const storage = new StorageManager();

        const urlValidator = new URLValidator();

        const downloadManager = new DownloadManager(
            fileManager,
            config.retryAttempts,
            config.downloadTimeout
        );

        // Initialize request queue with concurrency limit
        const requestQueue = new RequestQueue(config.maxConcurrentDownloads);

        // Initialize bot handler
        const botHandler = new BotHandler(
            config.telegramToken,
            storage,
            requestQueue,
            downloadManager,
            fileManager,
            urlValidator,
            config.adminConfig
        );

        // Queue processing is now handled internally by BotHandler -> DownloadService

        logger.info('✅ All components initialized');

        // Start server or polling based on configuration
        if (config.useWebhook) {
            if (!config.webhookUrl) {
                throw new Error('WEBHOOK_URL is required when USE_WEBHOOK=true');
            }

            const server = new Server(botHandler, config.port, config.webhookUrl);
            await server.start();
            logger.info('✅ Bot started in WEBHOOK mode');
        } else {
            await botHandler.startPolling();
            logger.info('✅ Bot started in POLLING mode');
        }

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            logger.info(`${signal} received, shutting down gracefully...`);

            try {
                await botHandler.stop();
                await downloadManager.killAllActiveDownloads();
                logger.info('✅ Bot stopped');
                process.exit(0);
            } catch (error) {
                logger.error('Error during shutdown', { error });
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Additional cleanup handlers for unexpected exits
        process.on('exit', (code) => {
            logger.info(`Process exiting with code ${code}. Performing final cleanup...`);
            // Synchronous cleanup only - Node.js limitation
            // The downloadManager.activeDownloads cleanup happens in shutdown()
        });

        process.on('uncaughtException', async (error) => {
            logger.error('Uncaught Exception - initiating emergency shutdown', {
                error: error.message,
                stack: error.stack
            });
            try {
                await botHandler.stop();
                // Kill all active downloads
                logger.info('Emergency cleanup completed');
            } catch (cleanupError) {
                logger.error('Error during emergency cleanup', { error: cleanupError });
            }
            process.exit(1);
        });

        process.on('unhandledRejection', async (reason, promise) => {
            logger.error('Unhandled Rejection - potential memory leak', {
                reason,
                promise
            });
            // Don't exit, just log for monitoring
        });

        logger.info('🎉 Tanzil Bot is fully operational!');

    } catch (error: any) {
        logger.error('Fatal error during startup', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Start the application
main();
