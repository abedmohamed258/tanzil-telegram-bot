# TMA Bridge WebSocket Contract

## Endpoint

```text
GET /api/events
```

## Connection Rules

- The client must present the valid bridge session credential issued by `POST /api/session` using a non-URL transport such as a secure cookie or an explicit authentication message.
- The server rejects expired, missing, or malformed tokens before accepting the WebSocket.
- After the socket is accepted, the server sends a `snapshot` event before any live task events.
- Multiple active clients for the same Telegram user receive the same task state stream.

## Client-to-Server Messages

The client does not send task mutations over the WebSocket. Task mutations use HTTP endpoints. The only client messages allowed are keepalive frames.

```json
{ "type": "ping" }
```

## Server-to-Client Event Envelope

All server messages use the same top-level envelope.

```json
{
  "type": "task.completed",
  "published_at": "2026-04-17T12:00:00Z",
  "payload": {}
}
```

## Event Types

### `snapshot`

Sent immediately after connection so the client starts from a complete task view.

```json
{
  "type": "snapshot",
  "published_at": "2026-04-17T12:00:00Z",
  "payload": {
    "tasks": [
      {
        "task_id": "1cb43e8a-6848-4d77-9128-c6e2b2b5d5b5",
        "status": "RUNNING",
        "progress_percent": 42,
        "created_at": "2026-04-17T11:59:30Z"
      }
    ]
  }
}
```

### `task.started`

```json
{
  "type": "task.started",
  "published_at": "2026-04-17T12:00:01Z",
  "payload": {
    "task_id": "1cb43e8a-6848-4d77-9128-c6e2b2b5d5b5",
    "status": "RUNNING"
  }
}
```

### `task.progress`

```json
{
  "type": "task.progress",
  "published_at": "2026-04-17T12:00:02Z",
  "payload": {
    "task_id": "1cb43e8a-6848-4d77-9128-c6e2b2b5d5b5",
    "status": "RUNNING",
    "progress_percent": 60
  }
}
```

### `task.completed`

```json
{
  "type": "task.completed",
  "published_at": "2026-04-17T12:00:05Z",
  "payload": {
    "task_id": "1cb43e8a-6848-4d77-9128-c6e2b2b5d5b5",
    "status": "COMPLETED",
    "result": {
      "output": "Extracted from https://example.com"
    }
  }
}
```

### `task.failed`

```json
{
  "type": "task.failed",
  "published_at": "2026-04-17T12:00:05Z",
  "payload": {
    "task_id": "1cb43e8a-6848-4d77-9128-c6e2b2b5d5b5",
    "status": "FAILED",
    "error": "Task cancelled during shutdown"
  }
}
```

### `session.degraded`

Sent when the bridge temporarily loses the core event stream but keeps the client socket open while attempting to recover.

```json
{
  "type": "session.degraded",
  "published_at": "2026-04-17T12:00:07Z",
  "payload": {
    "message": "Realtime updates temporarily unavailable. Retrying..."
  }
}
```

### `error`

```json
{
  "type": "error",
  "published_at": "2026-04-17T12:00:08Z",
  "payload": {
    "message": "Session expired. Reopen the Mini-App from Telegram."
  }
}
```

## Delivery Guarantees

- Snapshot first, then live events.
- Events are delivered in the order they are received by the bridge from the core event stream.
- If the bridge loses its core subscription, clients receive `session.degraded` and the bridge attempts to reconnect.
- Unknown event types are not forwarded to clients.
