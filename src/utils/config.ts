import { BotConfig } from '../types';

/**
 * Load configuration from environment variables
 * Implements configuration from design.md
 */
export function loadConfig(): BotConfig {
  const requiredEnvVars = ['BOT_TOKEN'];

  // Validate required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    telegramToken: process.env.BOT_TOKEN!,
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '2147483648'), // 2GB default
    downloadTimeout: parseInt(process.env.DOWNLOAD_TIMEOUT || '600000'), // 10 min default
    tempDirectory: process.env.TEMP_DIRECTORY || './temp',
    supportedPlatforms: [
      'youtube.com',
      'facebook.com',
      'twitter.com',
      'instagram.com',
    ],
    maxConcurrentDownloads: parseInt(
      process.env.MAX_CONCURRENT_DOWNLOADS || '2',
    ),
    sessionTimeout: 3600000, // 1 hour
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
    webhookUrl: process.env.WEBHOOK_URL,
    port: parseInt(process.env.PORT || '3000'),
    useWebhook: process.env.USE_WEBHOOK === 'true',
    adminConfig: {
      adminGroupId: parseInt(process.env.ADMIN_GROUP_ID || '-1003313521719'),
      topicGeneral: parseInt(process.env.TOPIC_GENERAL || '1'),
      topicControl: parseInt(process.env.TOPIC_CONTROL || '2'),
      topicLogs: parseInt(process.env.TOPIC_LOGS || '4'),
      topicErrors: parseInt(process.env.TOPIC_ERRORS || '6'),
    },
    dailyCredits: parseInt(process.env.DAILY_CREDITS || '100'),
  };
}
