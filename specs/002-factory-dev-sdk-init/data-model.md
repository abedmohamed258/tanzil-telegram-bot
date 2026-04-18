# Data Model: Factory & Dev-SDK

## Entities

### Factory
The root orchestrator for project initialization and lifecycle.
- **Attributes**:
  - `root_path`: Absolute path to project root.
  - `config_path`: Path to `.tanzil/config.yaml`.
  - `version`: Version of the factory tool.
- **Validation**:
  - `root_path` must be a valid directory.
  - `config_path` must be writable.

### Environment Profile
Defines the state and configuration for a specific environment (dev, test, prod).
- **Attributes**:
  - `name`: (e.g., "development", "testing").
  - `python_version`: Required Python version.
  - `node_version`: Required Node.js version.
  - `is_isolated`: Boolean, defaults to true.
- **Relationships**:
  - Managed by the **Dev-SDK**.

### SDK Component
Represents a language-specific or tool-specific part of the SDK.
- **Attributes**:
  - `language`: (Node.js, Python).
  - `isolation_path`: (e.g., `.tanzil/venv` or `node_modules`).
  - `status`: (initialized, missing, error).

## State Transitions

### Initialization Flow
1. **Uninitialized**: No `.tanzil/` directory.
2. **Bootstrapping**: `init.sh` running, checking prerequisites.
3. **Scaffolding**: Creating directories and default configs.
4. **Isolating**: Creating venvs and installing local packages.
5. **Ready**: Health check passes, system is operational.
