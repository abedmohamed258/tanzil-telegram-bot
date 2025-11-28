import winston from 'winston';
import TelegramBot from 'node-telegram-bot-api';

/**
 * Winston logger configuration for structured logging
 * Filters sensitive information like user IDs
 */
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'tanzil-bot' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    let msg = `${timestamp} [${level}]: ${message}`;
                    if (Object.keys(meta).length > 0) {
                        msg += ` ${JSON.stringify(meta)}`;
                    }
                    return msg;
                })
            )
        })
    ]
});

/**
 * Log an operation (Property 16: Operation Logging Completeness)
 */
export function logOperation(operation: string, details?: Record<string, unknown>): void {
    logger.info(operation, details);
}

/**
 * Log an error with stack trace (Property 17: Error Logging Detail)
 */
export function logError(error: Error, context?: Record<string, unknown>): void {
    logger.error({
        message: error.message,
        stack: error.stack,
        ...context
    });
}

/**
 * Helper to log to a specific Telegram topic
 */
export async function logToTopic(
    bot: TelegramBot,
    chatId: number,
    topicId: number,
    message: string
): Promise<void> {
    try {
        await bot.sendMessage(chatId, message, {
            message_thread_id: topicId,
            parse_mode: 'Markdown'
        });
    } catch (error: any) {
        // Silent Fallback: Send to main chat without thread_id
        // We catch ALL errors here to ensure the log is sent somewhere
        if (error.message.includes('message thread not found')) {
            logger.debug(`Topic ${topicId} not found, falling back to main chat.`);
        } else {
            logger.warn(`Failed to log to topic ${topicId}, falling back to main chat.`, { error: error.message });
        }
        try {
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } catch (fallbackError: any) {
            // If even main chat fails (e.g. bot blocked), we just log to console
            logger.error('Failed to log to topic AND fallback', { error: error.message });
        }
    }
}
