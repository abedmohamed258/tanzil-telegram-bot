# Tasks: Tanzil Engine Core Extraction

## Implementation Strategy

We will follow a Service-Oriented Architecture (SOA) approach, implementing a long-running daemon (server) that maintains in-memory state and a lightweight CLI client that communicates via Unix Domain Sockets. This architecture resolves the ephemeral state issues identified in early reviews.

1.  **MVP Scope**: Phase 1 through Phase 3 (US1: Engine Initialization & Daemon).
2.  **Incremental Delivery**: Phases 4 and 5 add asynchronous extraction and observability.

## Phase 1: Setup
Project initialization and environment configuration.

- [x] T001 Initialize project structure at `src/tanzil/`
- [x] T002 Configure `pyproject.toml` with `typer`, `pyyaml`, `pydantic`, and script entry points
- [x] T003 Set up virtual environment and install development dependencies

## Phase 2: Foundational
Core logic, models, and IPC infrastructure.

- [x] T004 Implement `EngineConfig` and YAML loader in `src/tanzil/core/config.py`
- [x] T005 Implement `TaskRegistry` with LRU eviction in `src/tanzil/core/registry.py`
- [x] T006 Implement `EventBus` using `asyncio.Queue` in `src/tanzil/core/bus.py`
- [x] T007 Define `ExtractionTask` and `EngineEvent` in `src/tanzil/models/task.py`

## Phase 3: User Story 1 - Engine Initialization & Daemon (Priority: P1)
**Goal**: Start a persistent engine daemon.
**Independent Test**: Start `tanzil server`, verify socket creation, and successful initialization logs.

- [x] T008 [US1] Implement core `Engine` with strong task tracking in `src/tanzil/core/engine.py`
- [x] T009 [US1] Implement `TanzilServer` with Unix Socket IPC in `src/tanzil/cli/server.py`
- [x] T010 [US1] Create `server` command in `src/tanzil/cli/main.py`
- [x] T011 [P] [US1] Write unit tests for configuration and registry in `tests/unit/`

## Phase 4: User Story 2 - Asynchronous Core Extraction (Priority: P2)
**Goal**: Submit and track extraction tasks via IPC.
**Independent Test**: Use `tanzil submit` and `tanzil status` to manage tasks across process boundaries.

- [x] T012 [US2] Implement `submit` and `status` command handlers in `src/tanzil/cli/server.py`
- [x] T013 [US2] Implement CLI client commands in `src/tanzil/cli/main.py`
- [x] T014 [US2] Implement `asyncio.Semaphore` concurrency control in `src/tanzil/core/engine.py`
- [x] T015 [P] [US2] Write integration tests for multi-process task management in `tests/integration/test_concurrency.py`

## Phase 5: User Story 3 - Event Notification & Observability (Priority: P3)
**Goal**: Broadcast task events and integrate structured logging.
**Independent Test**: Subscribe to events and verify log levels respect configuration.

- [x] T016 [US3] Integrate `EventBus` into the task lifecycle in `src/tanzil/core/engine.py`
- [x] T017 [US3] Implement structured logging across core modules
- [x] T018 [P] [US3] Write unit tests for event bus globbing and dispatching in `tests/unit/test_bus.py`

## Phase 6: Polish
Final validation and documentation.

- [x] T019 Implement `list` command for task discovery in CLI/Server
- [x] T020 [P] Conduct final end-to-end validation using `quickstart.md` scenarios

## Dependencies & Parallel Execution

### Dependency Graph
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3)

### Parallel Opportunities
- T011, T015, T018 (Testing) can run alongside implementation.
- T019, T020 can be prepared as US3 is finalized.
