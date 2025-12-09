/**
 * InvidiousProvider - Download provider for YouTube using Invidious API
 * Privacy-focused fallback for YouTube when yt-dlp fails
 */

import { BaseProvider } from './BaseProvider';
import { FileManager } from '../../utils/FileManager';
import { logger } from '../../utils/logger';
import {
    Platform,
    ProviderCapabilities,
    VideoInfo,
    VideoFormat,
    DownloadResult,
    DownloadOptions,
    DownloadProgress,
    DownloadState,
} from '../core/types';

// Invidious API response types
interface InvidiousVideo {
    title: string;
    videoId: string;
    lengthSeconds: number;
    viewCount: number;
    author: string;
    description: string;
    publishedText: string;
    videoThumbnails: Array<{ url: string; quality: string }>;
    formatStreams: Array<{
        url: string;
        itag: string;
        type: string;
        quality: string;
        container: string;
        resolution?: string;
    }>;
    adaptiveFormats: Array<{
        url: string;
        itag: string;
        type: string;
        container: string;
        bitrate: string;
    }>;
}

// Public Invidious instances (verified from api.invidious.io)
const INVIDIOUS_INSTANCES = [
    'https://vid.puffyan.us',        // Consistent uptime
    'https://inv.tux.pizza',         // Good performance
    'https://invidious.drgns.space', // Reliable
    'https://iv.ggtyler.dev',        // Backup
    'https://inv.nadeko.net',        // Backup
];

export class InvidiousProvider extends BaseProvider {
    readonly name = 'invidious';
    readonly priority = 3;
    readonly supportedPlatforms = [Platform.YOUTUBE];

    readonly capabilities: ProviderCapabilities = {
        supportsVideoInfo: true,
        supportsDirectDownload: true,
        supportsAudioOnly: false,
        supportsQualitySelection: true,
        supportsProgress: true,
        supportsResume: false,
    };

    private readonly fileManager: FileManager;
    private readonly timeout: number;
    private instanceHealth = new Map<string, { failures: number; lastFailure?: Date }>();

    constructor(
        fileManager: FileManager,
        options: { timeout?: number } = {},
    ) {
        super();
        this.fileManager = fileManager;
        this.timeout = options.timeout || 15000;
    }

    /**
     * Check if this provider supports the URL
     */
    supports(url: string): boolean {
        try {
            const hostname = new URL(url).hostname.toLowerCase();
            return hostname.includes('youtube.com') || hostname.includes('youtu.be');
        } catch {
            return false;
        }
    }

    /**
     * Extract YouTube video ID from URL
     */
    private extractVideoId(url: string): string | null {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
            /[?&]v=([a-zA-Z0-9_-]{11})/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    /**
     * Get video information
     */
    async getVideoInfo(url: string): Promise<VideoInfo> {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            throw new Error('Could not extract YouTube video ID');
        }

        return this.executeWithTracking(async () => {
            const data = await this.fetchFromInvidious<InvidiousVideo>(
                `/api/v1/videos/${videoId}`,
            );

            const formats = this.parseFormats(data.formatStreams);
            const thumbnail = data.videoThumbnails.find(t => t.quality === 'maxres')?.url ||
                data.videoThumbnails[0]?.url || '';

            return {
                title: data.title,
                duration: data.lengthSeconds,
                thumbnail,
                uploader: data.author,
                description: data.description,
                viewCount: data.viewCount,
                platform: Platform.YOUTUBE,
                formats,
                provider: this.name,
            };
        }, 'getVideoInfo');
    }

    /**
     * Download video
     */
    async download(
        url: string,
        sessionId: string,
        options: DownloadOptions,
        onProgress?: (progress: DownloadProgress) => void,
    ): Promise<DownloadResult> {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            return { success: false, error: 'Could not extract video ID', provider: this.name };
        }

        return this.executeWithTracking(async () => {
            // Get video info to find download URL
            const data = await this.fetchFromInvidious<InvidiousVideo>(
                `/api/v1/videos/${videoId}`,
            );

            // Find best quality stream
            let downloadUrl: string | null = null;

            if (options.formatId) {
                const stream = data.formatStreams.find(s => s.itag === options.formatId);
                if (stream) {
                    downloadUrl = stream.url;
                }
            }

            if (!downloadUrl) {
                // Find highest quality mp4
                const mp4Stream = data.formatStreams
                    .filter(s => s.container === 'mp4')
                    .sort((a, b) => {
                        const resA = parseInt(a.resolution || '0');
                        const resB = parseInt(b.resolution || '0');
                        return resB - resA;
                    })[0];

                if (mp4Stream) {
                    downloadUrl = mp4Stream.url;
                } else if (data.formatStreams.length > 0) {
                    downloadUrl = data.formatStreams[0].url;
                }
            }

            if (!downloadUrl) {
                throw new Error('No download URL found');
            }

            // Download the file
            const filename = this.sanitizeFilename(data.title) + '.mp4';
            const result = await this.downloadFile(
                downloadUrl,
                sessionId,
                filename,
                onProgress,
            );

            return result;
        }, 'download');
    }

    /**
     * Fetch data from Invidious API
     */
    private async fetchFromInvidious<T>(path: string): Promise<T> {
        const healthyInstances = this.getHealthyInstances();

        for (const instance of healthyInstances) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.timeout);

            try {
                logger.info(`[${this.name}] Trying instance`, { instance });

                const response = await fetch(`${instance}${path}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json',
                    },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json() as T;
                this.recordInstanceSuccess(instance);
                return data;
            } catch (error) {
                this.recordInstanceFailure(instance);
                logger.warn(`[${this.name}] Instance failed`, {
                    instance,
                    error: (error as Error).message,
                });
            } finally {
                clearTimeout(timeout);
            }
        }

        throw new Error('All Invidious instances failed');
    }

    /**
     * Download file from URL
     */
    private async downloadFile(
        url: string,
        sessionId: string,
        filename: string,
        onProgress?: (progress: DownloadProgress) => void,
    ): Promise<DownloadResult> {
        try {
            const sessionDir = await this.fileManager.createSessionDir(sessionId);
            const filePath = (await import('path')).join(sessionDir, filename);

            const controller = this.createAbortController(sessionId);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
            const reader = response.body?.getReader();

            if (!reader) {
                throw new Error('No response body');
            }

            const chunks: Uint8Array[] = [];
            let downloadedBytes = 0;
            let lastProgressUpdate = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                downloadedBytes += value.length;

                // Throttle progress updates
                const now = Date.now();
                if (onProgress && contentLength > 0 && now - lastProgressUpdate > 200) {
                    lastProgressUpdate = now;
                    onProgress({
                        sessionId,
                        state: DownloadState.DOWNLOADING,
                        percentage: (downloadedBytes / contentLength) * 100,
                        downloadedBytes,
                        totalBytes: contentLength,
                        speed: 0,
                        eta: 0,
                    });
                }
            }

            const fs = await import('fs/promises');
            const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
            await fs.writeFile(filePath, buffer);

            this.cleanupAbortController(sessionId);

            logger.info(`[${this.name}] Download successful`, { filePath, sessionId });

            return {
                success: true,
                filePath,
                filename,
                filesize: buffer.length,
                provider: this.name,
            };
        } catch (error) {
            this.cleanupAbortController(sessionId);
            const err = error as Error;

            if (err.name === 'AbortError') {
                return { success: false, error: 'Download cancelled', provider: this.name };
            }

            return { success: false, error: err.message, provider: this.name };
        }
    }

    /**
     * Parse format streams
     */
    private parseFormats(streams: InvidiousVideo['formatStreams']): VideoFormat[] {
        return streams
            .filter(s => s.container === 'mp4')
            .map(s => {
                const resMatch = s.resolution?.match(/(\d+)/);
                const height = resMatch ? parseInt(resMatch[1]) : 0;

                return {
                    formatId: s.itag,
                    quality: s.resolution || s.quality,
                    extension: s.container,
                    filesize: 0,
                    hasVideo: true,
                    hasAudio: true,
                    resolution: s.resolution,
                    resolutionCategory: this.getResolutionCategory(height),
                };
            })
            .sort((a, b) => {
                const resA = parseInt(a.resolution || '0');
                const resB = parseInt(b.resolution || '0');
                return resB - resA;
            });
    }

    /**
     * Get resolution category
     */
    private getResolutionCategory(height: number): VideoFormat['resolutionCategory'] {
        if (height >= 2160) return '4K';
        if (height >= 1080) return '1080p';
        if (height >= 720) return '720p';
        if (height >= 480) return '480p';
        if (height >= 360) return '360p';
        return 'other';
    }

    /**
     * Sanitize filename
     */
    private sanitizeFilename(name: string): string {
        return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    }

    /**
     * Get healthy instances
     */
    private getHealthyInstances(): string[] {
        const now = Date.now();
        const cooldownMs = 60000;

        return INVIDIOUS_INSTANCES
            .filter(instance => {
                const health = this.instanceHealth.get(instance);
                if (!health) return true;
                if (health.lastFailure && now - health.lastFailure.getTime() < cooldownMs) {
                    return health.failures < 3;
                }
                return true;
            })
            .sort((a, b) => {
                const healthA = this.instanceHealth.get(a);
                const healthB = this.instanceHealth.get(b);
                return (healthA?.failures || 0) - (healthB?.failures || 0);
            });
    }

    private recordInstanceSuccess(instance: string): void {
        this.instanceHealth.set(instance, { failures: 0 });
    }

    private recordInstanceFailure(instance: string): void {
        const current = this.instanceHealth.get(instance) || { failures: 0 };
        this.instanceHealth.set(instance, {
            failures: current.failures + 1,
            lastFailure: new Date(),
        });
    }

    reset(): void {
        super.reset();
        this.instanceHealth.clear();
    }
}
