# Implementation Plan: Telegram Bot Client

**Branch**: `004-telegram-bot-client` | **Date**: 2026-04-17 | **Spec**: [specs/004-telegram-bot-client/spec.md](spec.md)
**Input**: Feature specification from `/specs/004-telegram-bot-client/spec.md`

## Summary

The Telegram Bot Client (The Pro Client) provides a user-friendly interface for the Tanzil download engine via a Telegram bot. The bot will use AIOGram (v3.x) for native `asyncio` integration, throttled progress updates, and a hybrid delivery system (direct upload or link). Access will be restricted via a User ID Whitelist.

## Technical Context

**Language/Version**: Python 3.10+
**Primary Dependencies**: AIOGram (v3.x), Tanzil Core Engine (asyncio)
**Storage**: In-memory (sessions), Filesystem (downloads)
**Testing**: pytest-asyncio
**Target Platform**: Linux (server)
**Project Type**: Telegram Bot Service
**Performance Goals**: < 2s response time for commands, < 5s progress update latency
**Constraints**: Telegram API 50MB upload limit (standard bot API), 1 edit/sec rate limit
**Scale/Scope**: Up to 50 concurrent users

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Clean, idiomatic code**: Standard Python/AIOGram patterns.
- **Testing**: pytest-asyncio for bot logic.
- **DRY**: Shared logic for download management between CLI and Bot.
- **Immediate Feedback**: Throttled updates for progress.

## Project Structure

### Documentation (this feature)

```text
specs/004-telegram-bot-client/
├── plan.md              # This file
├── research.md          # AIOGram and upload patterns
├── data-model.md        # Session and task mapping
├── quickstart.md        # Setup and usage
├── contracts/           # Telegram Bot API integration
└── tasks.md             # To be generated
```

### Source Code (repository root)

```text
src/tanzil/
├── core/                # Core engine logic
├── clients/             # All clients
│   ├── cli/             # Existing CLI client
│   └── telegram/        # NEW Telegram bot client
│       ├── __init__.py
│       ├── main.py      # Entry point
│       ├── handlers/    # Bot handlers
│       ├── middleware/  # Auth/Whitelisting
│       └── utils/       # Progress reporting, file delivery
```

**Structure Decision**: Single project under `src/tanzil/clients/telegram/`.

## Complexity Tracking

_No constitution violations._
