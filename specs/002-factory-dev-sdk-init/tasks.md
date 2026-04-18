# Tasks: factory-dev-sdk-init

**Input**: Design documents from `/specs/002-factory-dev-sdk-init/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Automated tests are REQUIRED per the Constitution. This task list includes test-driven development (TDD) steps for each phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project structure: `.tanzil/`, `bin/`, `packages/`, `services/`, `scripts/`
- [x] T002 Initialize Node.js root workspace with `package.json` and `pnpm-workspace.yaml`
- [x] T003 Initialize Python root workspace with `pyproject.toml` (uv configuration)
- [x] T004 [P] Configure linting and formatting (ESLint/Prettier for Node, Ruff for Python)
- [x] T005 [P] Create initial `.gitignore` covering both Node and Python ecosystems

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create Bash bootstrapper `scripts/init.sh` to check for Python3 and Node.js
- [x] T007 Implement core configuration schema in `packages/python-core/tanzil/models/config.py`
- [x] T008 Setup logging infrastructure in `packages/python-core/tanzil/utils/logging.py`
- [x] T009 Create base Factory class in `packages/python-core/tanzil/factory/base.py`
- [x] T010 [P] Implement YAML loader for `.tanzil/config.yaml` in `packages/python-core/tanzil/utils/yaml.py`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Developer Environment Setup (Priority: P1) 🎯 MVP

**Goal**: Initialize core directory structure, config, and isolated environments (venv/pnpm).

**Independent Test**: Run `./scripts/init.sh` and verify `.tanzil/venv` exists and `bin/tanzil` is executable.

### Tests for User Story 1

- [x] T011 [P] [US1] Integration test for directory scaffolding in `tests/integration/test_scaffolding.py`
- [x] T012 [P] [US1] Integration test for environment isolation (venv creation) in `tests/integration/test_isolation.py`

### Implementation for User Story 1

- [x] T013 [US1] Implement directory creation logic in `packages/python-core/tanzil/factory/scaffold.py`
- [x] T014 [US1] Implement Python venv creation logic using `uv` in `packages/python-core/tanzil/factory/isolation_py.py`
- [x] T015 [US1] Implement Node.js workspace setup logic in `packages/python-core/tanzil/factory/isolation_node.py`
- [x] T016 [US1] Implement CLI entry point `bin/tanzil` that proxies to the Python factory
- [x] T017 [US1] Implement `init` command in `packages/python-core/tanzil/cli/init.py`
- [x] T018 [US1] Integrate `init` logic with `init.sh` bootstrapper

**Checkpoint**: User Story 1 is fully functional. Environment can be initialized from scratch.

---

## Phase 4: User Story 2 - SDK Configuration Management (Priority: P2)

**Goal**: Automatic management of environment-specific configurations (dev, test, prod).

**Independent Test**: Run `tanzil init --env testing` and verify `.tanzil/config.yaml` reflects testing profiles.

### Tests for User Story 2

- [x] T019 [P] [US2] Unit tests for config profile loading in `tests/unit/test_config_profiles.py`
- [x] T020 [P] [US2] Integration test for environment switching in `tests/integration/test_env_switch.py`
- [x] T021 [US2] Implement environment profile definitions in `packages/python-core/tanzil/models/profiles.py`
- [x] T022 [US2] Implement profile switching logic in `packages/python-core/tanzil/factory/config_manager.py`
- [x] T023 [US2] Add `--env` flag to `init` command in `packages/python-core/tanzil/cli/init.py`
- [x] T024 [US2] Implement automated config update logic for environment transitions

**Checkpoint**: SDK correctly handles different environment profiles.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Health checks, integrity validation, and final documentation.

- [x] T025 Implement `doctor` command for integrity validation in `packages/python-core/tanzil/cli/doctor.py`
- [x] T026 [P] Implement tool version checks (Node/Python/Git) in `packages/python-core/tanzil/utils/health.py`
- [x] T027 [US1] [US2] Add "Safe Merge" logic to prevent overwriting existing files in `packages/python-core/tanzil/utils/fs.py`
- [x] T028 [P] Update `README.md` with initialization instructions from `quickstart.md`
- [x] T029 Final validation: Run all integration tests and verify SC-001 (init under 60s)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Blocks Phase 2.
- **Phase 2 (Foundational)**: Blocks all User Story phases.
- **Phase 3 (US1)**: MVP. Blocks US2 if US2 needs the venv, but designed to be independent where possible.
- **Phase 5 (Polish)**: Depends on Phase 3 and 4 completion.

### User Story Dependencies

- **US1 (P1)**: Foundation for the entire SDK.
- **US2 (P2)**: Builds on US1's configuration management.

### Parallel Opportunities

- T004, T005 (Setup)
- T010 (Foundational)
- T011, T012 (US1 Tests)
- T019, T020 (US2 Tests)
- T026, T028 (Polish)

---

## Parallel Example: User Story 1

```bash
# Run integration tests in parallel
pytest tests/integration/test_scaffolding.py & pytest tests/integration/test_isolation.py
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup (T001-T005)
2. Complete Foundational (T006-T010)
3. Complete US1 (T011-T018)
4. **Validate**: Run `./scripts/init.sh` and verify the environment.

### Incremental Delivery

1. Foundation + US1 -> Deliver "Tanzil Environment Initializer".
2. Add US2 -> Deliver "Multi-environment Configuration Support".
3. Add Polish -> Deliver "Production-ready SDK with Health Checks".
