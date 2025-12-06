import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { z } from 'zod';
import {
  VideoInfo,
  Format,
  DownloadResult,
  YtDlpFormat,
  YtDlpVideoInfo,
  YtDlpPlaylistEntry,
} from '../types';
import { logger } from '../utils/logger';
import { FileManager } from '../utils/FileManager';
import { retryWithBackoff } from '../utils/retryHelper';

// Zod Schema for URL Validation
const UrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      // Basic check to prevent obviously bad inputs or command injection attempts (though spawn is safe)
      return !url.includes(';') && !url.includes('|') && !url.includes('&&');
    },
    { message: 'Invalid URL format or potential injection attempt' },
  );

/**
 * DownloadManager - Manages video downloads using yt-dlp as external process
 * Implements "God-Mode" robustness: Zod validation, strict typing, memory safety.
 */
export class DownloadManager {
  private readonly fileManager: FileManager;
  private readonly maxRetries: number;
  private readonly timeout: number;
  // Map to track active downloads for cancellation
  private activeDownloads: Map<
    string,
    { process: ChildProcess; userId?: number }
  > = new Map();

  constructor(
    fileManager: FileManager,
    maxRetries: number = 2,
    timeout: number = 180000, // 3 minutes instead of 10
  ) {
    this.fileManager = fileManager;
    this.maxRetries = maxRetries;
    this.timeout = timeout;
  }

  // Info Cache (30 minutes for better reuse)
  private infoCache = new Map<string, { data: VideoInfo; expires: number }>();

  /**
   * Categorizes video resolution for grouping in quality menu
   * @param height - Video height in pixels
   * @returns Resolution category string
   */
  private getResolutionCategory(height?: number): string {
    if (!height) return 'Other';
    if (height >= 2160) return '4K';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    return 'Other';
  }

  /**
   * Get video information using yt-dlp
   */
  async getVideoInfo(url: string, cookies?: string): Promise<VideoInfo> {
    // 1. Validate Input
    const validUrl = UrlSchema.parse(url);

    // 2. Check Cache
    const cached = this.infoCache.get(validUrl);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    logger.info('🔍 Fetching video info', { url: validUrl });

    const args = [
      '--dump-json',
      '--no-playlist',
      '--force-ipv4',
      '--no-warnings',
      '--socket-timeout',
      '3',
      '--skip-download',
      validUrl,
    ];

    if (cookies) {
      args.push('--cookies', cookies);
    }

    try {
      // Use retry logic for network operations (2 attempts, 500ms delay)
      const output = await retryWithBackoff(
        () => this.executeYtDlp(args),
        2,
        200,
        'getVideoInfo',
      );
      const data: YtDlpVideoInfo = JSON.parse(output);

      // 3. Extract and Clean Formats with enhanced metadata
      const allFormats: Format[] = (data.formats || [])
        .filter(
          (f: YtDlpFormat) =>
            (f.filesize || f.filesize_approx) &&
            (f.vcodec !== 'none' || f.acodec !== 'none'),
        )
        .map((f: YtDlpFormat) => {
          let qualityLabel = 'Unknown';
          if (f.height) {
            qualityLabel = `${f.height}p`;
          } else if (f.format_note && !f.format_note.includes('url')) {
            qualityLabel = f.format_note;
          } else if (f.quality) {
            qualityLabel = String(f.quality);
          }

          // Determine resolution category for grouping
          const resolutionCategory = this.getResolutionCategory(f.height);

          // Extract bitrate for audio formats (in kbps)
          const bitrate =
            f.abr ||
            f.tbr ||
            (f.acodec !== 'none'
              ? Math.round((f.filesize || 0) / (data.duration || 1) / 125)
              : undefined);

          return {
            formatId: f.format_id,
            quality: qualityLabel,
            extension: f.ext,
            filesize: f.filesize || f.filesize_approx || 0,
            hasVideo: f.vcodec !== 'none',
            hasAudio: f.acodec !== 'none',
            // Enhanced fields
            bitrate: bitrate,
            fps: f.fps,
            codec: f.vcodec !== 'none' ? f.vcodec : f.acodec,
            resolutionCategory: resolutionCategory,
          };
        });

      // 4. Deduplication Logic
      const uniqueFormats = new Map<string, Format>();
      allFormats.forEach((format) => {
        const existing = uniqueFormats.get(format.quality);
        if (
          !existing ||
          (format.extension === 'mp4' && existing.extension !== 'mp4')
        ) {
          uniqueFormats.set(format.quality, format);
        }
      });

      const cleanFormats = Array.from(uniqueFormats.values()).sort(
        (a, b) => a.filesize - b.filesize,
      );

      const result: VideoInfo = {
        title: data.title || 'Unknown',
        duration: data.duration || 0,
        thumbnail: data.thumbnail || '',
        uploader: data.uploader || 'Unknown',
        formats: cleanFormats,
      };

      // Save to Cache
      this.infoCache.set(validUrl, {
        data: result,
        expires: Date.now() + 1800000, // 30 minutes for better reuse
      });

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get video info', {
        url: validUrl,
        error: errorMessage,
      });
      throw new Error(`فشل الحصول على معلومات الفيديو: ${errorMessage}`);
    }
  }

  /**
   * Get playlist information without downloading
   */
  async getPlaylistInfo(
    url: string,
    cookies?: string,
  ): Promise<{
    title: string;
    videoCount: number;
    videos: { title: string; url: string; index: number }[];
  }> {
    const validUrl = UrlSchema.parse(url);
    logger.info('🔍 Fetching playlist info', { url: validUrl });

    const args = ['--dump-json', '--flat-playlist', validUrl];

    if (cookies) {
      args.push('--cookies', cookies);
    }

    try {
      const output = await this.executeYtDlp(args);
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
              url: data.url,
              index: index + 1,
            });
          }
        } catch (e) {
          /* Ignore invalid lines */
        }
      });

      return {
        title: playlistTitle,
        videoCount: videos.length,
        videos,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get playlist info', {
        url: validUrl,
        error: errorMessage,
      });
      throw new Error(`فشل الحصول على معلومات القائمة: ${errorMessage}`);
    }
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
    const validUrl = UrlSchema.parse(url);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info('⬇️ Download attempt', {
          attempt,
          maxRetries: this.maxRetries,
          sessionId,
        });

        const sessionDir = await this.fileManager.createSessionDir(sessionId);
        const outputTemplate = path.join(sessionDir, '%(title)s.%(ext)s');

        const args = [
          '-f',
          `${formatId}+bestaudio/best`,
          '-o',
          outputTemplate,
          '--no-playlist',
          '--merge-output-format',
          'mp4',
          '--external-downloader',
          'aria2c',
          '--external-downloader-args',
          'aria2c:-x 16 -s 16 -k 1M -j 16 --min-split-size=1M',
          '--no-mtime',
          '--force-ipv4',
          '--no-warnings',
          '--socket-timeout',
          '5',
          '--concurrent-fragments',
          '8',
          validUrl,
        ];

        if (cookies) {
          args.push('--cookies', cookies);
        }

        await this.executeYtDlp(
          args,
          sessionId,
          userId,
          this.timeout,
          onProgress,
        );

        const files = await import('fs/promises').then((fs) =>
          fs.readdir(sessionDir),
        );
        if (files.length === 0) {
          throw new Error('لم يتم العثور على الملف المحمل');
        }

        const filePath = path.join(sessionDir, files[0]);
        logger.info('✅ Download successful', { filePath, sessionId });

        // Force GC after heavy operation
        if (global.gc) {
          global.gc();
        }

        return { success: true, filePath };
      } catch (error: unknown) {
        const err = error as Error & { killed?: boolean };
        if (
          err.killed ||
          (err.message && err.message.includes('Process killed by user'))
        ) {
          logger.info('Download cancelled by user', { sessionId });
          return { success: false, error: 'تم إلغاء التحميل بواسطة المستخدم' };
        }

        lastError = err;
        logger.warn(`Download attempt ${attempt} failed`, {
          error: err.message,
          sessionId,
        });

        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      } finally {
        this.activeDownloads.delete(sessionId);
      }
    }

    return {
      success: false,
      error: lastError?.message || 'فشل التحميل بعد عدة محاولات',
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
    const validUrl = UrlSchema.parse(url);

    try {
      const sessionDir = await this.fileManager.createSessionDir(sessionId);
      const outputTemplate = path.join(sessionDir, '%(title)s.%(ext)s');

      const args = [
        '-x',
        '--audio-format',
        'mp3',
        '-o',
        outputTemplate,
        '--no-playlist',
        validUrl,
      ];

      if (cookies) {
        args.push('--cookies', cookies);
      }

      await this.executeYtDlp(args, sessionId, userId, this.timeout);

      const files = await import('fs/promises').then((fs) =>
        fs.readdir(sessionDir),
      );
      if (files.length === 0) {
        throw new Error('لم يتم العثور على الملف الصوتي');
      }

      const filePath = path.join(sessionDir, files[0]);
      logger.info('✅ Audio download successful', { filePath, sessionId });

      return { success: true, filePath };
    } catch (error: unknown) {
      const err = error as Error & { killed?: boolean };
      if (
        err.killed ||
        (err.message && err.message.includes('Process killed by user'))
      ) {
        logger.info('Audio download cancelled by user', { sessionId });
        return { success: false, error: 'تم إلغاء التحميل بواسطة المستخدم' };
      }

      logger.error('Audio download failed', { sessionId, error: err.message });
      return { success: false, error: err.message };
    } finally {
      this.activeDownloads.delete(sessionId);
    }
  }

  /**
   * Execute yt-dlp as external process
   */
  private executeYtDlp(
    args: string[],
    sessionId?: string,
    userId?: number,
    timeout?: number,
    onProgress?: (percentage: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';

      const process = spawn('yt-dlp', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

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
            const err = new Error('Process killed by user');
            (err as any).killed = true;
            reject(err);
          } else {
            reject(new Error(errorOutput || `yt-dlp exited with code ${code}`));
          }
        }
      });

      process.on('error', (error) => {
        reject(error);
      });

      if (timeout) {
        const timer = setTimeout(() => {
          process.kill();
          const err = new Error('تجاوز المهلة الزمنية للتحميل (3 دقائق)');
          (err as any).killed = true;
          reject(err);
        }, timeout);

        process.on('close', () => clearTimeout(timer));
      }
    });
  }

  async cancelDownload(sessionId: string): Promise<void> {
    try {
      const active = this.activeDownloads.get(sessionId);
      if (active) {
        logger.info('🛑 Cancelling download request', { sessionId });
        active.process.kill('SIGKILL');
        this.activeDownloads.delete(sessionId);
      }
    } catch (error) {
      logger.error('Failed to cancel download', { sessionId, error });
    }
  }

  async cancelUserDownloads(userId: number): Promise<void> {
    logger.info('🛑 Cancelling all downloads for user', { userId });
    for (const [sessionId, active] of this.activeDownloads.entries()) {
      if (active.userId === userId) {
        try {
          active.process.kill('SIGKILL');
          this.activeDownloads.delete(sessionId);
          logger.info('Cancelled download for user', { sessionId, userId });
        } catch (error) {
          logger.error('Failed to cancel user download', {
            sessionId,
            userId,
            error,
          });
        }
      }
    }
  }

  async getVideoUrlFromPlaylist(
    playlistUrl: string,
    index: number,
  ): Promise<string | null> {
    const validUrl = UrlSchema.parse(playlistUrl);
    const args = [
      '--dump-json',
      '--playlist-items',
      index.toString(),
      '--no-playlist', // We want the video info, not playlist metadata
      validUrl,
    ];

    try {
      const output = await this.executeYtDlp(args);
      const data = JSON.parse(output);
      return data.webpage_url || data.url || null;
    } catch (error) {
      logger.error('Failed to get video URL from playlist', {
        playlistUrl,
        index,
        error,
      });
      return null;
    }
  }

  async killAllActiveDownloads(): Promise<void> {
    const activeCount = this.activeDownloads.size;
    if (activeCount > 0) {
      logger.warn(`Killing ${activeCount} active downloads during shutdown`);
      for (const [sessionId, active] of this.activeDownloads.entries()) {
        try {
          active.process.kill('SIGKILL');
        } catch (error) {
          logger.error('Failed to kill process', { sessionId, error });
        }
      }
      this.activeDownloads.clear();
    }
  }

  killAllActiveDownloadsSync(): void {
    const activeCount = this.activeDownloads.size;
    if (activeCount > 0) {
      // JUSTIFICATION: console.error is required here because:
      // 1. This is an emergency synchronous cleanup called during process exit
      // 2. Logger may already be shut down or unavailable
      // 3. We need immediate console output for debugging critical shutdown issues
      console.error(
        `🚨 EMERGENCY: Killing ${activeCount} active downloads synchronously`,
      );
      for (const [sessionId, active] of this.activeDownloads.entries()) {
        try {
          active.process.kill('SIGKILL');
        } catch (error) {
          // JUSTIFICATION: console.error is appropriate in emergency sync cleanup
          console.error(`Failed to kill process ${sessionId}:`, error);
        }
      }
      this.activeDownloads.clear();
    }
  }
}
