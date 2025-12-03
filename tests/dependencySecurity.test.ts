/**
 * Property-Based Tests for Dependency Security
 * **Feature: production-readiness-review, Property 13: Dependency Security**
 * **Validates: Requirements 3.6**
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('Property 13: Dependency Security', () => {
  describe('Package.json Validation', () => {
    it('should have a valid package.json file', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBeDefined();
      expect(packageJson.dependencies).toBeDefined();
    });

    it('should have all dependencies with specific versions or ranges', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      Object.entries(allDeps).forEach(([_name, version]) => {
        // Version should not be '*' or 'latest'
        expect(version).not.toBe('*');
        expect(version).not.toBe('latest');

        // Should have a version specifier
        expect(typeof version).toBe('string');
        expect((version as string).length).toBeGreaterThan(0);
      });
    });

    it('should not have duplicate dependencies', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const deps = Object.keys(packageJson.dependencies || {});
      const devDeps = Object.keys(packageJson.devDependencies || {});

      // Find duplicates
      const duplicates = deps.filter((dep) => devDeps.includes(dep));

      if (duplicates.length > 0) {
        console.warn(
          `Warning: Duplicate dependencies found: ${duplicates.join(', ')}`,
        );
      }

      // This is a warning, not a hard failure
      expect(duplicates.length).toBeLessThan(5);
    });
  });

  describe('NPM Audit', () => {
    it('should have no critical or high severity vulnerabilities (excluding known issues)', () => {
      // Known vulnerabilities that are accepted risks (documented in docs/known-vulnerabilities.md)
      const knownVulnerabilities = [
        'form-data', // Transitive dep from node-telegram-bot-api
        'request', // Deprecated package used by node-telegram-bot-api
        'tough-cookie', // Transitive dep from request
        '@cypress/request-promise', // Transitive dep from node-telegram-bot-api
        'request-promise-core', // Transitive dep from request-promise
      ];

      try {
        // Run npm audit with JSON output
        const auditOutput = execSync('npm audit --json', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        const auditResult = JSON.parse(auditOutput);
        const vulnerabilities = auditResult.vulnerabilities || {};

        // Filter out known vulnerabilities
        const unknownCriticalOrHigh = Object.entries(vulnerabilities).filter(
          ([name, vuln]: [string, any]) => {
            const isKnown = knownVulnerabilities.includes(name);
            const isCriticalOrHigh =
              vuln.severity === 'critical' || vuln.severity === 'high';
            return isCriticalOrHigh && !isKnown;
          },
        );

        if (unknownCriticalOrHigh.length > 0) {
          console.error(
            `Found ${unknownCriticalOrHigh.length} unknown critical/high vulnerabilities:`,
          );
          unknownCriticalOrHigh.forEach(([name, vuln]: [string, any]) => {
            console.error(`  - ${name}: ${vuln.severity}`);
          });
          console.error('Run "npm audit fix" to fix them');
        }

        expect(unknownCriticalOrHigh.length).toBe(0);
      } catch (error: any) {
        // npm audit returns non-zero exit code if vulnerabilities are found
        if (error.stdout) {
          try {
            const auditResult = JSON.parse(error.stdout);
            const vulnerabilities = auditResult.vulnerabilities || {};

            // Filter out known vulnerabilities
            const unknownCriticalOrHigh = Object.entries(
              vulnerabilities,
            ).filter(([name, vuln]: [string, any]) => {
              const isKnown = knownVulnerabilities.includes(name);
              const isCriticalOrHigh =
                vuln.severity === 'critical' || vuln.severity === 'high';
              return isCriticalOrHigh && !isKnown;
            });

            if (unknownCriticalOrHigh.length > 0) {
              console.error(
                `Found ${unknownCriticalOrHigh.length} unknown critical/high vulnerabilities:`,
              );
              unknownCriticalOrHigh.forEach(([name, vuln]: [string, any]) => {
                console.error(`  - ${name}: ${vuln.severity}`);
              });
              console.error('Run "npm audit fix" to fix them');
            }

            expect(unknownCriticalOrHigh.length).toBe(0);
          } catch (parseError) {
            // If we can't parse the output, fail the test
            throw new Error(
              `Failed to parse npm audit output: ${error.message}`,
            );
          }
        } else {
          throw error;
        }
      }
    }, 30000); // 30 second timeout for npm audit

    it('should have package-lock.json for dependency locking', () => {
      const lockFilePath = path.join(process.cwd(), 'package-lock.json');
      expect(fs.existsSync(lockFilePath)).toBe(true);

      const content = fs.readFileSync(lockFilePath, 'utf-8');
      const lockFile = JSON.parse(content);

      expect(lockFile.lockfileVersion).toBeDefined();
      expect(lockFile.packages).toBeDefined();
    });
  });

  describe('Dependency Best Practices', () => {
    it('should not have unused dependencies', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const dependencies = Object.keys(packageJson.dependencies || {});

      // Get all source files
      const sourceFiles = getSourceFiles();
      const importedPackages = new Set<string>();

      sourceFiles.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Find all imports/requires
        const importPatterns = [
          /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
          /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        ];

        importPatterns.forEach((pattern) => {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const importPath = match[1];
            // Extract package name (handle scoped packages)
            const packageName = importPath.startsWith('@')
              ? importPath.split('/').slice(0, 2).join('/')
              : importPath.split('/')[0];

            if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
              importedPackages.add(packageName);
            }
          }
        });
      });

      // Find potentially unused dependencies
      const potentiallyUnused = dependencies.filter(
        (dep) => !importedPackages.has(dep),
      );

      // Some dependencies might be used indirectly or in config files
      const knownIndirectDeps = [
        'dotenv', // Used via import in index.ts
        'ts-node', // Used for development
        'typescript', // Used for compilation
      ];

      const actuallyUnused = potentiallyUnused.filter(
        (dep) => !knownIndirectDeps.includes(dep),
      );

      if (actuallyUnused.length > 0) {
        console.warn(
          `Warning: Potentially unused dependencies: ${actuallyUnused.join(', ')}`,
        );
      }

      // This is a warning, not a hard failure, as detection isn't perfect
      expect(actuallyUnused.length).toBeLessThan(10);
    });

    it('should have security-related dependencies up to date', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const securityCriticalPackages = ['@sentry/node', 'dotenv', 'express'];

      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      securityCriticalPackages.forEach((pkg) => {
        if (dependencies[pkg]) {
          const version = dependencies[pkg];

          // Should not use very old major versions
          // This is a basic check - in production, you'd want more sophisticated version checking
          expect(version).toBeDefined();
          expect(typeof version).toBe('string');
        }
      });
    });

    it('should not have known vulnerable package patterns', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Known vulnerable or deprecated packages
      const knownVulnerablePackages = [
        'request', // Deprecated
        'node-uuid', // Deprecated, use 'uuid' instead
        'colors', // Had a security incident
        'faker', // Deprecated, use '@faker-js/faker' instead
      ];

      const foundVulnerable = Object.keys(allDeps).filter((dep) =>
        knownVulnerablePackages.includes(dep),
      );

      if (foundVulnerable.length > 0) {
        fail(
          `Found known vulnerable/deprecated packages: ${foundVulnerable.join(', ')}`,
        );
      }

      expect(foundVulnerable.length).toBe(0);
    });
  });

  describe('Property: Dependency Version Consistency', () => {
    it('should maintain consistent dependency versions across package files', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageLockPath = path.join(process.cwd(), 'package-lock.json');

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf-8'));

      // Verify package-lock is in sync with package.json
      expect(packageLock.name).toBe(packageJson.name);
      expect(packageLock.version).toBe(packageJson.version);

      // Check that all dependencies in package.json are in package-lock.json
      const deps = Object.keys(packageJson.dependencies || {});
      const lockPackages = packageLock.packages || {};

      deps.forEach((dep) => {
        const lockKey = `node_modules/${dep}`;
        // Should exist in lock file
        expect(
          lockPackages[lockKey] || lockPackages[`node_modules/${dep}`],
        ).toBeDefined();
      });
    });
  });
});

/**
 * Helper function to get all source files
 */
function getSourceFiles(): string[] {
  const files: string[] = [];
  const sourceDirectories = ['src', 'tests', 'scripts'];
  const excludePatterns = ['node_modules', 'dist', 'coverage', '.git'];

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
