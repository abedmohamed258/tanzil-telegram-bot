# Research: Tanzil Deployment & Production (Phase 6)

**Thoroughness Level**: Medium
**Status**: Consolidating Findings

---

## 1. Docker Base Image Choice
### Decision: `python:3.10-slim-bookworm`
*   **Rationale**: 
    *   **Balance**: Provides a small footprint (~120MB) while maintaining high compatibility with `glibc` libraries (unlike Alpine).
    *   **Security**: Official Python images are patched quickly.
    *   **Performance**: Debian-based builds are generally faster than Alpine for C-extension heavy apps like `pydantic` and `aiosqlite`.
*   **Alternatives**:
    *   **Alpine**: Smaller (~50MB) but requires complex build-base installs for many Python packages.
    *   **`uv` managed**: Using `debian:bookworm-slim` + `uv` to install Python. This is faster but adds a tool dependency.

---

## 2. Let's Encrypt SSL Strategy
### Decision: `nginx-proxy` + `acme-companion`
*   **Rationale**: 
    *   **Automation**: Automatically detects new services via Docker labels and requests/renews SSL certificates.
    *   **Isolation**: Keeps Nginx configuration and SSL management in separate containers.
*   **Alternatives**:
    *   **Certbot Sidecar**: Requires manual configuration of renewal hooks and volume sharing.
    *   **Host-level Nginx**: Easier to manage certificates but complicates the "everything in Docker" philosophy.

---

## 3. GitHub Actions Deployment Method
### Decision: SSH-based `rsync` + Remote Commands
*   **Rationale**: 
    *   **Reliability**: Most standard and least prone to failure during connection drops.
    *   **Simplicity**: Uses well-known tools (`rsync`, `ssh`).
    *   **Security**: Uses SSH keys stored in GitHub Secrets.
*   **Alternatives**:
    *   **Docker Contexts**: Allows running `docker compose` locally but pointing to the remote. Can be finicky with SSH tunnels.
    *   **Self-hosted Runners**: Fast but requires maintaining the runner agent on the VPS.

---

## 4. 7-Day Storage Cleanup
### Decision: Containerized Sidecar (Cron-based)
*   **Rationale**: 
    *   **Portability**: The cleanup logic is part of the `docker-compose.yml`. Moving the app to a new VPS doesn't require re-setting up host-level crontabs.
    *   **Implementation**: A lightweight image (like `alpine`) running `find /data -type f -mtime +7 -delete`.
*   **Alternatives**:
    *   **Host CRON**: Simple but "leaks" application logic to the host system.

---

## 5. Logging Strategy
### Decision: Docker `json-file` Driver with Rotation + `Dozzle` (Optional)
*   **Rationale**: 
    *   **Safety**: Prevents log files from growing indefinitely (e.g., max-size: "10m", max-file: "3").
    *   **Visibility**: Standard `docker logs` works for CLI; `Dozzle` provides a lightweight web UI for real-time monitoring if needed.
*   **Alternatives**:
    *   **ELK/Loki Stack**: Overkill for a single VPS and consumes significant RAM/CPU.
