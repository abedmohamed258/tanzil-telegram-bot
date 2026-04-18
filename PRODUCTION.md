# Production Deployment Guide

This guide describes how to deploy Tanzil to a production environment using Docker, Nginx, and GitHub Actions.

## Prerequisites

- Linux VPS (Ubuntu/Debian recommended)
- Docker and Docker Compose installed
- Domain name pointing to the VPS IP

## Environment Variables

The following secrets must be configured in your GitHub repository:

| Secret | Description |
|--------|-------------|
| `BOT_TOKEN` | Your Telegram Bot token from @BotFather |
| `SERVER_IP` | The public IP of your production VPS |
| `SSH_USER` | The username for SSH access to the VPS |
| `SSH_PRIVATE_KEY` | The private key for SSH access |
| `ALERTS_CHAT_ID` | (Optional) Telegram Chat ID for health alerts |

## First-Time Setup

1. **Initial Deployment**:
   Manually clone the repo on the server to `/path/to/app`.

2. **SSL Initialization**:
   Run the following script to provision Let's Encrypt certificates:
   ```bash
   bash scripts/init-ssl.sh yourdomain.com
   ```

3. **Start Services**:
   ```bash
   docker-compose up -d
   ```

## Monitoring & Health

- **Logs**: View live logs with `docker-compose logs -f`.
- **Health Check**: Run `bash scripts/check-health.sh` to verify system status.
- **Auto-Renewal**: Certbot is configured to automatically renew certificates every 12 hours.

## Security

- Images are built using multi-stage builds and run as a non-root user.
- Nginx is configured with HSTS and other security headers.
- Secrets are managed via GitHub Actions and passed as environment variables.
