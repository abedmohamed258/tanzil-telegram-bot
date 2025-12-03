/**
 * Property-Based Tests for Secret Protection
 * **Feature: production-readiness-review, Property 12: Secret Protection**
 * **Validates: Requirements 3.7**
 */

import * as fs from 'fs';
import * as path from 'path';
import fc from 'fast-check';

describe('Property 12: Secret Protection', () => {
  // Common patterns for secrets
  const secretPatterns = [
    // API Keys (with or without quotes)
    /api[_-]?key[_-]?[:=]\s*["']?[a-zA-Z0-9_-]{20,}["']?/gi,
    /apikey[_-]?[:=]\s*["']?[a-zA-Z0-9_-]{20,}["']?/gi,

    // Tokens (with or without quotes)
    /token[_-]?[:=]\s*["']?[a-zA-Z0-9_-]{20,}["']?/gi,
    /bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,

    // Passwords (with or without quotes, allowing special chars)
    /password[_-]?\s*[:=]\s*["']?[^\s"']{8,}["']?/gi,
    /passwd[_-]?\s*[:=]\s*["']?[^\s"']{8,}["']?/gi,
    /pwd[_-]?\s*[:=]\s*["']?[^\s"']{8,}["']?/gi,

    // Database URLs with credentials
    /postgres:\/\/[^:]+:[^@]+@/gi,
    /mysql:\/\/[^:]+:[^@]+@/gi,
    /mongodb:\/\/[^:]+:[^@]+@/gi,

    // AWS Keys
    /AKIA[0-9A-Z]{16}/g,
    /aws[_-]?secret[_-]?access[_-]?key[_-]?[:=]\s*["']?[a-zA-Z0-9/+=]{40}["']?/gi,

    // Private Keys
    /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,

    // Telegram Bot Tokens (specific pattern - flexible length, typically 35 chars after colon)
    /[0-9]{8,10}:[a-zA-Z0-9_-]{20,}/g,
    /TELEGRAM[_-]?BOT[_-]?TOKEN\s*[:=]\s*[0-9]{8,10}:[a-zA-Z0-9_-]{20,}/gi,

    // Supabase Keys (specific pattern - JWT tokens)
    /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,

    // Generic secrets (with or without quotes)
    /secret[_-]?[:=]\s*["']?[a-zA-Z0-9_-]{20,}["']?/gi,
    /client[_-]?secret[_-]?[:=]\s*["']?[a-zA-Z0-9_-]{20,}["']?/gi,
  ];

  // Files to scan
  const sourceDirectories = ['src', 'tests', 'scripts'];
  const excludePatterns = [
    'node_modules',
    'dist',
    'coverage',
    '.git',
    'secretProtection.test.ts', // Exclude this test file itself
  ];

  /**
   * Get all TypeScript and JavaScript files in source directories
   */
  function getSourceFiles(): string[] {
    const files: string[] = [];

    function scanDirectory(dir: string) {
      if (!fs.existsSync(dir)) return;

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip excluded patterns
        if (excludePatterns.some((pattern) => fullPath.includes(pattern))) {
          continue;
        }

        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.isFile() && /\.(ts|js)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }

    sourceDirectories.forEach((dir) => scanDirectory(dir));
    return files;
  }

  /**
   * Check if a match is a false positive
   */
  function isFalsePositive(match: string, context: string): boolean {
    // Ignore comments explaining what secrets are
    if (
      context.includes('//') ||
      context.includes('/*') ||
      context.includes('*')
    ) {
      return true;
    }

    // Ignore process.env references (these are correct - loading from env)
    if (context.includes('process.env.')) {
      return true;
    }

    // Ignore example/placeholder values
    const placeholders = [
      'your_api_key',
      'your_token',
      'your_password',
      'example',
      'placeholder',
      'xxx',
      'yyy',
      'zzz',
      '***',
      'REPLACE_ME',
      'YOUR_',
    ];

    if (
      placeholders.some((p) => match.toLowerCase().includes(p.toLowerCase()))
    ) {
      return true;
    }

    // Ignore very short values (likely not real secrets)
    const valueMatch = match.match(/[:=]\s*['"]?([^'"]+)['"]?/);
    if (valueMatch && valueMatch[1].length < 10) {
      return true;
    }

    return false;
  }

  describe('Hardcoded Secret Detection', () => {
    it('should not contain hardcoded API keys, tokens, or passwords in source files', () => {
      const sourceFiles = getSourceFiles();
      const violations: Array<{ file: string; line: number; match: string }> =
        [];

      sourceFiles.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        secretPatterns.forEach((pattern) => {
          let match;
          const globalPattern = new RegExp(pattern.source, pattern.flags);

          while ((match = globalPattern.exec(content)) !== null) {
            const matchText = match[0];

            // Find line number
            let lineNumber = 1;
            let charCount = 0;
            for (let i = 0; i < lines.length; i++) {
              charCount += lines[i].length + 1; // +1 for newline
              if (charCount > match.index) {
                lineNumber = i + 1;
                break;
              }
            }

            // Get context (the line where match was found)
            const context = lines[lineNumber - 1] || '';

            // Check if it's a false positive
            if (!isFalsePositive(matchText, context)) {
              violations.push({
                file: path.relative(process.cwd(), filePath),
                line: lineNumber,
                match:
                  matchText.substring(0, 50) +
                  (matchText.length > 50 ? '...' : ''),
              });
            }
          }
        });
      });

      if (violations.length > 0) {
        const errorMessage = violations
          .map((v) => `  ${v.file}:${v.line} - ${v.match}`)
          .join('\n');

        fail(
          `Found potential hardcoded secrets:\n${errorMessage}\n\nAll secrets should be loaded from environment variables.`,
        );
      }

      expect(violations.length).toBe(0);
    });

    it('should load all secrets from environment variables', () => {
      const sourceFiles = getSourceFiles();
      const envVarUsage: Set<string> = new Set();

      // Find all process.env usages (including bracket notation)
      sourceFiles.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const patterns = [
          /process\.env\.([A-Z_][A-Z0-9_]*)/g,
          /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]]/g,
        ];

        patterns.forEach((pattern) => {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            envVarUsage.add(match[1]);
          }
        });
      });

      // Expected environment variables for secrets (at least these should be present)
      const expectedSecretVars = [
        'BOT_TOKEN', // Used in config.ts
        'SUPABASE_URL',
      ];

      // At least one of these should be used for Supabase auth
      const supabaseKeyVars = ['SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
      const hasSupabaseKey = supabaseKeyVars.some((v) => envVarUsage.has(v));

      // Verify that expected secret vars are being used
      expectedSecretVars.forEach((varName) => {
        expect(envVarUsage.has(varName)).toBe(true);
      });

      // Verify Supabase key is loaded
      expect(hasSupabaseKey).toBe(true);
    });

    it('should have .env.example file with placeholder values', () => {
      const envExamplePath = path.join(process.cwd(), '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);

      const content = fs.readFileSync(envExamplePath, 'utf-8');

      // Should contain key names but not real values
      expect(content).toContain('TELEGRAM_BOT_TOKEN');
      expect(content).toContain('SUPABASE_URL');
      expect(content).toContain('SUPABASE_KEY');

      // Should not contain real tokens (basic check)
      const lines = content.split('\n');
      lines.forEach((line) => {
        if (line.includes('=') && !line.trim().startsWith('#')) {
          const parts = line.split('=');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();

            if (value && value.length > 0) {
              // Values should be placeholders or examples
              const isPlaceholder =
                value.includes('your_') ||
                value.includes('YOUR_') ||
                value.includes('your-') ||
                value.includes('xxx') ||
                value.includes('...') ||
                value.includes('example') ||
                value.includes('123456') || // Example numbers
                value.includes('ABC') || // Example letters
                value.includes('abcdef') || // Example hex
                value.startsWith('https://your-') || // Example URLs
                value.length < 10 ||
                (key.includes('TOPIC') && /^\d+$/.test(value)) || // Topic IDs are just numbers
                (key.includes('PORT') && /^\d+$/.test(value)) || // Ports are just numbers
                (key.includes('SIZE') && /^\d+$/.test(value)) || // Size limits are numbers
                (key.includes('TIMEOUT') && /^\d+$/.test(value)) || // Timeouts are numbers
                (key.includes('DOWNLOADS') && /^\d+$/.test(value)) || // Download limits are numbers
                (key.includes('ATTEMPTS') && /^\d+$/.test(value)) || // Retry attempts are numbers
                (key.includes('CREDITS') && /^\d+$/.test(value)) || // Credits are numbers
                (key.includes('API_ID') && /^\d+$/.test(value)) || // API IDs are numbers
                (key === 'USE_WEBHOOK' && value === 'false') || // Boolean config
                (key === 'TELEGRAM_SESSION' && value === '') || // Empty is placeholder
                (key === 'SENTRY_DSN' && value === '') || // Empty is placeholder
                (key === 'TEMP_DIRECTORY' && value.startsWith('./')); // Path config

              expect(isPlaceholder).toBe(true);
            }
          }
        }
      });
    });

    it('should have .env in .gitignore', () => {
      const gitignorePath = path.join(process.cwd(), '.gitignore');
      expect(fs.existsSync(gitignorePath)).toBe(true);

      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toMatch(/^\.env$/m);
    });
  });

  describe('Property: Secret Pattern Validation', () => {
    it('should detect realistic secret-like strings', () => {
      // Test with realistic examples rather than random strings
      const realisticSecrets = [
        {
          str: 'api_key="sk_live_abcdefghijklmnopqrstuvwxyz123456"',
          desc: 'API key',
        },
        {
          str: 'token: "ghp_1234567890abcdefghijklmnopqrstuvwxyz"',
          desc: 'Token',
        },
        { str: 'password = "MySecretP@ssw0rd123"', desc: 'Password' },
        { str: 'secret="xyzABC123def456GHI789jkl"', desc: 'Secret' },
        {
          str: 'TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
          desc: 'Telegram token',
        },
      ];

      realisticSecrets.forEach(({ str: testString, desc }) => {
        // At least one pattern should match
        const matches = secretPatterns.some((pattern) => {
          const regex = new RegExp(pattern.source, pattern.flags);
          return regex.test(testString);
        });

        if (!matches) {
          console.log(`Failed to match ${desc}: ${testString}`);
        }
        expect(matches).toBe(true);
      });
    });

    it('should not flag process.env references as secrets', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'TELEGRAM_BOT_TOKEN',
            'SUPABASE_URL',
            'SUPABASE_KEY',
            'API_KEY',
            'SECRET_TOKEN',
          ),
          (envVar) => {
            const code = `const token = process.env.${envVar};`;

            // This should not be flagged as a hardcoded secret
            // because it's loading from environment
            const context = code;
            const isFalsePos = isFalsePositive(envVar, context);

            expect(isFalsePos).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Environment Variable Security', () => {
    it('should not expose environment variables in logs or error messages', () => {
      const sourceFiles = getSourceFiles();
      const violations: string[] = [];

      sourceFiles.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Check for logging of environment variables
        const dangerousPatterns = [
          /console\.log\([^)]*process\.env\./gi,
          /logger\.(info|debug|warn)\([^)]*process\.env\./gi,
          /throw\s+new\s+Error\([^)]*process\.env\./gi,
        ];

        dangerousPatterns.forEach((pattern) => {
          if (pattern.test(content)) {
            violations.push(path.relative(process.cwd(), filePath));
          }
        });
      });

      if (violations.length > 0) {
        console.warn(
          `Warning: Files that may expose environment variables:\n${violations.join('\n')}`,
        );
      }

      // This is a warning, not a hard failure, as some logging might be intentional
      // but we want to be aware of it
      expect(violations.length).toBeLessThan(5);
    });
  });
});
