from typing import Any, Dict

from pydantic import BaseModel, Field


class EngineConfig(BaseModel):
    max_concurrency: int = Field(default=50, ge=1)
    log_level: str = Field(default="INFO")
    extraction_rules: Dict[str, Any] = Field(default_factory=dict)
