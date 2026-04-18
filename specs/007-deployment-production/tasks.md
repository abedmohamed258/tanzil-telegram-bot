# Tasks: Deployment & Production

**Input**: Design documents from `/specs/007-deployment-production/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests for deployment and infrastructure (health checks, workflow validation) are included to satisfy the Constitution.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create `docker/` directory structure for all services per plan.md
- [X] T002 Create `scripts/deployment/` directory for operational scripts
- [X] T003 [P] Create `.env.example` with all production environment variables from data-model.md
- [X] T004 [P] Configure Docker log rotation defaults in `docker-compose.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 [P] Create production-ready `docker/core/Dockerfile` using `python:3.10-slim-bookworm`
- [X] T006 [P] Create production-ready `docker/bot/Dockerfile` using `python:3.10-slim-bookworm`
- [X] T007 [P] Create production-ready `docker/bridge/Dockerfile` using `python:3.10-slim-bookworm`
- [X] T008 [P] Implement `/health` endpoint in Core service (src/core/api.py or similar) per contracts/api.md
- [X] T009 [P] Implement `/health` endpoint in Bot service (src/bot/main.py or similar) per contracts/api.md
- [X] T010 [P] Implement `/health` endpoint in Bridge service (src/bridge/app.py or similar) per contracts/api.md

**Checkpoint**: Foundation ready - containerization and health monitoring infrastructure complete.

---

## Phase 3: User Story 1 - Production Environment Setup (Priority: P1) 🎯 MVP

**Goal**: Deploy the system to a VPS with Nginx and SSL.

**Independent Test**: Run `docker-compose.prod.yml` locally or on a VPS; verify Nginx proxies traffic to services over HTTPS.

### Implementation for User Story 1

- [X] T011 [P] [US1] Create `docker-compose.prod.yml` with Core, Bot, Bridge, Nginx-proxy, and ACME-companion
- [X] T012 [P] [US1] Define Docker volumes for `tanzil_downloads`, `tanzil_config`, and SSL certs in `docker-compose.prod.yml`
- [X] T013 [US1] Create VPS initialization script in `scripts/deployment/setup-vps.sh` (install Docker, clone repo)
- [X] T014 [US1] Configure Nginx VIRTUAL_HOST and LETSENCRYPT environment variables for all services in `docker-compose.prod.yml`
- [X] T015 [US1] Verify end-to-end connectivity between Nginx and container health endpoints

**Checkpoint**: At this point, the system can be manually deployed to a VPS with full SSL protection.

---

## Phase 4: User Story 2 - Automated Updates (Priority: P2)

**Goal**: Enable CI/CD via GitHub Actions.

**Independent Test**: Push a change to a branch and verify the GitHub Action successfully connects to the VPS and executes deployment commands.

### Implementation for User Story 2

- [X] T016 [P] [US2] Create GitHub Actions deployment workflow in `.github/workflows/deploy.yml`
- [X] T017 [US2] Implement SSH-based deployment logic using `appleboy/ssh-action` in `.github/workflows/deploy.yml`
- [X] T018 [US2] Add steps to `.github/workflows/deploy.yml` to pull latest code, rebuild images, and restart services
- [X] T019 [US2] Validate workflow triggers on push to `main` branch

**Checkpoint**: At this point, code changes are automatically deployed to the production environment.

---

## Phase 5: User Story 3 - Monitoring & Logging (Priority: P3)

**Goal**: Aggregated logging and storage cleanup.

**Independent Test**: Verify logs from all containers are viewable via `docker logs` and that the cleanup script correctly identifies/removes old files.

### Implementation for User Story 3

- [X] T020 [P] [US3] Create storage cleanup script in `scripts/deployment/cleanup-storage.sh` per data-model.md
- [X] T021 [US3] Create `docker/cleanup/Dockerfile` for the sidecar cleanup container
- [X] T022 [US3] Add cleanup service to `docker-compose.prod.yml` with cron schedule `0 3 * * *`
- [X] T023 [P] [US3] Configure centralized logging and rotation limits for all services in `docker-compose.prod.yml`
- [X] T024 [US3] Add optional Dozzle service to `docker-compose.prod.yml` for real-time log viewing

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [X] T025 [P] Update root `README.md` with production deployment instructions from `quickstart.md`
- [X] T026 Final security audit of `docker-compose.prod.yml` (remove exposed ports, check secrets)
- [X] T027 [P] Run and validate all instructions in `specs/007-deployment-production/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Prerequisite for all phases.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories.
- **User Story 1 (P1)**: Depends on Foundational.
- **User Story 2 (P2)**: Depends on US1 (requires a working deployment to automate).
- **User Story 3 (P3)**: Depends on US1 (requires volumes and containers to monitor/clean).

---

## Parallel Example: Foundational Tasks

```bash
# Launch Dockerfile creation in parallel
Task: "Create production-ready docker/core/Dockerfile"
Task: "Create production-ready docker/bot/Dockerfile"
Task: "Create production-ready docker/bridge/Dockerfile"

# Launch health check implementation in parallel
Task: "Implement /health endpoint in Core service"
Task: "Implement /health endpoint in Bot service"
Task: "Implement /health endpoint in Bridge service"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Manually deploy the stack and verify HTTPS access to health checks.

### Incremental Delivery

1. **Foundation Ready**: T001-T010 complete.
2. **Manual Production**: US1 complete. System is "live".
3. **Automated Production**: US2 complete. Maintenance is now effortless.
4. **Robust Production**: US3 complete. System handles its own maintenance and observability.
