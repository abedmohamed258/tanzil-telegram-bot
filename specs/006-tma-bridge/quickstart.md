# Quickstart: TMA Bridge

## Prerequisites

- Python 3.10+
- Project dependencies installed with `uv sync`
- A valid Telegram bot token in the Tanzil config
- A public HTTPS base URL that Telegram can open for the Mini-App

## 1. Start the core service

Run the existing core server so the bridge has a command socket and event stream to connect to.

```bash
tanzil server --config config.yaml
```

## 2. Start the Mini-App bridge service

Run the planned ASGI bridge service as its own process.

```bash
tanzil bridge --config config.yaml
```

Expected bridge responsibilities:

- Serve the Mini-App shell at `/app`
- Accept Telegram `initData` and create a bridge session
- Proxy task commands to the core service
- Stream task events to connected WebSocket clients

## 3. Register the Telegram Mini-App entry point

Configure the bot menu button or an inline `web_app` button to point to the public bridge URL:

```text
https://<public-bridge-host>/app
```

## 4. Verify the end-to-end flow

1. Open the bot in Telegram.
2. Tap the Mini-App button.
3. Confirm the Mini-App loads in under 1.5 seconds.
4. Submit a download from the Mini-App.
5. Confirm the bridge returns an immediate acknowledgement.
6. Confirm task lifecycle updates arrive in the Mini-App without manual refresh.
7. Open the Mini-App from a second device and confirm both devices share the same task state.

## 5. Run automated checks

```bash
pytest tests/unit tests/integration tests/contract
```

Key verification targets:

- `initData` validation and expiry handling
- Bridge session creation and reuse
- Core command proxying over Unix sockets
- WebSocket snapshot and live event streaming
- Multi-device shared-session behavior
