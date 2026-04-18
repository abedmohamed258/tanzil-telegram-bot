import yaml
from pydantic import BaseModel, Field, SecretStr
from typing import List


class TelegramConfig(BaseModel):
    token: SecretStr
    authorized_users: List[int]
    upload_limit_mb: int = 50
    core_socket_path: str = "/tmp/tanzil.sock"
    task_db_path: str = Field(default=".tanzil/telegram_tasks.db")
    status_poll_interval_sec: float = 0.2


class Config(BaseModel):
    telegram: TelegramConfig


def load_config(path: str = "config.yaml") -> Config:
    with open(path, "r") as f:
        data = yaml.safe_load(f)
    return Config(**data)
