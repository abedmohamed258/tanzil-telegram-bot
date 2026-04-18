from __future__ import annotations

from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class DownloadStatus(str, Enum):
    PENDING = "PENDING"
    DOWNLOADING = "DOWNLOADING"
    UPLOADING = "UPLOADING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class BotSession(BaseModel):
    telegram_user_id: int
    state: str = "IDLE"
    settings: dict = Field(default_factory=dict)


class TelegramDownloadTask(BaseModel):
    task_id: UUID
    engine_task_id: UUID
    telegram_user_id: int
    message_id: int
    chat_id: int
    source_url: str
    status: DownloadStatus = DownloadStatus.PENDING
