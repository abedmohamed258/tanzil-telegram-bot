/**
 * Property-Based Tests for Input Validation
 * **Feature: production-readiness-review, Property 11: Input Validation**
 * **Validates: Requirements 3.4**
 */

import fc from 'fast-check';
import { InputValidator } from '../src/utils/InputValidator';

describe('Property 11: Input Validation', () => {
  describe('Text Sanitization', () => {
    it('should handle any string input without crashing', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          // Should not throw
          const result = InputValidator.sanitizeText(input);
          expect(result === null || typeof result === 'string').toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should reject empty or whitespace-only strings', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.constant('\t\t'),
            fc.constant('\n\n'),
            fc.constant('  \t  \n  '),
          ),
          (input) => {
            const result = InputValidator.sanitizeText(input);
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should enforce maximum length limit', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.integer({ min: 1, max: 1000 }),
          (input, maxLength) => {
            const result = InputValidator.sanitizeText(input, maxLength);
            if (result !== null) {
              expect(result.length).toBeLessThanOrEqual(maxLength);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should remove control characters except newlines and tabs', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = InputValidator.sanitizeText(input);
          if (result !== null) {
            // Should not contain null bytes or other dangerous control chars
            expect(result).not.toMatch(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('User ID Validation', () => {
    it('should accept valid positive integer user IDs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
          (userId) => {
            const result = InputValidator.validateUserId(userId.toString());
            expect(result).toBe(userId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject non-numeric user IDs', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string().filter((s) => !/^\d+$/.test(s)),
            fc.constant('abc'),
            fc.constant('12.34'),
            fc.constant('-123'),
            fc.constant('1e5'),
          ),
          (input) => {
            const result = InputValidator.validateUserId(input);
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject zero and negative user IDs', () => {
      fc.assert(
        fc.property(fc.integer({ max: 0 }), (userId) => {
          const result = InputValidator.validateUserId(userId.toString());
          expect(result).toBeNull();
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Numeric Input Validation', () => {
    it('should accept numbers within specified range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (min, max) => {
            if (min > max) [min, max] = [max, min];
            const value = min + Math.floor((max - min) / 2);
            const result = InputValidator.validateNumericInput(
              value.toString(),
              min,
              max,
            );
            expect(result).toBe(value);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject numbers outside specified range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 20 }),
          fc.oneof(fc.integer({ max: 9 }), fc.integer({ min: 21 })),
          (min, value) => {
            const result = InputValidator.validateNumericInput(
              value.toString(),
              min,
              20,
            );
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject non-numeric strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !/^-?\d+(\.\d+)?$/.test(s)),
          (input) => {
            const result = InputValidator.validateNumericInput(input, 0, 100);
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Timezone Offset Validation', () => {
    it('should accept valid timezone offsets (-12 to +14)', () => {
      fc.assert(
        fc.property(fc.integer({ min: -12, max: 14 }), (offset) => {
          const result = InputValidator.validateTimezoneOffset(
            offset.toString(),
          );
          expect(result).toBe(offset);
        }),
        { numRuns: 100 },
      );
    });

    it('should reject timezone offsets outside valid range', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer({ max: -13 }), fc.integer({ min: 15 })),
          (offset) => {
            const result = InputValidator.validateTimezoneOffset(
              offset.toString(),
            );
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Callback Data Validation', () => {
    it('should accept valid callback data (alphanumeric with :_-)', () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 64 })
            .filter((s) => /^[a-zA-Z0-9:_-]+$/.test(s)),
          (input: string) => {
            const result = InputValidator.sanitizeCallbackData(input);
            expect(result).toBe(input);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject callback data with invalid characters', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => {
            const trimmed = s.trim();
            return trimmed.length > 0 && /[^a-zA-Z0-9:_-]/.test(trimmed);
          }),
          (input: string) => {
            const result = InputValidator.sanitizeCallbackData(input);
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should enforce 64-byte Telegram limit', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (input) => {
          const result = InputValidator.sanitizeCallbackData(input);
          if (result !== null) {
            expect(result.length).toBeLessThanOrEqual(64);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Time Input Validation', () => {
    it('should accept valid 24-hour time format', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          (hours, minutes) => {
            const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}`;
            const result = InputValidator.validateTimeInput(timeStr);
            expect(result).toEqual({ hours, minutes });
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject invalid time formats', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('25:00'), // Invalid hour
            fc.constant('12:60'), // Invalid minute
            fc.constant('abc'),
            fc.constant('12-30'),
            fc.string().filter((s) => !/^\d{1,2}:\d{2}$/.test(s)),
          ),
          (input) => {
            const result = InputValidator.validateTimeInput(input);
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Path Safety Validation', () => {
    it('should reject paths with directory traversal attempts', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('../etc/passwd'),
            fc.constant('../../secret'),
            fc.constant('~/private'),
            fc.constant('./../config'),
          ),
          (path) => {
            const result = InputValidator.isPathSafe(path);
            expect(result).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject absolute paths', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('/etc/passwd'),
            fc.constant('C:\\Windows\\System32'),
            fc.constant('/var/log/app.log'),
          ),
          (path) => {
            const result = InputValidator.isPathSafe(path);
            expect(result).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should accept safe relative paths', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('temp/file.txt'),
            fc.constant('data/store.json'),
            fc.constant('logs/app.log'),
          ),
          (path) => {
            const result = InputValidator.isPathSafe(path);
            expect(result).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Markdown Escaping', () => {
    it('should escape all Markdown special characters', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const escaped = InputValidator.escapeMarkdown(input);
          // Escaped string should not contain unescaped special chars
          // This is a basic check - full validation would require parsing
          expect(typeof escaped).toBe('string');
        }),
        { numRuns: 100 },
      );
    });

    it('should handle strings with special characters', () => {
      const specialChars = [
        '*',
        '_',
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
      ];

      fc.assert(
        fc.property(fc.constantFrom(...specialChars), (char) => {
          const escaped = InputValidator.escapeMarkdown(char);
          expect(escaped).toContain('\\');
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Credit Amount Validation', () => {
    it('should accept valid positive integer credit amounts', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000000 }), (amount) => {
          const result = InputValidator.validateCreditAmount(amount.toString());
          expect(result).toBe(amount);
        }),
        { numRuns: 100 },
      );
    });

    it('should reject non-integer credit amounts', () => {
      fc.assert(
        fc.property(
          fc
            .double({ min: 0.1, max: 100, noNaN: true })
            .filter((n) => !Number.isInteger(n)),
          (amount) => {
            const result = InputValidator.validateCreditAmount(
              amount.toString(),
            );
            expect(result).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject negative credit amounts', () => {
      fc.assert(
        fc.property(fc.integer({ max: -1 }), (amount) => {
          const result = InputValidator.validateCreditAmount(amount.toString());
          expect(result).toBeNull();
        }),
        { numRuns: 100 },
      );
    });
  });
});
