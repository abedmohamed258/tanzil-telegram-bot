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
    status: 'tunnel' | 'redirect' | 'picker' | 'error';
    url?: string;
    filename?: string;
    picker?: Array<{ url: string; filename?: string }>;
    error?: { code?: string };
}

// Cobalt instances to rotate through
const COBALT_INSTANCES = [
    'https://api.cobalt.tools/api/json',
    'https://cobalt.canine.tools/api/json',
    'https://co.wuk.sh/api/json',
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
        supportsVideoInfo: false, // Cobalt doesn't provide full video info
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
     */
    supports(url: string): boolean {
        try {
            const platform = this.getPlatform(url);
            return this.supportedPlatforms.includes(platform);
        } catch {
            return false;
        }
    }

    /**
     * Get video information (minimal - Cobalt doesn't provide full info)
     */
    async getVideoInfo(url: string, options?: DownloadOptions): Promise<VideoInfo> {
        // Try to get direct download URL and use that as info
        const result = await this.getCobaltUrl(url, options?.quality || '1080', options?.audioOnly || false);

        if (!result) {
            throw new Error('Could not get video info from Cobalt');
        }

        const platform = this.getPlatform(url);
        const filename = result.filename.replace(/\.[^/.]+$/, '') || 'Video';

        const format: VideoFormat = {
            formatId: 'cobalt-best',
            quality: 'Best',
            extension: 'mp4',
            filesize: 0,
            hasVideo: !options?.audioOnly,
            hasAudio: true,
            resolutionCategory: 'other',
        };

        return {
            title: filename,
            duration: 0,
            thumbnail: '',
            uploader: 'Unknown',
            platform,
            formats: [format],
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
            // Get download URL from Cobalt
            const result = await this.getCobaltUrl(
                url,
                options.quality || '1080',
                options.audioOnly || false,
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

                const response = await fetch(instanceUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                    body: JSON.stringify({
                        url: videoUrl,
                        videoQuality: quality,
                        downloadMode: audioOnly ? 'audio' : 'auto',
                        audioFormat: 'mp3',
                        filenameStyle: 'basic',
                    }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json() as CobaltResponse;

                if (data.status === 'error') {
                    throw new Error(data.error?.code || 'Cobalt error');
                }

                if (data.status === 'tunnel' || data.status === 'redirect') {
                    this.recordInstanceSuccess(instanceUrl);
                    return {
                        url: data.url || '',
                        filename: data.filename || 'download.mp4',
                    };
                }

                if (data.status === 'picker' && data.picker?.length) {
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
