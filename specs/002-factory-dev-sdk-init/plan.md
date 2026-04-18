# Implementation Plan: factory-dev-sdk-init

**Branch**: `002-factory-dev-sdk-init` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-factory-dev-sdk-init/spec.md`

## Summary

This feature implements the foundational **Tanzil Factory** and **Dev-SDK**, responsible for scaffolding the project structure, managing environment-specific configurations (dev, test, prod), and ensuring prerequisite integrity across Node.js and Python. The approach uses a lightweight Bash bootstrapper to launch a robust Python-based factory that manages a hidden `.tanzil/` configuration directory and isolated runtime environments (`uv` managed venv and `pnpm` workspaces).

## Technical Context

**Language/Version**: Bash 5+, Python 3.10+, Node.js 18+  
**Primary Dependencies**: `uv` (Python), `pnpm` (Node), `typer` (CLI), `pyyaml`  
**Storage**: Filesystem (YAML/JSON in `.tanzil/`)  
**Testing**: `pytest` (Python), `vitest` (Node)  
**Target Platform**: Linux Server (Ubuntu 22.04+ primary)  
**Project Type**: CLI tool & Development SDK  
**Performance Goals**: Initialization under 60 seconds (SC-001)  
**Constraints**: <100MB memory usage for the factory, isolated runtimes  
**Scale/Scope**: Unified monorepo supporting multiple language packages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Code Quality**: CLI tools will use structured logging and human-readable YAML for configuration.
- [x] **II. Testing Standards**: Health check (`doctor` command) will serve as a continuous integration test for the environment.
- [x] **III. UX Consistency**: Prerequisite reporting will include actionable guidance (links/commands) for missing items.
- [x] **IV. Performance Requirements**: `uv` and `pnpm` chosen specifically to meet the <60s initialization target.
- [x] **V. Observability & Documentation**: All initialization steps are logged; `research.md` and `quickstart.md` are generated.

## Project Structure

### Documentation (this feature)

```text
specs/002-factory-dev-sdk-init/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── cli-contract.md
└── tasks.md             # Phase 2 output (to be created)
```

### Source Code (repository root)

```text
.
├── .tanzil/                # Hidden config & environment state
│   ├── config.yaml         # Project-level settings
│   └── venv/               # SDK-managed Python virtualenv
├── bin/                    # Unified CLI entry points (tanzil-cli)
├── packages/               # Shared logic/types
│   ├── node-core/          
│   └── python-core/        
├── scripts/                # Raw automation (init.sh)
├── package.json            # Root workspace for Node
├── pyproject.toml          # Root workspace for Python (uv)
└── .gitignore              
```

**Structure Decision**: Hybrid Monorepo (Option 1). This structure allows for a shared configuration context (`.tanzil/`) while maintaining strict language isolation in `packages/`.

## Complexity Tracking

*No violations detected.*
