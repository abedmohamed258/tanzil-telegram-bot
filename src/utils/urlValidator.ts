import { logger } from './logger';

/**
 * URLValidator - Validates URLs and checks platform support
 * Implements Property 1 (URL Extraction) and Property 2 (URL Validation)
 */
export class URLValidator {
    // Note: Added explicit dots to ensure full domain matching or subdomains
    private readonly supportedPatterns = [
        /(^|\.)youtube\.com$/,
        /(^|\.)youtu\.be$/,
        /(^|\.)facebook\.com$/,
        /(^|\.)fb\.watch$/,
        /(^|\.)twitter\.com$/,
        /(^|\.)x\.com$/,
        /(^|\.)instagram\.com$/,
        /(^|\.)tiktok\.com$/,
        /(^|\.)vimeo\.com$/,
        /(^|\.)dailymotion\.com$/
    ];

    extractURL(text: string): string | null {
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const matches = text.match(urlRegex);
        return matches && matches.length > 0 ? matches[0] : null;
    }

    isValid(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();

            // Strict regex matching for security
            return this.supportedPatterns.some(pattern => pattern.test(hostname));
        } catch (error) {
            logger.debug('Invalid URL format', { url });
            return false;
        }
    }

    getSupportedPlatforms(): string[] {
        return [
            'YouTube', 'Facebook', 'Twitter/X', 'Instagram', 'TikTok', 'Vimeo', 'Dailymotion'
        ];
    }

    getUnsupportedPlatformMessage(): string {
        return `⚠️ *عذراً، هذا الرابط غير مدعوم.*\n\n✅ *المنصات المدعومة:*\n` +
            this.getSupportedPlatforms().map(p => `• ${p}`).join('\n');
    }
}
