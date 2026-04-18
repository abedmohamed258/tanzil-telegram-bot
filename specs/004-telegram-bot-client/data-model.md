# Data Model: Telegram Bot Client

## Entities

### BotSession

- **telegram_user_id** (int, unique): The unique ID provided by Telegram.
- **state** (string): Current FSM state (e.g., IDLE, WAITING_FOR_LINK).
- **settings** (dict): User-specific settings (e.g., default download folder).

### TelegramDownloadTask

- **task_id** (uuid): Local identifier.
- **engine_task_id** (uuid): Reference to the Tanzil engine task.
- **message_id** (int): The ID of the Telegram message showing progress.
- **chat_id** (int): The ID of the chat where the download was initiated.
- **status** (enum): PENDING, DOWNLOADING, UPLOADING, COMPLETED, FAILED.

## Relationships

- A `BotSession` can have multiple `TelegramDownloadTask`s.
- Each `TelegramDownloadTask` maps 1:1 to a Tanzil Core Engine task.

## Validation Rules

- **User IDs** must be present in the `AUTHORIZED_USERS` whitelist (defined in config).
- **URLs** must be validated before being passed to the engine.
