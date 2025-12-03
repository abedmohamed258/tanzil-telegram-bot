# Tanzil Telegram Bot - Deployment Guide

This guide provides step-by-step instructions for deploying the Tanzil Telegram Bot to a production environment.

## Prerequisites

Before you begin, ensure you have the following:

1.  **Server/Environment**: A VPS (Virtual Private Server) or a local machine with:
    - **Node.js**: Version 18.0.0 or higher.
    - **npm**: Installed with Node.js.
    - **Git**: For cloning the repository.
2.  **External Services**:
    - **Supabase Project**: For database and storage. You need the URL and Service Role Key.
    - **Telegram Bot Token**: From [@BotFather](https://t.me/BotFather).
    - **Telegram API ID & Hash**: From [my.telegram.org](https://my.telegram.org) (for downloading Stories).
    - **Sentry DSN** (Optional): For error tracking.

## 1. Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd tanzil-telegram-bot
npm install
```

## 2. Environment Configuration

Create a `.env` file in the root directory based on the example:

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

- **TELEGRAM_BOT_TOKEN**: Your bot token.
- **ADMIN_GROUP_ID**: ID of the group for admin logs.
- **SUPABASE_URL**: Your Supabase project URL.
- **SUPABASE_KEY**: Your Supabase Service Role Key.
- **TELEGRAM_API_ID** & **TELEGRAM_API_HASH**: Required for Stories.
- **TELEGRAM_SESSION**: Run `node scripts/generate-session.js` (if available) or use a script to generate this string if you are using the Telegram Client for stories.

## 3. Build the Project

Compile the TypeScript code to JavaScript:

```bash
npm run build
```

This will create a `dist` directory containing the compiled code.

## 4. Running the Bot

### Option A: Using PM2 (Recommended for Production)

PM2 is a process manager that keeps your bot running and restarts it if it crashes.

1.  Install PM2 globally:

    ```bash
    npm install -g pm2
    ```

2.  Start the bot:

    ```bash
    pm2 start dist/index.js --name "tanzil-bot"
    ```

3.  Save the process list to restart on reboot:
    ```bash
    pm2 save
    pm2 startup
    ```

### Option B: Running Directly

For testing or simple setups:

```bash
npm start
```

## 5. Deployment Checklist

- [ ] **Environment Variables**: Double-check all keys in `.env`.
- [ ] **Database**: Ensure your Supabase tables are set up correctly (refer to `IMPLEMENTATION-GUIDE.md` or database migration scripts if available).
- [ ] **Permissions**: Ensure the bot has necessary permissions in the Telegram Admin Group (Post Messages, etc.).
- [ ] **Webhook vs Polling**:
  - By default, the bot uses **Polling**. This is easiest for most setups.
  - For **Webhook** (faster, requires HTTPS), set `USE_WEBHOOK=true` and `WEBHOOK_URL` in `.env`.

## 6. Maintenance

- **View Logs**: `pm2 logs tanzil-bot`
- **Restart**: `pm2 restart tanzil-bot`
- **Update**:
  ```bash
  git pull
  npm install
  npm run build
  pm2 restart tanzil-bot
  ```

## Troubleshooting

- **Bot not responding?** Check logs (`pm2 logs` or console output) for errors.
- **Database errors?** Verify Supabase credentials and network connectivity.
- **"409 Conflict"?** If switching from Webhook to Polling, you might need to manually delete the webhook using a simple script or API call.

## 7. Publishing to npm (For Library Users)

The bot can be published as an npm package for use in other projects.

### Pre-publication Checklist

Before publishing, ensure:

- [ ] All tests pass: `npm test`
- [ ] Code lints cleanly: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Package contents are correct: `npm pack --dry-run`
- [ ] `package.json` version is updated (semantic versioning: major.minor.patch)
- [ ] `CHANGELOG.md` is updated with release notes
- [ ] Git is clean with all changes committed

### Publishing to npm

1. **Verify authentication**:
   ```bash
   npm whoami
   ```
   If not logged in, run `npm login` and enter your npm credentials.

2. **Update version** using semantic versioning:
   ```bash
   npm version patch  # For bug fixes (0.0.x)
   npm version minor  # For new features (0.x.0)
   npm version major  # For breaking changes (x.0.0)
   ```
   This automatically commits and creates a git tag.

3. **Publish to npm**:
   ```bash
   npm publish
   ```

4. **Verify**:
   ```bash
   npm view tanzil-telegram-bot
   npm search tanzil
   ```

### Publishing Scoped Package

If you want to publish under a scope (e.g., `@yourusername/tanzil-bot`), update `package.json`:

```json
{
  "name": "@yourusername/tanzil-bot"
}
```

Then publish with:
```bash
npm publish --access public  # For public scoped packages
```

## 8. Release Management

### Semantic Versioning

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version (x.0.0): Breaking changes
- **MINOR** version (0.x.0): New features (backward compatible)
- **PATCH** version (0.0.x): Bug fixes

### Updating CHANGELOG.md

Before each release, update `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [Unreleased]

## [1.2.0] - 2024-12-03

### Added
- New feature description

### Changed
- Change description

### Fixed
- Bug fix description

### Security
- Security patch description

[Unreleased]: https://github.com/yourusername/tanzil-bot/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/yourusername/tanzil-bot/releases/tag/v1.2.0
```

### Automated CI/CD

The project includes GitHub Actions workflows (`.github/workflows/ci.yml`) that:

1. **On every push/PR**:
   - Runs TypeScript build
   - Executes all tests
   - Runs ESLint
   - Validates package contents

2. **Before publishing**:
   - Ensure CI passes on main branch
   - All tests must pass
   - Code must lint cleanly

### Release Workflow

1. **Create release branch**:
   ```bash
   git checkout -b release/v1.2.0
   ```

2. **Update version, changelog, and documentation**:
   ```bash
   npm version minor  # Updates package.json and creates commit+tag
   ```

3. **Review and test**:
   ```bash
   npm test
   npm run lint
   npm run build
   npm pack --dry-run
   ```

4. **Create pull request** for review

5. **Once approved, merge to main**:
   ```bash
   git checkout main
   git merge release/v1.2.0
   ```

6. **Publish**:
   ```bash
   npm publish
   ```

7. **Push tags to GitHub**:
   ```bash
   git push origin main
   git push origin --tags
   ```

## 9. Production Monitoring

- **Health checks**: Regularly monitor bot responsiveness
- **Error tracking**: Check Sentry dashboard (if enabled)
- **Database performance**: Monitor Supabase logs and query performance
- **Uptime monitoring**: Use services like UptimeRobot

## 10. Backup and Recovery

- **Database backups**: Enable Supabase automated backups
- **Configuration backup**: Securely store `.env` (use secrets manager in production)
- **Code recovery**: Maintain git history with tagged releases

