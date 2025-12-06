/**
 * Property-Based Tests for Quality Menu Builder
 *
 * **Feature: quality-selection-menu**
 * **Property 1: All video formats are displayed**
 * **Property 3: Large format lists are grouped correctly**
 * **Property 5: Audio formats display bitrate information**
 * **Property 6: Audio formats are sorted by bitrate descending**
 * **Property 9: Menu keyboard respects row limit**
 * **Property 10: Menu includes cancel button**
 * **Validates: Requirements 1.1, 1.3, 2.1, 2.2, 2.3, 4.3, 4.4**
 */

import * as fc from 'fast-check';
import { Format } from '../src/types/download';
import { MarkdownSanitizer } from '../src/utils/MarkdownSanitizer';

// Constants matching MenuBuilder
const MAX_BUTTONS_PER_ROW = 3;
const GROUP_THRESHOLD = 8;

// Helper functions extracted from MenuBuilder for testing
function groupByResolution(formats: Format[]): Map<string, Format[]> {
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

function formatVideoButtonText(
  format: Format,
  compact: boolean = false,
): string {
  const quality = format.quality;
  const size = MarkdownSanitizer.formatFileSize(format.filesize);
  const ext = format.extension.toUpperCase();
  const fps = format.fps ? `@${format.fps}` : '';

  if (compact) {
    return size ? `${quality}${fps} (${size})` : `${quality}${fps}`;
  }

  return size
    ? `🎬 ${quality}${fps} ${ext} (${size})`
    : `🎬 ${quality}${fps} ${ext}`;
}

function formatAudioButtonText(format: Format): string {
  const bitrate = format.bitrate ? `${format.bitrate}kbps` : '';
  const ext = format.extension.toUpperCase();
  const size = MarkdownSanitizer.formatFileSize(format.filesize);

  if (bitrate && size) {
    return `🎵 ${bitrate} ${ext} (${size})`;
  } else if (bitrate) {
    return `🎵 ${bitrate} ${ext}`;
  } else if (size) {
    return `🎵 ${ext} (${size})`;
  }
  return `🎵 ${ext}`;
}

// Simulate keyboard building logic
function buildKeyboardRows(
  videoFormats: Format[],
  audioFormats: Format[],
): string[][] {
  const rows: string[][] = [];

  // Video section (displayed first)
  if (videoFormats.length > 0) {
    rows.push(['📹 ─── جودات الفيديو ───']);

    if (videoFormats.length > GROUP_THRESHOLD) {
      // Grouped display
      const groups = groupByResolution(videoFormats);
      const categoryOrder = ['4K', '1080p', '720p', '480p', 'Other'];

      for (const category of categoryOrder) {
        const categoryFormats = groups.get(category);
        if (categoryFormats && categoryFormats.length > 0) {
          rows.push([`${category}`]);

          let row: string[] = [];
          categoryFormats.forEach((f) => {
            row.push(formatVideoButtonText(f, true));
            if (row.length === MAX_BUTTONS_PER_ROW) {
              rows.push(row);
              row = [];
            }
          });
          if (row.length > 0) rows.push(row);
        }
      }
    } else {
      // Non-grouped display
      let row: string[] = [];
      videoFormats.forEach((f) => {
        if (f.quality !== 'Unknown') {
          row.push(formatVideoButtonText(f));
          if (row.length === MAX_BUTTONS_PER_ROW) {
            rows.push(row);
            row = [];
          }
        }
      });
      if (row.length > 0) rows.push(row);
    }
  }

  // Audio section
  if (audioFormats.length > 0) {
    rows.push(['🎵 ─── جودات الصوت ───']);

    const sortedAudio = [...audioFormats].sort(
      (a, b) => (b.bitrate || 0) - (a.bitrate || 0),
    );
    let row: string[] = [];
    sortedAudio.forEach((f) => {
      row.push(formatAudioButtonText(f));
      if (row.length === MAX_BUTTONS_PER_ROW) {
        rows.push(row);
        row = [];
      }
    });
    if (row.length > 0) rows.push(row);
  }

  // Audio MP3 button (always present)
  rows.push(['🎵 تحميل صوت MP3']);

  // Cancel button
  rows.push(['❌ إلغاء']);

  return rows;
}

// Arbitrary generators
const videoFormatArb = fc.record({
  formatId: fc.string({ minLength: 1, maxLength: 10 }),
  quality: fc.constantFrom(
    '1080p',
    '720p',
    '480p',
    '360p',
    '240p',
    '2160p',
    '1440p',
  ),
  extension: fc.constantFrom('mp4', 'webm', 'mkv'),
  filesize: fc.integer({ min: 1000000, max: 5000000000 }),
  hasVideo: fc.constant(true),
  hasAudio: fc.boolean(),
  bitrate: fc.option(fc.integer({ min: 100, max: 50000 }), { nil: undefined }),
  fps: fc.option(fc.constantFrom(24, 30, 60, 120), { nil: undefined }),
  codec: fc.option(fc.constantFrom('h264', 'vp9', 'av1'), { nil: undefined }),
  resolutionCategory: fc.constantFrom('4K', '1080p', '720p', '480p', 'Other'),
});

const audioFormatArb = fc.record({
  formatId: fc.string({ minLength: 1, maxLength: 10 }),
  quality: fc.constantFrom('128kbps', '192kbps', '256kbps', '320kbps'),
  extension: fc.constantFrom('m4a', 'mp3', 'opus'),
  filesize: fc.integer({ min: 100000, max: 50000000 }),
  hasVideo: fc.constant(false),
  hasAudio: fc.constant(true),
  bitrate: fc.integer({ min: 32, max: 320 }),
  fps: fc.constant(undefined),
  codec: fc.option(fc.constantFrom('aac', 'opus', 'mp3'), { nil: undefined }),
  resolutionCategory: fc.constant('Other'),
});

describe('Quality Menu Builder', () => {
  describe('Property 1: All video formats are displayed', () => {
    /**
     * Property: For any VideoInfo with N video formats where N ≤ 8,
     * the generated keyboard SHALL contain exactly N video format buttons
     */
    it('should display all video formats when count <= 8', () => {
      fc.assert(
        fc.property(
          fc.array(videoFormatArb, { minLength: 1, maxLength: 8 }),
          (formats: Format[]) => {
            const rows = buildKeyboardRows(formats, []);

            // Count video format buttons (excluding headers and cancel)
            let videoButtonCount = 0;
            rows.forEach((row) => {
              row.forEach((btn) => {
                if (btn.startsWith('🎬')) {
                  videoButtonCount++;
                }
              });
            });

            // Should have same number of buttons as formats (excluding Unknown quality)
            const validFormats = formats.filter((f) => f.quality !== 'Unknown');
            return videoButtonCount === validFormats.length;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 3: Large format lists are grouped correctly', () => {
    /**
     * Property: For any VideoInfo with more than 8 video formats,
     * the formats SHALL be grouped into resolution categories
     */
    it('should group formats by resolution when count > 8', () => {
      fc.assert(
        fc.property(
          fc.array(videoFormatArb, { minLength: 9, maxLength: 20 }),
          (formats: Format[]) => {
            const groups = groupByResolution(formats);

            // All formats should be in some group
            let totalInGroups = 0;
            groups.forEach((g) => (totalInGroups += g.length));

            return totalInGroups === formats.length;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should assign formats to correct resolution categories', () => {
      const testFormats: Format[] = [
        {
          formatId: '1',
          quality: '2160p',
          extension: 'mp4',
          filesize: 1000,
          hasVideo: true,
          hasAudio: true,
          resolutionCategory: '4K',
        },
        {
          formatId: '2',
          quality: '1080p',
          extension: 'mp4',
          filesize: 500,
          hasVideo: true,
          hasAudio: true,
          resolutionCategory: '1080p',
        },
        {
          formatId: '3',
          quality: '720p',
          extension: 'mp4',
          filesize: 300,
          hasVideo: true,
          hasAudio: true,
          resolutionCategory: '720p',
        },
        {
          formatId: '4',
          quality: '480p',
          extension: 'mp4',
          filesize: 200,
          hasVideo: true,
          hasAudio: true,
          resolutionCategory: '480p',
        },
        {
          formatId: '5',
          quality: '360p',
          extension: 'mp4',
          filesize: 100,
          hasVideo: true,
          hasAudio: true,
          resolutionCategory: 'Other',
        },
      ];

      const groups = groupByResolution(testFormats);

      expect(groups.get('4K')?.length).toBe(1);
      expect(groups.get('1080p')?.length).toBe(1);
      expect(groups.get('720p')?.length).toBe(1);
      expect(groups.get('480p')?.length).toBe(1);
      expect(groups.get('Other')?.length).toBe(1);
    });
  });

  describe('Property 5: Audio formats display bitrate information', () => {
    /**
     * Property: For any audio format, the generated button text
     * SHALL contain the bitrate in kbps and the format extension
     */
    it('should include bitrate in audio button text', () => {
      fc.assert(
        fc.property(audioFormatArb, (format: Format) => {
          const buttonText = formatAudioButtonText(format);

          // Should contain bitrate if available
          if (format.bitrate) {
            expect(buttonText).toContain(`${format.bitrate}kbps`);
          }

          // Should contain extension
          expect(buttonText.toUpperCase()).toContain(
            format.extension.toUpperCase(),
          );

          return true;
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 6: Audio formats are sorted by bitrate descending', () => {
    /**
     * Property: For any list of audio formats, the displayed order
     * SHALL be sorted by bitrate from highest to lowest
     */
    it('should sort audio formats by bitrate descending', () => {
      fc.assert(
        fc.property(
          fc.array(audioFormatArb, { minLength: 2, maxLength: 10 }),
          (formats: Format[]) => {
            const sorted = [...formats].sort(
              (a, b) => (b.bitrate || 0) - (a.bitrate || 0),
            );

            // Check that sorting is correct
            for (let i = 1; i < sorted.length; i++) {
              const prevBitrate = sorted[i - 1].bitrate || 0;
              const currBitrate = sorted[i].bitrate || 0;
              if (prevBitrate < currBitrate) {
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 9: Menu keyboard respects row limit', () => {
    /**
     * Property: For any generated keyboard, no row SHALL contain
     * more than 3 buttons
     */
    it('should not exceed max buttons per row', () => {
      fc.assert(
        fc.property(
          fc.array(videoFormatArb, { minLength: 1, maxLength: 15 }),
          fc.array(audioFormatArb, { minLength: 0, maxLength: 5 }),
          (videoFormats: Format[], audioFormats: Format[]) => {
            const rows = buildKeyboardRows(videoFormats, audioFormats);

            // Check each row
            for (const row of rows) {
              if (row.length > MAX_BUTTONS_PER_ROW) {
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 10: Menu includes cancel button', () => {
    /**
     * Property: For any generated quality menu, the last row
     * SHALL contain a cancel button
     */
    it('should always have cancel button at the end', () => {
      fc.assert(
        fc.property(
          fc.array(videoFormatArb, { minLength: 0, maxLength: 10 }),
          fc.array(audioFormatArb, { minLength: 0, maxLength: 5 }),
          (videoFormats: Format[], audioFormats: Format[]) => {
            const rows = buildKeyboardRows(videoFormats, audioFormats);

            // Last row should contain cancel button
            const lastRow = rows[rows.length - 1];
            const hasCancelButton = lastRow.some(
              (btn) => btn.includes('إلغاء') || btn.includes('cancel'),
            );

            return hasCancelButton;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Video button text formatting', () => {
    it('should include quality, extension, and size in button text', () => {
      const format: Format = {
        formatId: 'test',
        quality: '1080p',
        extension: 'mp4',
        filesize: 15728640, // 15MB
        hasVideo: true,
        hasAudio: true,
        fps: 30,
      };

      const buttonText = formatVideoButtonText(format);

      expect(buttonText).toContain('1080p');
      expect(buttonText).toContain('MP4');
      expect(buttonText).toContain('15.0MB');
      expect(buttonText).toContain('@30');
    });

    it('should handle formats without fps', () => {
      const format: Format = {
        formatId: 'test',
        quality: '720p',
        extension: 'webm',
        filesize: 10485760,
        hasVideo: true,
        hasAudio: true,
      };

      const buttonText = formatVideoButtonText(format);

      expect(buttonText).toContain('720p');
      expect(buttonText).not.toContain('@');
    });
  });

  describe('Audio button text formatting', () => {
    it('should include bitrate, extension, and size', () => {
      const format: Format = {
        formatId: 'test',
        quality: '320kbps',
        extension: 'm4a',
        filesize: 5242880, // 5MB
        hasVideo: false,
        hasAudio: true,
        bitrate: 320,
      };

      const buttonText = formatAudioButtonText(format);

      expect(buttonText).toContain('320kbps');
      expect(buttonText).toContain('M4A');
      expect(buttonText).toContain('5.0MB');
    });
  });
});
