# Quickstart: Production Launch

## Deployment Workflow

1. **Prerequisites**:
   - Linux VPS with Docker and Docker Compose installed.
   - Domain name pointed to the VPS IP.
   - GitHub Repository Secrets configured.

2. **Secrets Setup**:
   Add the following to your GitHub Repo Secrets:
   - `BOT_TOKEN`
   - `SSH_PRIVATE_KEY`
   - `SERVER_IP`
   - `SSH_USER`

3. **Manual First-Run (SSL Initialization)**:
   ```bash
   # Run the certbot initialization script on the server
   ./scripts/init-ssl.sh yourdomain.com
   ```

4. **Continuous Deployment**:
   - Push to `main` branch.
   - Monitor GitHub Actions for build and deploy status.

5. **Monitoring**:
   - Logs: `docker-compose logs -f`
   - Health: `docker-compose ps`
