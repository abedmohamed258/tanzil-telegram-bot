# Research: Telegram Bot Client

## Decision 1: Library Choice

- **Decision**: AIOGram (v3.x)
- **Rationale**: Tanzil's core engine is built on `asyncio`. AIOGram is built from the ground up for `asyncio`, offering superior performance and cleaner integration with Tanzil's event loop compared to alternatives.
- **Alternatives considered**: `python-telegram-bot` (has async support but is more "bolted on"), `telebot` (too synchronous).

## Decision 2: Progress Updates

- **Decision**: Throttled Message Editing
- **Rationale**: Provides real-time feedback without hitting Telegram's rate limits (max ~1 edit per second per message).
- **Alternatives considered**: Sending new messages (too spammy), Custom UI/Buttons (not enough feedback).

## Decision 3: File Delivery & Uploads

- **Decision**: Hybrid approach (Bot API < 50MB, fallback to Link)
- **Rationale**: Bots are limited to 50MB for uploads via the standard API. For files larger than 50MB, the bot will provide a direct download link served from the server. The architecture will allow switching to Local Bot API (2GB limit) later.
- **Alternatives considered**: Pure link delivery (less convenient for small files).

## Decision 4: Authorization

- **Decision**: Middleware-based Whitelist
- **Rationale**: A whitelist of Telegram User IDs is the most secure and simplest way to protect a private bot. Implementing this as middleware in AIOGram ensures no unauthorized users can trigger engine actions.
- **Alternatives considered**: Password/Token entry (extra friction), Public access (security risk).

## Decision 5: Project Structure

- **Decision**: `src/tanzil/clients/telegram/`
- **Rationale**: Follows standard Python packaging and keeps clients separate from the core `tanzil.engine`.
- **Alternatives considered**: Top-level `bot.py` (messy), separate repo (too much overhead).
