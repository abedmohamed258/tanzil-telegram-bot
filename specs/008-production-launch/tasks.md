# Tasks: production-launch

**Feature**: production-launch
**Plan**: [specs/008-production-launch/plan.md](plan.md)

## Implementation Strategy

We will follow an MVP-first approach, focusing on containerization and secure routing (User Story 1) as the primary goal. Automated deployment and monitoring will follow to complete the production environment.

### Phase 1: Setup

- [ ] T001 Create project structure for deployment configuration in `docker/`
- [ ] T002 Initialize production `.dockerignore` in root directory
- [ ] T003 [P] Configure structured JSON logging for production in `src/logger.py` (or existing logger)

### Phase 2: Foundational

- [ ] T004 Create production Dockerfile for the bot in `docker/bot.Dockerfile`
- [ ] T005 Create production Dockerfile for the core engine in `docker/core.Dockerfile`
- [ ] T006 [P] Define Nginx reverse proxy configuration in `docker/nginx/default.conf`
- [ ] T007 [P] Create the production orchestration file in `docker-compose.yml`

### Phase 3: User Story 1 - Secure and Scalable Deployment

**Goal**: Deploy Tanzil to production with HTTPS and Docker.
**Independent Test**: Verify the bot responds at a public HTTPS endpoint.

- [ ] T008 [US1] Implement SSL initialization and renewal script in `scripts/init-ssl.sh`
- [ ] T009 [P] [US1] Configure Docker volumes for certificates and media in `docker-compose.yml`
- [ ] T010 [US1] Add health check definitions for services in `docker-compose.yml`

### Phase 4: User Story 2 - Automated Release Pipeline

**Goal**: Automatically test and deploy changes via GitHub Actions.
**Independent Test**: Push a change to `main` and verify it deploys automatically.

- [ ] T011 [US2] Create GitHub Actions production workflow in `.github/workflows/production.yml`
- [ ] T012 [P] [US2] Implement automated testing step (pytest) in `.github/workflows/production.yml`
- [ ] T013 [US2] Implement SSH deployment step with secret handling in `.github/workflows/production.yml`

### Phase 5: User Story 3 - Production Monitoring and Health

**Goal**: Monitor system health and logs in production.
**Independent Test**: Access live logs and check container status on the VPS.

- [x] T015 [US3] Configure log rotation for Docker containers in `docker-compose.yml`
- [x] T016 [P] [US3] Implement health check endpoint and alerting (e.g., UptimeRobot ping) in `scripts/check-health.sh`

### Phase 6: Polish & Cross-Cutting Concerns

- [ ] T016 Optimize Docker images using multi-stage builds in `docker/*.Dockerfile`
- [ ] T017 Finalize production README with environment variable documentation
- [ ] T018 [P] Perform security audit of Docker images and Nginx headers

## Dependencies

- **US1** depends on: **Phase 1, Phase 2**
- **US2** depends on: **US1**
- **US3** depends on: **US1**

## Parallel Execution Examples

### User Story 1
- **T006** (Nginx config) and **T009** (Volume config) can be done in parallel.

### User Story 2
- **T012** (Test step) can be drafted while **T013** (SSH step) is being configured.

## Independent Test Criteria

- **US1**: `curl -v https://yourdomain.com` returns 200 and shows valid certificate.
- **US2**: GitHub Actions tab shows "Success" for the production workflow after a push.
- **US3**: `docker-compose logs --tail=10` shows active bot activity on the server.
