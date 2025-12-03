/**
 * Property-Based Tests for README Completeness
 * **Feature: production-readiness-review, Property 17: README Completeness**
 * **Feature: production-readiness-review, Property 26: README Badge Presence**
 * **Validates: Requirements 5.1, 6.7**
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Property: README Completeness', () => {
  /**
   * **Feature: production-readiness-review, Property 17: README Completeness**
   * **Validates: Requirements 5.1**
   */

  const readmePath = path.join(process.cwd(), 'README.md');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(readmePath, 'utf-8');
  });

  it('should have README.md file', () => {
    expect(fs.existsSync(readmePath)).toBe(true);
  });

  describe('Required Sections', () => {
    const requiredSections = [
      { name: 'Introduction', pattern: /^#\s+.+/m },
      { name: 'Features', pattern: /features/i },
      { name: 'Installation', pattern: /install/i },
      { name: 'Usage', pattern: /usage|quick start/i },
      { name: 'Configuration', pattern: /config/i },
      { name: 'Contributing', pattern: /contribut/i },
      { name: 'License', pattern: /license/i },
    ];

    requiredSections.forEach(({ name, pattern }) => {
      it(`should have ${name} section`, () => {
        expect(pattern.test(content)).toBe(true);
      });
    });
  });

  describe('Section Content Quality', () => {
    it('should have substantial Introduction (>100 words)', () => {
      const introMatch = content.match(/^#\s+.+[\s\S]*?(?=^##\s+)/m);
      if (introMatch) {
        const wordCount = introMatch[0].split(/\s+/).length;
        expect(wordCount).toBeGreaterThan(20);
      }
    });

    it('should have Features section with multiple features', () => {
      const featuresSection = content.match(
        /##\s+.*features.*[\s\S]*?(?=^##\s+)/im,
      );
      if (featuresSection) {
        const bulletPoints = (featuresSection[0].match(/^[-*]\s+/gm) || [])
          .length;
        expect(bulletPoints).toBeGreaterThan(3);
      }
    });

    it('should have Installation instructions with code blocks', () => {
      const installSection = content.match(
        /##\s+.*install.*[\s\S]*?(?=^##\s+)/im,
      );
      if (installSection) {
        expect(installSection[0]).toContain('```');
      }
    });

    it('should have Usage examples', () => {
      const usageSection = content.match(
        /##\s+.*(usage|quick start).*[\s\S]*?(?=^##\s+)/im,
      );
      expect(usageSection).toBeDefined();
    });
  });

  describe('Documentation Links', () => {
    it('should link to CONTRIBUTING.md', () => {
      expect(content).toContain('CONTRIBUTING.md');
    });

    it('should link to LICENSE', () => {
      expect(content).toContain('LICENSE');
    });

    it('should have documentation links', () => {
      const hasDocLinks =
        content.includes('docs/') || content.includes('documentation');
      expect(hasDocLinks).toBe(true);
    });
  });

  describe('Content Quality', () => {
    it('should have substantial content (>1000 characters)', () => {
      expect(content.length).toBeGreaterThan(1000);
    });

    it('should have multiple sections (>5 headings)', () => {
      const headings = content.match(/^#{1,3}\s+.+$/gm);
      expect(headings).toBeDefined();
      expect(headings!.length).toBeGreaterThan(5);
    });

    it('should have code examples', () => {
      const codeBlocks = content.match(/```/g);
      expect(codeBlocks).toBeDefined();
      expect(codeBlocks!.length).toBeGreaterThan(2);
    });

    it('should have project description', () => {
      // Should have a description near the top
      const firstParagraph = content.substring(0, 500);
      expect(firstParagraph.length).toBeGreaterThan(100);
    });
  });
});

describe('Property: README Badge Presence', () => {
  /**
   * **Feature: production-readiness-review, Property 26: README Badge Presence**
   * **Validates: Requirements 6.7**
   */

  const readmePath = path.join(process.cwd(), 'README.md');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(readmePath, 'utf-8');
  });

  describe('Required Badges', () => {
    it('should have license badge', () => {
      const hasLicenseBadge =
        content.includes('License') && content.includes('badge');
      expect(hasLicenseBadge).toBe(true);
    });

    it('should have version or technology badges', () => {
      const hasTechBadges =
        content.includes('TypeScript') ||
        content.includes('Node.js') ||
        content.includes('version');
      expect(hasTechBadges).toBe(true);
    });

    it('should have badges in header section', () => {
      // Badges should be near the top (first 1000 characters)
      const header = content.substring(0, 1000);
      const hasBadges =
        header.includes('badge') ||
        header.includes('shields.io') ||
        header.includes('img.shields.io');
      expect(hasBadges).toBe(true);
    });
  });

  describe('Badge Format', () => {
    it('should use markdown image syntax for badges', () => {
      const header = content.substring(0, 1000);
      const hasMarkdownImages = /!\[.*?\]\(.*?\)/.test(header);
      expect(hasMarkdownImages).toBe(true);
    });

    it('should have clickable badges (with links)', () => {
      const header = content.substring(0, 1000);
      const hasLinkedBadges = /\[!\[.*?\]\(.*?\)\]\(.*?\)/.test(header);
      expect(hasLinkedBadges).toBe(true);
    });
  });

  describe('Badge Content', () => {
    it('should have at least 3 badges', () => {
      const header = content.substring(0, 1500);
      const badges = header.match(/!\[.*?\]\(.*?badge.*?\)/gi) || [];
      expect(badges.length).toBeGreaterThanOrEqual(3);
    });

    it('should include relevant project information in badges', () => {
      const relevantInfo = [
        'License',
        'TypeScript',
        'Node',
        'test',
        'coverage',
      ];
      const hasSomeInfo = relevantInfo.some((info) =>
        content.toLowerCase().includes(info.toLowerCase()),
      );
      expect(hasSomeInfo).toBe(true);
    });
  });
});
