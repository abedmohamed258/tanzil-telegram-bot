# Data Model: Tanzil Engine Core Extraction

## Entities

### EngineConfig

Operational parameters for the extraction engine.

- `max_concurrency`: Integer (default: 50)
- `log_level`: String (e.g., INFO, DEBUG)
- `extraction_rules`: Dictionary/List of rules (domain-specific)

### ExtractionTask

State and metadata for a single extraction unit.

- `id`: UUID string (Unique identifier)
- `status`: Enum (PENDING, RUNNING, COMPLETED, FAILED)
- `created_at`: Datetime
- `results`: JSON object (Extraction output)
- `errors`: List of strings (If failed)

### EngineEvent

Broadcasting structure for internal notifications.

- `type`: Enum (TASK_STARTED, TASK_PROGRESS, TASK_COMPLETED, TASK_FAILED)
- `timestamp`: Datetime
- `payload`: JSON (Task details or error info)

## Relationships

- `EngineConfig` is loaded once at initialization.
- One `EngineConfig` governs all `ExtractionTask` instances.
- Each `ExtractionTask` lifecycle emits multiple `EngineEvent` instances.
