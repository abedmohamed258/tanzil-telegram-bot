/**
 * YtDlpProvider - Download provider using yt-dlp
 * Primary provider for most platforms with full quality selection support
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { z } from 'zod';
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

// URL validation schema
const UrlSchema = z
    .string()
    .url()
    .refine(
        (url) => !url.includes(';') && !url.includes('|') && !url.includes('&&'),
        { message: 'Invalid URL format' },
    );

// yt-dlp format interface
interface YtDlpFormat {
    format_id: string;
    ext: string;
    height?: number;
    width?: number;
    filesize?: number;
    filesize_approx?: number;
    vcodec?: string;
    acodec?: string;
    abr?: number;
    tbr?: number;
    fps?: number;
    format_note?: string;
    quality?: number;
}

interface YtDlpVideoInfo {
    title: string;
    duration?: number;
    thumbnail?: string;
    uploader?: string;
    upload_date?: string;
    description?: string;
    view_count?: number;
    formats?: YtDlpFormat[];
    webpage_url?: string;
}

export class YtDlpProvider extends BaseProvider {
    readonly name = 'yt-dlp';
    readonly priority = 1;
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
        supportsVideoInfo: true,
        supportsDirectDownload: true,
        supportsAudioOnly: true,
        supportsQualitySelection: true,
        supportsProgress: true,
        supportsResume: false,
        maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
    };

    private readonly fileManager: FileManager;
    private readonly timeout: number;
    private readonly maxRetries: number;
    private activeProcesses = new Map<string, ChildProcess>();
    private infoCache = new Map<string, { data: VideoInfo; expires: number }>();

    constructor(
        fileManager: FileManager,
        options: { timeout?: number; maxRetries?: number } = {},
    ) {
        super();
        this.fileManager = fileManager;
        this.timeout = options.timeout || 180000; // 3 minutes
        this.maxRetries = options.maxRetries || 2;
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
     * Get video information
     */
    async getVideoInfo(url: string, options?: DownloadOptions): Promise<VideoInfo> {
        const validUrl = UrlSchema.parse(url);

        // Check cache
        const cached = this.infoCache.get(validUrl);
        if (cached && cached.expires > Date.now()) {
            return cached.data;
        }

        return this.executeWithTracking(async () => {
            const args = [
                '--dump-json',
                '--no-playlist',
                '--force-ipv4',
                '--no-warnings',
                '--socket-timeout', '5',
                '--skip-download',
                ...this.getYouTubeExtractorArgs(),
                validUrl,
            ];

            if (options?.cookies) {
                args.push('--cookies', options.cookies);
            }

            const output = await this.executeYtDlp(args, undefined, 30000);
            const data: YtDlpVideoInfo = JSON.parse(output);

            const formats = this.parseFormats(data.formats || [], data.duration);
            const platform = this.getPlatform(validUrl);

            const result: VideoInfo = {
                title: data.title || 'Unknown',
                duration: data.duration || 0,
                thumbnail: data.thumbnail || '',
                uploader: data.uploader || 'Unknown',
                uploadDate: data.upload_date,
                description: data.description,
                viewCount: data.view_count,
                platform,
                formats,
                provider: this.name,
            };

            // Cache for 30 minutes
            this.infoCache.set(validUrl, {
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
        const validUrl = UrlSchema.parse(url);
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                logger.info(`[${this.name}] Download attempt ${attempt}`, { sessionId });

                const sessionDir = await this.fileManager.createSessionDir(sessionId);
                const outputTemplate = path.join(sessionDir, '%(title)s.%(ext)s');

                const args = this.buildDownloadArgs(validUrl, outputTemplate, options);

                await this.executeYtDlp(
                    args,
                    sessionId,
                    this.timeout,
                    (percentage) => {
                        if (onProgress) {
                            onProgress({
                                sessionId,
                                state: DownloadState.DOWNLOADING,
                                percentage,
                                downloadedBytes: 0,
                                totalBytes: 0,
                                speed: 0,
                                eta: 0,
                            });
                        }
                    },
                );

                // Find downloaded file
                const fs = await import('fs/promises');
                const files = await fs.readdir(sessionDir);
                if (files.length === 0) {
                    throw new Error('Downloaded file not found');
                }

                const filePath = path.join(sessionDir, files[0]);
                const stats = await fs.stat(filePath);

                this.recordSuccess(Date.now());

                return {
                    success: true,
                    filePath,
                    filename: files[0],
                    filesize: stats.size,
                    provider: this.name,
                };
            } catch (error) {
                const err = error as Error & { killed?: boolean };

                if (err.killed || err.message?.includes('cancelled')) {
                    return { success: false, error: 'Download cancelled', provider: this.name };
                }

                lastError = err;
                logger.warn(`[${this.name}] Download attempt ${attempt} failed`, {
                    error: err.message,
                    sessionId,
                });

                if (attempt < this.maxRetries) {
                    await new Promise((r) => setTimeout(r, 1000 * attempt));
                }
            } finally {
                this.activeProcesses.delete(sessionId);
            }
        }

        this.recordFailure();
        return {
            success: false,
            error: lastError?.message || 'Download failed after retries',
            provider: this.name,
        };
    }

    /**
     * Cancel download
     */
    async cancelDownload(sessionId: string): Promise<void> {
        const process = this.activeProcesses.get(sessionId);
        if (process) {
            process.kill('SIGKILL');
            this.activeProcesses.delete(sessionId);
            logger.info(`[${this.name}] Download cancelled`, { sessionId });
        }
        await super.cancelDownload(sessionId);
    }

    /**
     * Kill all active downloads
     */
    async killAll(): Promise<void> {
        for (const [sessionId, proc] of this.activeProcesses) {
            try {
                proc.kill('SIGKILL');
            } catch {
                // Ignore
            }
            this.activeProcesses.delete(sessionId);
        }
    }

    /**
     * Parse yt-dlp formats into our format
     */
    private parseFormats(formats: YtDlpFormat[], duration?: number): VideoFormat[] {
        const allFormats: VideoFormat[] = formats
            .filter((f) =>
                (f.filesize || f.filesize_approx) &&
                (f.vcodec !== 'none' || f.acodec !== 'none')
            )
            .map((f) => {
                let quality = 'Unknown';
                if (f.height) {
                    quality = `${f.height}p`;
                } else if (f.format_note && !f.format_note.includes('url')) {
                    quality = f.format_note;
                } else if (f.quality) {
                    quality = String(f.quality);
                }

                const resolutionCategory = this.getResolutionCategory(f.height);
                const bitrate = f.abr || f.tbr ||
                    (f.acodec !== 'none' && duration
                        ? Math.round((f.filesize || 0) / duration / 125)
                        : undefined);

                return {
                    formatId: f.format_id,
                    quality,
                    extension: f.ext,
                    filesize: f.filesize || f.filesize_approx || 0,
                    hasVideo: f.vcodec !== 'none',
                    hasAudio: f.acodec !== 'none',
                    bitrate,
                    fps: f.fps,
                    codec: f.vcodec !== 'none' ? f.vcodec : f.acodec,
                    resolution: f.height ? `${f.width}x${f.height}` : undefined,
                    resolutionCategory,
                };
            });

        // Deduplicate by quality
        const uniqueFormats = new Map<string, VideoFormat>();
        allFormats.forEach((format) => {
            const existing = uniqueFormats.get(format.quality);
            if (!existing || (format.extension === 'mp4' && existing.extension !== 'mp4')) {
                uniqueFormats.set(format.quality, format);
            }
        });

        return Array.from(uniqueFormats.values()).sort((a, b) => a.filesize - b.filesize);
    }

    /**
     * Get resolution category
     */
    private getResolutionCategory(height?: number): VideoFormat['resolutionCategory'] {
        if (!height) return 'other';
        if (height >= 2160) return '4K';
        if (height >= 1080) return '1080p';
        if (height >= 720) return '720p';
        if (height >= 480) return '480p';
        if (height >= 360) return '360p';
        return 'other';
    }

    /**
     * Build download arguments
     */
    private buildDownloadArgs(
        url: string,
        outputTemplate: string,
        options: DownloadOptions,
    ): string[] {
        const args: string[] = [];

        if (options.audioOnly) {
            args.push('-x', '--audio-format', 'mp3');
        } else {
            args.push(
                '-f', `${options.formatId || 'best'}+bestaudio/best`,
                '--merge-output-format', 'mp4',
            );
        }

        args.push(
            '-o', outputTemplate,
            '--no-playlist',
            '--external-downloader', 'aria2c',
            '--external-downloader-args', 'aria2c:-x 16 -s 16 -k 1M -j 16 --min-split-size=1M',
            '--no-mtime',
            '--force-ipv4',
            '--no-warnings',
            '--socket-timeout', '5',
            '--concurrent-fragments', '8',
            ...this.getYouTubeExtractorArgs(),
            url,
        );

        if (options.cookies) {
            args.push('--cookies', options.cookies);
        }

        return args;
    }

    /**
     * Get YouTube extractor arguments for PO Token
     */
    private getYouTubeExtractorArgs(): string[] {
        if (process.env.NODE_ENV === 'production' || process.env.USE_POT_SERVER === 'true') {
            return [
                '--extractor-args',
                'youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416',
            ];
        }
        return [];
    }

    /**
     * Execute yt-dlp command
     */
    private executeYtDlp(
        args: string[],
        sessionId?: string,
        timeout?: number,
        onProgress?: (percentage: number) => void,
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            let output = '';
            let errorOutput = '';

            const proc = spawn('yt-dlp', args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            if (sessionId) {
                this.activeProcesses.set(sessionId, proc);
            }

            proc.stdout.on('data', (data: Buffer) => {
                const text = data.toString();
                output += text;

                if (onProgress) {
                    const match = text.match(/\[download\]\s+(\d+\.?\d*)%/);
                    if (match?.[1]) {
                        onProgress(parseFloat(match[1]));
                    }
                }
            });

            proc.stderr.on('data', (data: Buffer) => {
                errorOutput += data.toString();
            });

            proc.on('close', (code) => {
                if (sessionId) this.activeProcesses.delete(sessionId);

                if (code === 0) {
                    resolve(output);
                } else if (proc.killed) {
                    const err = new Error('Process cancelled');
                    (err as Error & { killed: boolean }).killed = true;
                    reject(err);
                } else {
                    reject(new Error(errorOutput || `yt-dlp exited with code ${code}`));
                }
            });

            proc.on('error', reject);

            if (timeout) {
                const timer = setTimeout(() => {
                    proc.kill('SIGKILL');
                    reject(new Error('Download timeout'));
                }, timeout);

                proc.on('close', () => clearTimeout(timer));
            }
        });
    }
}
