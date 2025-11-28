/**
 * Type definitions for Tanzil Telegram Bot
 * Based on design.md specifications
 */

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
}

export interface AdminConfig {
    adminGroupId: number;
    topicGeneral: number;
    topicControl: number;
    topicLogs: number;
    topicErrors: number;
    tempDirectory?: string;
}

export interface VideoInfo {
    title: string;
    duration: number;
    thumbnail: string;
    uploader: string;
    formats: Format[];
}

export interface Format {
    formatId: string;
    quality: string;
    extension: string;
    filesize: number;
    hasVideo: boolean;
    hasAudio: boolean;
}

export interface DownloadResult {
    success: boolean;
    filePath?: string;
    error?: string;
}

export interface DownloadRequest {
    id: string;
    userId: number;
    user?: {
        id: number;
        firstName: string;
        username?: string;
    };
    videoInfo?: {
        title: string;
    };
    chatId: number;
    url: string;
    format?: string;
    priority: number;
    createdAt: Date;
    statusMessageId?: number; // Track the status message to edit it
    reservedCredits?: number;
}

export interface QueueStatus {
    position: number;
    totalInQueue: number;
    estimatedWaitTime: number;
}

export interface Session {
    id: string;
    userId: number;
    url: string;
    videoInfo?: VideoInfo;
    selectedFormat?: string;
    createdAt: Date;
    expiresAt: Date;
}

export interface FileMetadata {
    filename: string;
    title: string;
    duration?: number;
    mimeType: string;
    thumbnail?: Buffer;
}

export interface DownloadProgress {
    sessionId: string;
    percentage: number;
    downloadedBytes: number;
    totalBytes: number;
    speed: number;
}

export interface ErrorContext {
    sessionId?: string;
    chatId?: number;
    userId?: number;
    operation: string;
}

export interface DownloadRecord {
    title: string;
    url: string;
    format: string;
    date: string; // ISO Date
    timestamp: number;
    filename?: string;
}

export interface Credits {
    used: number;
    lastReset: string; // ISO Date
}

export interface PlaylistSession {
    url: string;
    indices: number[];
    totalVideos: number;
    state: 'WAITING_FOR_SELECTION' | 'PROCESSING';
    currentIndex?: number;
    options?: string;
    threadId?: number;
}

export interface ScheduledTaskOptions {
    chatId: number;
    threadId?: number;
}

export interface ScheduledTask {
    id: string;
    userId: number;
    url: string;
    executeAt: number;
    options: ScheduledTaskOptions;
}

/**
 * yt-dlp JSON response interfaces for type safety
 */
export interface YtDlpFormat {
    format_id: string;
    format_note?: string;
    quality?: string | number;
    ext: string;
    filesize?: number;
    filesize_approx?: number;
    vcodec: string;
    acodec: string;
    width?: number;
    height?: number;
    fps?: number;
    tbr?: number;
    abr?: number;
    vbr?: number;
}

export interface YtDlpVideoInfo {
    title: string;
    duration: number;
    thumbnail?: string;
    uploader?: string;
    formats?: YtDlpFormat[];
    _type?: string;
    url?: string;
    webpage_url?: string;
}

export interface YtDlpPlaylistEntry {
    title: string;
    url: string;
    id?: string;
    _type?: string;
}

export interface UserProfile {
    id: number;
    username?: string;
    firstName: string;
    lastName?: string;
    joinedAt: string; // ISO Date
    lastActive: string; // ISO Date
    isBanned: boolean;
    downloadHistory: DownloadRecord[];
    // V3 Features
    credits: Credits;
    timezone: number; // Offset from UTC
    activePlaylist: PlaylistSession | null;
}
