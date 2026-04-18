# Telegram Bot Quickstart

## 1. Setup Environment

- Ensure you have a Telegram Bot Token from @BotFather.
- Add your Telegram User ID to the `AUTHORIZED_USERS` list in the configuration.

## 2. Configuration

Create/update `config.yaml`:

```yaml
telegram:
  token: "YOUR_BOT_TOKEN"
  authorized_users:
    - 123456789
  upload_limit_mb: 50
```

## 3. Running the Bot

```bash
python -m tanzil.clients.telegram.main
```

## 4. Usage

1. Send `/start` to the bot.
2. Paste a supported download URL.
3. Monitor progress in the dynamic message.
4. Receive the file (if < 50MB) or a download link.
