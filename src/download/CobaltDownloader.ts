import { logger } from '../utils/logger';

/**
 * Cobalt API Response types
 */
interface CobaltResponse {
    status: 'tunnel' | 'redirect' | 'picker' | 'error';
    url?: string;
    filename?: string;
    picker?: Array<{ url: string; filename?: string }>;
    error?: { code?: string };
}

/**
 * Generic API Response types
 */
interface SnapinstaResponse {
    url?: string;
}

interface IndownResponse {
    video_url?: string;
    download_url?: string;
}

interface SaveFromResponse {
    url?: string;
    download?: string;
    video?: string;
}

/**
 * CobaltDownloader - Uses multiple fallback APIs for Instagram/TikTok
 * When yt-dlp fails, tries multiple third-party services
 */
export class CobaltDownloader {
    private currentServiceIndex = 0;

    /**
     * Get direct download URL using multiple fallback services
     */
    async getDownloadUrl(
        url: string,
        options: {
            quality?: string;
            audioOnly?: boolean;
        } = {}
    ): Promise<{ url: string; filename: string } | null> {
        // Try platform-specific services first, then Cobalt as universal fallback
        const services = [
            () => this.trySnapinsta(url),      // Instagram only
            () => this.tryIndown(url),         // Instagram only
            () => this.tryFBDown(url),         // Facebook only
            () => this.trySaveFrom(url),       // Universal
            () => this.tryCobaltInstance(url, options.quality || '1080', options.audioOnly || false), // Universal
        ];

        for (let i = 0; i < services.length; i++) {
            const serviceIndex = (this.currentServiceIndex + i) % services.length;
            try {
                const result = await services[serviceIndex]();
                if (result) {
                    this.currentServiceIndex = serviceIndex;
                    return result;
                }
            } catch (error) {
                logger.warn(`Download service ${serviceIndex} failed`, {
                    error: (error as Error).message
                });
                continue;
            }
        }

        logger.error('All download services failed');
        return null;
    }

    /**
     * Try Snapinsta.to API (works for Instagram)
     */
    private async trySnapinsta(url: string): Promise<{ url: string; filename: string } | null> {
        if (!url.includes('instagram.com')) return null;

        logger.info('🔗 Trying Snapinsta', { url });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        try {
            const formData = new URLSearchParams();
            formData.append('url', url);

            const response = await fetch('https://snapinsta.to/api/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': 'https://snapinsta.to',
                    'Referer': 'https://snapinsta.to/',
                },
                body: formData.toString(),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json() as SnapinstaResponse;

            if (data.url) {
                logger.info('✅ Snapinsta succeeded');
                return {
                    url: data.url,
                    filename: 'instagram_video.mp4',
                };
            }

            throw new Error('No URL in response');
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Try indown.io API
     */
    private async tryIndown(url: string): Promise<{ url: string; filename: string } | null> {
        if (!url.includes('instagram.com')) return null;

        logger.info('🔗 Trying Indown', { url });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        try {
            const response = await fetch('https://indown.io/api/media', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Origin': 'https://indown.io',
                    'Referer': 'https://indown.io/',
                },
                body: JSON.stringify({ url }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json() as IndownResponse;

            if (data.video_url || data.download_url) {
                logger.info('✅ Indown succeeded');
                return {
                    url: data.video_url || data.download_url || '',
                    filename: 'instagram_video.mp4',
                };
            }

            throw new Error('No URL in response');
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Try FBDown API for Facebook videos
     */
    private async tryFBDown(url: string): Promise<{ url: string; filename: string } | null> {
        if (!url.includes('facebook.com') && !url.includes('fb.watch')) return null;

        logger.info('🔗 Trying FBDown', { url });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        try {
            // Use a similar approach to other services
            const response = await fetch('https://www.getfvid.com/api/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Origin': 'https://www.getfvid.com',
                    'Referer': 'https://www.getfvid.com/',
                },
                body: new URLSearchParams({ url }).toString(),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json() as { url?: string; hd?: string; sd?: string };

            const downloadUrl = data.hd || data.sd || data.url;
            if (downloadUrl) {
                logger.info('✅ FBDown succeeded');
                return {
                    url: downloadUrl,
                    filename: 'facebook_video.mp4',
                };
            }

            throw new Error('No URL in response');
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Try savefrom.net style API
     */
    private async trySaveFrom(url: string): Promise<{ url: string; filename: string } | null> {
        logger.info('🔗 Trying SaveFrom style API', { url });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        try {
            const response = await fetch(`https://api.savefrom.biz/api/convert?url=${encodeURIComponent(url)}`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json() as SaveFromResponse;

            if (data.url || data.download || data.video) {
                logger.info('✅ SaveFrom succeeded');
                return {
                    url: data.url || data.download || data.video || '',
                    filename: 'video.mp4',
                };
            }

            throw new Error('No URL in response');
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Try Cobalt instances (original implementation)
     */
    private async tryCobaltInstance(
        videoUrl: string,
        quality: string,
        audioOnly: boolean
    ): Promise<{ url: string; filename: string } | null> {
        const COBALT_INSTANCES = [
            'https://api.cobalt.tools/api/json',
            'https://cobalt.canine.tools/api/json',
            'https://co.wuk.sh/api/json',
        ];

        for (const instanceUrl of COBALT_INSTANCES) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            try {
                logger.info('🔗 Trying Cobalt instance', { instance: instanceUrl });

                const response = await fetch(instanceUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                    body: JSON.stringify({
                        url: videoUrl,
                        videoQuality: quality,
                        downloadMode: audioOnly ? 'audio' : 'auto',
                        audioFormat: 'mp3',
                        filenameStyle: 'basic',
                    }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json() as CobaltResponse;

                if (data.status === 'error') {
                    throw new Error(data.error?.code || 'Unknown error');
                }

                if (data.status === 'tunnel' || data.status === 'redirect') {
                    logger.info('✅ Cobalt succeeded');
                    return {
                        url: data.url || '',
                        filename: data.filename || 'download.mp4',
                    };
                }

                if (data.status === 'picker' && data.picker && data.picker.length > 0) {
                    const firstItem = data.picker[0];
                    return {
                        url: firstItem.url,
                        filename: 'download.mp4',
                    };
                }
            } catch (error) {
                logger.warn(`Cobalt ${instanceUrl} failed`, { error: (error as Error).message });
            } finally {
                clearTimeout(timeout);
            }
        }

        return null;
    }

    /**
     * Check if URL is supported
     */
    isSupportedUrl(url: string): boolean {
        const supportedDomains = [
            'instagram.com',
            'tiktok.com',
            'twitter.com',
            'x.com',
            'youtube.com',
            'youtu.be',
            'reddit.com',
            'twitch.tv',
            'vimeo.com',
            'facebook.com',
        ];

        try {
            const hostname = new URL(url).hostname.toLowerCase();
            return supportedDomains.some(domain => hostname.includes(domain));
        } catch {
            return false;
        }
    }
}

// Singleton instance
export const cobaltDownloader = new CobaltDownloader();
