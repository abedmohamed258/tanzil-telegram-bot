# CLI Contract: tanzil-factory

The `tanzil-factory` (invoked via `init.sh` or `python3 -m tanzil.factory`) provides the following interface:

## Commands

### `init`
Initializes a new project or repairs an existing one.
- **Arguments**: None
- **Options**:
  - `--force`: Overwrite configuration files (skips Safe Merge).
  - `--verbose`: Enable detailed logging.
- **Output**:
  - Success: Exit code 0, summary of created files.
  - Failure: Non-zero exit code, list of missing prerequisites or errors.

### `doctor`
Validates the health of the development environment.
- **Arguments**: None
- **Output**:
  - JSON or formatted text table showing status of Python, Node, Git, and configuration integrity.

## Directory Structure Contract
The factory guarantees the following layout:
- `.tanzil/`
  - `config.yaml`
  - `venv/` (Python virtualenv)
- `packages/` (Optional language-specific packages)
- `services/` (Optional service implementations)
