# Phase 0 Research: TMA Bridge

All technical unknowns from planning were resolved in this document.

## Decision 1: Use Starlette and Uvicorn for the bridge service

**Decision**: Build the bridge as a small ASGI service using Starlette, served by Uvicorn, with static Mini-App assets served from the same process.

**Rationale**:

- The repository is already Python 3.10 and `asyncio` based, so ASGI fits naturally.
- The bridge needs HTTP routes, WebSocket endpoints, startup/shutdown hooks, and static asset serving, which Starlette covers without the extra surface area of a larger API framework.
- Pydantic is already present for request and response models.
- Keeping the UI shell and WebSocket endpoint in one service keeps deployment simple for this phase.

**Alternatives considered**:

- **FastAPI**: Stronger built-in API tooling, but larger than needed for a thin bridge with a small endpoint set.
- **aiohttp**: Technically viable, but less aligned with the ASGI ecosystem and less future-friendly for shared middleware and testing patterns.

## Decision 2: Validate Telegram `initData` with Python stdlib and exchange it for a bridge session

**Decision**: Validate raw Telegram `initData` with the documented HMAC flow using Python stdlib (`urllib.parse`, `hmac`, `hashlib`), enforce a short freshness window, and exchange a valid Mini-App launch for a short-lived bridge session credential that is not passed in URLs.

**Rationale**:

- This follows Telegram's documented Mini-App verification flow.
- Stdlib validation avoids an extra dependency for a small, security-critical algorithm.
- A bridge-issued session credential reduces replay risk and avoids re-sending raw `initData` on every request or WebSocket message.
- The bridge can reject malformed, expired, or replayed authentication payloads before proxying anything to the core service.

**Alternatives considered**:

- **Third-party Telegram auth helper library**: More convenience, but unnecessary for a simple HMAC verification flow.
- **Validating `initData` on every request**: Simpler client flow, but weaker operationally because it increases replay exposure and repeats cryptographic work.
- **Public-key validation flow**: Possible, but adds complexity and is not needed while the bridge can safely access the bot token.

## Decision 3: Keep the existing core command socket and add a dedicated event-stream socket

**Decision**: Preserve the existing request/response Unix socket interface for commands, add a separate long-lived Unix socket subscription stream for core events, and have the bridge fan those events out to authenticated WebSocket clients after sending an initial snapshot.

**Rationale**:

- The core already exposes commands over a Unix socket and already emits task lifecycle events on its in-process event bus.
- A dedicated event stream is the smallest change that preserves the current service boundary while meeting the realtime requirement.
- Snapshot-then-stream avoids race gaps after a client connects or reconnects.
- The bridge stays a translator between local core protocols and external Mini-App protocols instead of becoming another engine host.

**Alternatives considered**:

- **Polling the core service**: Too stale and inefficient for the realtime requirement.
- **Embedding the engine inside the bridge**: Breaks the service boundary and complicates ownership of shared task state.
- **Adding a broker now**: Useful later for durability or multi-host scale, but unnecessary infrastructure for this phase.
- **Multiplexing commands and events on one socket**: Works, but makes correlation and protocol framing more fragile than separate channels.

## Decision 4: Keep bridge state in-memory for this phase

**Decision**: Store bridge sessions, connected clients, and event fan-out state in-memory only.

**Rationale**:

- This stays consistent with the core engine's current in-memory model.
- The spec explicitly accepts session loss on bridge restart for this phase.
- Avoiding a new persistence layer keeps the bridge focused on transport, auth, and session fan-out.

**Alternatives considered**:

- **SQLite or file persistence**: Adds restart recovery but increases coordination and lifecycle complexity.
- **Redis or database persistence**: Better for distributed scaling, but unjustified before multi-node bridge deployments exist.
