from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional


class EngineConfig(BaseModel):
    max_concurrency: int = Field(default=50, ge=1)
    log_level: str = Field(default="INFO")
    extraction_rules: Dict[str, Any] = Field(default_factory=dict)
