/**
 * SSYouTubeProvider - YouTube download provider using ssyoutube.com API
 * Fallback for YouTube when yt-dlp fails due to bot detection
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

// SSYouTube API endpoints
const SSYOUTUBE_ENDPOINTS = [
    'https://ssyoutube.com/api/convert',
    'https://www.y2mate.com/mates/analyzeV2/ajax',
    'https://loader.to/api/button/',
];

interface SSYouTubeResponse {
    status: string;
    url?: string;
    title?: string;
    thumbnail?: string;
    duration?: string;
    links?: {
        mp4?: Record<string, { k: string; q: string; size: string }>;
        mp3?: Record<string, { k: string; q: string; size: string }>;
    };
}

export class SSYouTubeProvider extends BaseProvider {
    readonly name = 'ssyoutube';
    readonly priority = 4; // After Invidious
    readonly supportedPlatforms = [Platform.YOUTUBE];

    readonly capabilities: ProviderCapabilities = {
        supportsVideoInfo: true,
        supportsDirectDownload: true,
        supportsAudioOnly: true,
        supportsQualitySelection: true,
        supportsProgress: false,
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
            // Try to get info using noembed (always works, no API limits)
            const noembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.timeout);

            try {
                const response = await fetch(noembedUrl, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json() as { title?: string; author_name?: string; thumbnail_url?: string };

                // Create quality options (we'll download best available)
                const formats: VideoFormat[] = [
                    {
                        formatId: 'ssyt-1080',
                        quality: '1080p',
                        extension: 'mp4',
                        filesize: 0,
                        hasVideo: true,
                        hasAudio: true,
                        resolutionCategory: '1080p',
                    },
                    {
                        formatId: 'ssyt-720',
                        quality: '720p',
                        extension: 'mp4',
                        filesize: 0,
                        hasVideo: true,
                        hasAudio: true,
                        resolutionCategory: '720p',
                    },
                    {
                        formatId: 'ssyt-480',
                        quality: '480p',
                        extension: 'mp4',
                        filesize: 0,
                        hasVideo: true,
                        hasAudio: true,
                        resolutionCategory: '480p',
                    },
                    {
                        formatId: 'ssyt-360',
                        quality: '360p',
                        extension: 'mp4',
                        filesize: 0,
                        hasVideo: true,
                        hasAudio: true,
                        resolutionCategory: '360p',
                    },
                    {
                        formatId: 'ssyt-audio',
                        quality: 'Audio (MP3)',
                        extension: 'mp3',
                        filesize: 0,
                        hasVideo: false,
                        hasAudio: true,
                        bitrate: 128,
                        resolutionCategory: 'audio',
                    },
                ];

                return {
                    title: data.title || 'YouTube Video',
                    duration: 0,
                    thumbnail: data.thumbnail_url || '',
                    uploader: data.author_name || 'Unknown',
                    platform: Platform.YOUTUBE,
                    formats,
                    provider: this.name,
                };
            } finally {
                clearTimeout(timeout);
            }
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
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            return { success: false, error: 'Could not extract video ID', provider: this.name };
        }

        return this.executeWithTracking(async () => {
            // Parse quality from formatId
            let quality = '720';
            let audioOnly = options.audioOnly || false;

            if (options.formatId) {
                if (options.formatId === 'ssyt-audio') {
                    audioOnly = true;
                } else if (options.formatId.startsWith('ssyt-')) {
                    quality = options.formatId.replace('ssyt-', '');
                }
            }

            // Use SaveFrom API-style approach
            const downloadUrl = await this.getDownloadUrl(videoId, quality, audioOnly);

            if (!downloadUrl) {
                throw new Error('Could not get download URL');
            }

            // Update progress
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

            // Download the file
            const filename = `youtube_${videoId}.${audioOnly ? 'mp3' : 'mp4'}`;
            const result = await this.downloadFile(downloadUrl, sessionId, filename, onProgress);

            return result;
        }, 'download');
    }

    /**
     * Get download URL using various methods
     */
    private async getDownloadUrl(
        videoId: string,
        quality: string,
        audioOnly: boolean,
    ): Promise<string | null> {
        // Method 1: Try using a direct API
        const apiUrls = [
            `https://api.vevioz.com/api/button/mp4/${videoId}`,
            `https://api.mp3download.to/v2/converter/youtube?url=https://youtube.com/watch?v=${videoId}&format=${audioOnly ? 'mp3' : 'mp4'}`,
        ];

        for (const apiUrl of apiUrls) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), this.timeout);

                const response = await fetch(apiUrl, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                });

                clearTimeout(timeout);

                if (response.ok) {
                    const text = await response.text();
                    // Try to extract download link from response
                    const linkMatch = text.match(/https?:\/\/[^\s"'<>]+\.(mp4|mp3|webm)[^\s"'<>]*/i);
                    if (linkMatch) {
                        logger.info(`[${this.name}] Found download URL from API`);
                        return linkMatch[0];
                    }
                }
            } catch (error) {
                logger.debug(`[${this.name}] API method failed`, { error: (error as Error).message });
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
