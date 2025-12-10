/**
 * DownloadOrchestrator - Main coordinator for the download system
 * Manages the complete lifecycle of downloads with events, progress, and error handling
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { FileManager } from '../../utils/FileManager';
import { ProviderManager } from './ProviderManager';
import {
    DownloadTask,
    DownloadState,
    DownloadProgress,
    DownloadResult,
    DownloadOptions,
    VideoInfo,
    DownloadEvent,
    DownloadEventHandler,
    ProviderStatus,
} from './types';

// Providers
import { YtDlpProvider, CobaltProvider, InvidiousProvider, SSYouTubeProvider, TikMateProvider } from '../providers';

export class DownloadOrchestrator extends EventEmitter {
    private readonly providerManager: ProviderManager;
    private readonly fileManager: FileManager;
    private readonly tasks = new Map<string, DownloadTask>();
    private readonly userTasks = new Map<number, Set<string>>();
    private eventHandlers: DownloadEventHandler[] = [];

    constructor(fileManager: FileManager) {
        super();
        this.fileManager = fileManager;
        this.providerManager = new ProviderManager();

        // Register default providers
        this.registerDefaultProviders();
    }

    /**
     * Register default providers
     * Order matters - higher priority providers are tried first
     */
    private registerDefaultProviders(): void {
        // YtDlp - Priority 1 (primary, supports 1000+ sites)
        this.providerManager.registerProvider(
            new YtDlpProvider(this.fileManager, {
                timeout: 180000,
                maxRetries: 2,
            }),
        );

        // Invidious - Priority 2 (YouTube fallback, privacy-focused)
        this.providerManager.registerProvider(
            new InvidiousProvider(this.fileManager, {
                timeout: 30000,
            }),
        );

        // Cobalt - Priority 3 (general fallback, multi-platform)
        this.providerManager.registerProvider(
            new CobaltProvider(this.fileManager, {
                timeout: 30000,
            }),
        );

        // SSYouTube - Priority 4 (YouTube specialist when yt-dlp fails)
        this.providerManager.registerProvider(
            new SSYouTubeProvider(this.fileManager, {
                timeout: 30000,
            }),
        );

        // TikMate - Priority 4 (TikTok no-watermark specialist)
        this.providerManager.registerProvider(
            new TikMateProvider(this.fileManager, {
                timeout: 30000,
            }),
        );

        logger.info('Download providers registered', {
            count: 5,
            providers: ['yt-dlp', 'invidious', 'cobalt', 'ssyoutube', 'tikmate'],
        });
    }

    /**
     * Get provider manager for advanced configuration
     */
    getProviderManager(): ProviderManager {
        return this.providerManager;
    }

    /**
     * Add event handler
     */
    onDownloadEvent(handler: DownloadEventHandler): void {
        this.eventHandlers.push(handler);
    }

    /**
     * Emit download event
     */
    private emitEvent(type: DownloadEvent['type'], taskId: string, data?: Record<string, unknown>): void {
        const event: DownloadEvent = {
            type,
            taskId,
            timestamp: new Date(),
            data,
        };

        this.emit(type, event);
        this.eventHandlers.forEach(handler => handler(event));
    }

    /**
     * Get video information
     */
    async getVideoInfo(url: string, options?: DownloadOptions): Promise<VideoInfo> {
        return this.providerManager.getVideoInfo(url, options);
    }

    /**
     * Create a new download task
     */
    createTask(
        url: string,
        userId: number,
        chatId: number,
        options: DownloadOptions = {},
    ): DownloadTask {
        const taskId = randomUUID();

        const task: DownloadTask = {
            id: taskId,
            url,
            userId,
            chatId,
            options,
            state: DownloadState.PENDING,
            progress: {
                sessionId: taskId,
                state: DownloadState.PENDING,
                percentage: 0,
                downloadedBytes: 0,
                totalBytes: 0,
                speed: 0,
                eta: 0,
            },
            createdAt: new Date(),
            retryCount: 0,
        };

        this.tasks.set(taskId, task);

        // Track user tasks
        let userTaskSet = this.userTasks.get(userId);
        if (!userTaskSet) {
            userTaskSet = new Set();
            this.userTasks.set(userId, userTaskSet);
        }
        userTaskSet.add(taskId);

        this.emitEvent('task:created', taskId, { url, userId, chatId });
        logger.info('Download task created', { taskId, url, userId });

        return task;
    }

    /**
     * Execute a download task
     */
    async executeTask(taskId: string): Promise<DownloadResult> {
        const task = this.tasks.get(taskId);
        if (!task) {
            return { success: false, error: 'Task not found' };
        }

        try {
            // Update state
            task.state = DownloadState.FETCHING_INFO;
            task.startedAt = new Date();
            this.emitEvent('task:started', taskId);

            // Get video info if not already available
            if (!task.videoInfo) {
                task.videoInfo = await this.providerManager.getVideoInfo(task.url, task.options);
            }

            // Update state to downloading
            task.state = DownloadState.DOWNLOADING;
            task.progress.state = DownloadState.DOWNLOADING;

            // Execute download with progress tracking
            const result = await this.providerManager.download(
                task.url,
                taskId,
                task.options,
                (progress) => {
                    task.progress = progress;
                    this.emitEvent('task:progress', taskId, { progress });
                },
                (from, to) => {
                    task.currentProvider = to;
                    this.emitEvent('provider:switched', taskId, { from, to });
                },
            );

            // Update task with result
            task.result = result;
            task.completedAt = new Date();

            if (result.success) {
                task.state = DownloadState.COMPLETED;
                task.progress.state = DownloadState.COMPLETED;
                task.progress.percentage = 100;
                this.emitEvent('task:completed', taskId, { result });
                logger.info('Download task completed', { taskId, filePath: result.filePath });
            } else {
                task.state = DownloadState.FAILED;
                task.progress.state = DownloadState.FAILED;
                this.emitEvent('task:failed', taskId, { error: result.error });
                logger.warn('Download task failed', { taskId, error: result.error });
            }

            return result;
        } catch (error) {
            const err = error as Error;
            task.state = DownloadState.FAILED;
            task.progress.state = DownloadState.FAILED;
            task.result = { success: false, error: err.message };
            task.completedAt = new Date();

            this.emitEvent('task:failed', taskId, { error: err.message });
            logger.error('Download task error', { taskId, error: err.message });

            return { success: false, error: err.message };
        }
    }

    /**
     * Download video (convenience method - creates and executes task)
     */
    async downloadVideo(
        url: string,
        formatId: string,
        sessionId: string,
        userId: number,
        chatId: number,
        options: DownloadOptions = {},
        onProgress?: (progress: DownloadProgress) => void,
    ): Promise<DownloadResult> {
        // Create task with existing sessionId
        const task: DownloadTask = {
            id: sessionId,
            url,
            userId,
            chatId,
            options: { ...options, formatId },
            state: DownloadState.PENDING,
            progress: {
                sessionId,
                state: DownloadState.PENDING,
                percentage: 0,
                downloadedBytes: 0,
                totalBytes: 0,
                speed: 0,
                eta: 0,
            },
            createdAt: new Date(),
            retryCount: 0,
        };

        this.tasks.set(sessionId, task);

        try {
            task.state = DownloadState.DOWNLOADING;
            task.startedAt = new Date();

            const result = await this.providerManager.download(
                url,
                sessionId,
                { ...options, formatId },
                (progress) => {
                    task.progress = progress;
                    if (onProgress) onProgress(progress);
                },
            );

            task.result = result;
            task.completedAt = new Date();
            task.state = result.success ? DownloadState.COMPLETED : DownloadState.FAILED;

            return result;
        } catch (error) {
            const err = error as Error;
            task.state = DownloadState.FAILED;
            task.result = { success: false, error: err.message };
            return { success: false, error: err.message };
        } finally {
            this.tasks.delete(sessionId);
        }
    }

    /**
     * Download audio
     */
    async downloadAudio(
        url: string,
        sessionId: string,
        userId: number,
        chatId: number,
        options: DownloadOptions = {},
    ): Promise<DownloadResult> {
        return this.downloadVideo(url, 'bestaudio', sessionId, userId, chatId, {
            ...options,
            audioOnly: true,
        });
    }

    /**
     * Download from direct URL (for Cobalt-provided URLs)
     */
    async downloadFromUrl(
        directUrl: string,
        sessionId: string,
        filename: string = 'download.mp4',
    ): Promise<DownloadResult> {
        try {
            const sessionDir = await this.fileManager.createSessionDir(sessionId);
            const path = await import('path');
            const filePath = path.join(sessionDir, filename);

            const response = await fetch(directUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const fs = await import('fs/promises');
            const buffer = Buffer.from(await response.arrayBuffer());
            await fs.writeFile(filePath, buffer);

            logger.info('Direct download successful', { filePath, sessionId });
            return { success: true, filePath, filename, filesize: buffer.length };
        } catch (error) {
            const err = error as Error;
            logger.error('Direct download failed', { sessionId, error: err.message });
            return { success: false, error: err.message };
        }
    }

    /**
     * Cancel a download
     */
    async cancelDownload(sessionId: string): Promise<void> {
        const task = this.tasks.get(sessionId);
        if (task) {
            task.state = DownloadState.CANCELLED;
            task.progress.state = DownloadState.CANCELLED;
            this.emitEvent('task:cancelled', sessionId);
        }

        await this.providerManager.cancelDownload(sessionId);
        this.tasks.delete(sessionId);

        logger.info('Download cancelled', { sessionId });
    }

    /**
     * Cancel all downloads for a user
     */
    async cancelUserDownloads(userId: number): Promise<void> {
        const userTaskSet = this.userTasks.get(userId);
        if (!userTaskSet) return;

        for (const taskId of userTaskSet) {
            await this.cancelDownload(taskId);
        }

        this.userTasks.delete(userId);
        logger.info('All downloads cancelled for user', { userId });
    }

    /**
     * Get task by ID
     */
    getTask(taskId: string): DownloadTask | undefined {
        return this.tasks.get(taskId);
    }

    /**
     * Get all tasks for a user
     */
    getUserTasks(userId: number): DownloadTask[] {
        const taskIds = this.userTasks.get(userId);
        if (!taskIds) return [];

        return Array.from(taskIds)
            .map(id => this.tasks.get(id))
            .filter((t): t is DownloadTask => t !== undefined);
    }

    /**
     * Get system health status
     */
    getHealth(): {
        status: ProviderStatus;
        providers: Record<string, { status: ProviderStatus; successRate: number }>;
        activeTasks: number;
    } {
        const systemHealth = this.providerManager.getSystemHealth();
        const providerHealth = this.providerManager.getHealthStatus();

        const providers: Record<string, { status: ProviderStatus; successRate: number }> = {};
        for (const [name, health] of Object.entries(providerHealth)) {
            providers[name] = {
                status: health.status,
                successRate: health.successRate,
            };
        }

        return {
            status: systemHealth.status,
            providers,
            activeTasks: this.tasks.size,
        };
    }

    /**
     * Kill all active downloads
     */
    async killAll(): Promise<void> {
        for (const taskId of this.tasks.keys()) {
            await this.cancelDownload(taskId);
        }
        this.tasks.clear();
        this.userTasks.clear();
        logger.warn('All downloads killed');
    }

    /**
     * Cleanup and shutdown
     */
    async shutdown(): Promise<void> {
        await this.killAll();
        this.providerManager.resetAll();
        this.removeAllListeners();
        logger.info('Download orchestrator shutdown complete');
    }
}
