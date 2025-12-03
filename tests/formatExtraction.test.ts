/**
 * Property-Based Tests for Format Extraction
 *
 * **Feature: quality-selection-menu, Property 2: Format button contains required information**
 * **Validates: Requirements 1.2**
 */

import * as fc from 'fast-check';
import { Format } from '../src/types/download';

// Helper function to simulate format extraction logic
function extractFormatInfo(ytdlpFormat: any): Format {
  let qualityLabel = 'Unknown';
  if (ytdlpFormat.height) {
    qualityLabel = `${ytdlpFormat.height}p`;
  } else if (
    ytdlpFormat.format_note &&
    !ytdlpFormat.format_note.includes('url')
  ) {
    qualityLabel = ytdlpFormat.format_note;
  } else if (ytdlpFormat.quality) {
    qualityLabel = String(ytdlpFormat.quality);
  }

  // Determine resolution category
  const getResolutionCategory = (height?: number): string => {
    if (!height) return 'Other';
    if (height >= 2160) return '4K';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    return 'Other';
  };

  const resolutionCategory = getResolutionCategory(ytdlpFormat.height);
  const bitrate = ytdlpFormat.abr || ytdlpFormat.tbr || undefined;

  return {
    formatId: ytdlpFormat.format_id,
    quality: qualityLabel,
    extension: ytdlpFormat.ext,
    filesize: ytdlpFormat.filesize || ytdlpFormat.filesize_approx || 0,
    hasVideo: ytdlpFormat.vcodec !== 'none',
    hasAudio: ytdlpFormat.acodec !== 'none',
    bitrate: bitrate,
    fps: ytdlpFormat.fps,
    codec:
      ytdlpFormat.vcodec !== 'none' ? ytdlpFormat.vcodec : ytdlpFormat.acodec,
    resolutionCategory: resolutionCategory,
  };
}

// Arbitrary generator for yt-dlp format objects
const ytdlpFormatArb = fc.record({
  format_id: fc.string({ minLength: 1, maxLength: 10 }),
  format_note: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
  quality: fc.option(
    fc.oneof(fc.string({ maxLength: 10 }), fc.integer({ min: 0, max: 10 })),
    { nil: undefined },
  ),
  ext: fc.constantFrom('mp4', 'webm', 'mkv', 'm4a', 'mp3', 'opus'),
  filesize: fc.option(fc.integer({ min: 1000, max: 5000000000 }), {
    nil: undefined,
  }),
  filesize_approx: fc.option(fc.integer({ min: 1000, max: 5000000000 }), {
    nil: undefined,
  }),
  vcodec: fc.constantFrom('h264', 'vp9', 'av1', 'none'),
  acodec: fc.constantFrom('aac', 'opus', 'mp3', 'none'),
  width: fc.option(fc.integer({ min: 144, max: 7680 }), { nil: undefined }),
  height: fc.option(fc.integer({ min: 144, max: 4320 }), { nil: undefined }),
  fps: fc.option(fc.integer({ min: 24, max: 120 }), { nil: undefined }),
  tbr: fc.option(fc.integer({ min: 32, max: 50000 }), { nil: undefined }),
  abr: fc.option(fc.integer({ min: 32, max: 320 }), { nil: undefined }),
  vbr: fc.option(fc.integer({ min: 100, max: 50000 }), { nil: undefined }),
});

describe('Format Extraction', () => {
  describe('Property 2: Format contains required information', () => {
    /**
     * Property: For any valid yt-dlp format, the extracted Format object
     * SHALL contain formatId, quality, extension, and filesize
     */
    it('should extract all required fields from any yt-dlp format', () => {
      fc.assert(
        fc.property(ytdlpFormatArb, (ytdlpFormat) => {
          const format = extractFormatInfo(ytdlpFormat);

          // Required fields must exist
          expect(format.formatId).toBeDefined();
          expect(format.quality).toBeDefined();
          expect(format.extension).toBeDefined();
          expect(typeof format.filesize).toBe('number');
          expect(typeof format.hasVideo).toBe('boolean');
          expect(typeof format.hasAudio).toBe('boolean');

          return true;
        }),
        { numRuns: 100 },
      );
    });

    /**
     * Property: Video formats with height should have correct quality label
     */
    it('should generate correct quality label for video formats with height', () => {
      fc.assert(
        fc.property(fc.integer({ min: 144, max: 4320 }), (height) => {
          const ytdlpFormat = {
            format_id: 'test',
            ext: 'mp4',
            vcodec: 'h264',
            acodec: 'aac',
            height: height,
          };

          const format = extractFormatInfo(ytdlpFormat);
          expect(format.quality).toBe(`${height}p`);

          return true;
        }),
        { numRuns: 100 },
      );
    });

    /**
     * Property: Resolution category should be correctly assigned based on height
     */
    it('should assign correct resolution category based on height', () => {
      const testCases = [
        { height: 2160, expected: '4K' },
        { height: 4320, expected: '4K' },
        { height: 1080, expected: '1080p' },
        { height: 1440, expected: '1080p' },
        { height: 720, expected: '720p' },
        { height: 480, expected: '480p' },
        { height: 360, expected: 'Other' },
        { height: 240, expected: 'Other' },
        { height: undefined, expected: 'Other' },
      ];

      testCases.forEach(({ height, expected }) => {
        const ytdlpFormat = {
          format_id: 'test',
          ext: 'mp4',
          vcodec: 'h264',
          acodec: 'aac',
          height: height,
        };

        const format = extractFormatInfo(ytdlpFormat);
        expect(format.resolutionCategory).toBe(expected);
      });
    });

    /**
     * Property: Audio-only formats should have hasVideo=false and hasAudio=true
     */
    it('should correctly identify audio-only formats', () => {
      fc.assert(
        fc.property(
          fc.record({
            format_id: fc.string({ minLength: 1, maxLength: 10 }),
            ext: fc.constantFrom('m4a', 'mp3', 'opus'),
            vcodec: fc.constant('none'),
            acodec: fc.constantFrom('aac', 'opus', 'mp3'),
            abr: fc.integer({ min: 32, max: 320 }),
          }),
          (ytdlpFormat) => {
            const format = extractFormatInfo(ytdlpFormat);

            expect(format.hasVideo).toBe(false);
            expect(format.hasAudio).toBe(true);

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * Property: Video formats should have hasVideo=true
     */
    it('should correctly identify video formats', () => {
      fc.assert(
        fc.property(
          fc.record({
            format_id: fc.string({ minLength: 1, maxLength: 10 }),
            ext: fc.constantFrom('mp4', 'webm', 'mkv'),
            vcodec: fc.constantFrom('h264', 'vp9', 'av1'),
            acodec: fc.constantFrom('aac', 'opus', 'none'),
            height: fc.integer({ min: 144, max: 4320 }),
          }),
          (ytdlpFormat) => {
            const format = extractFormatInfo(ytdlpFormat);

            expect(format.hasVideo).toBe(true);

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * Property: Bitrate should be extracted for audio formats
     */
    it('should extract bitrate for audio formats when available', () => {
      fc.assert(
        fc.property(fc.integer({ min: 32, max: 320 }), (abr) => {
          const ytdlpFormat = {
            format_id: 'test',
            ext: 'm4a',
            vcodec: 'none',
            acodec: 'aac',
            abr: abr,
          };

          const format = extractFormatInfo(ytdlpFormat);
          expect(format.bitrate).toBe(abr);

          return true;
        }),
        { numRuns: 100 },
      );
    });

    /**
     * Property: FPS should be preserved for video formats
     */
    it('should preserve fps for video formats', () => {
      fc.assert(
        fc.property(fc.integer({ min: 24, max: 120 }), (fps) => {
          const ytdlpFormat = {
            format_id: 'test',
            ext: 'mp4',
            vcodec: 'h264',
            acodec: 'aac',
            height: 1080,
            fps: fps,
          };

          const format = extractFormatInfo(ytdlpFormat);
          expect(format.fps).toBe(fps);

          return true;
        }),
        { numRuns: 100 },
      );
    });
  });
});
