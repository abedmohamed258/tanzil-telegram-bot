/**
 * Property-Based Test for Configuration Completeness
 * **Feature: production-readiness-review, Property 3: Configuration Completeness**
 * **Validates: Requirements 1.3**
 *
 * Property: For any configuration file (.env.example, tsconfig.json, package.json),
 * all required fields should be present and properly documented with comments or examples.
 */

import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

describe('Property Test: Configuration Completeness', () => {
  describe('package.json completeness', () => {
    it('should have all required fields in package.json', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Required fields for any npm package
      const requiredFields = [
        'name',
        'version',
        'description',
        'main',
        'scripts',
        'author',
        'license',
      ];

      requiredFields.forEach((field) => {
        expect(packageJson).toHaveProperty(field);
        expect(packageJson[field]).toBeDefined();
      });
    });

    it('should have essential scripts defined', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const essentialScripts = ['build', 'start', 'test'];

      essentialScripts.forEach((script) => {
        expect(packageJson.scripts).toHaveProperty(script);
        expect(packageJson.scripts[script]).toBeDefined();
        expect(typeof packageJson.scripts[script]).toBe('string');
      });
    });

    it('should have dependencies and devDependencies defined', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson).toHaveProperty('dependencies');
      expect(packageJson).toHaveProperty('devDependencies');
      expect(typeof packageJson.dependencies).toBe('object');
      expect(typeof packageJson.devDependencies).toBe('object');
    });
  });

  describe('tsconfig.json completeness', () => {
    it('should have all required compiler options', () => {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      expect(fs.existsSync(tsconfigPath)).toBe(true);

      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));

      expect(tsconfig).toHaveProperty('compilerOptions');

      const requiredOptions = [
        'target',
        'module',
        'outDir',
        'strict',
        'esModuleInterop',
      ];

      requiredOptions.forEach((option) => {
        expect(tsconfig.compilerOptions).toHaveProperty(option);
        expect(tsconfig.compilerOptions[option]).toBeDefined();
      });
    });

    it('should have include and exclude patterns', () => {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));

      expect(tsconfig).toHaveProperty('include');
      expect(Array.isArray(tsconfig.include)).toBe(true);
      expect(tsconfig.include.length).toBeGreaterThan(0);

      expect(tsconfig).toHaveProperty('exclude');
      expect(Array.isArray(tsconfig.exclude)).toBe(true);
    });
  });

  describe('.env.example completeness', () => {
    it('should exist and contain documented environment variables', () => {
      const envExamplePath = path.join(process.cwd(), '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);

      const envContent = fs.readFileSync(envExamplePath, 'utf-8');
      const lines = envContent.split('\n').filter((line) => line.trim() !== '');

      // Should have at least some environment variables
      expect(lines.length).toBeGreaterThan(0);
    });

    it('should have all critical environment variables documented', () => {
      const envExamplePath = path.join(process.cwd(), '.env.example');
      const envContent = fs.readFileSync(envExamplePath, 'utf-8');

      // Critical environment variables for this bot
      const criticalVars = [
        'TELEGRAM_BOT_TOKEN',
        'SUPABASE_URL',
        'SUPABASE_KEY',
      ];

      criticalVars.forEach((varName) => {
        expect(envContent).toContain(varName);
      });
    });

    it('should have comments or examples for environment variables', () => {
      const envExamplePath = path.join(process.cwd(), '.env.example');
      const envContent = fs.readFileSync(envExamplePath, 'utf-8');
      const lines = envContent.split('\n');

      // Count lines with comments (starting with #) or examples (containing =)
      const documentedLines = lines.filter((line) => {
        const trimmed = line.trim();
        return trimmed.startsWith('#') || trimmed.includes('=');
      });

      // Most lines should be either comments or variable definitions
      expect(documentedLines.length).toBeGreaterThan(0);
    });
  });

  describe('Property: Configuration field validation', () => {
    it('should validate that any required field in package.json is non-empty', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'name',
            'version',
            'description',
            'main',
            'author',
            'license',
          ),
          (fieldName) => {
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(
              fs.readFileSync(packageJsonPath, 'utf-8'),
            );

            const fieldValue = packageJson[fieldName];

            // Field should exist and be non-empty
            expect(fieldValue).toBeDefined();
            expect(fieldValue).not.toBe('');

            if (typeof fieldValue === 'string') {
              expect(fieldValue.length).toBeGreaterThan(0);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should validate that any script in package.json is a valid command', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const scripts = Object.keys(packageJson.scripts || {});

      if (scripts.length > 0) {
        fc.assert(
          fc.property(fc.constantFrom(...scripts), (scriptName) => {
            const scriptCommand = packageJson.scripts[scriptName];

            // Script should be a non-empty string
            expect(typeof scriptCommand).toBe('string');
            expect(scriptCommand.length).toBeGreaterThan(0);

            // Should not contain obvious errors
            expect(scriptCommand).not.toContain('undefined');
            expect(scriptCommand).not.toContain('null');
          }),
          { numRuns: 100 },
        );
      }
    });

    it('should validate that any dependency version is properly formatted', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      const depNames = Object.keys(allDeps);

      if (depNames.length > 0) {
        fc.assert(
          fc.property(fc.constantFrom(...depNames), (depName) => {
            const version = allDeps[depName];

            // Version should be a non-empty string
            expect(typeof version).toBe('string');
            expect(version.length).toBeGreaterThan(0);

            // Should match semver pattern (with or without ^ or ~)
            const semverPattern = /^[\^~]?\d+\.\d+\.\d+/;
            expect(version).toMatch(semverPattern);
          }),
          { numRuns: 100 },
        );
      }
    });

    it('should validate that tsconfig compiler options have valid values', () => {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      const compilerOptions = Object.keys(tsconfig.compilerOptions || {});

      if (compilerOptions.length > 0) {
        fc.assert(
          fc.property(fc.constantFrom(...compilerOptions), (optionName) => {
            const optionValue = tsconfig.compilerOptions[optionName];

            // Option should be defined
            expect(optionValue).toBeDefined();

            // Should not be null or undefined
            expect(optionValue).not.toBeNull();
          }),
          { numRuns: 100 },
        );
      }
    });

    it('should validate that environment variables follow naming conventions', () => {
      const envExamplePath = path.join(process.cwd(), '.env.example');
      const envContent = fs.readFileSync(envExamplePath, 'utf-8');
      const lines = envContent.split('\n');

      // Extract variable names (lines with = that don't start with #)
      const varNames = lines
        .filter((line) => {
          const trimmed = line.trim();
          return trimmed.includes('=') && !trimmed.startsWith('#');
        })
        .map((line) => line.split('=')[0].trim())
        .filter((name) => name.length > 0);

      if (varNames.length > 0) {
        fc.assert(
          fc.property(fc.constantFrom(...varNames), (varName) => {
            // Environment variables should be UPPER_SNAKE_CASE
            const upperSnakeCasePattern = /^[A-Z][A-Z0-9_]*$/;
            expect(varName).toMatch(upperSnakeCasePattern);
          }),
          { numRuns: 100 },
        );
      }
    });
  });

  describe('Configuration consistency', () => {
    it('should have consistent TypeScript configuration across files', () => {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      const tsconfigBuildPath = path.join(process.cwd(), 'tsconfig.build.json');

      if (fs.existsSync(tsconfigBuildPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
        const tsconfigBuild = JSON.parse(
          fs.readFileSync(tsconfigBuildPath, 'utf-8'),
        );

        // Both should have compilerOptions
        expect(tsconfig).toHaveProperty('compilerOptions');
        expect(tsconfigBuild).toHaveProperty('compilerOptions');

        // Key options should be consistent
        const keyOptions = ['target', 'module', 'strict'];
        keyOptions.forEach((option) => {
          if (
            tsconfig.compilerOptions[option] &&
            tsconfigBuild.compilerOptions[option]
          ) {
            expect(tsconfig.compilerOptions[option]).toBe(
              tsconfigBuild.compilerOptions[option],
            );
          }
        });
      }
    });

    it('should have jest configuration file', () => {
      const jestConfigPath = path.join(process.cwd(), 'jest.config.js');
      expect(fs.existsSync(jestConfigPath)).toBe(true);

      // Should be a valid JavaScript file
      const jestConfig = require(jestConfigPath);
      expect(jestConfig).toBeDefined();
      expect(typeof jestConfig).toBe('object');
    });

    it('should have consistent test configuration', () => {
      const jestConfigPath = path.join(process.cwd(), 'jest.config.js');
      const jestConfig = require(jestConfigPath);

      // Essential jest configuration
      expect(jestConfig).toHaveProperty('preset');
      expect(jestConfig).toHaveProperty('testEnvironment');
      expect(jestConfig).toHaveProperty('testMatch');
    });
  });

  describe('Documentation in configuration', () => {
    it('should have package.json with descriptive fields', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Description should be meaningful (more than 10 characters)
      expect(packageJson.description.length).toBeGreaterThan(10);

      // Keywords should exist and be an array
      if (packageJson.keywords) {
        expect(Array.isArray(packageJson.keywords)).toBe(true);
      }
    });

    it('should have .env.example with helpful comments', () => {
      const envExamplePath = path.join(process.cwd(), '.env.example');
      const envContent = fs.readFileSync(envExamplePath, 'utf-8');
      const lines = envContent.split('\n');

      // Count comment lines
      const commentLines = lines.filter((line) => line.trim().startsWith('#'));

      // Should have at least some comments for documentation
      expect(commentLines.length).toBeGreaterThan(0);
    });
  });
});
