import { logger } from './logger';

/**
 * URLValidator - Validates URLs and checks platform support
 * Implements comprehensive URL validation with clear error messages
 * Requirements: 3.4, 7.1
 */
export class URLValidator {
  // Supported platform patterns with explicit domain matching
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
    /(^|\.)dailymotion\.com$/,
    /(^|\.)t\.me$/,
    /(^|\.)telegram\.me$/,
  ];

  // Platform examples for error messages
  private readonly platformExamples: Record<string, string[]> = {
    YouTube: [
      'https://www.youtube.com/watch?v=VIDEO_ID',
      'https://youtu.be/VIDEO_ID',
    ],
    Facebook: [
      'https://www.facebook.com/username/videos/VIDEO_ID',
      'https://fb.watch/VIDEO_ID',
    ],
    'Twitter/X': [
      'https://twitter.com/username/status/TWEET_ID',
      'https://x.com/username/status/TWEET_ID',
    ],
    Instagram: [
      'https://www.instagram.com/p/POST_ID',
      'https://www.instagram.com/reel/REEL_ID',
    ],
    TikTok: [
      'https://www.tiktok.com/@username/video/VIDEO_ID',
      'https://vm.tiktok.com/SHORT_CODE',
    ],
    Vimeo: ['https://vimeo.com/VIDEO_ID'],
    Dailymotion: ['https://www.dailymotion.com/video/VIDEO_ID'],
  };

  /**
   * Validates a URL with comprehensive checks
   * @param url - The URL to validate
   * @returns Validation result with error details if invalid
   */
  validate(url: string): ValidationResult {
    // Check if URL is empty or whitespace
    if (!url || url.trim().length === 0) {
      return {
        valid: false,
        error: 'empty_url',
        message: this.getEmptyURLMessage(),
      };
    }

    // Check basic URL format
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Check if platform is supported
      const isSupported = this.supportedPatterns.some((pattern) =>
        pattern.test(hostname),
      );

      if (!isSupported) {
        return {
          valid: false,
          error: 'unsupported_platform',
          message: this.getUnsupportedPlatformMessage(),
          detectedPlatform: hostname,
        };
      }

      // URL is valid and supported
      return {
        valid: true,
        platform: this.detectPlatform(hostname),
      };
    } catch (error) {
      logger.debug('Invalid URL format', {
        url,
        error: (error as Error).message,
      });
      return {
        valid: false,
        error: 'invalid_format',
        message: this.getInvalidFormatMessage(),
      };
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  isValid(url: string): boolean {
    return this.validate(url).valid;
  }

  /**
   * Extracts URL from text
   */
  extractURL(text: string): string | null {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(urlRegex);
    return matches && matches.length > 0 ? matches[0] : null;
  }

  /**
   * Detects the platform from hostname
   */
  private detectPlatform(hostname: string): string {
    if (
      /(^|\.)youtube\.com$/.test(hostname) ||
      /(^|\.)youtu\.be$/.test(hostname)
    ) {
      return 'YouTube';
    }
    if (
      /(^|\.)facebook\.com$/.test(hostname) ||
      /(^|\.)fb\.watch$/.test(hostname)
    ) {
      return 'Facebook';
    }
    if (
      /(^|\.)twitter\.com$/.test(hostname) ||
      /(^|\.)x\.com$/.test(hostname)
    ) {
      return 'Twitter/X';
    }
    if (/(^|\.)instagram\.com$/.test(hostname)) {
      return 'Instagram';
    }
    if (/(^|\.)tiktok\.com$/.test(hostname)) {
      return 'TikTok';
    }
    if (/(^|\.)vimeo\.com$/.test(hostname)) {
      return 'Vimeo';
    }
    if (/(^|\.)dailymotion\.com$/.test(hostname)) {
      return 'Dailymotion';
    }
    return 'Unknown';
  }

  /**
   * Gets list of supported platforms
   */
  getSupportedPlatforms(): string[] {
    return [
      'YouTube',
      'Facebook',
      'Twitter/X',
      'Instagram',
      'TikTok',
      'Vimeo',
      'Dailymotion',
    ];
  }

  /**
   * Gets error message for empty URL
   */
  private getEmptyURLMessage(): string {
    return (
      `❌ *الرابط فارغ*\n\n` +
      `يرجى إرسال رابط صحيح من إحدى المنصات المدعومة.\n\n` +
      `📝 *مثال:*\n` +
      `https://www.youtube.com/watch?v=VIDEO_ID`
    );
  }

  /**
   * Gets error message for invalid URL format
   */
  private getInvalidFormatMessage(): string {
    return (
      `❌ *صيغة الرابط غير صحيحة*\n\n` +
      `يرجى التأكد من أن الرابط يبدأ بـ http:// أو https://\n\n` +
      `📝 *أمثلة صحيحة:*\n` +
      `• https://www.youtube.com/watch?v=VIDEO_ID\n` +
      `• https://www.instagram.com/p/POST_ID\n` +
      `• https://www.tiktok.com/@user/video/ID`
    );
  }

  /**
   * Gets error message for unsupported platform with examples
   */
  getUnsupportedPlatformMessage(): string {
    let message = `⚠️ *عذراً، هذا الرابط غير مدعوم*\n\n`;
    message += `✅ *المنصات المدعومة:*\n`;

    const platforms = this.getSupportedPlatforms();
    platforms.forEach((platform) => {
      message += `\n📱 *${platform}*\n`;
      const examples = this.platformExamples[platform];
      if (examples && examples.length > 0) {
        examples.forEach((example) => {
          message += `   ${example}\n`;
        });
      }
    });

    return message;
  }

  /**
   * Gets validation error message with examples
   */
  getValidationErrorMessage(result: ValidationResult): string {
    if (result.valid) {
      return '';
    }

    return result.message || this.getInvalidFormatMessage();
  }
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: 'empty_url' | 'invalid_format' | 'unsupported_platform';
  message?: string;
  platform?: string;
  detectedPlatform?: string;
}
