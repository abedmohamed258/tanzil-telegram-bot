# Research Report: Factory & Dev-SDK Initialization

## Decisions

| Component | Decision | Rationale |
| :--- | :--- | :--- |
| **Bootstrapper** | Bash (`init.sh`) | Minimal dependency to check for Python/Node and launch the main factory. |
| **Orchestrator** | Python 3 | Robust file system handling, native `venv` support, and readable automation logic. |
| **Environment Tools** | `uv` (Python), `pnpm` (Node) | Prioritizing speed (SC-001) and strict isolation (FR-007). |
| **Directory Layout** | Hybrid Monorepo | Centralizes `.tanzil/` config while isolating `packages/` by language. |
| **Configuration** | YAML (`.tanzil/config.yaml`) | Industry standard for human-readable configuration. |

## Rationale

- **Python for Orchestration**: Unlike Node.js, Python can manage its own environment bootstrapping without requiring a `node_modules` directory to exist first. It is pre-installed on most target (Linux) systems.
- **Speed & Isolation**: Using `uv` allows for virtual environment creation and dependency installation in seconds, meeting the <60s success criterion. `pnpm` provides efficient, symlink-based isolation for Node.js.
- **Hidden Config**: Placing all SDK-managed state (venvs, state files, config) in `.tanzil/` keeps the project root clean.

## Alternatives Considered

- **Bash Only**: Rejected due to poor error handling and difficulty parsing structured configuration (YAML/JSON).
- **Node.js (npx)**: Rejected because it requires Node.js and a potentially slow package download before the first command can even run.
- **Docker**: Rejected as a primary dev environment due to overhead and filesystem performance, though it remains an option for CI.
