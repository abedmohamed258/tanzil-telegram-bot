# CLI Contract: Tanzil Engine

The engine is managed via a Command Line Interface built with `typer`.

## Commands

### `start`

Initialize the engine and start listening for tasks.

- **Args**: `--config <path>` (Path to YAML config)
- **Output**: JSON confirmation with Engine status.

### `submit`

Submit a new extraction task.

- **Args**: `--payload <json>` or `--file <path>`
- **Output**:
  ```json
  {
    "task_id": "uuid-v4",
    "status": "PENDING"
  }
  ```

### `status`

Check status of a specific task.

- **Args**: `<task_id>`
- **Output**: Full task state in JSON.

## Event Schema (JSON)

Events published to the internal bus follow this structure:

```json
{
  "event": "TASK_COMPLETED",
  "task_id": "uuid-v4",
  "data": { ... }
}
```
