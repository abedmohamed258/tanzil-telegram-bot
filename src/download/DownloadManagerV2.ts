/**
 * DownloadManager - Backward Compatible Wrapper
 * 
 * This file maintains compatibility with existing code while using the new
 * DownloadOrchestrator internally. This allows gradual migration.
 * 
 * @deprecated Use DownloadOrchestrator directly for new code
 */

import { DownloadOrchestrator } from './core/DownloadOrchestrator';
import { FileManager } from '../utils/FileManager';
import { VideoInfo as NewVideoInfo, VideoFormat } from './core/types';

// Re-export types for compatibility
export { VideoInfo, Format, DownloadResult } from '../types';

// Import old types
import { VideoInfo, Format, DownloadResult } from '../types';

/**
 * DownloadManager - Legacy API wrapper around DownloadOrchestrator
 * @deprecated Use DownloadOrchestrator for new implementations
 */
export class DownloadManager {
    private orchestrator: DownloadOrchestrator;

    constructor(
        fileManager: FileManager,
        _maxRetries: number = 2,
        _timeout: number = 180000,
    ) {
        this.orchestrator = new DownloadOrchestrator(fileManager);
    }

    /**
     * Get the underlying orchestrator for direct access to new features
     */
    getOrchestrator(): DownloadOrchestrator {
        return this.orchestrator;
    }

    /**
     * Get video information using the new provider system
     */
    async getVideoInfo(url: string, _cookies?: string): Promise<VideoInfo> {
        const newInfo = await this.orchestrator.getVideoInfo(url, { cookies: _cookies });
        return this.convertVideoInfo(newInfo);
    }

    /**
     * Get playlist information
     * Note: Playlist functionality uses yt-dlp directly via the new YtDlpProvider
     */
    async getPlaylistInfo(
        url: string,
        cookies?: string,
    ): Promise<{
        title: string;
        videoCount: number;
        videos: { title: string; url: string; index: number }[];
    }> {
        // For playlists, we need to use yt-dlp directly
        // The YtDlpProvider handles this internally
        const { spawn } = await import('child_process');

        return new Promise((resolve, reject) => {
            const args = [
                '--dump-json',
                '--flat-playlist',
                url,
            ];

            if (cookies) {
                args.push('--cookies', cookies);
            }

            let output = '';
            let errorOutput = '';

            const proc = spawn('yt-dlp', args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            proc.stdout.on('data', (data) => output += data.toString());
            proc.stderr.on('data', (data) => errorOutput += data.toString());

            proc.on('close', (code) => {
                if (code === 0) {
                    const lines = output.trim().split('\n');
                    const videos: { title: string; url: string; index: number }[] = [];
                    let playlistTitle = 'Unknown Playlist';

                    lines.forEach((line, index) => {
                        try {
                            const data = JSON.parse(line);
                            if (data._type === 'playlist') {
                                playlistTitle = data.title;
                            } else {
                                videos.push({
                                    title: data.title,
                                    url: data.url,
                                    index: index + 1,
                                });
                            }
                        } catch {
                            // Ignore invalid lines
                        }
                    });

                    resolve({
                        title: playlistTitle,
                        videoCount: videos.length,
                        videos,
                    });
                } else {
                    reject(new Error(errorOutput || `yt-dlp exited with code ${code}`));
                }
            });

            proc.on('error', reject);
        });
    }

    /**
     * Download video with specified format
     */
    async downloadVideo(
        url: string,
        formatId: string,
        sessionId: string,
        userId?: number,
        cookies?: string,
        onProgress?: (percentage: number) => void,
    ): Promise<DownloadResult> {
        const result = await this.orchestrator.downloadVideo(
            url,
            formatId,
            sessionId,
            userId || 0,
            0, // chatId not needed for legacy API
            { cookies },
            onProgress ? (progress) => onProgress(progress.percentage) : undefined,
        );

        return {
            success: result.success,
            filePath: result.filePath,
            error: result.error,
        };
    }

    /**
     * Download audio only
     */
    async downloadAudio(
        url: string,
        sessionId: string,
        userId?: number,
        cookies?: string,
    ): Promise<DownloadResult> {
        const result = await this.orchestrator.downloadAudio(
            url,
            sessionId,
            userId || 0,
            0,
            { cookies },
        );

        return {
            success: result.success,
            filePath: result.filePath,
            error: result.error,
        };
    }

    /**
     * Download from direct Cobalt URL
     */
    async downloadFromCobalt(
        cobaltUrl: string,
        sessionId: string,
        filename: string = 'download.mp4',
    ): Promise<DownloadResult> {
        const result = await this.orchestrator.downloadFromUrl(cobaltUrl, sessionId, filename);
        return {
            success: result.success,
            filePath: result.filePath,
            error: result.error,
        };
    }

    /**
     * Cancel a download
     */
    async cancelDownload(sessionId: string): Promise<void> {
        await this.orchestrator.cancelDownload(sessionId);
    }

    /**
     * Cancel all downloads for a user
     */
    async cancelUserDownloads(userId: number): Promise<void> {
        await this.orchestrator.cancelUserDownloads(userId);
    }

    /**
     * Get video URL from playlist
     */
    async getVideoUrlFromPlaylist(
        playlistUrl: string,
        index: number,
    ): Promise<string | null> {
        const { spawn } = await import('child_process');

        return new Promise((resolve) => {
            const args = [
                '--dump-json',
                '--playlist-items', index.toString(),
                '--no-playlist',
                playlistUrl,
            ];

            let output = '';
            const proc = spawn('yt-dlp', args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            proc.stdout.on('data', (data) => output += data.toString());

            proc.on('close', (code) => {
                if (code === 0) {
                    try {
                        const data = JSON.parse(output);
                        resolve(data.webpage_url || data.url || null);
                    } catch {
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });

            proc.on('error', () => resolve(null));
        });
    }

    /**
     * Kill all active downloads
     */
    async killAllActiveDownloads(): Promise<void> {
        await this.orchestrator.killAll();
    }

    /**
     * Kill all downloads synchronously (for shutdown)
     */
    killAllActiveDownloadsSync(): void {
        // Can't be truly sync with the new system, but we try
        this.orchestrator.killAll().catch(() => { });
    }

    /**
     * Convert new VideoInfo to legacy format
     */
    private convertVideoInfo(newInfo: NewVideoInfo): VideoInfo {
        const formats: Format[] = newInfo.formats.map((f: VideoFormat) => ({
            formatId: f.formatId,
            quality: f.quality,
            extension: f.extension,
            filesize: f.filesize,
            hasVideo: f.hasVideo,
            hasAudio: f.hasAudio,
            bitrate: f.bitrate,
            fps: f.fps,
            codec: f.codec,
            resolutionCategory: f.resolutionCategory,
        }));

        return {
            title: newInfo.title,
            duration: newInfo.duration,
            thumbnail: newInfo.thumbnail,
            uploader: newInfo.uploader,
            formats,
            cobaltUrl: newInfo.directUrl,
        };
    }
}
