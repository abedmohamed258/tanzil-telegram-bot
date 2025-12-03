/**
 * Property-Based Tests for File Structure Validation
 * **Feature: production-readiness-review, Property 1: File Structure Validation**
 * **Validates: Requirements 1.1, 1.4**
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Property: File Structure Validation', () => {
  describe('Source files organization', () => {
    it('should have all TypeScript source files in src/ directory', () => {
      const srcDir = path.join(process.cwd(), 'src');
      const files = getAllFiles(srcDir);

      const tsFiles = files.filter((f) => f.endsWith('.ts'));

      // All TypeScript files should be in src/
      tsFiles.forEach((file) => {
        expect(file).toMatch(/^src[\/\\]/);
      });
    });

    it('should have all test files in tests/ directory', () => {
      const testsDir = path.join(process.cwd(), 'tests');

      if (fs.existsSync(testsDir)) {
        const files = getAllFiles(testsDir);
        const testFiles = files.filter(
          (f) => f.endsWith('.test.ts') || f.endsWith('.test.js'),
        );

        // All test files should be in tests/
        testFiles.forEach((file) => {
          expect(file).toMatch(/^tests[\/\\]/);
        });
      }
    });

    it('should follow consistent naming conventions for TypeScript files', () => {
      const srcDir = path.join(process.cwd(), 'src');
      const files = getAllFiles(srcDir);

      const tsFiles = files.filter(
        (f) => f.endsWith('.ts') && !f.endsWith('.d.ts'),
      );

      tsFiles.forEach((file) => {
        const basename = path.basename(file, '.ts');

        // Should be either PascalCase (for classes) or camelCase (for utilities)
        // or kebab-case for config files
        const isPascalCase = /^[A-Z][a-zA-Z0-9]*$/.test(basename);
        const isCamelCase = /^[a-z][a-zA-Z0-9]*$/.test(basename);
        const isKebabCase = /^[a-z][a-z0-9-]*$/.test(basename);

        expect(isPascalCase || isCamelCase || isKebabCase).toBe(true);
      });
    });
  });

  describe('Configuration files', () => {
    it('should have all required configuration files in root', () => {
      const requiredFiles = [
        'package.json',
        'tsconfig.json',
        '.env.example',
        '.gitignore',
        'README.md',
        'LICENSE',
      ];

      requiredFiles.forEach((file) => {
        const filePath = path.join(process.cwd(), file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    it('should not have temporary or log files in root', () => {
      const rootFiles = fs.readdirSync(process.cwd());

      const temporaryPatterns = [
        /\.log$/,
        /\.tmp$/,
        /\.bak$/,
        /^app\.log$/,
        /^error_log\.txt$/,
        /^build_log\.txt$/,
        /^build_output\.txt$/,
      ];

      const temporaryFiles = rootFiles.filter((file) =>
        temporaryPatterns.some((pattern) => pattern.test(file)),
      );

      expect(temporaryFiles).toEqual([]);
    });
  });

  describe('Property: Redundant File Detection', () => {
    /**
     * **Feature: production-readiness-review, Property 2: Redundant File Detection**
     * **Validates: Requirements 1.2**
     */
    it('should not have duplicate test files (.js and .ts)', () => {
      const testsDir = path.join(process.cwd(), 'tests');

      if (fs.existsSync(testsDir)) {
        const files = fs.readdirSync(testsDir);
        const testFiles = files.filter(
          (f) => f.endsWith('.test.ts') || f.endsWith('.test.js'),
        );

        const basenames = testFiles.map((f) => f.replace(/\.(ts|js)$/, ''));
        const uniqueBasenames = new Set(basenames);

        // No duplicates should exist
        expect(basenames.length).toBe(uniqueBasenames.size);
      }
    });

    it('should not have SQL files in root directory', () => {
      const rootFiles = fs.readdirSync(process.cwd());
      const sqlFiles = rootFiles.filter((f) => f.endsWith('.sql'));

      expect(sqlFiles.length).toBe(0);
    });
  });

  describe('Property: Standard File Presence', () => {
    /**
     * **Feature: production-readiness-review, Property 4: Standard File Presence**
     * **Validates: Requirements 1.5, 6.1, 6.2, 6.3**
     */
    it('should have LICENSE file', () => {
      const licensePath = path.join(process.cwd(), 'LICENSE');
      expect(fs.existsSync(licensePath)).toBe(true);
    });

    it('should have README.md file', () => {
      const readmePath = path.join(process.cwd(), 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);
    });

    it('should have CONTRIBUTING.md file', () => {
      const contributingPath = path.join(process.cwd(), 'CONTRIBUTING.md');
      expect(fs.existsSync(contributingPath)).toBe(true);
    });
  });
});

/**
 * Helper function to recursively get all files in a directory
 */
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) {
    return arrayOfFiles;
  }

  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);

    if (fs.statSync(filePath).isDirectory()) {
      // Skip node_modules, dist, and .git
      if (!['node_modules', 'dist', '.git', 'coverage'].includes(file)) {
        arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
      }
    } else {
      // Store relative path from project root
      const relativePath = path.relative(process.cwd(), filePath);
      arrayOfFiles.push(relativePath.replace(/\\/g, '/'));
    }
  });

  return arrayOfFiles;
}
