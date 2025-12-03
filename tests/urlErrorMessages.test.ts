/**
 * Property-Based Tests for Invalid URL Error Messages
 * **Feature: production-readiness-review, Property 27: Invalid URL Error Messages**
 * **Validates: Requirements 7.1**
 */

import fc from 'fast-check';
import { URLValidator } from '../src/utils/UrlValidator';

describe('Property 27: Invalid URL Error Messages', () => {
  const validator = new URLValidator();

  describe('Error Message Completeness', () => {
    it('should include what was wrong with invalid URLs', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''), // Empty URL
            fc.constant('not-a-url'), // Invalid format
            fc.constant('https://unsupported-site.com/video'), // Unsupported platform
          ),
          (url: string) => {
            const result = validator.validate(url);

            if (!result.valid) {
              const errorMessage = validator.getValidationErrorMessage(result);

              // Error message should exist and be non-empty
              expect(errorMessage).toBeDefined();
              expect(errorMessage.length).toBeGreaterThan(0);

              // Should contain Arabic text explaining the error
              expect(errorMessage).toMatch(/[\u0600-\u06FF]/); // Contains Arabic characters
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include examples of valid URLs for unsupported platforms', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('https://unsupported-site.com/video'),
            fc.constant('https://example.com/content'),
            fc.constant('https://random-domain.org/media'),
          ),
          (url: string) => {
            const result = validator.validate(url);

            if (!result.valid && result.error === 'unsupported_platform') {
              const errorMessage = validator.getUnsupportedPlatformMessage();

              // Should contain examples (URLs with http/https)
              expect(errorMessage).toMatch(/https?:\/\//);

              // Should contain multiple examples (at least 2)
              const urlMatches = errorMessage.match(/https?:\/\/[^\s]+/g);
              expect(urlMatches).toBeDefined();
              expect(urlMatches!.length).toBeGreaterThanOrEqual(2);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should list all supported platforms in error message', () => {
      const unsupportedUrl = 'https://unsupported-site.com/video';
      const result = validator.validate(unsupportedUrl);

      if (!result.valid && result.error === 'unsupported_platform') {
        const errorMessage = validator.getUnsupportedPlatformMessage();
        const supportedPlatforms = validator.getSupportedPlatforms();

        // Each supported platform should be mentioned in the error message
        supportedPlatforms.forEach((platform) => {
          expect(errorMessage).toContain(platform);
        });
      }
    });

    it('should provide clear guidance for empty URLs', () => {
      const result = validator.validate('');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('empty_url');

      const errorMessage = validator.getValidationErrorMessage(result);

      // Should explain the issue
      expect(errorMessage).toMatch(/[\u0600-\u06FF]/); // Contains Arabic
      expect(errorMessage.length).toBeGreaterThan(10);

      // Should provide an example
      expect(errorMessage).toMatch(/https?:\/\//);
    });

    it('should provide clear guidance for malformed URLs', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('not-a-url'),
            fc.constant('just text'),
            fc.constant('www.youtube.com'), // Missing protocol
            fc.constant('youtube.com/watch'), // Missing protocol
          ),
          (url: string) => {
            const result = validator.validate(url);

            if (!result.valid && result.error === 'invalid_format') {
              const errorMessage = validator.getValidationErrorMessage(result);

              // Should explain format requirements
              expect(errorMessage).toMatch(/[\u0600-\u06FF]/); // Contains Arabic
              expect(errorMessage).toMatch(/https?/i); // Mentions http/https

              // Should provide examples
              expect(errorMessage).toMatch(/https?:\/\//);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Error Message Structure', () => {
    it('should have consistent structure across all error types', () => {
      const testCases = [
        { url: '', expectedError: 'empty_url' },
        { url: 'not-a-url', expectedError: 'invalid_format' },
        {
          url: 'https://unsupported.com/video',
          expectedError: 'unsupported_platform',
        },
      ];

      testCases.forEach(({ url, expectedError }) => {
        const result = validator.validate(url);

        expect(result.valid).toBe(false);
        expect(result.error).toBe(expectedError);

        const errorMessage = validator.getValidationErrorMessage(result);

        // All error messages should:
        // 1. Be non-empty
        expect(errorMessage.length).toBeGreaterThan(0);

        // 2. Contain Arabic text
        expect(errorMessage).toMatch(/[\u0600-\u06FF]/);

        // 3. Be user-friendly (not too technical)
        expect(errorMessage).not.toMatch(/error|exception|null|undefined/i);
      });
    });

    it('should include visual indicators (emojis) for better UX', () => {
      const testCases = ['', 'not-a-url', 'https://unsupported.com/video'];

      testCases.forEach((url) => {
        const result = validator.validate(url);

        if (!result.valid) {
          const errorMessage = validator.getValidationErrorMessage(result);

          // Should contain at least one emoji for visual clarity
          expect(errorMessage).toMatch(/[\u{1F300}-\u{1F9FF}]|[❌⚠️✅📝📱]/u);
        }
      });
    });
  });

  describe('Supported Platforms Information', () => {
    it('should return consistent list of supported platforms', () => {
      fc.assert(
        fc.property(fc.constant(true), () => {
          const platforms1 = validator.getSupportedPlatforms();
          const platforms2 = validator.getSupportedPlatforms();

          // Should return same list every time
          expect(platforms1).toEqual(platforms2);

          // Should have at least 5 platforms
          expect(platforms1.length).toBeGreaterThanOrEqual(5);

          // Each platform should be a non-empty string
          platforms1.forEach((platform) => {
            expect(typeof platform).toBe('string');
            expect(platform.length).toBeGreaterThan(0);
          });
        }),
        { numRuns: 100 },
      );
    });

    it('should provide examples for each supported platform', () => {
      const unsupportedUrl = 'https://unsupported.com/video';
      const result = validator.validate(unsupportedUrl);

      if (!result.valid && result.error === 'unsupported_platform') {
        const errorMessage = validator.getUnsupportedPlatformMessage();
        const supportedPlatforms = validator.getSupportedPlatforms();

        // For each platform, there should be at least one example URL
        supportedPlatforms.forEach((platform) => {
          // Find the platform section in the message
          const platformIndex = errorMessage.indexOf(platform);
          expect(platformIndex).toBeGreaterThan(-1);

          // After the platform name, there should be example URLs
          const afterPlatform = errorMessage.substring(platformIndex);
          expect(afterPlatform).toMatch(/https?:\/\//);
        });
      }
    });
  });

  describe('URL Extraction and Validation', () => {
    it('should validate extracted URLs and provide appropriate errors', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('Check this out: https://unsupported.com/video'),
            fc.constant('Download from not-a-url please'),
            fc.constant('Here is the link: www.youtube.com/watch'),
          ),
          (text: string) => {
            const extractedUrl = validator.extractURL(text);

            if (extractedUrl) {
              const result = validator.validate(extractedUrl);

              if (!result.valid) {
                const errorMessage =
                  validator.getValidationErrorMessage(result);

                // Error message should be helpful
                expect(errorMessage.length).toBeGreaterThan(0);
                expect(errorMessage).toMatch(/[\u0600-\u06FF]/);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Error Message Localization', () => {
    it('should provide error messages in Arabic', () => {
      const testUrls = ['', 'invalid', 'https://unsupported.com/video'];

      testUrls.forEach((url) => {
        const result = validator.validate(url);

        if (!result.valid) {
          const errorMessage = validator.getValidationErrorMessage(result);

          // Should contain Arabic characters
          expect(errorMessage).toMatch(/[\u0600-\u06FF]/);

          // Arabic characters should be present (examples may have English URLs)
          const arabicChars = (errorMessage.match(/[\u0600-\u06FF]/g) || [])
            .length;
          expect(arabicChars).toBeGreaterThan(0);
        }
      });
    });
  });
});
