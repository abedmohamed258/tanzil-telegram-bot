# Research: Tanzil Core Engine (Component A)

This document outlines the technical decisions and research findings for the core architectural components of the Tanzil Engine.

## 1. Dynamic Component Registration

**Decision**: Use `importlib.metadata` Entry Points.

**Rationale**:

- **Standardization**: It is the standard Python mechanism for plugin discovery (PEP 566).
- **Decoupling**: Components can be installed as separate packages without the core engine needing to know their file paths.
- **Performance**: Metadata is cached by the packaging system, avoiding slow filesystem crawls.

**Alternatives Considered**:

- **Dynamic Imports (Path Scanning)**: Scanning a `plugins/` directory. (Pro: simple for users; Con: fragile, difficult to manage dependencies).
- **Decorator Registry**: Explicitly registering components in code. (Pro: explicit; Con: requires eager loading of all possible components).

## 2. Lightweight Asynchronous Pub/Sub

**Decision**: `asyncio.Queue` based internal Event Bus.

**Rationale**:

- **Zero Dependencies**: Uses Python's standard library.
- **Asynchronicity**: Natively handles `await` and backpressure.
- **Flexibility**: Can easily be extended to support multiple subscribers per topic.

**Alternatives Considered**:

- **Blinker**: Very popular but primarily synchronous; async support is secondary.
- **Redis/NATS**: Robust but requires external infrastructure, which violates the "lightweight" requirement for internal routing.

## 3. Standard YAML Configuration Patterns

**Decision**: `Pydantic` (Settings Management) + `PyYAML`.

**Rationale**:

- **Type Safety**: Automatic conversion of YAML strings to Python types.
- **Validation**: Schema validation is built-in; provides clear error messages for users.
- **IDE Support**: Autocomplete and linting work out-of-the-box.

**Alternatives Considered**:

- **jsonschema**: Standardized but requires writing JSON schemas separately, which is verbose and redundant in Python.
- **Marshmallow**: Powerful but more boilerplate compared to Pydantic.

## 4. State Machine Lifecycle Management

**Decision**: `python-statemachine` (with Async transitions).

**Rationale**:

- **Declarative**: State transitions are defined clearly as class attributes.
- **Robustness**: Prevents invalid state transitions automatically.
- **Async Support**: Handles async callbacks for entry/exit actions.

**Alternatives Considered**:

- **Transitions (Async branch)**: Very flexible but API is more complex.
- **Manual State Management**: Using a simple `Enum` and `if/match` statements. (Pro: zero dependency; Con: error-prone as the system grows).

## 5. Parallel File Downloads

**Decision**: `aiohttp` + `asyncio.Semaphore`.

**Rationale**:

- **Performance**: `aiohttp` is the industry standard for high-concurrency async HTTP.
- **Control**: `Semaphore` allows strict limits on concurrent connections (e.g., max 10 downloads) to prevent rate limiting or socket exhaustion.

**Alternatives Considered**:

- **httpx**: Great modern alternative with a better API, but `aiohttp` remains slightly faster for massive parallel operations.
- **ThreadPoolExecutor + Requests**: Uses too many system resources (threads) for a high number of concurrent downloads.
