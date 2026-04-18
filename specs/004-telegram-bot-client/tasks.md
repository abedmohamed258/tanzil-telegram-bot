# Tasks: Telegram Bot Client

**Feature**: Telegram Bot Client (The Pro Client)  
**Plan**: [specs/004-telegram-bot-client/plan.md](plan.md)  
**Branch**: `004-telegram-bot-client`

## Implementation Strategy

We will follow an incremental delivery approach, starting with a basic bot skeleton and whitelisting (Phase 1-2), followed by the core download interaction (US1), real-time progress updates (US2), and finally management commands (US3). Each user story phase results in a functional increment that can be independently tested.

## Dependencies

- **US1** depends on **Foundational**
- **US2** depends on **US1**
- **US3** depends on **US1**

## Phase 1: Setup

- [x] T001 Create project directory structure at `src/tanzil/clients/telegram/`
- [x] T002 Initialize `src/tanzil/clients/telegram/__init__.py` and `main.py` skeleton with AIOGram dispatcher
- [x] T003 Add `aiogram` to project dependencies in `pyproject.toml` or equivalent

## Phase 2: Foundational

- [x] T004 Implement configuration loading for `telegram.token` and `telegram.authorized_users` in `src/tanzil/clients/telegram/config.py`
- [x] T005 Implement `WhitelistMiddleware` in `src/tanzil/clients/telegram/middleware/auth.py` to restrict access to authorized users
- [x] T006 Register `WhitelistMiddleware` in `src/tanzil/clients/telegram/main.py`
- [x] T007 [P] Create `BotSession` and `TelegramDownloadTask` schemas in `src/tanzil/clients/telegram/models/schemas.py`

## Phase 3: User Story 1 - Interact with Tanzil via Telegram (P1)

- [x] T008 [US1] Implement `/start` command handler in `src/tanzil/clients/telegram/handlers/commands.py`
- [x] T009 [US1] Implement message handler for URL detection in `src/tanzil/clients/telegram/handlers/downloads.py`
- [x] T010 [US1] Create `EngineWrapper` in `src/tanzil/clients/telegram/utils/engine.py` to bridge AIOGram and Tanzil Core Engine
- [x] T011 [US1] Implement basic "Download started" response and task queuing logic in `src/tanzil/clients/telegram/handlers/downloads.py`
- [x] T012 [US1] Implement file delivery logic (upload < 50MB, else link) in `src/tanzil/clients/telegram/utils/delivery.py`

**Independent Test**: Send a valid URL to the bot; verify the engine starts the download and the bot acknowledges it.

## Phase 4: User Story 2 - Monitor Download Progress (P2)

- [x] T013 [US2] Implement `ProgressReporter` with message editing throttling in `src/tanzil/clients/telegram/utils/progress.py`
- [x] T014 [US2] Integrate `ProgressReporter` with Tanzil Engine's pub/sub or callback system in `src/tanzil/clients/telegram/utils/engine.py`
- [x] T015 [US2] Update `TelegramDownloadTask` status in-memory upon engine events

**Independent Test**: Initiate a download and verify the Telegram message updates its progress percentage/speed periodically.

## Phase 5: User Story 3 - Manage Download Queue (P3)

- [x] T016 [US3] Implement `/list` command handler in `src/tanzil/clients/telegram/handlers/commands.py`
- [x] T017 [US3] Implement `/cancel {id}` command handler in `src/tanzil/clients/telegram/handlers/commands.py`
- [x] T018 [US3] [P] Add inline buttons for "Cancel" in the progress message in `src/tanzil/clients/telegram/utils/progress.py`
- [x] T019 [US3] Implement callback query handler for the "Cancel" button in `src/tanzil/clients/telegram/handlers/callbacks.py`

**Independent Test**: Use `/list` to see active tasks and `/cancel` (or the button) to stop a download; verify the engine stops the task.

## Phase 6: Polish & Cross-Cutting

- [x] T020 Implement user-friendly error handling for invalid URLs and engine failures in `src/tanzil/clients/telegram/handlers/errors.py`
- [x] T021 [P] Add logging for all bot interactions and engine events in `src/tanzil/clients/telegram/utils/logging.py`
- [x] T022 Finalize `src/tanzil/clients/telegram/main.py` with proper shutdown handling and signal listeners

## Parallel Execution Examples

### User Story 1

- T010 (Engine Wrapper) and T012 (Delivery Utils) can be developed in parallel as they have stable interfaces.

### User Story 3

- T016 (List command) and T018 (Cancel buttons) can be worked on simultaneously.
