/**
 * Property-Based Tests for MarkdownSanitizer
 *
 * **Feature: quality-selection-menu, Property 11: Markdown escape handles special characters**
 * **Validates: Requirements 5.1, 5.2**
 */

import * as fc from 'fast-check';
import { MarkdownSanitizer } from '../src/utils/MarkdownSanitizer';

describe('MarkdownSanitizer', () => {
  // Markdown special characters that need escaping
  const MARKDOWN_SPECIAL_CHARS = [
    '_',
    '*',
    '[',
    ']',
    '(',
    ')',
    '~',
    '`',
    '>',
    '#',
    '+',
    '-',
    '=',
    '|',
    '{',
    '}',
    '.',
    '!',
    '\\',
  ];

  describe('Property 11: Markdown escape handles special characters', () => {
    /**
     * Property: For any string containing Markdown special characters,
     * the escape function SHALL produce a string where all special characters are escaped
     */
    it('should escape all Markdown special characters in any string', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 500 }), (input) => {
          const escaped = MarkdownSanitizer.escape(input);

          // Check that all special characters in the result are escaped
          for (let i = 0; i < escaped.length; i++) {
            const char = escaped[i];
            if (MARKDOWN_SPECIAL_CHARS.includes(char) && char !== '\\') {
              // If we find a special char, the previous char must be backslash
              if (i === 0 || escaped[i - 1] !== '\\') {
                return false;
              }
            }
          }
          return true;
        }),
        { numRuns: 100 },
      );
    });

    /**
     * Property: Escaping should be idempotent in terms of safety
     * (escaped text should not cause parsing errors)
     */
    it('should produce output that contains no unescaped special characters', () => {
      fc.assert(
        fc.property(
          fc
            .array(
              fc.constantFrom(
                ...MARKDOWN_SPECIAL_CHARS,
                'a',
                'b',
                'c',
                '1',
                '2',
                '3',
                ' ',
              ),
            )
            .map((arr) => arr.join('')),
          (input: string) => {
            const escaped = MarkdownSanitizer.escape(input);

            // Count unescaped special chars (not preceded by backslash)
            let unescapedCount = 0;
            for (let i = 0; i < escaped.length; i++) {
              const char = escaped[i];
              if (MARKDOWN_SPECIAL_CHARS.includes(char) && char !== '\\') {
                if (i === 0 || escaped[i - 1] !== '\\') {
                  unescapedCount++;
                }
              }
            }

            return unescapedCount === 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * Property: Empty string should return empty string
     */
    it('should handle empty strings', () => {
      expect(MarkdownSanitizer.escape('')).toBe('');
    });

    /**
     * Property: Strings without special characters should remain unchanged
     */
    it('should not modify strings without special characters', () => {
      fc.assert(
        fc.property(
          fc
            .array(
              fc.constantFrom(
                ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split(
                  '',
                ),
              ),
            )
            .map((arr) => arr.join('')),
          (input: string) => {
            const escaped = MarkdownSanitizer.escape(input);
            return escaped === input;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('sanitizeTitle', () => {
    /**
     * Property: Title sanitization should always produce a non-empty result
     */
    it('should always return a non-empty string', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = MarkdownSanitizer.sanitizeTitle(input);
          return result.length > 0;
        }),
        { numRuns: 100 },
      );
    });

    /**
     * Property: Long titles should be truncated
     */
    it('should truncate titles longer than 100 characters', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 101, maxLength: 500 }), (input) => {
          const result = MarkdownSanitizer.sanitizeTitle(input);
          // After escaping, the result might be longer, but truncation happens after
          return result.length <= 103; // 100 + "..."
        }),
        { numRuns: 50 },
      );
    });

    it('should return "Unknown" for empty or null input', () => {
      expect(MarkdownSanitizer.sanitizeTitle('')).toBe('Unknown');
      expect(MarkdownSanitizer.sanitizeTitle(null as any)).toBe('Unknown');
      expect(MarkdownSanitizer.sanitizeTitle(undefined as any)).toBe('Unknown');
    });
  });

  describe('sanitizeChannel', () => {
    it('should return "Unknown" for empty input', () => {
      expect(MarkdownSanitizer.sanitizeChannel('')).toBe('Unknown');
    });

    it('should escape special characters in channel names', () => {
      const input = 'Channel_Name*Test';
      const result = MarkdownSanitizer.sanitizeChannel(input);
      expect(result).toContain('\\');
    });
  });

  describe('stripMarkdown', () => {
    /**
     * Property: Stripped text should not contain Markdown formatting characters
     */
    it('should remove all Markdown formatting', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const stripped = MarkdownSanitizer.stripMarkdown(input);
          // Should not contain consecutive asterisks or underscores
          return !stripped.includes('**') && !stripped.includes('__');
        }),
        { numRuns: 100 },
      );
    });

    it('should remove bold markers', () => {
      expect(MarkdownSanitizer.stripMarkdown('*bold*')).toBe('bold');
      expect(MarkdownSanitizer.stripMarkdown('**bold**')).toBe('bold');
    });

    it('should remove code markers', () => {
      expect(MarkdownSanitizer.stripMarkdown('`code`')).toBe('code');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(MarkdownSanitizer.formatDuration(0)).toBe('00:00');
      expect(MarkdownSanitizer.formatDuration(65)).toBe('01:05');
      expect(MarkdownSanitizer.formatDuration(3661)).toBe('01:01:01');
    });

    it('should handle negative values', () => {
      expect(MarkdownSanitizer.formatDuration(-10)).toBe('00:00');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes to MB correctly', () => {
      expect(MarkdownSanitizer.formatFileSize(1048576)).toBe('1.0MB');
      expect(MarkdownSanitizer.formatFileSize(15728640)).toBe('15.0MB');
    });

    it('should format large sizes to GB', () => {
      expect(MarkdownSanitizer.formatFileSize(1073741824)).toBe('1.0GB');
    });

    it('should return empty string for zero or negative', () => {
      expect(MarkdownSanitizer.formatFileSize(0)).toBe('');
      expect(MarkdownSanitizer.formatFileSize(-100)).toBe('');
    });
  });

  describe('buildSafeMessage', () => {
    it('should replace placeholders with escaped values', () => {
      const template = 'Title: {title}, Channel: {channel}';
      const data = { title: 'Test*Video', channel: 'My_Channel' };
      const result = MarkdownSanitizer.buildSafeMessage(template, data);

      expect(result).toContain('Test\\*Video');
      expect(result).toContain('My\\_Channel');
    });

    it('should handle missing placeholders gracefully', () => {
      const template = 'Title: {title}';
      const data = { other: 'value' };
      const result = MarkdownSanitizer.buildSafeMessage(template, data);

      expect(result).toBe('Title: {title}');
    });
  });
});
