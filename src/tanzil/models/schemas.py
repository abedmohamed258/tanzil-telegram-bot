from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class TaskBase(BaseModel):
    url: str
    owner_id: str
    metadata: dict = Field(default_factory=dict)

class Task(TaskBase):
    id: str
    status: str = "PENDING"
    progress: float = 0.0
    created_at: datetime
    completed_at: Optional[datetime] = None
    file_path: Optional[str] = None
    error: Optional[str] = None

class TaskEvent(BaseModel):
    task_id: str
    status: str
    progress: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)
