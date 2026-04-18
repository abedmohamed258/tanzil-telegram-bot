# Quickstart: Tanzil Production Deployment

This guide covers the initial deployment of the Tanzil system to a production VPS.

## Prerequisites
- A VPS with Ubuntu 22.04+ or Debian 12+.
- Docker and Docker Compose installed.
- A public domain name (e.g., `tanzil.yourdomain.com`).
- DNS A/AAAA records pointing to the VPS IP.

## 1. Initial VPS Setup
Run the setup script on your VPS:
```bash
# Clone the repository (or upload via SFTP)
git clone https://github.com/youruser/tanzil.git
cd tanzil

# Run the initialization script
chmod +x scripts/deployment/setup-vps.sh
./scripts/deployment/setup-vps.sh
```

## 2. Configuration
Copy the `.env.example` file and fill in your production secrets:
```bash
cp .env.example .env
nano .env
```
Ensure you set the following:
- `TELEGRAM_BOT_TOKEN`
- `ADMIN_IDS`
- `VIRTUAL_HOST=tanzil.yourdomain.com`
- `LETSENCRYPT_HOST=tanzil.yourdomain.com`
- `LETSENCRYPT_EMAIL=your@email.com`

## 3. Deploy
Start the production stack:
```bash
docker compose -f docker-compose.prod.yml up -d
```
Nginx will automatically request SSL certificates from Let's Encrypt. The system will be live once the certificates are issued (usually 1-2 minutes).

## 4. Monitoring
Check logs for all services:
```bash
docker compose -f docker-compose.prod.yml logs -f
```
Or view the real-time log dashboard (if enabled) at `http://your-vps-ip:8080`.

## 5. Continuous Deployment
To enable automated updates:
1. Go to your GitHub Repository Settings > Secrets and variables > Actions.
2. Add the following secrets:
   - `SSH_HOST`: Your VPS IP.
   - `SSH_USER`: The deployment user (e.g., `root`).
   - `SSH_KEY`: Your SSH private key.
3. Push to the `main` branch to trigger a deployment.
