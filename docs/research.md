# Telegram Bot Client Research: Tanzil Integration

## 1. Python Telegram Bot Libraries

### Decision: AIOGram (v3.x)

- **Rationale**: Native `asyncio` support from the ground up. High performance, clean middleware system, and excellent support for modern Python types. It aligns perfectly with Tanzil's `asyncio` core.
- **Alternatives**: `python-telegram-bot` (mature but legacy-heavy), `Telethon`/`Pyrogram` (User-bot focused, though capable).

## 2. Streaming Progress Updates

### Decision: Throttled Message Editing

- **Rationale**: Telegram allows message editing to show progress. To avoid rate limits (approx 1 req/sec), updates must be throttled (e.g., every 2-3 seconds or every 5% progress change).
- **Patterns**:
  - Use `asyncio.create_task` for background progress tracking.
  - Implement a `ProgressManager` that handles message editing logic.
  - Use Inline Keyboards for "Cancel" or "Retry" actions.

## 3. Handling File Uploads

### Decision: Integrated Event-Driven Uploads

- **Rationale**: Tanzil Core Engine emits events (`TASK_COMPLETED`). The Bot Client subscribes to these and initiates uploads.
- **Limits**:
  - **Standard Bot API**: 50MB limit for uploads.
  - **Local Bot API Server**: Up to 2GB limit.
- **Strategy**: Phase 1 will use standard API. If files exceed 50MB, the bot will provide a local download link or prompt for Local Bot API configuration.

## 4. Authorization Patterns

### Decision: Middleware Whitelist

- **Rationale**: A dedicated AIOGram middleware will check `from_user.id` against a `whitelist` defined in `config.yaml`.
- **Implementation**: Any message from a non-whitelisted user is ignored or receives a "Permission Denied" response.

## 5. Sub-package Structure

### Decision: `src/tanzil/clients/telegram/`

- **Rationale**: Isolates client-specific logic while allowing easy access to `tanzil.core`.
- **Structure**:
  ```text
  src/tanzil/clients/telegram/
  ├── __init__.py
  ├── bot.py          # Main runner
  ├── handlers/       # Commands, text, callbacks
  ├── middlewares/    # Auth, rate-limiting
  └── formatter.py    # Progress bar and message styling
  ```
