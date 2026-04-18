import uuid
from enum import Enum
from pydantic import BaseModel, Field


class TaskStatus(Enum):
    PENDING = "PENDING"
    DOWNLOADING = "DOWNLOADING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DownloadTask(BaseModel):
    task_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    source_url: str
    status: TaskStatus = TaskStatus.PENDING
    progress: float = 0.0
    error_message: str | None = None
