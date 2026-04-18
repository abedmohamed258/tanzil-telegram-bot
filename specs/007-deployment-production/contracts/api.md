# Deployment & Production Contracts

The system exposes operational and maintenance contracts for production management.

## 1. Webhook Endpoint Contract

| Service | Method | Endpoint | Purpose |
| :--- | :--- | :--- | :--- |
| **Bot Service** | POST | `/webhook` | Receives real-time update events from the Telegram Bot API. |

### Payload Requirements
- **Source**: Telegram Bot API servers.
- **Protocol**: HTTPS (mandatory).
- **Format**: JSON-encoded `Update` objects.

## 2. Health Check Contract

| Service | Method | Endpoint | Purpose |
| :--- | :--- | :--- | :--- |
| **Core Service** | GET | `/health` | Verifies the core engine and Pub/Sub availability. |
| **Bot Service** | GET | `/health` | Verifies the bot's connection to Telegram. |
| **Bridge Service** | GET | `/health` | Verifies the bridge's connectivity to both components. |

### Response Schema
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-04-18T12:00:00Z",
  "checks": {
    "engine": "ok",
    "pubsub": "ok",
    "storage": "writable"
  }
}
```

## 3. Storage Cleanup Contract

The cleanup service uses the following operational parameters.

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `CLEANUP_RETENTION_DAYS` | Integer | 7 | Number of days to retain files. |
| `CLEANUP_CRON_SCHEDULE` | String | `0 3 * * *` | Cron schedule for the cleanup task. |
| `CLEANUP_DRY_RUN` | Boolean | false | If true, logs what would be deleted without actually deleting. |

### Log Signature
Successful cleanup operations should produce logs with the following pattern:
`[CLEANUP] Purged X files and Y directories older than Z days. Total space reclaimed: {size}.`
