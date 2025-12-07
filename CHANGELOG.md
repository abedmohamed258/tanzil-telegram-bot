# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Comprehensive test suite with Jest and fast-check
- Property-based tests for file structure validation
- Security audit and vulnerability scanning
- CODE_OF_CONDUCT.md following Contributor Covenant
- SECURITY.md with vulnerability reporting process
- CHANGELOG.md following Keep a Changelog format
- GitHub issue and PR templates
- Improved documentation structure
- Scripts README with security guidelines

### Changed

- Moved SQL files to docs/database/ directory
- Moved generate-session.js to scripts/ directory
- Updated generate-session.js to use environment variables instead of hardcoded values
- Improved .gitignore to exclude log files and session files
- Enhanced CONTRIBUTING.md with detailed guidelines

### Fixed

- Removed hardcoded API credentials from generate-session.js
- Removed duplicate test file (tests/logic.test.js)
- Cleaned up temporary log files from root directory
- Fixed security vulnerabilities in dependencies (documented)

### Security

- Removed all hardcoded secrets from codebase
- Added security scanning for dependencies
- Documented known vulnerabilities in node-telegram-bot-api dependencies
- Implemented proper secret management guidelines

## [1.0.0] - 2025-12-01

### Added

- Initial release of Tanzil Bot
- Multi-platform video downloading (YouTube, TikTok, Instagram, Facebook, etc.)
- Telegram Stories downloading via MTProto
- Playlist support with batch downloading
- Quality selection (1080p, 720p, audio)
- Scheduling functionality with timezone support
- Credit system for rate limiting
- Admin dashboard with comprehensive controls
- Hard ban system for user management
- Real-time progress tracking
- Graceful shutdown handling
- Supabase database integration
- Sentry error tracking
- Winston logging
- Docker support
- Render deployment configuration

### Features

#### Core Functionality

- Universal downloader powered by yt-dlp
- Support for 100+ platforms
- Smart quality selection
- Playlist detection and batch processing
- Scheduled downloads with timezone awareness

#### User Experience

- Beautiful emoji-rich interface
- Real-time progress bars
- Smooth menu navigation
- Arabic language support
- Intuitive command structure

#### Admin Features

- User profile management
- Temporary and permanent bans
- Broadcast messaging
- System statistics
- Download history tracking
- Credit management

#### Technical Features

- TypeScript with strict mode
- Modular architecture
- Request queue management
- Resource monitoring
- Automatic file cleanup
- Webhook and polling support
- Health check endpoint

### Documentation

- Comprehensive README with architecture diagram
- Configuration guide with all environment variables
- Database setup guide
- Render deployment guide (Arabic)
- Contributing guidelines
- MIT License

---

## Release Notes

### Version 1.0.0 - Initial Release

This is the first stable release of Tanzil Bot, a powerful Telegram bot for downloading videos from various platforms.

**Highlights:**

- Support for 100+ platforms via yt-dlp
- Beautiful Arabic interface
- Comprehensive admin controls
- Production-ready with Docker support

**Known Issues:**

- Transitive dependency vulnerabilities in node-telegram-bot-api (being monitored)
- Limited test coverage (being improved)

**Upgrade Notes:**

- This is the initial release, no upgrade path needed

---

## How to Update

### For Users

1. Pull the latest changes:

   ```bash
   git pull origin main
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run database migrations (if any):

   ```bash
   # Check docs/database/ for new migration files
   ```

4. Rebuild and restart:
   ```bash
   npm run build
   npm start
   ```

### For Contributors

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

---

## Links

- [GitHub Repository](https://github.com/abedmohamed258/tanzil-telegram-bot)
- [Issue Tracker](https://github.com/abedmohamed258/tanzil-telegram-bot/issues)
- [Documentation](https://github.com/abedmohamed258/tanzil-telegram-bot/tree/main/docs)
- [Security Policy](SECURITY.md)

---

**Note**: This changelog is maintained manually. For a complete list of changes, see the [commit history](https://github.com/abedmohamed258/tanzil-telegram-bot/commits/main).
