import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { VideoInfo, Format, DownloadResult, YtDlpFormat, YtDlpVideoInfo, YtDlpPlaylistEntry } from '../types';
import { logger } from '../utils/logger';
import { FileManager } from '../utils/fileManager';

/**
 * DownloadManager - Manages video downloads using yt-dlp as external process
 * Implements download logic from design.md with retry mechanism
 */
export class DownloadManager {
    private readonly fileManager: FileManager;
    private readonly maxRetries: number;
    private readonly timeout: number;
    // Map to track active downloads for cancellation (Updated to store userId)
    private activeDownloads: Map<string, { process: ChildProcess; userId?: number }> = new Map();

    constructor(
        fileManager: FileManager,
        maxRetries: number = 3,
        timeout: number = 600000 // 10 minutes
    ) {
        this.fileManager = fileManager;
        this.maxRetries = maxRetries;
        this.timeout = timeout;
    }

    /**
     * Get video information using yt-dlp
     * Fixed: Dedup licenses qualities
     */
    async getVideoInfo(url: string, cookies?: string): Promise<VideoInfo> {
        logger.info('🔍 Fetching video info', { url });

        const args = [
            '--dump-json',
            '--no-playlist',
            url
        ];

        if (cookies) {
            args.push('--cookies', cookies);
        }

        try {
            const output = await this.executeYtDlp(args);
            const data: YtDlpVideoInfo = JSON.parse(output);

            // 1. Extract all formats
            // 1. Extract all formats
            const allFormats: Format[] = (data.formats || [])
                .filter((f: YtDlpFormat) => (f.filesize || f.filesize_approx) && (f.vcodec !== 'none' || f.acodec !== 'none'))
                .map((f: YtDlpFormat) => {
                    // Smart Quality Labeling
                    let qualityLabel = 'Unknown';
                    if (f.height) {
                        qualityLabel = `${f.height}p`;
                    } else if (f.format_note && !f.format_note.includes('url')) {
                        qualityLabel = f.format_note;
                    } else if (f.quality) {
                        qualityLabel = String(f.quality);
                    }

                    return {
                        formatId: f.format_id,
                        quality: qualityLabel,
                        extension: f.ext,
                        filesize: f.filesize || f.filesize_approx || 0,
                        hasVideo: f.vcodec !== 'none',
                        hasAudio: f.acodec !== 'none'
                    };
                });

            // 2. Deduplication Logic
            const uniqueFormats = new Map<string, Format>();

            allFormats.forEach(format => {
                // Use quality name as key (e.g., "720p")
                // If quality doesn't exist, or if we find an MP4 file (prefer it over others), update
                const existing = uniqueFormats.get(format.quality);
                if (!existing || (format.extension === 'mp4' && existing.extension !== 'mp4')) {
                    uniqueFormats.set(format.quality, format);
                }
            });

            // Convert Map to Array and sort
            const cleanFormats = Array.from(uniqueFormats.values())
                .sort((a, b) => a.filesize - b.filesize); // Sort by size

            return {
                title: data.title || 'Unknown',
                duration: data.duration || 0,
                thumbnail: data.thumbnail || '',
                uploader: data.uploader || 'Unknown',
                formats: cleanFormats
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to get video info', { url, error: errorMessage });
            throw new Error(`فشل الحصول على معلومات الفيديو: ${errorMessage}`);
        }
    }

    /**
     * Get playlist information without downloading
     * Uses --flat-playlist to get metadata quickly
     */
    async getPlaylistInfo(url: string, cookies?: string): Promise<{ title: string; videoCount: number; videos: { title: string; url: string; index: number }[] }> {
        logger.info('🔍 Fetching playlist info', { url });

        const args = [
            '--dump-json',
            '--flat-playlist',
            url
        ];

        if (cookies) {
            args.push('--cookies', cookies);
        }

        try {
            const output = await this.executeYtDlp(args);
            // Output might be multiple JSON objects (one per line) or a single one
            const lines = output.trim().split('\n');
            const videos: { title: string; url: string; index: number }[] = [];
            let playlistTitle = 'Unknown Playlist';

            lines.forEach((line, index) => {
                try {
                    const data: YtDlpPlaylistEntry = JSON.parse(line);
                    if (data._type === 'playlist') {
                        playlistTitle = data.title;
                    } else {
                        videos.push({
                            title: data.title,
                            url: data.url, // Note: might be ID only depending on extractor
                            index: index + 1
                        });
                    }
                } catch (e) { /* Ignore invalid lines */ }
            });

            return {
                title: playlistTitle,
                videoCount: videos.length,
                videos
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to get playlist info', { url, error: errorMessage });
            throw new Error(`فشل الحصول على معلومات القائمة: ${errorMessage}`);
        }
    }

    /**
     * List available formats for a video
     */
    async listFormats(url: string): Promise<Format[]> {
        const info = await this.getVideoInfo(url);
        return info.formats;
    }

    /**
     * Cancel a download request
     */
    async cancelDownload(sessionId: string): Promise<void> {
        const active = this.activeDownloads.get(sessionId);
        if (active) {
            logger.info('🛑 Cancelling download request', { sessionId });
            active.process.kill('SIGKILL');
            this.activeDownloads.delete(sessionId);
        }
    }

    /**
     * Cancel all active downloads for a specific user
     * Used for Hard Ban
     */
    async cancelUserDownloads(userId: number): Promise<void> {
        let count = 0;
        for (const [sessionId, active] of this.activeDownloads.entries()) {
            if (active.userId === userId) {
                logger.info('🛑 Hard Ban: Killing download', { sessionId, userId });
                active.process.kill('SIGKILL');
                this.activeDownloads.delete(sessionId);
                count++;
            }
        }
        if (count > 0) {
            logger.info('🛑 Hard Ban: Cancelled user downloads', { userId, count });
        }
    }

    /**
     * Get direct video URL from playlist index
     */
    async getVideoUrlFromPlaylist(playlistUrl: string, index: number): Promise<string> {
        const args = [
            '--get-url',
            '--playlist-items', index.toString(),
            '--no-playlist',
            playlistUrl
        ];

        try {
            const output = await this.executeYtDlp(args);
            return output.trim();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to get video URL from playlist', { playlistUrl, index, error: errorMessage });
            throw new Error(`فشل الحصول على رابط الفيديو رقم ${index}`);
        }
    }

    /**
     * Download video with specified format
     * Implements Property 15: Retry Logic Consistency (3 retries)
     */
    async downloadVideo(
        url: string,
        formatId: string,
        sessionId: string,
        userId?: number, // Added userId
        cookies?: string,
        onProgress?: (percentage: number) => void
    ): Promise<DownloadResult> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                logger.info('⬇️ Download attempt', { attempt, maxRetries: this.maxRetries, sessionId });

                const sessionDir = await this.fileManager.createSessionDir(sessionId);
                const outputTemplate = path.join(sessionDir, '%(title)s.%(ext)s');

                const args = [
                    '-f', `${formatId}+bestaudio/best`,
                    '-o', outputTemplate,
                    '--no-playlist',
                    '--merge-output-format', 'mp4',
                    url
                ];

                if (cookies) {
                    args.push('--cookies', cookies);
                }

                logger.info('🚀 Executing yt-dlp', { args: args.join(' '), sessionId });

                await this.executeYtDlp(args, sessionId, userId, this.timeout, onProgress);

                // Find the downloaded file
                const files = await import('fs/promises').then(fs => fs.readdir(sessionDir));
                if (files.length === 0) {
                    throw new Error('لم يتم العثور على الملف المحمل');
                }

                const filePath = path.join(sessionDir, files[0]);
                logger.info('✅ Download successful', { filePath, sessionId });

                return {
                    success: true,
                    filePath
                };
            } catch (error: unknown) {
                const err = error as Error & { killed?: boolean };
                // Check if cancelled
                if (err.killed || (err.message && err.message.includes('Process killed by user'))) {
                    logger.info('Download cancelled by user', { sessionId });
                    return { success: false, error: 'تم إلغاء التحميل بواسطة المستخدم' };
                }

                lastError = err;
                logger.warn(`Download attempt ${attempt} failed`, {
                    error: err.message,
                    sessionId,
                    willRetry: attempt < this.maxRetries
                });

                if (attempt < this.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                }
            } finally {
                this.activeDownloads.delete(sessionId);
            }
        }

        logger.error('Download failed after all retries', {
            sessionId,
            error: lastError?.message
        });

        return {
            success: false,
            error: lastError?.message || 'فشل التحميل بعد عدة محاولات'
        };
    }

    /**
     * Download audio only
     * Property 8: Audio Format Validation
     */
    async downloadAudio(
        url: string,
        sessionId: string,
        userId?: number, // Added userId
        cookies?: string
    ): Promise<DownloadResult> {
        try {
            const sessionDir = await this.fileManager.createSessionDir(sessionId);
            const outputTemplate = path.join(sessionDir, '%(title)s.%(ext)s');

            const args = [
                '-x', // Extract audio
                '--audio-format', 'mp3',
                '-o', outputTemplate,
                '--no-playlist',
                url
            ];

            if (cookies) {
                args.push('--cookies', cookies);
            }

            // Pass sessionId for tracking
            await this.executeYtDlp(args, sessionId, userId, this.timeout);

            // Find the downloaded file
            const files = await import('fs/promises').then(fs => fs.readdir(sessionDir));
            if (files.length === 0) {
                throw new Error('لم يتم العثور على الملف الصوتي');
            }

            const filePath = path.join(sessionDir, files[0]);
            logger.info('✅ Audio download successful', { filePath, sessionId });

            return {
                success: true,
                filePath
            };
        } catch (error: unknown) {
            const err = error as Error & { killed?: boolean };
            // Check if cancelled
            if (err.killed || (err.message && err.message.includes('Process killed by user'))) {
                logger.info('Audio download cancelled by user', { sessionId });
                return { success: false, error: 'تم إلغاء التحميل بواسطة المستخدم' };
            }

            logger.error('Audio download failed', { sessionId, error: err.message });
            return {
                success: false,
                error: err.message
            };
        } finally {
            this.activeDownloads.delete(sessionId);
        }
    }

    /**
     * Execute yt-dlp as external process
     * Note from design.md: yt-dlp must run as external process for better resource control
     */
    private executeYtDlp(
        args: string[],
        sessionId?: string,
        userId?: number,
        timeout?: number,
        onProgress?: (percentage: number) => void
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            let output = '';
            let errorOutput = '';

            const process = spawn('yt-dlp', args);

            if (sessionId) {
                this.activeDownloads.set(sessionId, { process, userId });
            }

            process.stdout.on('data', (data) => {
                const text = data.toString();
                output += text;

                if (onProgress) {
                    const match = text.match(/\[download\]\s+(\d+\.\d+)%/);
                    if (match && match[1]) {
                        onProgress(parseFloat(match[1]));
                    }
                }
            });

            process.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                // Log warnings or errors immediately for debugging
                if (text.includes('WARNING') || text.includes('ERROR')) {
                    logger.warn('yt-dlp stderr', { text: text.trim(), sessionId });
                }
            });

            process.on('close', (code) => {
                if (sessionId) this.activeDownloads.delete(sessionId);

                if (code === 0) {
                    resolve(output);
                } else {
                    if (process.killed) {
                        // If the process was explicitly killed (e.g., by cancelDownload)
                        const err = new Error('Process killed by user');
                        (err as any).killed = true; // Mark error as killed
                        reject(err);
                    } else {
                        reject(new Error(errorOutput || `yt-dlp exited with code ${code}`));
                    }
                }
            });

            process.on('error', (error) => {
                reject(error);
            });

            // Timeout handling
            if (timeout) {
                const timer = setTimeout(() => {
                    process.kill();
                    const err = new Error('تجاوز المهلة الزمنية للتحميل (10 دقائق)');
                    (err as any).killed = true; // Mark error as killed
                    reject(err);
                }, timeout);

                // Clear timeout if process closes before timeout
                process.on('close', () => clearTimeout(timer));
            }
        });
    }

    /**
     * Cleanup session files
     */
    async cleanup(sessionId: string): Promise<void> {
        await this.cancelDownload(sessionId);
        await this.fileManager.cleanupSession(sessionId);
    }

    /**
     * Emergency cleanup: Kill ALL active downloads
     * Used during bot shutdown to prevent orphaned processes
     */
    async killAllActiveDownloads(): Promise<void> {
        const activeCount = this.activeDownloads.size;
        if (activeCount > 0) {
            logger.warn(`Killing ${activeCount} active downloads during shutdown`);

            for (const [sessionId, active] of this.activeDownloads.entries()) {
                try {
                    active.process.kill('SIGKILL');
                    logger.debug('Killed download process', { sessionId, userId: active.userId });
                } catch (error) {
                    logger.error('Failed to kill process', { sessionId, error });
                }
            }

            this.activeDownloads.clear();
            logger.info('All download processes terminated');
        }
    }
}
