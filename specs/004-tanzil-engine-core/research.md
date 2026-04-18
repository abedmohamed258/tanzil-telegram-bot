# Research: Tanzil Engine Core Extraction

## Decision: Event Bus Implementation

- **Decision**: Use `asyncio.Queue` with a background worker task for decoupled event dispatching.
- **Rationale**: Standard Python pattern for in-memory Pub/Sub. Lightweight, native to `asyncio`, and sufficient for the current scale.
- **Alternatives considered**:
  - **Callbacks**: Rejected because it couples the producer and consumer, making concurrency harder to manage.
  - **Redis Pub/Sub**: Rejected because Phase 2 requires in-memory state only.

## Decision: Concurrency Management

- **Decision**: Use `asyncio.Semaphore(50)` for task-level concurrency control.
- **Rationale**: Simple, effective, and already partially used in existing components.
- **Alternatives considered**:
  - **Dynamic pooling**: Rejected for Phase 2 to keep the implementation simple.

## Decision: YAML Configuration & Validation

- **Decision**: Use `PyYAML` for parsing and `Pydantic` models for validation.
- **Rationale**: Industry standard for Python configuration. Provides clear, structured error reporting for malformed YAML.
- **Alternatives considered**:
  - **Simple dictionary access**: Rejected because it lacks validation and results in cryptic errors.

## Decision: CLI Framework

- **Decision**: Use `typer`.
- **Rationale**: Fast, type-safe, and generates high-quality help text automatically.
- **Alternatives considered**:
  - **argparse**: Rejected as it's too verbose and lacks type-hint integration.
