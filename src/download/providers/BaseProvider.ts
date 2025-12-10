/**
 * BaseProvider - Abstract base class for all download providers
 * Implements common functionality like health tracking and circuit breaker
 */

import { logger } from '../../utils/logger';
import {
    IDownloadProvider,
    ProviderHealth,
    ProviderStatus,
    ProviderCapabilities,
    VideoInfo,
    DownloadResult,
    DownloadOptions,
    DownloadProgress,
    Platform,
} from '../core/types';

// Circuit breaker configuration - tuned for resilience
const CIRCUIT_BREAKER_THRESHOLD = 8;    // failures before opening circuit (was 5)
const CIRCUIT_BREAKER_TIMEOUT = 120000; // 2 minute cooldown (was 1 min)
const HEALTH_WINDOW = 30;               // number of requests to track (was 20)

export abstract class BaseProvider implements IDownloadProvider {
    abstract readonly name: string;
    abstract readonly priority: number;
    abstract readonly supportedPlatforms: Platform[];
    abstract readonly capabilities: ProviderCapabilities;

    // Health tracking
    protected successCount = 0;
    protected failureCount = 0;
    protected totalResponseTime = 0;
    protected requestCount = 0;
    protected lastSuccess?: Date;
    protected lastFailure?: Date;
    protected circuitOpenedAt?: Date;

    // Active downloads
    protected activeDownloads = new Map<string, AbortController>();

    /**
     * Check if provider supports the given URL
     */
    abstract supports(url: string): boolean;

    /**
     * Get video information - must be implemented by subclass
     */
    abstract getVideoInfo(url: string, options?: DownloadOptions): Promise<VideoInfo>;

    /**
     * Download video/audio - must be implemented by subclass
     */
    abstract download(
        url: string,
        sessionId: string,
        options: DownloadOptions,
        onProgress?: (progress: DownloadProgress) => void,
    ): Promise<DownloadResult>;

    /**
     * Extract platform from URL
     */
    protected getPlatform(url: string): Platform {
        const hostname = new URL(url).hostname.toLowerCase();

        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            return Platform.YOUTUBE;
        }
        if (hostname.includes('instagram.com')) {
            return Platform.INSTAGRAM;
        }
        if (hostname.includes('tiktok.com')) {
            return Platform.TIKTOK;
        }
        if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            return Platform.TWITTER;
        }
        if (hostname.includes('facebook.com') || hostname.includes('fb.watch')) {
            return Platform.FACEBOOK;
        }
        if (hostname.includes('reddit.com')) {
            return Platform.REDDIT;
        }
        if (hostname.includes('vimeo.com')) {
            return Platform.VIMEO;
        }
        if (hostname.includes('twitch.tv')) {
            return Platform.TWITCH;
        }

        return Platform.UNKNOWN;
    }

    /**
     * Cancel an active download
     */
    async cancelDownload(sessionId: string): Promise<void> {
        const controller = this.activeDownloads.get(sessionId);
        if (controller) {
            controller.abort();
            this.activeDownloads.delete(sessionId);
            logger.info(`[${this.name}] Download cancelled`, { sessionId });
        }
    }

    /**
     * Get current health status
     */
    getHealth(): ProviderHealth {
        const isCircuitOpen = this.isCircuitOpen();
        const successRate = this.requestCount > 0
            ? this.successCount / this.requestCount
            : 1;
        const avgResponseTime = this.requestCount > 0
            ? this.totalResponseTime / this.requestCount
            : 0;

        let status: ProviderStatus;
        if (isCircuitOpen) {
            status = ProviderStatus.UNAVAILABLE;
        } else if (successRate < 0.5) {
            status = ProviderStatus.DEGRADED;
        } else {
            status = ProviderStatus.HEALTHY;
        }

        return {
            status,
            successRate,
            avgResponseTime,
            lastSuccess: this.lastSuccess,
            lastFailure: this.lastFailure,
            failureCount: this.failureCount,
            isCircuitOpen,
        };
    }

    /**
     * Check if circuit breaker is open
     */
    protected isCircuitOpen(): boolean {
        if (!this.circuitOpenedAt) return false;

        const elapsed = Date.now() - this.circuitOpenedAt.getTime();
        if (elapsed > CIRCUIT_BREAKER_TIMEOUT) {
            // Try to close circuit (half-open state)
            this.circuitOpenedAt = undefined;
            return false;
        }

        return true;
    }

    /**
     * Record a successful operation
     */
    protected recordSuccess(responseTime: number): void {
        this.successCount++;
        this.requestCount++;
        this.totalResponseTime += responseTime;
        this.lastSuccess = new Date();
        this.failureCount = 0; // Reset consecutive failures

        // Keep window limited
        if (this.requestCount > HEALTH_WINDOW) {
            this.successCount = Math.floor(this.successCount * 0.8);
            this.requestCount = HEALTH_WINDOW;
        }
    }

    /**
     * Record a failed operation
     */
    protected recordFailure(): void {
        this.failureCount++;
        this.requestCount++;
        this.lastFailure = new Date();

        // Open circuit if threshold exceeded
        if (this.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
            this.circuitOpenedAt = new Date();
            logger.warn(`[${this.name}] Circuit breaker opened`, {
                failureCount: this.failureCount,
            });
        }

        // Keep window limited
        if (this.requestCount > HEALTH_WINDOW) {
            this.requestCount = HEALTH_WINDOW;
        }
    }

    /**
     * Reset provider state
     */
    reset(): void {
        this.successCount = 0;
        this.failureCount = 0;
        this.totalResponseTime = 0;
        this.requestCount = 0;
        this.lastSuccess = undefined;
        this.lastFailure = undefined;
        this.circuitOpenedAt = undefined;

        // Cancel all active downloads
        for (const [sessionId, controller] of this.activeDownloads) {
            try {
                controller.abort();
            } catch {
                // Ignore errors during cleanup
            }
            this.activeDownloads.delete(sessionId);
        }

        logger.info(`[${this.name}] Provider reset`);
    }

    /**
     * Execute with health tracking
     */
    protected async executeWithTracking<T>(
        operation: () => Promise<T>,
        operationName: string,
    ): Promise<T> {
        if (this.isCircuitOpen()) {
            throw new Error(`[${this.name}] Circuit breaker is open`);
        }

        const startTime = Date.now();

        try {
            const result = await operation();
            const responseTime = Date.now() - startTime;
            this.recordSuccess(responseTime);

            logger.debug(`[${this.name}] ${operationName} succeeded`, {
                responseTime,
            });

            return result;
        } catch (error) {
            this.recordFailure();

            logger.warn(`[${this.name}] ${operationName} failed`, {
                error: (error as Error).message,
            });

            throw error;
        }
    }

    /**
     * Create abort controller for a session
     */
    protected createAbortController(sessionId: string): AbortController {
        const controller = new AbortController();
        this.activeDownloads.set(sessionId, controller);
        return controller;
    }

    /**
     * Cleanup abort controller for a session
     */
    protected cleanupAbortController(sessionId: string): void {
        this.activeDownloads.delete(sessionId);
    }
}
