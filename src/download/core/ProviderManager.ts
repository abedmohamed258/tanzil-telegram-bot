/**
 * ProviderManager - Manages download providers and selects the best one for each request
 * Implements intelligent fallback with health-based selection
 */

import { logger } from '../../utils/logger';
import {
    IDownloadProvider,
    Platform,
    ProviderHealth,
    ProviderStatus,
    VideoInfo,
    DownloadResult,
    DownloadOptions,
    DownloadProgress,
} from './types';

interface ProviderEntry {
    provider: IDownloadProvider;
    enabled: boolean;
}

export class ProviderManager {
    private providers = new Map<string, ProviderEntry>();

    /**
     * Register a provider
     */
    registerProvider(provider: IDownloadProvider, enabled: boolean = true): void {
        this.providers.set(provider.name, { provider, enabled });
        logger.info('Provider registered', {
            name: provider.name,
            priority: provider.priority,
            platforms: provider.supportedPlatforms,
            enabled,
        });
    }

    /**
     * Enable/disable a provider
     */
    setProviderEnabled(name: string, enabled: boolean): void {
        const entry = this.providers.get(name);
        if (entry) {
            entry.enabled = enabled;
            logger.info(`Provider ${name} ${enabled ? 'enabled' : 'disabled'}`);
        }
    }

    /**
     * Get all registered providers
     */
    getProviders(): IDownloadProvider[] {
        return Array.from(this.providers.values())
            .filter(e => e.enabled)
            .map(e => e.provider);
    }

    /**
     * Get providers for a specific platform, sorted by priority and health
     * For UNKNOWN platforms, returns all providers that have yt-dlp as primary (universal support)
     */
    getProvidersForPlatform(platform: Platform): IDownloadProvider[] {
        return Array.from(this.providers.values())
            .filter(e => {
                if (!e.enabled) return false;
                // For UNKNOWN platforms, try all providers (they may support it via yt-dlp)
                if (platform === Platform.UNKNOWN) {
                    return true; // Let all providers try
                }
                return e.provider.supportedPlatforms.includes(platform);
            })
            .sort((a, b) => {
                // First by priority
                const priorityDiff = a.provider.priority - b.provider.priority;
                if (priorityDiff !== 0) return priorityDiff;

                // Then by health
                const healthA = a.provider.getHealth();
                const healthB = b.provider.getHealth();

                if (healthA.isCircuitOpen && !healthB.isCircuitOpen) return 1;
                if (!healthA.isCircuitOpen && healthB.isCircuitOpen) return -1;

                return healthB.successRate - healthA.successRate;
            })
            .map(e => e.provider);
    }

    /**
     * Get the best provider for a URL
     */
    getBestProvider(url: string): IDownloadProvider | null {
        const platform = this.getPlatformFromUrl(url);
        const providers = this.getProvidersForPlatform(platform);

        // Find first healthy provider
        for (const provider of providers) {
            if (provider.supports(url) && !provider.getHealth().isCircuitOpen) {
                return provider;
            }
        }

        // If all circuits are open, return the one with highest success rate
        return providers.find(p => p.supports(url)) || null;
    }

    /**
     * Get video info with automatic fallback
     */
    async getVideoInfo(url: string, options?: DownloadOptions): Promise<VideoInfo> {
        const platform = this.getPlatformFromUrl(url);
        const providers = this.getProvidersForPlatform(platform);

        let lastError: Error | null = null;

        for (const provider of providers) {
            if (!provider.supports(url)) continue;
            if (!provider.capabilities.supportsVideoInfo) continue;

            const health = provider.getHealth();
            if (health.isCircuitOpen) {
                logger.debug(`Skipping ${provider.name} - circuit open`);
                continue;
            }

            try {
                logger.info(`Trying provider for video info: ${provider.name}`, { url });
                const info = await provider.getVideoInfo(url, options);
                return info;
            } catch (error) {
                lastError = error as Error;
                logger.warn(`Provider ${provider.name} failed for video info`, {
                    url,
                    error: lastError.message,
                });
            }
        }

        throw lastError || new Error('No provider could get video info');
    }

    /**
     * Download with automatic fallback
     */
    async download(
        url: string,
        sessionId: string,
        options: DownloadOptions,
        onProgress?: (progress: DownloadProgress) => void,
        onProviderSwitch?: (from: string, to: string) => void,
    ): Promise<DownloadResult> {
        const platform = this.getPlatformFromUrl(url);
        const providers = this.getProvidersForPlatform(platform);

        let lastError: Error | null = null;
        let lastProvider: string | null = null;

        for (const provider of providers) {
            if (!provider.supports(url)) continue;

            const health = provider.getHealth();
            if (health.isCircuitOpen) {
                logger.debug(`Skipping ${provider.name} - circuit open`);
                continue;
            }

            try {
                if (lastProvider && onProviderSwitch) {
                    onProviderSwitch(lastProvider, provider.name);
                }
                lastProvider = provider.name;

                logger.info(`Trying provider for download: ${provider.name}`, { url, sessionId });
                const result = await provider.download(url, sessionId, options, onProgress);

                if (result.success) {
                    return result;
                }

                lastError = new Error(result.error || 'Download failed');
            } catch (error) {
                lastError = error as Error;
                logger.warn(`Provider ${provider.name} failed for download`, {
                    url,
                    sessionId,
                    error: lastError.message,
                });
            }
        }

        return {
            success: false,
            error: lastError?.message || 'All providers failed',
        };
    }

    /**
     * Cancel download on all providers
     */
    async cancelDownload(sessionId: string): Promise<void> {
        const promises = Array.from(this.providers.values())
            .filter(e => e.enabled)
            .map(e => e.provider.cancelDownload(sessionId).catch(() => { }));

        await Promise.all(promises);
    }

    /**
     * Get health status of all providers
     */
    getHealthStatus(): Record<string, ProviderHealth> {
        const status: Record<string, ProviderHealth> = {};

        for (const [name, entry] of this.providers) {
            if (entry.enabled) {
                status[name] = entry.provider.getHealth();
            }
        }

        return status;
    }

    /**
     * Get overall system health
     */
    getSystemHealth(): { status: ProviderStatus; healthyProviders: number; totalProviders: number } {
        const providers = this.getProviders();
        const healthyCount = providers.filter(p => {
            const health = p.getHealth();
            return health.status === ProviderStatus.HEALTHY && !health.isCircuitOpen;
        }).length;

        let status: ProviderStatus;
        if (healthyCount === 0) {
            status = ProviderStatus.UNAVAILABLE;
        } else if (healthyCount < providers.length / 2) {
            status = ProviderStatus.DEGRADED;
        } else {
            status = ProviderStatus.HEALTHY;
        }

        return {
            status,
            healthyProviders: healthyCount,
            totalProviders: providers.length,
        };
    }

    /**
     * Reset all providers
     */
    resetAll(): void {
        for (const entry of this.providers.values()) {
            entry.provider.reset();
        }
        logger.info('All providers reset');
    }

    /**
     * Get platform from URL
     */
    private getPlatformFromUrl(url: string): Platform {
        try {
            const hostname = new URL(url).hostname.toLowerCase();

            // Major platforms
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
            if (hostname.includes('facebook.com') || hostname.includes('fb.watch') || hostname.includes('fb.com')) {
                return Platform.FACEBOOK;
            }
            if (hostname.includes('reddit.com') || hostname.includes('redd.it')) {
                return Platform.REDDIT;
            }
            if (hostname.includes('vimeo.com')) {
                return Platform.VIMEO;
            }
            if (hostname.includes('twitch.tv')) {
                return Platform.TWITCH;
            }

            // Additional platforms
            if (hostname.includes('snapchat.com')) {
                return Platform.SNAPCHAT;
            }
            if (hostname.includes('pinterest.com') || hostname.includes('pin.it')) {
                return Platform.PINTEREST;
            }
            if (hostname.includes('linkedin.com')) {
                return Platform.LINKEDIN;
            }
            if (hostname.includes('dailymotion.com') || hostname.includes('dai.ly')) {
                return Platform.DAILYMOTION;
            }
            if (hostname.includes('soundcloud.com')) {
                return Platform.SOUNDCLOUD;
            }
            if (hostname.includes('spotify.com')) {
                return Platform.SPOTIFY;
            }
            if (hostname.includes('vk.com') || hostname.includes('vk.ru')) {
                return Platform.VK;
            }
            if (hostname.includes('bilibili.com') || hostname.includes('b23.tv')) {
                return Platform.BILIBILI;
            }
            if (hostname.includes('rumble.com')) {
                return Platform.RUMBLE;
            }
            if (hostname.includes('odysee.com')) {
                return Platform.ODYSEE;
            }

            return Platform.UNKNOWN;
        } catch {
            return Platform.UNKNOWN;
        }
    }
}
