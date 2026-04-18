from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ComponentConfig(BaseModel):
    name: str
    enabled: bool = True
    settings: Dict[str, Any] = Field(default_factory=dict)


class EngineSettings(BaseModel):
    log_level: str = "INFO"
    max_parallel_downloads: int = Field(default=5, ge=1)


class EngineConfig(BaseModel):
    version: str
    engine_settings: EngineSettings = Field(default_factory=EngineSettings)
    components: List[ComponentConfig] = Field(default_factory=list)
