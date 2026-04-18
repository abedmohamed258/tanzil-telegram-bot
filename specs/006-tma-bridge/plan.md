# Implementation Plan: TMA Bridge

**Branch**: `006-phase-5-telegram` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-tma-bridge/spec.md`

**Note**: This plan covers Phase 0 research and Phase 1 design artifacts for the Telegram Mini-App bridge.

## Summary

Deliver a separate Telegram Mini-App bridge service that serves the Mini-App shell, validates Telegram `initData`, issues short-lived bridge sessions, proxies download commands to the Tanzil core service over the existing Unix socket command channel, and fans out core task events to authenticated WebSocket clients. The design keeps bridge state in-memory, adds a dedicated core-to-bridge event stream for low-latency updates, and preserves the Telegram bot process as a separate runtime.

## Technical Context

**Language/Version**: Python 3.10  
**Primary Dependencies**: Starlette, Uvicorn, Pydantic, Aiogram, asyncio  
**Storage**: In-memory bridge sessions and connection state; existing core task state remains in-memory  
**Testing**: pytest, pytest-asyncio, httpx ASGI client, WebSocket contract/integration tests  
**Target Platform**: Linux service runtime with Telegram mobile clients opening the Mini-App over HTTPS  
**Project Type**: Single Python project with an ASGI bridge service, existing Telegram bot client, and core engine service  
**Performance Goals**: Mini-App shell available in under 1.5 seconds; task state updates delivered to connected clients in under 200 ms; immediate user action acknowledgement under 100 ms at the bridge boundary  
**Constraints**: Separate service from the Telegram bot process; WebSocket-based realtime updates; in-memory-only bridge state; no external broker in this phase; core service remains the source of truth and handles rate limiting  
**Scale/Scope**: Single Tanzil deployment, shared sessions across multiple active devices per Telegram user, up to the current core registry bound of 1000 tracked tasks per service instance

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Pre-Phase 0 Gate Review: PASS**

- **Code Quality**: The feature fits the existing `src/tanzil/` package layout and keeps the bridge thin by reusing the current core service boundary instead of introducing a second source of truth.
- **Testing Standards**: The plan includes unit tests for `initData` validation and session management, integration tests for bridge-to-core flows, and contract tests for HTTP and WebSocket interfaces. Core bridge logic will be targeted for full coverage.
- **UX Consistency**: The Mini-App will honor Telegram theme settings, return human-readable error payloads, and acknowledge user actions immediately before longer-running background updates arrive.
- **Performance Requirements**: Explicit budgets are defined from the spec and maintained by avoiding polling in the primary path.
- **Observability & Documentation**: The plan includes structured logs for auth, command proxying, subscription health, and reconnects, plus metrics and the required design artifacts.

**Post-Phase 1 Design Re-check: PASS**

- The selected ASGI bridge keeps implementation complexity proportional to scope.
- The event-stream design preserves realtime performance without adding external infrastructure.
- The contracts and quickstart artifacts give the feature a testable external surface before implementation begins.

## Project Structure

### Documentation (this feature)

```text
specs/006-tma-bridge/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── tma-bridge.openapi.yaml
│   └── tma-events.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
└── tanzil/
    ├── cli/
    │   ├── main.py
    │   └── server.py
    ├── clients/
    │   ├── telegram/
    │   └── tma/
    │       ├── main.py
    │       ├── auth.py
    │       ├── sessions.py
    │       ├── core_client.py
    │       ├── websocket.py
    │       └── static/
    ├── core/
    │   ├── bus.py
    │   ├── engine.py
    │   └── registry.py
    └── models/

tests/
├── contract/
│   ├── test_tma_http_contract.py
│   └── test_tma_websocket_contract.py
├── integration/
│   ├── test_tma_bridge_flow.py
│   └── test_tma_core_event_stream.py
└── unit/
    ├── test_tma_auth.py
    ├── test_tma_sessions.py
    └── test_tma_event_fanout.py
```

**Structure Decision**: Use the existing single-project layout. Add a new `src/tanzil/clients/tma/` package for the ASGI bridge and static Mini-App shell, extend `src/tanzil/cli/server.py` to expose a persistent event stream over Unix sockets, and add `tests/contract/` for the bridge's external HTTP and WebSocket contracts.

## Complexity Tracking

No constitution violations or exceptions are required for this design.
