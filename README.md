# Tanzil Bot Ecosystem

[![Production Deployment](https://github.com/abedmohamed258/tanzil-telegram-bot/actions/workflows/production.yml/badge.svg)](https://github.com/abedmohamed258/tanzil-telegram-bot/actions/workflows/production.yml)

Tanzil is a high-performance, event-driven Telegram bot ecosystem designed for large-scale file extraction and processing.

## 🚀 Live Project
- **Repository**: [https://github.com/abedmohamed258/tanzil-telegram-bot](https://github.com/abedmohamed258/tanzil-telegram-bot)

## 🛠 Features
- **Event-Driven Core**: Robust task management and real-time event broadcasting.
- **Persistent State**: SQLite-backed session management ensuring no data loss.
- **Enterprise DevOps**: Fully containerized with Docker, automated SSL with Certbot, and CI/CD via GitHub Actions.
- **Scalable Architecture**: Decoupled transport and domain layers for multi-platform support.

## 📦 Local Setup
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/abedmohamed258/tanzil-telegram-bot.git
    cd tanzil-telegram-bot
    ```

2.  **Run the bootstrapper**:
    ```bash
    ./scripts/init.sh
    ```
    This will check for prerequisites, create a virtual environment, and install core dependencies.

## 🚢 Production Deployment
For deploying Tanzil to a production VPS using Docker, see [PRODUCTION.md](PRODUCTION.md).

## ✅ Verification
Run the health check tool:
```bash
./bin/tanzil doctor-alias
```
