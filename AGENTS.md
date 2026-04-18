# tanzil Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-18

## Active Technologies
- Python 3.10+ (as per root pyproject.toml) + `typer`, `pyyaml`, `asyncio` (for async Pub/Sub and parallel downloads) (003-core-engine-component-a)
- In-memory only (Phase 1) (003-core-engine-component-a)
- Python 3.10+ (as per AGENTS.md) + `typer`, `pyyaml`, `asyncio` (003-core-engine-component-a)
- N/A (In-memory state only) (003-core-engine-component-a)
- Python 3.10+ + AIOGram (v3.x), Tanzil Core Engine (asyncio) (004-telegram-bot-client)
- In-memory (sessions), Filesystem (downloads) (004-telegram-bot-client)
- Python 3.10 + Starlette, Uvicorn, Pydantic, Aiogram, asyncio (006-phase-5-telegram)
- In-memory bridge sessions and connection state; existing core task state remains in-memory (006-phase-5-telegram)
- Python 3.10+ (as per project root) + Docker, Docker Compose, Nginx, Certbot, GitHub Actions (007-deployment-production)
- Filesystem (Docker volumes for downloads and configuration) (007-deployment-production)

- (002-factory-dev-sdk-init)

## Project Structure

```text
src/
tests/
```

## Commands

# Add commands for 

## Code Style

: Follow standard conventions

## Recent Changes
- 008-production-launch: Added [if applicable, e.g., PostgreSQL, CoreData, files or N/A]
- 007-deployment-production: Added Python 3.10+ (as per project root) + Docker, Docker Compose, Nginx, Certbot, GitHub Actions
- 006-phase-5-telegram: Added Python 3.10 + Starlette, Uvicorn, Pydantic, Aiogram, asyncio


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
