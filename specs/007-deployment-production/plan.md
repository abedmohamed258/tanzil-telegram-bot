# Implementation Plan: Deployment & Production

**Branch**: `007-deployment-production` | **Date**: 2026-04-18 | **Spec**: [specs/007-deployment-production/spec.md](specs/007-deployment-production/spec.md)
**Input**: Feature specification from `/specs/007-deployment-production/spec.md`

## Summary

The goal of this feature is to establish a production-ready deployment for the Tanzil system (Core Engine, Telegram Bot, and Bridge) on a VPS using Docker Compose. The deployment will include an Nginx reverse proxy with SSL/TLS termination via Let's Encrypt, an automated CI/CD pipeline using GitHub Actions, and an automatic storage cleanup strategy to manage disk usage.

## Technical Context

**Language/Version**: Python 3.10+ (as per project root)  
**Primary Dependencies**: Docker, Docker Compose, Nginx, Certbot, GitHub Actions  
**Storage**: Filesystem (Docker volumes for downloads and configuration)  
**Testing**: Docker-based health checks, GitHub Actions workflow validation  
**Target Platform**: Linux VPS (e.g., Ubuntu/Debian)  
**Project Type**: Containerized Web Services / CLI Suite  
**Performance Goals**: 99.9% uptime, <30s update downtime  
**Constraints**: <10 min deployment time, automated SSL renewal, 7-day data retention  
**Scale/Scope**: Support for concurrent users (up to 50 as per spec), multi-service orchestration  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| **I. Code Quality** | Deployment scripts and Dockerfiles MUST be clean and documented. | ✅ Pass |
| **II. Testing Standards** | Deployment process MUST be testable (e.g., via a staging environment or local simulation). | ✅ Pass |
| **III. UX Consistency** | N/A (Internal/Operational) | - |
| **IV. Performance** | Deployment MUST NOT introduce bottlenecks; container resource limits SHOULD be set. | ✅ Pass |
| **V. Observability** | Centralized logging and health checks MUST be implemented as per spec. | ✅ Pass |

## Project Structure

### Documentation (this feature)

```text
specs/007-deployment-production/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
docker/
├── core/
│   └── Dockerfile
├── bot/
│   └── Dockerfile
├── bridge/
│   └── Dockerfile
└── nginx/
    ├── conf.d/
    └── Dockerfile (if customized)

scripts/
└── deployment/
    ├── setup-vps.sh
    └── cleanup-storage.sh

.github/
└── workflows/
    └── deploy.yml

docker-compose.yml
docker-compose.prod.yml
.env.example
```

**Structure Decision**: A root-level `docker/` directory will house service-specific Dockerfiles, while `docker-compose.yml` files at the root will orchestrate the stack. GitHub Actions will live in the standard `.github/workflows/` path.

## Complexity Tracking

*No constitution violations requiring justification.*
