import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * CookiesManager - Manages YouTube cookies for yt-dlp authentication
 * Handles both plaintext and base64-encoded cookies from environment variables
 */
class CookiesManagerClass {
    private cookiesPath: string | undefined;
    private initialized = false;

    /**
     * Initialize cookies from environment variable
     * Should be called once at startup
     */
    initialize(tempDir: string = './temp'): void {
        if (this.initialized) return;

        const cookiesContent = process.env.YOUTUBE_COOKIES;
        if (!cookiesContent) {
            logger.info('No YOUTUBE_COOKIES environment variable set - YouTube authentication disabled');
            this.initialized = true;
            return;
        }

        try {
            // Ensure temp directory exists
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            this.cookiesPath = path.join(tempDir, 'youtube_cookies.txt');

            // Check if content is already plaintext cookies (contains tabs and youtube.com)
            let decodedContent: string;
            if (cookiesContent.includes('\t') || cookiesContent.includes('youtube.com')) {
                decodedContent = cookiesContent;
            } else {
                // Try to decode as base64
                try {
                    decodedContent = Buffer.from(cookiesContent, 'base64').toString('utf-8');
                } catch {
                    decodedContent = cookiesContent;
                }
            }

            fs.writeFileSync(this.cookiesPath, decodedContent, 'utf-8');
            logger.info('✅ YouTube cookies initialized', { path: this.cookiesPath });
        } catch (error) {
            logger.error('Failed to initialize YouTube cookies', { error });
            this.cookiesPath = undefined;
        }

        this.initialized = true;
    }

    /**
     * Get the path to the cookies file
     * Returns undefined if cookies are not configured
     */
    getCookiesPath(): string | undefined {
        if (!this.initialized) {
            this.initialize();
        }
        return this.cookiesPath;
    }

    /**
     * Check if YouTube cookies are configured
     */
    hasCookies(): boolean {
        return this.getCookiesPath() !== undefined;
    }
}

// Singleton instance
export const CookiesManager = new CookiesManagerClass();
