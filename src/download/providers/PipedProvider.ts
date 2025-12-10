
import { BaseProvider } from './BaseProvider';
import { FileManager } from '../../utils/FileManager';
import {
    VideoInfo,
    DownloadResult,
    DownloadOptions,
    DownloadProgress,
    DownloadState,
    Platform,
    VideoFormat,
    ProviderCapabilities,
} from '../core/types';
import { logger } from '../../utils/logger';
import fetch from 'node-fetch';

interface PipedStream {
    url: string;
    format: string;
    quality: string;
    mimeType: string;
    codec: string;
    videoOnly: boolean;
    audioOnly: boolean;
    bitrate: number;
    contentLength: number;
}

interface PipedResponse {
    title: string;
    description: string;
    uploadDate: string;
    uploader: string;
    duration: number;
    thumbnailUrl: string;
    views: number;
    audioStreams: PipedStream[];
    videoStreams: PipedStream[];
}

// Piped instances
const PIPED_INSTANCES = [
    'https://api.piped.ot.ax',
    'https://pipedapi.kavin.rocks',
    'https://api.piped.privacy.com.de',
    'https://api.piped.projectsegfau.lt',
    'https://piped-api.lunar.icu',
    'https://api.piped.drgns.space',
];

export class PipedProvider extends BaseProvider {
    public readonly name = 'piped';
    public readonly supportedPlatforms = [Platform.YOUTUBE];
    public readonly priority = 3; // Better than SSYouTube, same as Invidious

    public readonly capabilities: ProviderCapabilities = {
        supportsVideoInfo: true,
        supportsDirectDownload: true,
        supportsAudioOnly: true,
        supportsQualitySelection: true,
        supportsProgress: true,
        supportsResume: false,
    };

    private readonly fileManager: FileManager;
    private infoCache = new Map<string, { data: VideoInfo; expires: number }>();

    constructor(fileManager: FileManager) {
        super();
        this.fileManager = fileManager;
    }

    /**
     * Check if provider supports the URL
     */
    supports(url: string): boolean {
        return this.extractVideoId(url) !== null;
    }

    /**
     * Get video info from Piped
     */
    async getVideoInfo(url: string, options?: DownloadOptions): Promise<VideoInfo> {
        return this.executeWithTracking(async () => {
            // Check cache
            const cached = this.infoCache.get(url);
            if (cached && cached.expires > Date.now()) {
                return cached.data;
            }

            const videoId = this.extractVideoId(url);
            if (!videoId) {
                throw new Error('Could not extract video ID');
            }

            const data = await this.fetchPipedData(videoId);

            const formats = this.parseFormats(data);
            const platform = Platform.YOUTUBE;

            const result: VideoInfo = {
                title: data.title,
                duration: data.duration,
                thumbnail: data.thumbnailUrl,
                uploader: data.uploader,
                uploadDate: data.uploadDate,
                description: data.description,
                viewCount: data.views,
                platform,
                formats,
                provider: this.name,
            };

            // Cache for 30 minutes
            this.infoCache.set(url, {
                data: result,
                expires: Date.now() + 1800000,
            });

            return result;
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
            const videoId = this.extractVideoId(url);
            if (!videoId) throw new Error('Invalid YouTube URL');

            // Fetch data again to get fresh stream URLs
            const data = await this.fetchPipedData(videoId);
            const formats = this.parseFormats(data);

            const selectedFormat = this.selectFormat(formats, options);
            if (!selectedFormat) throw new Error('No suitable format found');

            // Find the direct URL from the stream
            const streamUrl = this.findStreamUrl(data, selectedFormat, options);
            if (!streamUrl) throw new Error('Could not get download URL');

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

            // Download
            const result = await this.downloadFile(
                streamUrl,
                sessionId,
                `${this.sanitizeFilename(data.title)}.${selectedFormat.extension}`,
                onProgress
            );

            return result;
        }, 'download');
    }

    /**
     * Fetch data from Piped instances
     */
    private async fetchPipedData(videoId: string): Promise<PipedResponse> {
        const instances = this.getHealthyInstances();
        let lastError: Error | null = null;

        for (const instance of instances) {
            try {
                logger.debug(`[${this.name}] Trying instance`, { instance });
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

                const res = await fetch(`${instance}/streams/${videoId}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TanzilBot/1.0)' },
                    signal: controller.signal,
                });

                clearTimeout(timeout);

                if (res.ok) {
                    return await res.json() as PipedResponse;
                }
            } catch (err) {
                lastError = err as Error;
                continue;
            }
        }

        throw new Error('All Piped instances failed');
    }

    /**
     * Parse Piped streams to VideoFormat
     */
    private parseFormats(data: PipedResponse): VideoFormat[] {
        const formats: VideoFormat[] = [];

        // Audio streams
        data.audioStreams.forEach(stream => {
            formats.push({
                formatId: `audio-${stream.bitrate}`,
                quality: 'audio',
                extension: stream.mimeType.split('/')[1] || 'mp3',
                filesize: stream.contentLength,
                hasVideo: false,
                hasAudio: true,
                bitrate: stream.bitrate,
                codec: stream.codec,
                resolutionCategory: 'other',
            });
        });

        // Video streams
        data.videoStreams.forEach(stream => {
            if (!stream.videoOnly) { // Combined streams preferred
                formats.push({
                    formatId: `video-${stream.quality}-${stream.format}`,
                    quality: stream.quality,
                    extension: stream.format,
                    filesize: stream.contentLength,
                    hasVideo: true,
                    hasAudio: true,
                    bitrate: stream.bitrate,
                    codec: stream.codec,
                    resolutionCategory: this.getResolutionCategory(stream.quality),
                });
            }
        });

        return formats;
    }

    private findStreamUrl(data: PipedResponse, format: VideoFormat, options: DownloadOptions): string | undefined {
        if (options.audioOnly) {
            // Find audio stream
            const stream = data.audioStreams.find(s =>
                (s.mimeType.includes(format.extension) || format.extension === 'mp3') // Loose match
            );
            return stream?.url || data.audioStreams[0]?.url;
        }

        // Find video stream matching quality/extension
        const stream = data.videoStreams.find(s =>
            !s.videoOnly &&
            s.quality === format.quality &&
            s.format === format.extension
        );

        // Fallback to any combined stream
        if (!stream) {
            return data.videoStreams.find(s => !s.videoOnly)?.url;
        }

        return stream.url;
    }

    private selectFormat(formats: VideoFormat[], options: DownloadOptions): VideoFormat | undefined {
        if (options.audioOnly) {
            return formats.find(f => f.hasAudio && !f.hasVideo);
        }

        if (options.formatId && options.formatId !== 'best') {
            const specific = formats.find(f => f.formatId === options.formatId);
            if (specific) return specific;
        }

        // Default to best video
        return formats
            .filter(f => f.hasVideo)
            .sort((a, b) => b.filesize - a.filesize)[0];
    }

    private extractVideoId(url: string): string | null {
        const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/);
        return match ? match[1] : null;
    }

    private getResolutionCategory(quality: string): VideoFormat['resolutionCategory'] {
        if (quality.includes('4K') || quality.includes('2160')) return '4K';
        if (quality.includes('1080')) return '1080p';
        if (quality.includes('720')) return '720p';
        if (quality.includes('480')) return '480p';
        if (quality.includes('360')) return '360p';
        return 'other';
    }

    /**
     * Get healthy instances
     */
    private getHealthyInstances(): string[] {
        return PIPED_INSTANCES;
    }

    private sanitizeFilename(name: string): string {
        return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    }

    /**
     * Download file from URL (Implemented from InvidiousProvider pattern)
     */
    private async downloadFile(
        url: string,
        sessionId: string,
        filename: string,
        onProgress?: (progress: DownloadProgress) => void,
    ): Promise<DownloadResult> {
        try {
            const sessionDir = await this.fileManager.createSessionDir(sessionId);
            // Dynamic import to avoid path issues if needed, but path is standard
            const path = await import('path');
            const filePath = path.join(sessionDir, filename);

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

            // Note: node-fetch bodies are Node streams
            const body = response.body;

            if (!body) {
                throw new Error('No response body');
            }

            const fs = await import('fs');
            const fileStream = fs.createWriteStream(filePath);

            let downloadedBytes = 0;
            let lastProgressUpdate = 0;

            return new Promise((resolve, reject) => {
                body.on('data', (chunk: Buffer) => {
                    downloadedBytes += chunk.length;

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
                });

                body.pipe(fileStream);

                body.on('error', (err) => {
                    this.cleanupAbortController(sessionId);
                    reject(err);
                });

                fileStream.on('finish', () => {
                    this.cleanupAbortController(sessionId);
                    logger.info(`[${this.name}] Download successful`, { filePath, sessionId });
                    resolve({
                        success: true,
                        filePath,
                        filename,
                        filesize: downloadedBytes,
                        provider: this.name,
                    });
                });

                fileStream.on('error', (err) => {
                    this.cleanupAbortController(sessionId);
                    reject(err);
                });
            });

        } catch (error) {
            this.cleanupAbortController(sessionId);
            const err = error as Error;

            if (err.name === 'AbortError') {
                return { success: false, error: 'Download cancelled', provider: this.name };
            }

            return { success: false, error: err.message, provider: this.name };
        }
    }
}
