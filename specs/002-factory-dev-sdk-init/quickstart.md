# Quickstart: Factory & Dev-SDK

## Initialization

To set up your development environment:

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd tanzil
   ```

2. **Run the bootstrapper**:
   ```bash
   ./init.sh
   ```
   This will:
   - Check for Python 3 and Node.js.
   - Create the `.tanzil/` directory.
   - Set up a Python virtual environment in `.tanzil/venv`.
   - Install core development dependencies.

## Verification

Run the health check tool to ensure everything is set up correctly:
```bash
./bin/tanzil doctor
```

## Environment Management

The SDK automatically handles isolation. To run commands within the Tanzil environment:
- **Python**: Use `bin/python` or prefix commands with `bin/tanzil run ...`
- **Node.js**: Use `pnpm` within the project root.
