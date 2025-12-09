/**
 * Core Types for Download System
 * Defines all interfaces and types used across the modular download architecture
 */

// ============================================================================
// Enums
// ============================================================================

export enum ProviderStatus {
    HEALTHY = 'healthy',
    DEGRADED = 'degraded',
    UNAVAILABLE = 'unavailable',
}

export enum DownloadState {
    PENDING = 'pending',
    FETCHING_INFO = 'fetching_info',
    DOWNLOADING = 'downloading',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled',
}

export enum Platform {
    YOUTUBE = 'youtube',
    INSTAGRAM = 'instagram',
    TIKTOK = 'tiktok',
    TWITTER = 'twitter',
    FACEBOOK = 'facebook',
    REDDIT = 'reddit',
    VIMEO = 'vimeo',
    TWITCH = 'twitch',
    UNKNOWN = 'unknown',
}

// ============================================================================
// Video & Format Types
// ============================================================================

export interface VideoFormat {
    formatId: string;
    quality: string;
    extension: string;
    filesize: number;
    hasVideo: boolean;
    hasAudio: boolean;
    bitrate?: number;
    fps?: number;
    codec?: string;
    resolution?: string;
    resolutionCategory?: '4K' | '1080p' | '720p' | '480p' | '360p' | 'audio' | 'other';
}

export interface VideoMetadata {
    title: string;
    duration: number;
    thumbnail: string;
    uploader: string;
    uploadDate?: string;
    description?: string;
    viewCount?: number;
    platform: Platform;
}

export interface VideoInfo extends VideoMetadata {
    formats: VideoFormat[];
    directUrl?: string; // Direct download URL if available
    provider: string;   // Provider that fetched the info
}

// ============================================================================
// Download Types
// ============================================================================

export interface DownloadOptions {
    formatId?: string;
    quality?: string;
    audioOnly?: boolean;
    cookies?: string;
    outputDir?: string;
    maxRetries?: number;
    timeout?: number;
}

export interface DownloadProgress {
    sessionId: string;
    state: DownloadState;
    percentage: number;
    downloadedBytes: number;
    totalBytes: number;
    speed: number; // bytes per second
    eta: number;   // estimated time remaining in seconds
}

export interface DownloadResult {
    success: boolean;
    filePath?: string;
    filename?: string;
    filesize?: number;
    duration?: number;
    error?: string;
    provider?: string;
}

export interface DownloadTask {
    id: string;
    url: string;
    userId: number;
    chatId: number;
    options: DownloadOptions;
    state: DownloadState;
    progress: DownloadProgress;
    videoInfo?: VideoInfo;
    result?: DownloadResult;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    retryCount: number;
    currentProvider?: string;
}

// ============================================================================
// Provider Types
// ============================================================================

export interface ProviderHealth {
    status: ProviderStatus;
    successRate: number;       // 0-1
    avgResponseTime: number;   // ms
    lastSuccess?: Date;
    lastFailure?: Date;
    failureCount: number;
    isCircuitOpen: boolean;
}

export interface ProviderCapabilities {
    supportsVideoInfo: boolean;
    supportsDirectDownload: boolean;
    supportsAudioOnly: boolean;
    supportsQualitySelection: boolean;
    supportsProgress: boolean;
    supportsResume: boolean;
    maxFileSize?: number;
    maxDuration?: number;
}

export interface IDownloadProvider {
    readonly name: string;
    readonly priority: number;
    readonly supportedPlatforms: Platform[];
    readonly capabilities: ProviderCapabilities;

    /**
     * Check if provider supports the given URL
     */
    supports(url: string): boolean;

    /**
     * Get video information
     */
    getVideoInfo(url: string, options?: DownloadOptions): Promise<VideoInfo>;

    /**
     * Download video/audio
     */
    download(
        url: string,
        sessionId: string,
        options: DownloadOptions,
        onProgress?: (progress: DownloadProgress) => void,
    ): Promise<DownloadResult>;

    /**
     * Cancel an active download
     */
    cancelDownload(sessionId: string): Promise<void>;

    /**
     * Get current health status
     */
    getHealth(): ProviderHealth;

    /**
     * Reset provider state (after recovery)
     */
    reset(): void;
}

// ============================================================================
// Event Types
// ============================================================================

export type DownloadEventType =
    | 'task:created'
    | 'task:started'
    | 'task:progress'
    | 'task:completed'
    | 'task:failed'
    | 'task:cancelled'
    | 'provider:switched'
    | 'provider:failed';

export interface DownloadEvent {
    type: DownloadEventType;
    taskId: string;
    timestamp: Date;
    data?: Record<string, unknown>;
}

export type DownloadEventHandler = (event: DownloadEvent) => void;

// ============================================================================
// Configuration Types
// ============================================================================

export interface DownloadSystemConfig {
    maxConcurrentDownloads: number;
    defaultTimeout: number;
    maxRetries: number;
    tempDirectory: string;
    maxFileSize: number;
    maxDuration: number;
    providers: {
        ytdlp: {
            enabled: boolean;
            priority: number;
            timeout: number;
            usePotServer: boolean;
        };
        cobalt: {
            enabled: boolean;
            priority: number;
            instances: string[];
        };
        invidious: {
            enabled: boolean;
            priority: number;
            instances: string[];
        };
    };
}

// ============================================================================
// Security Types
// ============================================================================

export interface FileValidation {
    isValid: boolean;
    mimeType?: string;
    actualSize?: number;
    isSafe: boolean;
    warnings: string[];
}

export interface RateLimitInfo {
    userId: number;
    requestsRemaining: number;
    resetTime: Date;
    isLimited: boolean;
}

// ============================================================================
// Re-exports from existing types for compatibility
// ============================================================================

export type { DownloadRequest, QueueStatus, Session } from '../../types/download';
