import { BotConfig } from '../types';
import fs from 'fs';
import path from 'path';

/**
 * Initialize YouTube cookies from environment variable
 * Writes base64-encoded cookies to a temp file for yt-dlp
 */
function initializeYoutubeCookies(tempDir: string): string | undefined {
  const cookiesContent = process.env.YOUTUBE_COOKIES;
  if (!cookiesContent) {
    return undefined;
  }

  try {
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const cookiesPath = path.join(tempDir, 'youtube_cookies.txt');

    // Check if content is base64 encoded (contains no newlines and looks like base64)
    let decodedContent: string;
    if (cookiesContent.includes('\t') || cookiesContent.includes('youtube.com')) {
      // Already plaintext cookies
      decodedContent = cookiesContent;
    } else {
      // Try to decode as base64
      try {
        decodedContent = Buffer.from(cookiesContent, 'base64').toString('utf-8');
      } catch {
        // If base64 decode fails, use as-is
        decodedContent = cookiesContent;
      }
    }

    fs.writeFileSync(cookiesPath, decodedContent, 'utf-8');
    return cookiesPath;
  } catch (error) {
    console.error('Failed to initialize YouTube cookies:', error);
    return undefined;
  }
}

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

  const tempDirectory = process.env.TEMP_DIRECTORY || './temp';
  const youtubeCookiesPath = initializeYoutubeCookies(tempDirectory);

  return {
    telegramToken: process.env.BOT_TOKEN!,
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '2147483648'), // 2GB default
    downloadTimeout: parseInt(process.env.DOWNLOAD_TIMEOUT || '180000'), // 3 min (was 10 min)
    tempDirectory,
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
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '2'), // 2 retries instead of 3
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
    youtubeCookiesPath,
  };
}
