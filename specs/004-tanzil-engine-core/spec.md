# Feature Specification: Tanzil Engine Core Extraction

**Feature Branch**: `004-tanzil-engine-core`  
**Created**: 2026-04-17  
**Status**: Draft  
**Input**: User description: "PHASE 2: THE TANZIL ENGINE (CORE EXTRACTION)"

## Clarifications

### Session 2026-04-17

- Q: Which Pub/Sub mechanism should be used for event broadcasting? → A: Internal `asyncio` Event Bus.
- Q: How should extraction concurrency be managed? → A: Max Concurrent Tasks (e.g., 50.
- Q: What format should be used for extraction results? → A: Structured JSON.
- Q: What should be returned when a task is triggered? → A: Task ID & Status (JSON).
- Q: How should logging be handled? → A: Python `logging` Standard Library.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Engine Initialization (Priority: P1)

As a developer, I want to initialize the Tanzil engine with a YAML configuration so that the system is ready to process extraction tasks.

**Why this priority**: Fundamental requirement for any engine operation. Without initialization, no other features can run.

**Independent Test**: Can be tested by providing a valid YAML configuration and verifying that the engine state is correctly loaded in memory.

**Acceptance Scenarios**:

1. **Given** a valid `config.yaml`, **When** the engine starts, **Then** all configuration parameters are loaded into the in-memory state.
2. **Given** an invalid or missing `config.yaml`, **When** the engine starts, **Then** it provides a clear error message and halts execution.

---

### User Story 2 - Asynchronous Core Extraction (Priority: P2)

As a system user, I want to trigger an extraction process asynchronously so that multiple downloads/extractions can happen in parallel without blocking.

**Why this priority**: Core value proposition of the engine (efficiency and concurrency).

**Independent Test**: Can be tested by triggering multiple concurrent extraction tasks and verifying they run in parallel using asynchronous processing.

**Acceptance Scenarios**:

1. **Given** multiple extraction tasks, **When** triggered simultaneously, **Then** the engine processes them concurrently and returns results as they complete.
2. **Given** a long-running extraction task, **When** other tasks are submitted, **Then** the engine continues to accept and process new tasks.

---

### User Story 3 - Event Notification via Pub/Sub (Priority: P3)

As a monitoring system, I want to receive notifications about extraction progress and completion so that I can track the status of the engine's activities.

**Why this priority**: Necessary for observability and integration with other components.

**Independent Test**: Can be tested by subscribing to engine events and verifying that "started", "progress", and "completed" events are received for each extraction task.

**Acceptance Scenarios**:

1. **Given** a subscriber to the engine's Pub/Sub system, **When** an extraction task is processed, **Then** the subscriber receives events for each major lifecycle stage.

---

### Edge Cases

- What happens when a network timeout occurs during an extraction?
- How does the system handle corrupt YAML configuration files?
- What happens if the in-memory state exceeds available system memory?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST load engine configuration from a YAML file.
- **FR-002**: System MUST use asynchronous processing for all core extraction logic with a configurable maximum concurrency limit (default: 50) to support high throughput without resource exhaustion.
- **FR-003**: System MUST implement an internal `asyncio`-based event bus for event broadcasting.
- **FR-004**: System MUST provide a command-line interface for basic engine management.
- **FR-007**: System MUST use the Python standard `logging` library for all internal signals, errors, and audit trails.

### Key Entities _(include if feature involves data)_

- **EngineConfig**: Represents the operational parameters (extraction rules, concurrency limits, etc.).
- **ExtractionTask**: Represents a single unit of extraction work, including its status and results in structured JSON format.
- **EngineEvent**: Represents an asynchronous notification (e.g., ProgressUpdate, TaskCompleted).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Engine initialization from YAML completes in under 100ms.
- **SC-002**: System successfully handles 50+ concurrent extraction tasks without blocking the main event loop.
- **SC-003**: 100% of extraction lifecycle events are published to the internal Pub/Sub system.
- **SC-004**: Engine correctly handles malformed configuration by reporting the specific line/error within 2 seconds.

## Assumptions

- [Assumption about target users]: Users are developers or system administrators familiar with CLI tools.
- [Assumption about scope boundaries]: Persistent storage (database) is out of scope for Phase 2.
- [Assumption about data/environment]: The system will run on a machine with the required runtime environment installed.
- [Dependency on existing system/service]: Relies on the core engine components established in Phase 1.
