import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * CookiesManager - Manages platform-specific cookies for yt-dlp authentication
 * Supports: YouTube, Instagram, TikTok, Twitter/X
 * 
 * Environment Variables:
 * - YOUTUBE_COOKIES: YouTube cookies (base64 or plaintext)
 * - INSTAGRAM_COOKIES: Instagram cookies (base64 or plaintext)
 * - TIKTOK_COOKIES: TikTok cookies (base64 or plaintext)
 * - TWITTER_COOKIES: Twitter/X cookies (base64 or plaintext)
 */
class CookiesManagerClass {
    private cookiesPaths: Map<string, string> = new Map();
    private initialized = false;
    private tempDir: string = './temp';

    /**
     * Initialize all platform cookies from environment variables
     * Should be called once at startup
     */
    initialize(tempDir: string = './temp'): void {
        if (this.initialized) return;
        this.tempDir = tempDir;

        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Initialize each platform's cookies
        this.initializePlatformCookies('youtube', process.env.YOUTUBE_COOKIES);
        this.initializePlatformCookies('instagram', process.env.INSTAGRAM_COOKIES);
        this.initializePlatformCookies('tiktok', process.env.TIKTOK_COOKIES);
        this.initializePlatformCookies('twitter', process.env.TWITTER_COOKIES);

        this.initialized = true;

        const platforms = Array.from(this.cookiesPaths.keys());
        if (platforms.length > 0) {
            logger.info('✅ Cookies initialized for platforms', { platforms });
        } else {
            logger.info('⚠️ No platform cookies configured');
        }
    }

    /**
     * Initialize cookies for a specific platform
     */
    private initializePlatformCookies(platform: string, cookiesContent?: string): void {
        if (!cookiesContent) {
            return;
        }

        try {
            const cookiesPath = path.join(this.tempDir, `${platform}_cookies.txt`);

            // Decode content (handles both base64 and plaintext)
            let decodedContent: string;
            if (cookiesContent.includes('\t') || cookiesContent.includes('.com')) {
                decodedContent = cookiesContent;
            } else {
                try {
                    decodedContent = Buffer.from(cookiesContent, 'base64').toString('utf-8');
                } catch {
                    decodedContent = cookiesContent;
                }
            }

            fs.writeFileSync(cookiesPath, decodedContent, 'utf-8');
            this.cookiesPaths.set(platform, cookiesPath);
            logger.info(`✅ ${platform} cookies initialized`, { path: cookiesPath });
        } catch (error) {
            logger.error(`Failed to initialize ${platform} cookies`, { error });
        }
    }

    /**
     * Get cookies path for a specific URL
     * Automatically detects platform from URL
     */
    getCookiesForUrl(url: string): string | undefined {
        if (!this.initialized) {
            this.initialize();
        }

        const platform = this.detectPlatform(url);
        if (!platform) return undefined;

        return this.cookiesPaths.get(platform);
    }

    /**
     * Get cookies path (legacy - defaults to YouTube)
     * Use getCookiesForUrl instead for multi-platform support
     */
    getCookiesPath(): string | undefined {
        if (!this.initialized) {
            this.initialize();
        }
        return this.cookiesPaths.get('youtube');
    }

    /**
     * Detect platform from URL
     */
    private detectPlatform(url: string): string | undefined {
        try {
            const hostname = new URL(url).hostname.toLowerCase();

            if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
                return 'youtube';
            }
            if (hostname.includes('instagram.com')) {
                return 'instagram';
            }
            if (hostname.includes('tiktok.com')) {
                return 'tiktok';
            }
            if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
                return 'twitter';
            }

            return undefined;
        } catch {
            return undefined;
        }
    }

    /**
     * Check if cookies are configured for a platform
     */
    hasCookiesForPlatform(platform: string): boolean {
        return this.cookiesPaths.has(platform);
    }

    /**
     * Check if any cookies are configured
     */
    hasCookies(): boolean {
        return this.cookiesPaths.size > 0;
    }

    /**
     * Get all configured platforms
     */
    getConfiguredPlatforms(): string[] {
        return Array.from(this.cookiesPaths.keys());
    }
}

// Singleton instance
export const CookiesManager = new CookiesManagerClass();
