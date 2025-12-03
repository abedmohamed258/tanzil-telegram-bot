import { Telegraf } from 'telegraf';
import {
  InlineKeyboardButton,
} from 'telegraf/typings/core/types/typegram';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseManager } from '../../../database/SupabaseManager';
import { VideoInfo, Format } from '../../../types';
import { calculateCost } from '../../../utils/logicHelpers';
import { MarkdownSanitizer } from '../../../utils/MarkdownSanitizer';

export interface CallbackState {
  timestamp: number;
  url: string;
  userId: number;
  videoInfo?: VideoInfo;
}

/**
 * MenuBuilder - Responsible for creating professional quality selection menus
 * Displays ALL available formats organized by category
 *
 * **Feature: quality-selection-menu**
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 4.1, 4.3, 4.4**
 */
export class MenuBuilder {
  private bot: Telegraf;
  private storage: SupabaseManager;
  private callbackMap: Map<string, CallbackState>;

  // Configuration
  private readonly MAX_BUTTONS_PER_ROW = 3;
  private readonly GROUP_THRESHOLD = 8; // Group formats if more than this

  constructor(
    bot: Telegraf,
    storage: SupabaseManager,
    callbackMap: Map<string, CallbackState>,
  ) {
    this.bot = bot;
    this.storage = storage;
    this.callbackMap = callbackMap;
  }

  /**
   * Displays the quality selection menu with ALL available formats
   */
  public async showQualityOptions(
    chatId: number,
    userId: number,
    url: string,
    videoInfo: VideoInfo,
    messageIdToEdit?: number,
  ): Promise<string | null> {
    const uuid = uuidv4().substring(0, 8);
    this.callbackMap.set(uuid, {
      timestamp: Date.now(),
      url,
      userId,
      videoInfo,
    });

    // 1. Check User Preference (Auto-Selection)
    const user = await this.storage.getUser(userId);
    const pref = user?.preferredQuality;

    if (pref && pref !== 'ask') {
      return pref;
    }

    // 2. Calculate Costs
    const videoCost = calculateCost(videoInfo.duration, false);
    const audioCost = calculateCost(videoInfo.duration, true);

    // 3. Separate and sort formats
    const videoFormats = videoInfo.formats
      .filter((f) => f.hasVideo)
      .sort((a, b) => b.filesize - a.filesize);

    // We still calculate audio count for the message, but don't list them
    const audioFormats = videoInfo.formats.filter(
      (f) => f.hasAudio && !f.hasVideo,
    );

    // 4. Build keyboard
    const keyboard = this.buildKeyboard(
      uuid,
      videoFormats,
      videoCost,
      audioCost,
    );

    // 5. Build message
    const message = this.buildMessage(
      videoInfo,
      videoFormats.length,
      audioFormats.length,
    );

    // 6. Send or Edit
    try {
      const options = {
        reply_markup: { inline_keyboard: keyboard },
        parse_mode: 'Markdown' as const,
      };

      if (messageIdToEdit) {
        await this.bot.telegram.editMessageText(
          chatId,
          messageIdToEdit,
          undefined,
          message,
          options,
        );
      } else {
        await this.sendToChat(chatId, undefined, message, options);
      }
    } catch (error: unknown) {
      // Fallback to plain text if Markdown fails
      const plainMessage = MarkdownSanitizer.stripMarkdown(message);
      const options = {
        reply_markup: { inline_keyboard: keyboard },
      };

      if (messageIdToEdit) {
        await this.bot.telegram.editMessageText(
          chatId,
          messageIdToEdit,
          undefined,
          plainMessage,
          options,
        );
      } else {
        await this.sendToChat(chatId, undefined, plainMessage, options);
      }
    }

    return null; // Menu shown
  }

  /**
   * Builds the inline keyboard with all format options
   */
  private buildKeyboard(
    uuid: string,
    videoFormats: Format[],
    videoCost: number,
    audioCost: number,
  ): InlineKeyboardButton[][] {
    const keyboard: InlineKeyboardButton[][] = [];

    // --- Quick Actions Header ---
    keyboard.push([
      {
        text: `💎 أفضل جودة (${videoCost}ن)`,
        callback_data: `dl:${uuid}:best`,
      },
      { text: `🎵 صوت MP3 (${audioCost}ن)`, callback_data: `dl:${uuid}:audio` },
    ]);

    // --- Video Section ---
    if (videoFormats.length > 0) {
      // Check if we need to group by resolution
      if (videoFormats.length > this.GROUP_THRESHOLD) {
        this.addGroupedVideoFormats(keyboard, uuid, videoFormats);
      } else {
        this.addVideoFormats(keyboard, uuid, videoFormats);
      }
    }

    // --- Cancel Button ---
    keyboard.push([{ text: '❌ إلغاء', callback_data: `cancel:${uuid}` }]);

    return keyboard;
  }

  /**
   * Adds video formats without grouping
   */
  private addVideoFormats(
    keyboard: InlineKeyboardButton[][],
    uuid: string,
    formats: Format[],
  ): void {
    let row: InlineKeyboardButton[] = [];

    formats.forEach((f) => {
      if (f.quality !== 'Unknown') {
        const buttonText = this.formatVideoButtonText(f);
        row.push({
          text: buttonText,
          callback_data: `dl:${uuid}:${f.formatId}`,
        });

        if (row.length === this.MAX_BUTTONS_PER_ROW) {
          keyboard.push(row);
          row = [];
        }
      }
    });

    if (row.length > 0) keyboard.push(row);
  }

  /**
   * Adds video formats grouped by resolution category
   */
  private addGroupedVideoFormats(
    keyboard: InlineKeyboardButton[][],
    uuid: string,
    formats: Format[],
  ): void {
    const groups = this.groupByResolution(formats);
    const categoryOrder = ['4K', '1080p', '720p', '480p', 'Other'];

    for (const category of categoryOrder) {
      const categoryFormats = groups.get(category);
      if (categoryFormats && categoryFormats.length > 0) {
        // Add category sub-header
        const categoryEmoji = this.getCategoryEmoji(category);
        keyboard.push([
          {
            text: `${categoryEmoji} ${category}`,
            callback_data: 'noop',
          },
        ]);

        // Add formats in this category
        let row: InlineKeyboardButton[] = [];
        categoryFormats.forEach((f) => {
          const buttonText = this.formatVideoButtonText(f, true);
          row.push({
            text: buttonText,
            callback_data: `dl:${uuid}:${f.formatId}`,
          });

          if (row.length === this.MAX_BUTTONS_PER_ROW) {
            keyboard.push(row);
            row = [];
          }
        });

        if (row.length > 0) keyboard.push(row);
      }
    }
  }

  /**
   * Groups formats by resolution category
   */
  private groupByResolution(formats: Format[]): Map<string, Format[]> {
    const groups = new Map<string, Format[]>();

    formats.forEach((f) => {
      const category = f.resolutionCategory || 'Other';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(f);
    });

    return groups;
  }

  /**
   * Formats video button text with quality, size, and extension
   */
  private formatVideoButtonText(
    format: Format,
    compact: boolean = false,
  ): string {
    const quality = format.quality;
    const size = MarkdownSanitizer.formatFileSize(format.filesize);

    if (compact) {
      // Compact format for grouped display
      return size ? `${quality} | ${size}` : `${quality}`;
    }

    // Full format: "1080p | 150 MB"
    return size ? `${quality} | ${size}` : `${quality}`;
  }

  /**
   * Gets emoji for resolution category
   */
  private getCategoryEmoji(category: string): string {
    switch (category) {
      case '4K':
        return '🔥';
      case '1080p':
        return '💎';
      case '720p':
        return '✨';
      case '480p':
        return '📺';
      default:
        return '📱';
    }
  }

  /**
   * Builds the message header with video info
   */
  private buildMessage(
    videoInfo: VideoInfo,
    videoCount: number,
    audioCount: number,
  ): string {
    const title = MarkdownSanitizer.sanitizeTitle(videoInfo.title);
    const channel = MarkdownSanitizer.sanitizeChannel(
      videoInfo.uploader || 'Unknown',
    );
    const duration = MarkdownSanitizer.formatDuration(videoInfo.duration);

    return `
🎥 *${title}*
━━━━━━━━━━━━━━━━━━━━
👤 *القناة:* ${channel}
⏱ *المدة:* ${duration}
📊 *الجودات:* ${videoCount} فيديو | ${audioCount} صوت
━━━━━━━━━━━━━━━━━━━━
👇 *اختر الجودة المناسبة:*
`;
  }

  private async sendToChat(
    chatId: number,
    threadId: number | undefined,
    text: string,
    options: any = {},
  ): Promise<any> {
    return this.bot.telegram.sendMessage(chatId, text, options);
  }
}
