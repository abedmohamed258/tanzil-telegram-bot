# Tanzil Project

## Initialization

To set up your development environment:

1. **Clone the repository**:

   ```bash
   git clone <repo-url>
   cd tanzil
   ```

2. **Run the bootstrapper**:
   ```bash
   ./scripts/init.sh
   ```
   This will check for prerequisites, create the `.tanzil/` directory, set up a Python virtual environment, and install core dependencies.

## Verification

Run the health check tool:

```bash
./bin/tanzil doctor-alias
```

## Environment Management

- **Python**: Use `.tanzil/venv/bin/python` or run via `./bin/tanzil`.
- **Node.js**: Use `pnpm` in the project root.

## Production Deployment

For deploying Tanzil to a production VPS using Docker:

1. **Initial Setup**: Run the initialization script on your VPS:
   ```bash
   chmod +x scripts/deployment/setup-vps.sh
   ./scripts/deployment/setup-vps.sh
   ```
2. **Configuration**: Copy `.env.example` to `.env` and fill in your secrets.
3. **Deploy**: Start the stack with `docker compose -f docker-compose.prod.yml up -d`.
4. **CI/CD**: Configure GitHub Secrets (`SSH_HOST`, `SSH_USER`, `SSH_KEY`) to enable automated updates on push to `main`.
