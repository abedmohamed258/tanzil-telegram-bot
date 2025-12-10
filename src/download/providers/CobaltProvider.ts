/**
 * CobaltProvider - Download provider using Cobalt API instances
 * Fallback provider for when yt-dlp fails
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

// Cobalt API response types
interface CobaltResponse {
    status: 'tunnel' | 'redirect' | 'picker' | 'stream' | 'error';
    url?: string;
    filename?: string;
    picker?: Array<{ url: string; filename?: string }>;
    error?: { code?: string };
}

// Cobalt instances to rotate through (from instances.cobalt.best - December 2024)
// Using API endpoints with highest success rates
const COBALT_INSTANCES = [
    'https://cobalt-api.kwiatekmiki.com',   // 88% success rate
    'https://cobalt-api.meowing.de',        // 88% success rate
    'https://cobalt-backend.canine.tools',  // 80% success rate
    'https://kityune.imput.net',            // 76% (official cobalt.tools)
    'https://capi.3kh0.net',                // 76% success rate
    'https://nachos.imput.net',             // 72% (official cobalt.tools)
    'https://sunny.imput.net',              // 72% (official cobalt.tools)
    'https://blossom.imput.net',            // 72% (official cobalt.tools)
];

export class CobaltProvider extends BaseProvider {
    readonly name = 'cobalt';
    readonly priority = 2;
    readonly supportedPlatforms = [
        Platform.YOUTUBE,
        Platform.INSTAGRAM,
        Platform.TIKTOK,
        Platform.TWITTER,
        Platform.FACEBOOK,
        Platform.REDDIT,
        Platform.VIMEO,
        Platform.TWITCH,
    ];

    readonly capabilities: ProviderCapabilities = {
        supportsVideoInfo: true, // Cobalt provides basic video info for fallback
        supportsDirectDownload: true,
        supportsAudioOnly: true,
        supportsQualitySelection: true,
        supportsProgress: false,
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
        this.timeout = options.timeout || 30000;
    }

    /**
     * Check if this provider supports the URL
     * Cobalt supports many platforms - we try any valid URL as fallback
     */
    supports(url: string): boolean {
        try {
            // Validate it's a proper URL
            new URL(url);
            // Cobalt supports many platforms - let it try
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get video information with multiple quality options
     */
    async getVideoInfo(url: string, options?: DownloadOptions): Promise<VideoInfo> {
        // Try to get direct download URL and use that as info
        const result = await this.getCobaltUrl(url, options?.quality || '1080', options?.audioOnly || false);

        if (!result) {
            throw new Error('Could not get video info from Cobalt');
        }

        const platform = this.getPlatform(url);
        const filename = result.filename.replace(/\.[^/.]+$/, '') || 'Video';

        // Create multiple quality options for user selection
        const formats: VideoFormat[] = [
            {
                formatId: 'cobalt-1080',
                quality: '1080p',
                extension: 'mp4',
                filesize: 0,
                hasVideo: true,
                hasAudio: true,
                resolutionCategory: '1080p',
            },
            {
                formatId: 'cobalt-720',
                quality: '720p',
                extension: 'mp4',
                filesize: 0,
                hasVideo: true,
                hasAudio: true,
                resolutionCategory: '720p',
            },
            {
                formatId: 'cobalt-480',
                quality: '480p',
                extension: 'mp4',
                filesize: 0,
                hasVideo: true,
                hasAudio: true,
                resolutionCategory: '480p',
            },
            {
                formatId: 'cobalt-360',
                quality: '360p',
                extension: 'mp4',
                filesize: 0,
                hasVideo: true,
                hasAudio: true,
                resolutionCategory: '360p',
            },
            {
                formatId: 'cobalt-audio',
                quality: 'Audio (MP3)',
                extension: 'mp3',
                filesize: 0,
                hasVideo: false,
                hasAudio: true,
                bitrate: 128,
                resolutionCategory: 'other',
            },
        ];

        return {
            title: filename,
            duration: 0,
            thumbnail: '',
            uploader: 'Unknown',
            platform,
            formats,
            directUrl: result.url,
            provider: this.name,
        };
    }

    /**
     * Download video/audio
     */
    async download(
        url: string,
        sessionId: string,
        options: DownloadOptions,
        onProgress?: (progress: DownloadProgress) => void,
    ): Promise<DownloadResult> {
        return this.executeWithTracking(async () => {
            // Parse quality from formatId (e.g., cobalt-1080 -> 1080)
            let quality = 'max'; // Default to max/best
            let audioOnly = options.audioOnly || false;

            if (options.formatId) {
                if (options.formatId === 'cobalt-audio') {
                    audioOnly = true;
                } else if (options.formatId.startsWith('cobalt-')) {
                    const q = options.formatId.replace('cobalt-', '');
                    // Keep explicit quality if requested, otherwise max
                    quality = q === 'best' ? 'max' : q;
                }
            }

            // Get download URL from Cobalt
            const result = await this.getCobaltUrl(
                url,
                quality,
                audioOnly,
            );

            if (!result) {
                throw new Error('Could not get download URL from Cobalt');
            }

            // Update progress to downloading
            if (onProgress) {
                onProgress({
                    sessionId,
                    state: DownloadState.DOWNLOADING,
                    percentage: 0,
                    downloadedBytes: 0,
                    totalBytes: 0,
                    speed: 0,
                    eta: 0,
                });
            }

            // Download file
            const downloadResult = await this.downloadFile(
                result.url,
                sessionId,
                result.filename,
                onProgress,
            );

            return downloadResult;
        }, 'download');
    }

    /**
     * Get download URL from Cobalt
     */
    private async getCobaltUrl(
        videoUrl: string,
        quality: string,
        audioOnly: boolean,
    ): Promise<{ url: string; filename: string } | null> {
        // Get healthy instances
        const healthyInstances = this.getHealthyInstances();

        for (const instanceUrl of healthyInstances) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.timeout);

            try {
                logger.info(`[${this.name}] Trying instance`, { instance: instanceUrl });

                // Try common API endpoints
                const endpoints = [
                    '/api/json',  // Standard v7/v10 web instances
                    '/',          // API-only instances
                    '/api/server/json' // Some v7 forks
                ];

                let response: Response | undefined;

                for (const endpoint of endpoints) {
                    try {
                        const testUrl = instanceUrl.endsWith('/')
                            ? `${instanceUrl.slice(0, -1)}${endpoint}`
                            : `${instanceUrl}${endpoint}`;

                        const finalUrl = testUrl.replace('//', '/').replace(':/', '://');

                        // Prepare payloads (v10 and v7)
                        const v10Payload = {
                            url: videoUrl,
                            videoQuality: quality === 'max' ? 'max' : quality + 'p',
                            audioFormat: 'mp3',
                            filenamePattern: 'classic',
                            isAudioOnly: audioOnly,
                        };

                        const v7Payload = {
                            url: videoUrl,
                            vCodec: 'h264',
                            vQuality: quality === 'max' ? '1080' : quality,
                            aFormat: 'mp3',
                            filenamePattern: 'classic',
                            isAudioOnly: audioOnly,
                        };

                        // Decide payload based on endpoint or try both?
                        // Most root endpoints are v10
                        const payload = endpoint === '/' ? v10Payload : v7Payload;

                        const res = await fetch(finalUrl, {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            },
                            body: JSON.stringify(payload),
                            signal: controller.signal,
                        });

                        const contentType = res.headers.get('content-type');
                        if (res.ok && contentType && contentType.includes('application/json')) {
                            response = res;
                            break;
                        }
                    } catch (e) {
                        logger.debug(`[${this.name}] Endpoint ${endpoint} failed`, { error: (e as Error).message });
                        continue; // Try next endpoint
                    }
                }

                if (!response) {
                    throw new Error('All endpoints failed');
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json() as CobaltResponse;

                if (data.status === 'error') {
                    throw new Error(data.error?.code || 'Cobalt error');
                }

                if ((data.status === 'tunnel' || data.status === 'redirect' || data.status === 'stream') && data.url) {
                    this.recordInstanceSuccess(instanceUrl);
                    return {
                        url: data.url,
                        filename: data.filename || 'download.mp4',
                    };
                }

                if (data.status === 'picker' && data.picker?.length && data.picker[0].url) {
                    this.recordInstanceSuccess(instanceUrl);
                    return {
                        url: data.picker[0].url,
                        filename: data.picker[0].filename || 'download.mp4',
                    };
                }

                throw new Error('Unexpected response format');
            } catch (error) {
                this.recordInstanceFailure(instanceUrl);
                logger.warn(`[${this.name}] Instance failed`, {
                    instance: instanceUrl,
                    error: (error as Error).message,
                });
            } finally {
                clearTimeout(timeout);
            }
        }

        return null;
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
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
            const reader = response.body?.getReader();

            if (!reader) {
                throw new Error('No response body');
            }

            const chunks: Uint8Array[] = [];
            let downloadedBytes = 0;

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                chunks.push(value);
                downloadedBytes += value.length;

                if (onProgress && contentLength > 0) {
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

            // Write to file
            const fs = await import('fs/promises');
            const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));

            // Validate file is not empty
            if (buffer.length === 0) {
                throw new Error('Downloaded file is empty');
            }

            await fs.writeFile(filePath, buffer);

            this.cleanupAbortController(sessionId);

            logger.info(`[${this.name}] Download successful`, { filePath, sessionId, size: buffer.length });

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

            logger.error(`[${this.name}] Download failed`, {
                sessionId,
                error: err.message,
            });

            return { success: false, error: err.message, provider: this.name };
        }
    }

    /**
     * Get healthy instances sorted by success rate
     */
    private getHealthyInstances(): string[] {
        const now = Date.now();
        const cooldownMs = 60000; // 1 minute cooldown for failed instances

        return COBALT_INSTANCES
            .filter((instance) => {
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

    /**
     * Record instance success
     */
    private recordInstanceSuccess(instance: string): void {
        this.instanceHealth.set(instance, { failures: 0 });
    }

    /**
     * Record instance failure
     */
    private recordInstanceFailure(instance: string): void {
        const current = this.instanceHealth.get(instance) || { failures: 0 };
        this.instanceHealth.set(instance, {
            failures: current.failures + 1,
            lastFailure: new Date(),
        });
    }

    /**
     * Reset all instance health
     */
    reset(): void {
        super.reset();
        this.instanceHealth.clear();
    }
}
