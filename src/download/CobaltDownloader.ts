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
 * CobaltDownloader - Uses Cobalt API as fallback for yt-dlp
 * Supports: Instagram, TikTok, Twitter, YouTube, and 25+ other platforms
 * 
 * This is a fallback service when yt-dlp fails (e.g., login required)
 */
export class CobaltDownloader {
    // Multiple public Cobalt instances for reliability
    private readonly COBALT_INSTANCES = [
        'https://api.cobalt.tools',
        'https://co.wuk.sh',
        'https://cobalt.canine.tools',
    ];

    private currentInstanceIndex = 0;

    /**
     * Get direct download URL from Cobalt API
     */
    async getDownloadUrl(
        url: string,
        options: {
            quality?: string;
            audioOnly?: boolean;
        } = {}
    ): Promise<{ url: string; filename: string } | null> {
        const { quality = '1080', audioOnly = false } = options;

        for (let i = 0; i < this.COBALT_INSTANCES.length; i++) {
            const instanceUrl = this.COBALT_INSTANCES[(this.currentInstanceIndex + i) % this.COBALT_INSTANCES.length];

            try {
                const result = await this.tryInstance(instanceUrl, url, quality, audioOnly);
                if (result) {
                    // Remember successful instance for next time
                    this.currentInstanceIndex = (this.currentInstanceIndex + i) % this.COBALT_INSTANCES.length;
                    return result;
                }
            } catch (error) {
                logger.warn(`Cobalt instance ${instanceUrl} failed`, { error: (error as Error).message });
                continue;
            }
        }

        logger.error('All Cobalt instances failed');
        return null;
    }

    /**
     * Try a single Cobalt instance
     */
    private async tryInstance(
        instanceUrl: string,
        videoUrl: string,
        quality: string,
        audioOnly: boolean
    ): Promise<{ url: string; filename: string } | null> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        try {
            logger.info('🔗 Trying Cobalt instance', { instance: instanceUrl, url: videoUrl });

            const response = await fetch(instanceUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
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
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as CobaltResponse;

            // Handle different response types
            if (data.status === 'error') {
                throw new Error(data.error?.code || 'Unknown error');
            }

            if (data.status === 'tunnel' || data.status === 'redirect') {
                logger.info('✅ Cobalt returned download URL', {
                    status: data.status,
                    filename: data.filename
                });
                return {
                    url: data.url || '',
                    filename: data.filename || 'download.mp4',
                };
            }

            if (data.status === 'picker' && data.picker && data.picker.length > 0) {
                // Multiple items (e.g., Instagram carousel) - return first one
                const firstItem = data.picker[0];
                return {
                    url: firstItem.url,
                    filename: 'download.mp4',
                };
            }

            throw new Error(`Unexpected response status: ${data.status}`);
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Check if URL is supported by Cobalt
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
            'soundcloud.com',
            'facebook.com',
            'pinterest.com',
            'tumblr.com',
            'bilibili.com',
            'dailymotion.com',
            'ok.ru',
            'vk.com',
            'rutube.ru',
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
