# Tasks: TMA Bridge

**Input**: Design documents from `/specs/006-tma-bridge/`
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Tests are mandatory for this feature per the Constitution. Write tests first and verify they fail before implementation.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes an exact file path

## Path Conventions

- Single project layout under `src/` and `tests/`
- Bridge runtime code lives under `src/tanzil/clients/tma/`
- Core service integration stays in existing `src/tanzil/cli/`, `src/tanzil/core/`, and `src/tanzil/models/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the bridge package and dependencies required for implementation.

- [ ] T001 Update bridge runtime and test dependencies in `pyproject.toml`
- [ ] T002 Create the TMA bridge package marker in `src/tanzil/clients/tma/__init__.py`
- [ ] T003 [P] Create the static asset placeholder in `src/tanzil/clients/tma/static/.gitkeep`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared runtime and core integration pieces required by all user stories.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [ ] T004 Extend shared bridge configuration models in `src/tanzil/models/config.py`
- [ ] T005 Add the `tanzil bridge` CLI entrypoint in `src/tanzil/cli/main.py`
- [ ] T006 Implement ASGI app bootstrap and config loading in `src/tanzil/clients/tma/main.py`
- [ ] T007 [P] Add structured core event envelope support and owner-aware task metadata in `src/tanzil/models/task.py` and `src/tanzil/core/bus.py`
- [ ] T008 Implement a persistent core event subscription stream in `src/tanzil/cli/server.py`
- [ ] T009 Implement the Unix socket command and event client in `src/tanzil/clients/tma/core_client.py`

**Checkpoint**: Foundation ready. User story work can now begin.

---

## Phase 3: User Story 1 - Open Tanzil in Telegram Mini-App (Priority: P1) 🎯 MVP

**Goal**: Let a Telegram user open the Mini-App, validate identity from Telegram, and receive a themed authenticated shell inside Telegram.

**Independent Test**: Tap the Mini-App button from the Telegram bot, load `/app`, exchange valid `initData` at `/api/session`, and confirm the user receives an authenticated themed shell without leaving Telegram.

### Tests for User Story 1

- [ ] T010 [P] [US1] Add initData validation and expiry tests in `tests/unit/test_tma_auth.py`
- [ ] T011 [P] [US1] Add shared session creation and reuse tests in `tests/unit/test_tma_sessions.py`
- [ ] T012 [P] [US1] Add contract tests for `GET /api/health` and `POST /api/session` in `tests/contract/test_tma_http_contract.py`
- [ ] T013 [US1] Add Mini-App launch integration coverage in `tests/integration/test_tma_bridge_flow.py`

### Implementation for User Story 1

- [ ] T014 [US1] Implement Telegram `initData` validation and bridge token issuance in `src/tanzil/clients/tma/auth.py`
- [ ] T015 [US1] Implement the in-memory shared session store with expiry cleanup in `src/tanzil/clients/tma/sessions.py`
- [ ] T016 [US1] Implement `/app`, `/api/health`, and `/api/session` routes in `src/tanzil/clients/tma/main.py`
- [ ] T017 [P] [US1] Create the Telegram-themed Mini-App shell in `src/tanzil/clients/tma/static/index.html`
- [ ] T018 [US1] Add the Telegram `web_app` entry point wiring in `src/tanzil/clients/telegram/handlers/commands.py`

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Real-time Sync with Core Engine (Priority: P1)

**Goal**: Show the authenticated user the current task list and keep it updated through WebSocket snapshot-and-stream behavior.

**Independent Test**: With an authenticated Mini-App session, load the current task list from `/api/tasks`, connect to `/api/events`, trigger a task change from another client, and confirm the Mini-App updates automatically without refresh.

### Tests for User Story 2

- [ ] T019 [P] [US2] Add contract tests for `GET /api/tasks` in `tests/contract/test_tma_http_contract.py`
- [ ] T020 [P] [US2] Add WebSocket contract tests for `/api/events` snapshot and task events in `tests/contract/test_tma_websocket_contract.py`
- [ ] T021 [US2] Add realtime snapshot and event-stream integration coverage in `tests/integration/test_tma_core_event_stream.py`
- [ ] T022 [P] [US2] Add event fan-out and multi-client broadcast tests in `tests/unit/test_tma_event_fanout.py`

### Implementation for User Story 2

- [ ] T023 [US2] Implement task snapshot and list proxy methods in `src/tanzil/clients/tma/core_client.py`
- [ ] T024 [US2] Implement WebSocket connection management and event fan-out in `src/tanzil/clients/tma/websocket.py`
- [ ] T025 [US2] Implement `GET /api/tasks` and `GET /api/events` handlers in `src/tanzil/clients/tma/main.py`
- [ ] T026 [US2] Update shared session connection counting and reconnect state handling in `src/tanzil/clients/tma/sessions.py`
- [ ] T027 [US2] Render the task list and live progress updates in `src/tanzil/clients/tma/static/index.html`

**Checkpoint**: User Stories 1 and 2 both work independently, and authenticated users receive live task updates.

---

## Phase 5: User Story 3 - Bridge Operations (Priority: P2)

**Goal**: Securely proxy download actions through the bridge so only authenticated Telegram users can create and control tasks, and the core receives user identity context.

**Independent Test**: Attempt command requests with an invalid bridge session and confirm rejection; then issue authenticated create and action requests and confirm the core receives the command with Telegram user identity attached.

### Tests for User Story 3

- [ ] T028 [P] [US3] Add contract tests for `POST /api/tasks` and cancel-only `POST /api/tasks/{taskId}/actions` in `tests/contract/test_tma_http_contract.py`
- [ ] T029 [US3] Add authenticated command proxy integration coverage in `tests/integration/test_tma_bridge_flow.py`
- [ ] T030 [P] [US3] Add command payload and authorization unit tests in `tests/unit/test_tma_commands.py`

### Implementation for User Story 3

- [ ] T031 [US3] Implement authenticated create and cancel proxy methods in `src/tanzil/clients/tma/core_client.py`
- [ ] T032 [US3] Implement `POST /api/tasks` and cancel-only `POST /api/tasks/{taskId}/actions` handlers in `src/tanzil/clients/tma/main.py`
- [ ] T033 [US3] Extend core command request validation and actor forwarding in `src/tanzil/cli/server.py`
- [ ] T034 [US3] Add human-readable auth and proxy failure responses in `src/tanzil/clients/tma/main.py`

**Checkpoint**: All three user stories are independently functional, and the bridge enforces authenticated command proxying.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improve observability, resilience, and final documentation across all stories.

- [ ] T035 [P] Add structured bridge logs and latency instrumentation in `src/tanzil/clients/tma/main.py` and `src/tanzil/clients/tma/core_client.py`
- [ ] T036 [P] Add degraded-stream recovery and reconnect handling in `src/tanzil/clients/tma/websocket.py` and `src/tanzil/clients/tma/sessions.py`
- [ ] T037 Update bridge runbook steps in `specs/006-tma-bridge/quickstart.md`
- [ ] T038 Run and document the full bridge test matrix in `tests/contract/test_tma_http_contract.py`, `tests/contract/test_tma_websocket_contract.py`, `tests/integration/test_tma_bridge_flow.py`, `tests/integration/test_tma_core_event_stream.py`, `tests/unit/test_tma_auth.py`, `tests/unit/test_tma_sessions.py`, `tests/unit/test_tma_event_fanout.py`, and `tests/unit/test_tma_commands.py`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 and establishes authenticated Mini-App access.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and reuses the authenticated session flow from User Story 1.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and reuses the authenticated session flow from User Story 1.
- **Polish (Phase 6)**: Depends on the stories you intend to ship.

### User Story Dependency Graph

```text
Phase 1 Setup
  -> Phase 2 Foundational
    -> Phase 3 US1 (MVP)
      -> Phase 4 US2
      -> Phase 5 US3
        -> Phase 6 Polish
```

### Within Each User Story

- Tests must be written and fail before implementation.
- Session and auth primitives must exist before route handlers rely on them.
- Core client methods must exist before WebSocket or HTTP handlers call them.
- Story-specific UI updates come after the supporting backend contract is stable.

### Parallel Opportunities

- Phase 1: `T003` can run while `T001` and `T002` are in progress.
- Phase 2: `T007` can run in parallel with `T004` to `T006`; `T008` depends on `T007`; `T009` can start once the socket protocol is stable.
- US1: `T010`, `T011`, and `T012` can run together; `T017` can run in parallel with backend implementation once the `/app` contract is fixed.
- US2: `T018`, `T019`, and `T021` can run together before implementation begins.
- US3: `T027` and `T029` can run in parallel before command proxy implementation.
- Polish: `T035` and `T036` can run in parallel after story completion.

---

## Parallel Example: User Story 1

```bash
Task: "Add initData validation and expiry tests in tests/unit/test_tma_auth.py"
Task: "Add shared session creation and reuse tests in tests/unit/test_tma_sessions.py"
Task: "Add contract tests for GET /api/health and POST /api/session in tests/contract/test_tma_http_contract.py"
```

## Parallel Example: User Story 2

```bash
Task: "Add contract tests for GET /api/tasks in tests/contract/test_tma_http_contract.py"
Task: "Add WebSocket contract tests for /api/events snapshot and task events in tests/contract/test_tma_websocket_contract.py"
Task: "Add event fan-out and multi-client broadcast tests in tests/unit/test_tma_event_fanout.py"
```

## Parallel Example: User Story 3

```bash
Task: "Add contract tests for POST /api/tasks and POST /api/tasks/{taskId}/actions in tests/contract/test_tma_http_contract.py"
Task: "Add command payload and authorization unit tests in tests/unit/test_tma_commands.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate Mini-App launch, identity exchange, and themed shell behavior.
5. Demo or ship the authenticated launch flow before adding realtime or command proxy work.

### Incremental Delivery

1. Finish Setup and Foundational to establish the bridge runtime and core protocol.
2. Deliver User Story 1 as the MVP authenticated shell.
3. Deliver User Story 2 to add live task visibility.
4. Deliver User Story 3 to complete secure command proxying.
5. Finish with Phase 6 polish once the target story set is stable.

### Parallel Team Strategy

1. One developer completes Phase 1 and Phase 2.
2. After User Story 1 stabilizes the auth/session contract, one developer can focus on User Story 2 while another focuses on User Story 3.
3. Polish tasks then close the observability and resilience gaps before release.

---

## Notes

- `[P]` tasks are safe to parallelize because they target different files or isolated workstreams.
- Every user story phase includes tests, implementation, and an independent validation checkpoint.
- Keep the bridge thin: the core service remains the source of truth for task state and rate limiting.
- Preserve story independence by avoiding direct US2-to-US3 dependencies.
