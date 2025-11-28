# Tanzil Bot - System Context

## Project Overview
Tanzil is a high-performance Telegram media downloader bot built with Node.js, TypeScript, and `node-telegram-bot-api`. It uses `yt-dlp` for media extraction.

## Architecture
The project follows a **Service-Based Architecture**:
- **BotHandler**: Main router and entry point.
- **Services**:
  - `AdminService`: Handles admin commands, dashboard, bans, broadcasts.
  - `UserService`: Handles user interactions (`/start`, `/help`).
  - `DownloadService`: Handles URL processing, downloads, queues, and scheduling.
- **Utils**: `StorageManager` (JSON DB), `RequestQueue` (Concurrency), `DownloadManager` (yt-dlp wrapper).

## Key Systems
1.  **Hard Ban**: When a user is banned, their queue items are purged, and active downloads are cancelled immediately.
2.  **Queue System**: All downloads go through `RequestQueue`.
3.  **Credit System (V3)**: Users have daily credits. Costs vary by duration.
4.  **Scheduling (V3)**: Users can schedule downloads. Tasks are checked every minute.
5.  **Topic Support**: The bot is designed to work in Supergroups with Topics. Always use `message_thread_id`.

## Tech Stack
- Node.js (v18+)
- TypeScript
- node-telegram-bot-api
- yt-dlp
- ffmpeg
