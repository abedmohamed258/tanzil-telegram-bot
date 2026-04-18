# Data Model: Deployment & Production

This document outlines the essential data and configuration entities for the Tanzil production deployment.

## 1. Environment Configuration

The system uses a set of environment variables for production-specific settings and secrets.

### Core Variables
- `CORE_API_TOKEN`: Secret token for Core Engine access.
- `CORE_PORT`: Port the Core Engine service listens on.
- `PUBSUB_URL`: Connection string for internal service communication (if applicable).

### Bot Variables
- `TELEGRAM_BOT_TOKEN`: The API token from @BotFather.
- `ADMIN_IDS`: Comma-separated list of Telegram user IDs with administrative access.
- `WEBHOOK_URL`: The public HTTPS URL where the Bot service is reachable.

### Bridge Variables
- `BRIDGE_API_KEY`: Secret key for secure communication between the Bot and Bridge.
- `BRIDGE_PORT`: Port the Bridge service listens on.

### Nginx / SSL Variables
- `VIRTUAL_HOST`: The domain name for the service (e.g., `tanzil.example.com`).
- `VIRTUAL_PORT`: The internal container port Nginx should proxy to.
- `LETSENCRYPT_HOST`: The domain name for SSL certificate issuance.
- `LETSENCRYPT_EMAIL`: Contact email for Let's Encrypt notifications.

## 2. Persistent Storage (Docker Volumes)

The system manages data across restarts through dedicated Docker volumes.

| Volume Name | Mount Point (Container) | Purpose |
| :--- | :--- | :--- |
| `tanzil_downloads` | `/app/downloads` | Stores all active and completed download files. |
| `tanzil_config` | `/app/config` | Persists core engine and bot configuration YAML files. |
| `nginx_certs` | `/etc/nginx/certs` | Stores Let's Encrypt SSL certificates (shared with `acme-companion`). |
| `nginx_vhost` | `/etc/nginx/vhost.d` | Stores virtual host configurations for `nginx-proxy`. |
| `nginx_html` | `/usr/share/nginx/html` | Standard Nginx root for ACME challenge validation. |

## 3. Storage Cleanup Model

The cleanup sidecar service operates based on a 7-day retention policy.

### Cleanup Logic
- **Target**: Files in the `tanzil_downloads` volume.
- **Criteria**: Files and directories with a `mtime` (modification time) older than 7 days.
- **Frequency**: Every 24 hours at 03:00 (local server time).

### Cleanup State
No separate database state is maintained for cleanup; the filesystem's `mtime` serves as the source of truth for file age.
