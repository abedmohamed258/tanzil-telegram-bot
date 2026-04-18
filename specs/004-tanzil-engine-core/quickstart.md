# Quickstart: Tanzil Engine Core

## Prerequisites

- Python 3.10+
- `pip install typer pyyaml pydantic`

## Setup

1. Create a `config.yaml`:

   ```yaml
   max_concurrency: 50
   log_level: INFO
   ```

2. Start the engine:

   ```bash
   python -m tanzil.cli start --config config.yaml
   ```

3. Submit a task:
   ```bash
   python -m tanzil.cli submit --payload '{"url": "https://example.com"}'
   ```

## Integration

Subscribing to events internally:

```python
from tanzil.core.bus import EventBus

bus = EventBus()
async def on_event(event):
    print(f"Received: {event}")

bus.subscribe("TASK_*", on_event)
```
