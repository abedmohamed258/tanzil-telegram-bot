export interface AdminConfig {
  adminGroupId: number;
  topicGeneral: number;
  topicControl: number;
  topicLogs: number;
  topicErrors: number;
  tempDirectory?: string;
}

export interface BotConfig {
  telegramToken: string;
  maxFileSize: number;
  downloadTimeout: number;
  tempDirectory: string;
  supportedPlatforms: string[];
  maxConcurrentDownloads: number;
  sessionTimeout: number;
  retryAttempts: number;
  webhookUrl?: string;
  port: number;
  useWebhook: boolean;
  adminConfig: AdminConfig;
  dailyCredits: number;
  youtubeCookiesPath?: string;
}
