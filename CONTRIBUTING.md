# Contributing to Tanzil Bot

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to Tanzil Bot. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How Can I Contribute?](#how-can-i-contribute)
- [Style Guides](#style-guides)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [INSERT EMAIL].

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Git**
- **yt-dlp** (must be in PATH)
- **FFmpeg** (must be in PATH)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/tanzil-bot.git
   cd tanzil-bot
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/tanzil-bot.git
   ```

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

Required variables for development:

- `TELEGRAM_BOT_TOKEN` - Get from @BotFather
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase service role key
- `ADMIN_GROUP_ID` - Your admin group ID

### 3. Set Up Database

Follow the instructions in [docs/database-setup.md](docs/database-setup.md) to set up your Supabase database.

### 4. Run Tests

```bash
npm test
```

### 5. Build the Project

```bash
npm run build
```

### 6. Start Development

```bash
npm run dev
```

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible using our [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

**Guidelines:**

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce**
- **Provide specific examples**
- **Describe the behavior you observed and what you expected**
- **Include screenshots if applicable**
- **Include your environment details** (OS, Node.js version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. Use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).

**Guidelines:**

- **Use a clear and descriptive title**
- **Provide a detailed description of the proposed feature**
- **Explain why this enhancement would be useful**
- **List any alternatives you've considered**

### Your First Code Contribution

Unsure where to begin? Look for issues labeled:

- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `documentation` - Documentation improvements

### Pull Requests

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our style guides

3. **Write or update tests** for your changes

4. **Run tests** to ensure everything passes:

   ```bash
   npm test
   ```

5. **Commit your changes** with a descriptive message:

   ```bash
   git commit -m "Add feature: description"
   ```

6. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request** using our [PR template](.github/pull_request_template.md)

## Style Guides

### TypeScript Style Guide

**General Rules:**

- Use TypeScript strict mode
- Avoid `any` types - use proper typing
- Use `const` for immutable references
- Use `let` for mutable references (avoid `var`)
- Use arrow functions for callbacks
- Use async/await instead of promises chains

**Naming Conventions:**

- **Files**: PascalCase for classes (`UserService.ts`), camelCase for utilities (`logger.ts`)
- **Classes**: PascalCase (`class DownloadManager`)
- **Interfaces**: PascalCase with 'I' prefix optional (`interface User` or `interface IUser`)
- **Functions**: camelCase (`function downloadVideo()`)
- **Constants**: SCREAMING_SNAKE_CASE (`const MAX_FILE_SIZE`)
- **Private members**: prefix with underscore (`private _cache`)

**Code Organization:**

```typescript
// 1. Imports
import { Something } from 'somewhere';

// 2. Types/Interfaces
interface MyInterface {
  prop: string;
}

// 3. Constants
const MAX_RETRIES = 3;

// 4. Class/Function implementation
export class MyClass {
  // Public properties first
  public name: string;

  // Private properties
  private _cache: Map<string, any>;

  // Constructor
  constructor(name: string) {
    this.name = name;
    this._cache = new Map();
  }

  // Public methods
  public async doSomething(): Promise<void> {
    // Implementation
  }

  // Private methods
  private _helper(): void {
    // Implementation
  }
}
```

**Documentation:**

- Add JSDoc comments to all public functions and classes
- Include `@param`, `@returns`, and `@throws` tags
- Explain complex logic with inline comments

```typescript
/**
 * Downloads a video from the specified URL
 * @param url - The video URL to download
 * @param quality - Desired video quality (1080p, 720p, audio)
 * @returns Path to the downloaded file
 * @throws {Error} If download fails or URL is invalid
 */
async function downloadVideo(url: string, quality: string): Promise<string> {
  // Implementation
}
```

### Git Commit Messages

**Format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(download): add support for Instagram Reels

- Implement Reels detection
- Add quality selection for Reels
- Update tests

Closes #123
```

```
fix(credit): correct daily reset calculation

The credit reset was using UTC instead of user timezone.
Now correctly resets at midnight in user's timezone.

Fixes #456
```

**Rules:**

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- First line should be 50 characters or less
- Reference issues and PRs in the footer

## Testing Guidelines

### Writing Tests

**Unit Tests:**

- Test individual functions and classes in isolation
- Use mocks for external dependencies
- Focus on edge cases and error conditions
- Keep tests simple and readable

```typescript
describe('DownloadService', () => {
  it('should download video successfully', async () => {
    const service = new DownloadService();
    const result = await service.download('https://example.com/video');
    expect(result).toBeDefined();
    expect(result.path).toMatch(/\.mp4$/);
  });
});
```

**Property-Based Tests:**

- Use fast-check for property-based testing
- Test universal properties that should hold for all inputs
- Run at least 100 iterations
- Tag with property reference from design.md

```typescript
import fc from 'fast-check';

describe('Property: Credit System Correctness', () => {
  it('should maintain correct balance after any operation sequence', () => {
    // **Feature: production-readiness-review, Property 5: Credit System Correctness**
    fc.assert(
      fc.property(fc.array(fc.oneof(/* operations */)), (operations) => {
        // Test implementation
      }),
      { numRuns: 100 },
    );
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- fileStructure.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Test Coverage

- Aim for 70%+ overall coverage
- Critical business logic should have 90%+ coverage
- All new features must include tests
- Update tests when modifying existing code

## Pull Request Process

### Before Submitting

- [ ] Code follows the style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass locally
- [ ] No new warnings or errors
- [ ] CHANGELOG.md updated

### PR Review Process

1. **Automated Checks**: CI will run tests and linting
2. **Code Review**: Maintainers will review your code
3. **Feedback**: Address any requested changes
4. **Approval**: Once approved, your PR will be merged

### After Merge

- Delete your feature branch
- Pull the latest changes from upstream
- Celebrate! 🎉

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates

### Keeping Your Fork Updated

```bash
# Fetch upstream changes
git fetch upstream

# Merge upstream main into your main
git checkout main
git merge upstream/main

# Push to your fork
git push origin main
```

### Resolving Conflicts

If your PR has conflicts:

```bash
# Update your branch with latest main
git checkout main
git pull upstream main

# Rebase your feature branch
git checkout feature/your-feature
git rebase main

# Resolve conflicts, then:
git add .
git rebase --continue

# Force push to your fork
git push origin feature/your-feature --force
```

## Community

### Getting Help

- **Documentation**: Check [docs/](docs/) directory
- **Issues**: Search existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Pull Requests**: Code contributions

### Recognition

Contributors will be recognized in:

- README.md contributors section
- Release notes
- CHANGELOG.md

## Additional Resources

- [README.md](README.md) - Project overview
- [docs/configuration.md](docs/configuration.md) - Configuration guide
- [docs/database-setup.md](docs/database-setup.md) - Database setup
- [docs/RENDER_DEPLOYMENT.md](docs/RENDER_DEPLOYMENT.md) - Deployment guide
- [SECURITY.md](SECURITY.md) - Security policy

## Questions?

Don't hesitate to ask! Create an issue with the `question` label or start a discussion.

---

**Thank you for contributing to Tanzil Bot! 🚀**
