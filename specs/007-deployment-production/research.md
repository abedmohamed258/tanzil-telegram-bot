# Research: Deployment & Production (Phase 6)

## 1. Docker Base Image
**Decision**: Use `python:3.10-slim-bookworm`.
**Rationale**: The `slim` variant offers a significantly smaller image size than the full standard image while maintaining compatibility with common shared libraries (unlike Alpine, which can have issues with some Python binary packages). `bookworm` ensures we are on a modern, stable Debian base.
**Alternatives considered**:
- `python:3.10`: Too large (~900MB+).
- `python:3.10-alpine`: Smaller, but requires manual compilation of many packages and uses `musl` which can lead to subtle bugs in C-extensions.

## 2. SSL/TLS Management
**Decision**: Use `nginxproxy/nginx-proxy` and `nginxproxy/acme-companion`.
**Rationale**: This combination allows for automatic discovery of other Docker containers and automated Let's Encrypt certificate issuance/renewal based on environment variables. It abstracts the complexity of manually configuring Nginx and Certbot.
**Alternatives considered**:
- `certbot/certbot` standalone: Requires more complex volume sharing and Nginx configuration reloads.
- `traefik`: Modern and robust, but has a steeper learning curve compared to the simpler `nginx-proxy` approach for this project's scale.

## 3. GitHub Actions Deployment
**Decision**: Use `appleboy/ssh-action` for SSH-based deployment.
**Rationale**: For a single VPS, simple SSH deployment is reliable, secure, and easy to debug. It avoids the overhead of managing Docker contexts or self-hosted runners. The action can pull the latest code, build images, and restart containers.
**Alternatives considered**:
- Docker Contexts: Requires exposing the Docker daemon socket over the network (security risk if not done carefully).
- Self-hosted runners: Overkill for this project and requires managing the runner itself on the VPS.

## 4. Storage Cleanup Strategy
**Decision**: Containerized Sidecar (Alpine + Cron).
**Rationale**: Keeps the cleanup logic portable and within the Docker ecosystem. A simple Alpine-based container running a shell script via `crond` can mount the downloads volume and delete files older than 7 days.
**Alternatives considered**:
- Host-level CRON: Simpler to set up initially but adds an external dependency on the host OS configuration.

## 5. Logging Strategy
**Decision**: Docker `json-file` driver with log rotation.
**Rationale**: Standard and efficient for most VPS deployments. By configuring log rotation in `docker-compose.yml`, we prevent logs from consuming all disk space.
**Alternatives considered**:
- ELK Stack / Loki: Excellent but too resource-intensive for a standard VPS deployment of this scale.
- `dozzle`: Added as an optional service for real-time web-based log viewing.
