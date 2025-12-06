import { logger } from './logger';

/**
 * MarkdownSanitizer - Utility for safe Telegram Markdown message formatting
 * Handles escaping special characters and provides fallback mechanisms
 *
 * **Feature: quality-selection-menu**
 * **Validates: Requirements 5.1, 5.2, 5.4**
 */
export class MarkdownSanitizer {
  /**
   * Telegram Markdown special characters that need escaping
   * Reference: https://core.telegram.org/bots/api#markdownv2-style
   */
  private static readonly MARKDOWN_SPECIAL_CHARS = /[_*[\]()~`>#+\-=|{}.!\\]/g;

  /**
   * Escapes all Markdown special characters in a string
   * @param text - The text to escape
   * @returns Escaped text safe for Telegram Markdown
   */
  public static escape(text: string): string {
    if (!text) return '';
    return text.replace(this.MARKDOWN_SPECIAL_CHARS, '\\$&');
  }

  /**
   * Sanitizes a video/audio title for safe Markdown display
   * Handles common problematic characters in media titles
   * @param title - The title to sanitize
   * @returns Sanitized title
   */
  public static sanitizeTitle(title: string): string {
    if (!title) return 'Unknown';
    // First escape markdown, then truncate if too long
    const escaped = this.escape(title);
    return escaped.length > 100 ? escaped.substring(0, 97) + '...' : escaped;
  }

  /**
   * Sanitizes a channel/uploader name for safe Markdown display
   * @param channel - The channel name to sanitize
   * @returns Sanitized channel name
   */
  public static sanitizeChannel(channel: string): string {
    if (!channel) return 'Unknown';
    return this.escape(channel);
  }

  /**
   * Sanitizes a URL for safe inclusion in Markdown
   * URLs need special handling for parentheses
   * @param url - The URL to sanitize
   * @returns Sanitized URL
   */
  public static sanitizeUrl(url: string): string {
    if (!url) return '';
    // Only escape parentheses in URLs as they break Markdown links
    return url.replace(/[()]/g, '\\$&');
  }

  /**
   * Builds a safe message by replacing placeholders with sanitized values
   * @param template - Message template with {key} placeholders
   * @param data - Key-value pairs to substitute
   * @returns Safe message string
   */
  public static buildSafeMessage(
    template: string,
    data: Record<string, string>,
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{${key}}`;
      const sanitizedValue = this.escape(value);
      result = result.replace(new RegExp(placeholder, 'g'), sanitizedValue);
    }
    return result;
  }

  /**
   * Attempts to send a Markdown message, falling back to plain text on error
   * @param bot - TelegramBot instance
   * @param chatId - Chat ID to send to
   * @param text - Message text (with Markdown)
   * @param options - Additional message options
   * @returns Sent message or null on complete failure
   */
  public static async tryMarkdownOrFallback(
    bot: any,
    chatId: number,
    text: string,
    options: any = {},
  ): Promise<any | null> {
    try {
      // First attempt: send with Markdown (Telegraf uses bot.telegram.sendMessage)
      return await bot.telegram.sendMessage(chatId, text, {
        ...options,
        parse_mode: 'Markdown',
      });
    } catch (error: unknown) {
      const errorMessage = (error as Error).message || '';

      // Check if it's a Markdown parsing error
      if (
        errorMessage.includes("can't parse entities") ||
        errorMessage.includes('Bad Request')
      ) {
        logger.warn('Markdown parsing failed, falling back to plain text', {
          chatId,
          error: errorMessage,
        });

        try {
          // Fallback: strip Markdown formatting and send as plain text
          const plainText = this.stripMarkdown(text);
          return await bot.telegram.sendMessage(chatId, plainText, {
            ...options,
            parse_mode: undefined,
          });
        } catch (fallbackError) {
          logger.error('Failed to send message even as plain text', {
            chatId,
            error: (fallbackError as Error).message,
          });
          return null;
        }
      }

      // Re-throw non-Markdown errors
      throw error;
    }
  }

  /**
   * Attempts to edit a message with Markdown, falling back to plain text on error
   * @param bot - TelegramBot instance
   * @param chatId - Chat ID
   * @param messageId - Message ID to edit
   * @param text - New message text (with Markdown)
   * @param options - Additional edit options
   * @returns True if successful, false otherwise
   */
  public static async tryEditMarkdownOrFallback(
    bot: any,
    chatId: number,
    messageId: number,
    text: string,
    options: any = {},
  ): Promise<boolean> {
    try {
      // Telegraf uses bot.telegram.editMessageText with different signature
      await bot.telegram.editMessageText(chatId, messageId, undefined, text, {
        ...options,
        parse_mode: 'Markdown',
      });
      return true;
    } catch (error: unknown) {
      const errorMessage = (error as Error).message || '';

      if (
        errorMessage.includes("can't parse entities") ||
        errorMessage.includes('Bad Request')
      ) {
        logger.warn('Markdown edit failed, falling back to plain text', {
          chatId,
          messageId,
          error: errorMessage,
        });

        try {
          const plainText = this.stripMarkdown(text);
          await bot.telegram.editMessageText(chatId, messageId, undefined, plainText, {
            ...options,
            parse_mode: undefined,
          });
          return true;
        } catch (fallbackError) {
          logger.error('Failed to edit message even as plain text', {
            chatId,
            messageId,
            error: (fallbackError as Error).message,
          });
          return false;
        }
      }

      throw error;
    }
  }

  /**
   * Strips Markdown formatting from text
   * @param text - Text with Markdown
   * @returns Plain text without Markdown
   */
  public static stripMarkdown(text: string): string {
    return (
      text
        // Remove bold/italic markers
        .replace(/\*+/g, '')
        .replace(/_+/g, '')
        // Remove code markers
        .replace(/`+/g, '')
        // Remove escape characters
        .replace(/\\/g, '')
        // Clean up multiple spaces
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  /**
   * Formats a duration in seconds to MM:SS or HH:MM:SS
   * @param seconds - Duration in seconds
   * @returns Formatted duration string
   */
  public static formatDuration(seconds: number): string {
    if (!seconds || seconds < 0) return '00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Formats a file size in bytes to human-readable format
   * @param bytes - Size in bytes
   * @returns Formatted size string (e.g., "15.2MB")
   */
  public static formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '';

    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)}GB`;
    }
    return `${mb.toFixed(1)}MB`;
  }
}
