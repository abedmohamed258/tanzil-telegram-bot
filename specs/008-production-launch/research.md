# Research: Production Launch

**Feature**: production-launch
**Created**: Sat Apr 18 2026

## Decisions

### Decision 1: Nginx Configuration for SSL and Reverse Proxy
- **Decision**: Use a separate `nginx` container in Docker Compose with a shared volume for SSL certificates managed by `certbot`.
- **Rationale**: Decouples SSL termination from the application logic, allowing for easier updates and maintenance of the web server independently.
- **Alternatives considered**: Using a Python-based web server (like Uvicorn) directly for SSL. Rejected because Nginx is more robust, performant, and standard for production environments.

### Decision 2: Automated SSL Renewal via Certbot
- **Decision**: Use the `certbot/certbot` image in Docker Compose with a script or cron job to run renewal checks.
- **Rationale**: Let's Encrypt certificates expire every 90 days. Automation is essential for 99.9% uptime (SC-003).
- **Alternatives considered**: Manual renewal. Rejected as it violates "Observability & Documentation" (long-term maintainability) principles.

### Decision 3: CI/CD Pipeline with GitHub Actions
- **Decision**: Define a `.github/workflows/production.yml` that builds Docker images, runs tests (pytest), and deploys to the VPS via SSH.
- **Rationale**: Tanzil is already on GitHub. GitHub Actions provides native integration for secrets and triggers.
- **Alternatives considered**: GitLab CI, Jenkins. Rejected because the project is already hosted on GitHub.

### Decision 4: Secret Management in GitHub Actions
- **Decision**: Store `TELEGRAM_BOT_TOKEN`, `API_KEYS`, and `SERVER_IP` as GitHub Repository Secrets.
- **Rationale**: Aligns with the clarified specification and provides secure handling of sensitive data during the build/deploy process.
- **Alternatives considered**: Hardcoding (rejected by FR-006) or using a dedicated Vault (rejected for being over-complex for this stage).

## Best Practices for Python + Docker Production
- Use multi-stage builds to minimize image size.
- Run containers as non-root users for security.
- Use `.dockerignore` to exclude development artifacts.
- Configure health checks in `docker-compose.yml`.
- Use structured logging (JSON) for easier parsing in production.
