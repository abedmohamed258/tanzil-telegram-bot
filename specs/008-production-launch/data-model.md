# Data Model: Production Launch

**Feature**: production-launch

## Entities

### Deployment Environment
- **Host**: Production VPS (Linux)
- **Engine**: Docker + Docker Compose
- **Proxy**: Nginx (Reverse Proxy + SSL Termination)
- **Volumes**:
  - `downloads`: Persists media/files downloaded by the bot.
  - `certs`: Shared volume between Nginx and Certbot for SSL.
  - `logs`: Persistent storage for operational logs.

### Secret Store (GitHub Secrets)
- `BOT_TOKEN`: Required for Aiogram bot client.
- `SERVER_IP`: Target host for deployment.
- `SSH_PRIVATE_KEY`: For GitHub Actions to authenticate with the VPS.

## State Transitions
1. **Source Code (GitHub)**: Triggered by push to `main`.
2. **CI Pipeline (GitHub Actions)**: Build images -> Run tests.
3. **Deployment (SSH/Docker)**: Pull images on VPS -> Restart containers (Rolling or Stop/Start).
4. **Live (Production)**: Nginx routes traffic -> Bot processes requests.
