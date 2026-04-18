---
description: "Task list for Tanzil Core Engine implementation"
---

# Tasks: Core Engine (Component A)

**Input**: Design documents from `/specs/003-core-engine-a/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Automated tests are MANDATORY for all features per the Constitution. They are written first (TDD).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Paths assume the structure defined in `plan.md`: `packages/python-core/tanzil/`, `tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project directories `packages/python-core/tanzil/core`, `packages/python-core/tanzil/components/downloader`
- [x] T002 [P] Install dependencies: `pyyaml`, `pydantic`, `aiohttp`, `python-statemachine`
- [x] T003 [P] Configure `tool.ruff` in `pyproject.toml` for standard linting

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Implement logging infrastructure in `packages/python-core/tanzil/utils/logging.py`
- [x] T005 [P] Implement YAML configuration models in `packages/python-core/tanzil/models/engine_config.py`
- [x] T006 [P] Implement Event Bus (asyncio.Queue) in `packages/python-core/tanzil/core/events.py`
- [x] T007 Implement BaseComponent interface in `packages/python-core/tanzil/core/base.py`
- [x] T008 [P] Implement Registry (importlib.metadata) in `packages/python-core/tanzil/core/registry.py`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Initialize Core Engine (Priority: P1) 🎯 MVP

**Goal**: Initialize core engine via YAML and manage lifecycle.

**Independent Test**: Invoke engine initialization with valid/invalid YAML and verify state transitions to "Running" or "Error".

### Tests for User Story 1

- [x] T009 [P] [US1] Unit test for EngineConfig validation in `tests/unit/test_engine_config.py`
- [x] T010 [P] [US1] Integration test for Engine lifecycle transitions in `tests/integration/test_engine_lifecycle.py`

### Implementation for User Story 1

- [x] T011 [US1] Implement TanzilEngine state machine in `packages/python-core/tanzil/core/engine.py`
- [x] T012 [US1] Implement engine initialization logic (`from_yaml`) in `packages/python-core/tanzil/core/engine.py`
- [x] T013 [US1] Implement engine `start()` and `stop()` methods in `packages/python-core/tanzil/core/engine.py`

**Checkpoint**: User Story 1 functional - Engine can boot and transition states.

---

## Phase 4: User Story 2 - Register and Load Download Manager (Priority: P1)

**Goal**: Register Download Manager (Component A) via entry points and load it into the engine.

**Independent Test**: Register mock component and verify engine reports it as active.

### Tests for User Story 2

- [x] T014 [P] [US2] Unit test for dynamic component discovery in `tests/unit/test_registry.py`
- [x] T015 [P] [US2] Integration test for Download Manager registration in `tests/integration/test_component_loading.py`

### Implementation for User Story 2

- [x] T016 [US2] Implement `DownloadManager` skeleton in `packages/python-core/tanzil/components/downloader/manager.py`
- [x] T017 [US2] Configure entry point for `downloader` in `packages/python-core/pyproject.toml`
- [x] T018 [US2] Integrate `Registry` with `TanzilEngine` to load components during initialization in `packages/python-core/tanzil/core/engine.py`

**Checkpoint**: User Story 2 functional - Components can be registered and loaded.

---

## Phase 5: User Story 3 - Concurrent Download Trigger Routing (Priority: P2)

**Goal**: Route parallel download triggers via Pub/Sub to the Download Manager.

**Independent Test**: Send multiple download events and verify concurrent processing.

### Tests for User Story 3

- [x] T019 [P] [US3] Unit test for Event Bus async delivery in `tests/unit/test_events.py`
- [x] T020 [P] [US3] Integration test for concurrent download triggering in `tests/integration/test_concurrent_downloads.py`

### Implementation for User Story 3

- [x] T021 [US3] Implement `DownloadTask` model in `packages/python-core/tanzil/models/download_task.py`
- [x] T022 [US3] Implement parallel fetch logic using `aiohttp` and `Semaphore` in `packages/python-core/tanzil/components/downloader/manager.py`
- [x] T023 [US3] Subscribe `DownloadManager` to `downloader.fetch.request` events in `packages/python-core/tanzil/components/downloader/manager.py`
- [x] T024 [US3] Emit download status updates via Event Bus in `packages/python-core/tanzil/components/downloader/manager.py`

**Checkpoint**: All user stories functional - Parallel downloads working via engine orchestration.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T025 [P] Document component registration process in `README.md`
- [x] T026 Final code cleanup and type hint verification
- [x] T027 Run and validate `quickstart.md` examples

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all stories.
- **User Stories (Phase 3+)**: All depend on Phase 2. US1 and US2 are P1 and should complete first. US3 depends on US1 and US2 completion for full system integration.

### Parallel Opportunities

- T002, T003 (Setup)
- T005, T006, T008 (Foundational)
- Once Phase 2 is done, US1 and US2 can start in parallel.
- All tasks marked [P] within a phase.

---

## Parallel Example: Foundational Phase

```bash
# Launch foundational infrastructure together:
Task: "Implement YAML configuration models in packages/python-core/tanzil/models/engine_config.py"
Task: "Implement Event Bus (asyncio.Queue) in packages/python-core/tanzil/core/events.py"
Task: "Implement Registry (importlib.metadata) in packages/python-core/tanzil/core/registry.py"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Setup and Foundational phases.
2. Implement US1 (Engine Lifecycle).
3. Implement US2 (Component Loading).
4. **STOP and VALIDATE**: Test engine booting with a loaded component.

### Incremental Delivery

1. Foundation -> Stable base.
2. US1 + US2 -> Orchestration capability (MVP).
3. US3 -> Functional capability (Downloads).
4. Polish -> Documentation and cleanup.
