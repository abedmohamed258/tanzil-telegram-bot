# Quickstart: Core Engine (Component A)

## 1. Installation

Ensure dependencies are installed:

```bash
pip install pyyaml pydantic aiohttp python-statemachine
```

## 2. Configuration (`config.yaml`)

Create a basic engine configuration:

```yaml
version: "1.0"
engine_settings:
  log_level: "INFO"
  max_parallel_downloads: 10

components:
  - name: "downloader"
    enabled: true
    settings:
      chunk_size: 1024
```

## 3. Usage (Python)

Initialize and start the engine programmatically:

```python
import asyncio
from tanzil.core.engine import TanzilEngine

async def main():
    # Load and initialize engine
    engine = TanzilEngine.from_yaml("config.yaml")

    # Start the engine (triggers component registration and start)
    await engine.start()

    # Trigger a download via event bus
    await engine.events.emit(
        "downloader.fetch.request",
        {"url": "https://example.com/file.zip"}
    )

    # Run until interrupted
    try:
        while engine.is_running:
            await asyncio.sleep(1)
    finally:
        await engine.stop()

if __name__ == "__main__":
    asyncio.run(main())
```

## 4. Monitoring

Monitor the engine status via structured logs or the internal state attribute:

```python
print(f"Engine State: {engine.state}")
```
