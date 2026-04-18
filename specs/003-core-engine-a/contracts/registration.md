# Component Registration Contract (Python Entry Points)

To register a component with the Tanzil Core Engine, developers must define an entry point in their `pyproject.toml` or `setup.py` under the `tanzil.components` group.

## Entry Point Definition

```toml
[project.entry-points."tanzil.components"]
downloader = "tanzil.components.downloader.manager:DownloadManager"
```

## Component Base Class Interface

All components MUST inherit from `tanzil.core.base.BaseComponent` and implement the following async methods:

### `async def initialize(self, settings: dict) -> None`

- Called during engine `INIT` phase.
- Receives component-specific settings from YAML.
- Should perform setup (e.g., client sessions, resource allocation).

### `async def start(self) -> None`

- Called during engine `START` phase.
- Should begin active processing or subscription to events.

### `async def stop(self) -> None`

- Called during engine `STOP` phase.
- Should gracefully shut down and release resources.

## Event Bus Contract

Components communicate with the engine via the internal Event Bus.

### Event Schema

```python
{
    "type": "string",       # Dot-separated event name (e.g., "downloader.fetch.started")
    "source": "string",     # Name of the emitting component
    "payload": "dict",      # Event-specific data
    "timestamp": "iso8601"  # UTC timestamp
}
```

### Core Engine Events (Reserved)

- `engine.state.changed`: Emitted when the engine transitions between lifecycle states.
- `engine.error`: Emitted for unhandled exceptions in the core or components.
