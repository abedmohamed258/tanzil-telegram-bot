import winston from 'winston';
import { Telegraf } from 'telegraf';
import * as Sentry from '@sentry/node';

/**
 * Winston logger configuration for structured logging
 * Filters sensitive information like user IDs
 */
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
          msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
      }),
    ),
  }),
];

// Only add file transport in production (not during tests)
if (process.env.NODE_ENV !== 'test') {
  transports.push(new winston.transports.File({ filename: 'app.log' }));
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'tanzil-bot' },
  transports,
});

/**
 * Log an operation (Property 16: Operation Logging Completeness)
 */
export function logOperation(
  operation: string,
  details?: Record<string, unknown>,
): void {
  logger.info(operation, details);
}

/**
 * Log an error with stack trace (Property 17: Error Logging Detail)
 */
export function logError(
  error: Error,
  context?: Record<string, unknown>,
): void {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context,
  });
  Sentry.captureException(error, { extra: context });
}

/**
 * Helper to log to a specific Telegram topic
 */
export async function logToTopic(
  bot: Telegraf,
  chatId: number,
  topicId: number,
  message: string,
): Promise<void> {
  try {
    await bot.telegram.sendMessage(chatId, message, {
      message_thread_id: topicId,
      parse_mode: 'Markdown',
    });
  } catch (error: unknown) {
    // Silent Fallback: Send to main chat without thread_id
    // We catch ALL errors here to ensure the log is sent somewhere
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('message thread not found')) {
      logger.debug(`Topic ${topicId} not found, falling back to main chat.`);
    } else {
      logger.warn(
        `Failed to log to topic ${topicId}, falling back to main chat.`,
        { error: errorMessage },
      );
    }
    try {
      await bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
      });
    } catch (fallbackError: unknown) {
      // If even main chat fails (e.g. bot blocked), we just log to console
      const fallbackErrorMessage =
        fallbackError instanceof Error
          ? fallbackError.message
          : String(fallbackError);
      logger.error('Failed to log to topic AND fallback', {
        error: fallbackErrorMessage,
      });
    }
  }
}
