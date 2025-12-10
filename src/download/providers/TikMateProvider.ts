/**
 * TikMateProvider - TikTok download provider without watermark
 * Specialized provider for TikTok when yt-dlp gets watermarked videos
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

export class TikMateProvider extends BaseProvider {
    readonly name = 'tikmate';
    readonly priority = 4; // Lower priority, specialized fallback
    readonly supportedPlatforms = [Platform.TIKTOK];

    readonly capabilities: ProviderCapabilities = {
        supportsVideoInfo: true,
        supportsDirectDownload: true,
        supportsAudioOnly: true,
        supportsQualitySelection: false, // TikTok has limited quality options
        supportsProgress: true,
        supportsResume: false,
    };

    private readonly fileManager: FileManager;
    private readonly timeout: number;

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
            const hostname = new URL(url).hostname.toLowerCase();
            return hostname.includes('tiktok.com') || hostname.includes('vm.tiktok.com');
        } catch {
            return false;
        }
    }

    /**
     * Get video information
     */
    async getVideoInfo(url: string): Promise<VideoInfo> {
        return this.executeWithTracking(async () => {
            const videoData = await this.fetchTikTokData(url);

            if (!videoData) {
                throw new Error('Could not fetch TikTok video data');
            }

            const formats: VideoFormat[] = [
                {
                    formatId: 'tikmate-hd',
                    quality: 'HD (No Watermark)',
                    extension: 'mp4',
                    filesize: 0,
                    hasVideo: true,
                    hasAudio: true,
                    resolutionCategory: '1080p',
                },
                {
                    formatId: 'tikmate-sd',
                    quality: 'SD (No Watermark)',
                    extension: 'mp4',
                    filesize: 0,
                    hasVideo: true,
                    hasAudio: true,
                    resolutionCategory: '480p',
                },
                {
                    formatId: 'tikmate-audio',
                    quality: 'Audio Only',
                    extension: 'mp3',
                    filesize: 0,
                    hasVideo: false,
                    hasAudio: true,
                    resolutionCategory: 'audio',
                },
            ];

            return {
                title: videoData.title || 'TikTok Video',
                duration: videoData.duration || 0,
                thumbnail: videoData.thumbnail || '',
                uploader: videoData.author || 'Unknown',
                platform: Platform.TIKTOK,
                formats,
                directUrl: videoData.downloadUrl,
                provider: this.name,
            };
        }, 'getVideoInfo');
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
            const videoData = await this.fetchTikTokData(url);

            if (!videoData || !videoData.downloadUrl) {
                throw new Error('Could not get TikTok download URL');
            }

            const isAudio = options.audioOnly || options.formatId === 'tikmate-audio';
            const downloadUrl = isAudio && videoData.audioUrl ? videoData.audioUrl : videoData.downloadUrl;

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

            const filename = `tiktok_${Date.now()}.${isAudio ? 'mp3' : 'mp4'}`;
            const result = await this.downloadFile(downloadUrl, sessionId, filename, onProgress);

            return result;
        }, 'download');
    }

    /**
     * Fetch TikTok video data from API
     */
    private async fetchTikTokData(url: string): Promise<{
        title?: string;
        author?: string;
        thumbnail?: string;
        duration?: number;
        downloadUrl?: string;
        audioUrl?: string;
    } | null> {
        // Method 1: Use tikwm.com API (free, no auth)
        try {
            const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(apiUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                },
            });

            clearTimeout(timeout);

            if (response.ok) {
                const data = await response.json() as {
                    code: number;
                    data?: {
                        title?: string;
                        author?: { nickname?: string };
                        cover?: string;
                        duration?: number;
                        play?: string;
                        hdplay?: string;
                        music?: string;
                    };
                };

                if (data.code === 0 && data.data) {
                    logger.info(`[${this.name}] Got TikTok data from tikwm`);
                    return {
                        title: data.data.title,
                        author: data.data.author?.nickname,
                        thumbnail: data.data.cover,
                        duration: data.data.duration,
                        downloadUrl: data.data.hdplay || data.data.play,
                        audioUrl: data.data.music,
                    };
                }
            }
        } catch (error) {
            logger.debug(`[${this.name}] tikwm API failed`, { error: (error as Error).message });
        }

        // Method 2: Try ssstik.io style
        try {
            const apiUrl = `https://ssstik.io/abc?url=${encodeURIComponent(url)}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(apiUrl, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `id=${encodeURIComponent(url)}&locale=en&tt=1`,
            });

            clearTimeout(timeout);

            if (response.ok) {
                const text = await response.text();
                // Extract download URL from HTML response
                const downloadMatch = text.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
                if (downloadMatch) {
                    logger.info(`[${this.name}] Got TikTok data from ssstik`);
                    return {
                        title: 'TikTok Video',
                        downloadUrl: downloadMatch[1],
                    };
                }
            }
        } catch (error) {
            logger.debug(`[${this.name}] ssstik API failed`, { error: (error as Error).message });
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
                    'Referer': 'https://www.tiktok.com/',
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

            const fs = await import('fs/promises');
            const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));

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

            logger.error(`[${this.name}] Download failed`, { sessionId, error: err.message });
            return { success: false, error: err.message, provider: this.name };
        }
    }
}
