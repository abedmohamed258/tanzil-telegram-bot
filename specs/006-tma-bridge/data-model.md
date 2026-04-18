# Data Model: TMA Bridge

## Overview

The bridge introduces transient session and connection models on top of the core engine's existing task registry. The core engine remains the source of truth for task execution state.

## Entity: BridgeSession

Represents the authenticated bridge session for one Telegram user. Multiple active Mini-App clients for the same Telegram user share the same logical session.

| Field               | Type        | Required | Notes                                                         |
| ------------------- | ----------- | -------- | ------------------------------------------------------------- |
| `session_id`        | UUID/string | Yes      | Unique bridge session identifier                              |
| `telegram_user_id`  | Integer     | Yes      | Canonical Telegram user identity                              |
| `auth_date`         | Timestamp   | Yes      | Original Telegram auth timestamp                              |
| `expires_at`        | Timestamp   | Yes      | Short-lived bridge session expiry                             |
| `last_seen_at`      | Timestamp   | Yes      | Updated on authenticated HTTP and WebSocket activity          |
| `theme`             | Enum        | Yes      | `light`, `dark`, or `system` based on Telegram client context |
| `connected_clients` | Integer     | Yes      | Count of active WebSocket clients sharing the session         |
| `state`             | Enum        | Yes      | `authenticated`, `active`, `degraded`, `expired`, `closed`    |

**Validation rules**

- `telegram_user_id` must come from validated Telegram `initData`, never from an untrusted client body.
- `expires_at` must be later than `auth_date`.
- `connected_clients` cannot be negative.
- A new authenticated launch for the same Telegram user reuses or refreshes the shared logical session instead of creating isolated task views.

**State transitions**

`authenticated` -> `active` -> `degraded` -> `active`  
`authenticated` -> `expired`  
`active` -> `closed`

## Entity: ClientConnection

Represents one live browser or WebView connection bound to a `BridgeSession`.

| Field                | Type        | Required | Notes                                                |
| -------------------- | ----------- | -------- | ---------------------------------------------------- |
| `connection_id`      | UUID/string | Yes      | Unique per WebSocket connection                      |
| `session_id`         | UUID/string | Yes      | Parent bridge session                                |
| `client_instance_id` | String      | No       | Optional client-generated identifier for diagnostics |
| `connected_at`       | Timestamp   | Yes      | WebSocket acceptance time                            |
| `last_pong_at`       | Timestamp   | No       | Updated during keepalive handling                    |
| `state`              | Enum        | Yes      | `connecting`, `streaming`, `stale`, `disconnected`   |

**Relationships**

- Many `ClientConnection` records can belong to one `BridgeSession`.
- Disconnecting one client must not invalidate other clients for the same session.

## Entity: BridgeCommand

Represents a user action from the Mini-App that the bridge forwards to the core service.

| Field              | Type        | Required | Notes                                                         |
| ------------------ | ----------- | -------- | ------------------------------------------------------------- |
| `command_id`       | UUID/string | Yes      | Unique bridge-side request identifier                         |
| `session_id`       | UUID/string | Yes      | Authenticated session issuing the command                     |
| `telegram_user_id` | Integer     | Yes      | Identity propagated to the core boundary                      |
| `action`           | Enum        | Yes      | `create`, `pause`, `resume`, `delete`, `list`, `status`       |
| `task_id`          | UUID/string | No       | Required for task-specific actions                            |
| `payload`          | Object      | No       | Command body, such as source URL                              |
| `requested_at`     | Timestamp   | Yes      | Time accepted by the bridge                                   |
| `state`            | Enum        | Yes      | `accepted`, `forwarded`, `acknowledged`, `failed`, `rejected` |

**Validation rules**

- `create` requires a non-empty source URL payload.
- `pause`, `resume`, `delete`, and `status` require a `task_id`.
- The bridge must reject commands from expired or unauthenticated sessions.

**State transitions**

`accepted` -> `forwarded` -> `acknowledged`  
`accepted` -> `rejected`  
`forwarded` -> `failed`

## Entity: StatusUpdate

Represents an event envelope delivered from the core service to the bridge and then broadcast to connected clients.

| Field              | Type        | Required | Notes                                                                                            |
| ------------------ | ----------- | -------- | ------------------------------------------------------------------------------------------------ |
| `event_id`         | UUID/string | No       | Optional bridge-generated identifier for tracing                                                 |
| `event_type`       | Enum        | Yes      | `snapshot`, `task.started`, `task.progress`, `task.completed`, `task.failed`, `session.degraded` |
| `task_id`          | UUID/string | No       | Present for task-specific updates                                                                |
| `task_status`      | Enum        | No       | Mirrors core task lifecycle where relevant                                                       |
| `progress_percent` | Integer     | No       | Present for progress updates                                                                     |
| `payload`          | Object      | Yes      | Event-specific details from the core service                                                     |
| `published_at`     | Timestamp   | Yes      | Time emitted by the core or bridge envelope                                                      |

**Validation rules**

- `progress_percent` must be between 0 and 100 when present.
- `snapshot` events must include the full visible task list for the authenticated session.
- Unknown event types are logged and dropped rather than forwarded blindly.

## Core Relationships

- `BridgeSession` 1 -> N `ClientConnection`
- `BridgeSession` 1 -> N `BridgeCommand`
- `BridgeCommand` N -> 1 core task when `task_id` is present
- `StatusUpdate` N -> 1 core task when `task_id` is present

## Existing Core Model Dependencies

- The bridge consumes task identifiers and task statuses from `ExtractionTask` in `src/tanzil/models/task.py`.
- The bridge relies on the core registry as the canonical task snapshot source.
- The bridge's realtime feed depends on the core event bus exporting structured task lifecycle events over the new subscription channel.
