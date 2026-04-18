# Feature Specification: TMA Bridge

**Feature Branch**: `006-phase-5-telegram`  
**Created**: 2026-04-17  
**Status**: Draft  
**Input**: User description: "PHASE 5: THE TELEGRAM MINI-APP (TMA) BRIDGE"

## Clarifications

### Session 2026-04-17

- Q: Which protocol should the Bridge use to push real-time updates from the Core Engine to the TMA? → A: WebSockets
- Q: How should the Bridge handle a single Telegram user opening the TMA on multiple devices/clients simultaneously? → A: Shared Session (All clients see the same state/downloads)
- Q: Should TMA sessions be persisted in a database or kept in-memory only (consistent with Core Engine Phase 1)? → A: In-memory only (Lost on restart, consistent with Core)
- Q: Should the bridge handle rate limiting for TMA requests, or is that delegated to the Core Engine? → A: Delegated (Core Engine handles rate limiting/security)
- Q: Is the Bridge expected to run as a separate service (sidecar) or as an integrated module within the Telegram Bot process? → A: Separate Service (Standalone process/sidecar)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open Tanzil in Telegram Mini-App (Priority: P1)

As a Telegram user, I want to open the Tanzil interface directly within Telegram so that I don't have to leave the app to manage my downloads.

**Why this priority**: Core value of the TMA bridge. Essential for the mobile-first Telegram experience.

**Independent Test**: Can be fully tested by clicking a "Open App" button in a Telegram bot and seeing the Tanzil UI load within the Telegram client.

**Acceptance Scenarios**:

1. **Given** a user is interacting with the Tanzil bot, **When** they tap the "Open Tanzil" button, **Then** the Telegram Mini-App interface should launch immediately.
2. **Given** the Mini-App is launched, **When** the interface loads, **Then** it should automatically recognize the user's Telegram identity for personalization.

---

### User Story 2 - Real-time Sync with Core Engine (Priority: P1)

As a user of the Tanzil TMA, I want to see my active downloads and system status update in real-time so that I have accurate information without refreshing.

**Why this priority**: Essential for a responsive and modern user experience in a download manager.

**Independent Test**: Start a download via another client (e.g., CLI or Bot) and verify the TMA UI reflects the new download and its progress automatically.

**Acceptance Scenarios**:

1. **Given** a download is in progress, **When** the progress changes in the core engine, **Then** the TMA UI must update the progress bar/percentage instantly.
2. **Given** a download completes or fails, **When** the status changes, **Then** the TMA UI must reflect the final state without user intervention.

---

### User Story 3 - Bridge Operations (Priority: P2)

As a developer/admin, I want the TMA bridge to act as a secure intermediary between the Telegram Mini-App frontend and the Tanzil Core Engine.

**Why this priority**: Security and architectural integrity. Ensures the Mini-App can safely communicate with the core engine.

**Independent Test**: Attempt to access the core engine API directly without valid TMA authentication and verify rejection.

**Acceptance Scenarios**:

1. **Given** a request from the TMA, **When** the bridge receives it, **Then** it must validate the Telegram Init Data (initData) before forwarding the request to the Core Engine.
2. **Given** a valid authenticated session, **When** the bridge forwards a command (e.g., "Add Download" or "Cancel Download"), **Then** the Core Engine must receive it as coming from the specific Telegram user.

---

### Edge Cases

- **What happens when the Telegram user has no Tanzil session?**
  - The bridge should establish a fresh authenticated bridge session and return an empty task list rather than exposing a guest mode.
- **How does the system handle rapid network disconnects in the TMA?**
  - The bridge must support reconnection logic and state recovery for the real-time sync.
- **What happens when a user opens the TMA on multiple devices?**
  - The bridge MUST provide a shared session where state changes on one device are instantly reflected on all other active devices for that user.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a web-based interface optimized for the Telegram Mini-App viewport.
- **FR-002**: System MUST validate all incoming requests using the `initData` provided by the Telegram Mini-App SDK.
- **FR-003**: System MUST proxy commands from the TMA to the Tanzil Core Engine for task creation, task lookup, task listing, and task cancellation.
- **FR-004**: System MUST establish a real-time communication channel using WebSockets to push updates from the Core Engine to the TMA.
- **FR-005**: System MUST handle Telegram-specific UI themes (light/dark mode) based on the user's Telegram settings.
- **FR-006**: System MUST maintain all active session data in-memory without external database persistence.

### Key Entities

- **TMA Session**: Represents an active connection between a Telegram user and the Tanzil bridge. Multiple active clients for the same user share the same session state. Sessions are stored in-memory.
- **Bridge Command**: An encapsulated request from the TMA frontend to be executed by the Core Engine.
- **Status Update**: A real-time message containing the state of one or more download tasks.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can view their download list within the TMA in under 1.5 seconds from launch.
- **SC-002**: Real-time progress updates in the TMA reflect Core Engine state changes with less than 200ms latency.
- **SC-003**: 100% of unauthenticated or invalid `initData` requests are rejected by the bridge.
- **SC-004**: The TMA interface correctly adapts its color palette to match the Telegram theme in 100% of cases.

## Assumptions

- **Existing Core Engine**: It is assumed the Tanzil Core Engine (Phase 3) provides an accessible API or Pub/Sub mechanism for the bridge to connect to.
- **SDK Availability**: It is assumed the standard Telegram Mini-App SDK will be used for frontend interactions.
- **Connectivity**: Users are assumed to have a persistent internet connection while using the Telegram Mini-App.
- **Session Lifespan**: TMA sessions are assumed to be short-lived, typically lasting only as long as the Mini-App is open.
- **Persistence**: It is assumed that losing session state on bridge restart is acceptable for the current phase.
- **Security Delegation**: It is assumed that the Core Engine handles command-level throttling, while the Bridge still enforces request authentication, session expiry, and connection limits at its own boundary.
- **Deployment Boundary**: It is assumed that the bridge runs as a separate service from the Telegram bot process so it can scale and fail independently.
