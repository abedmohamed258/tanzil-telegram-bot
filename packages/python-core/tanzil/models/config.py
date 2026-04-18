from typing import List, Optional
from pydantic import BaseModel, Field


class EnvironmentProfile(BaseModel):
    name: str
    python_version: str = ">=3.10"
    node_version: str = ">=18"
    is_isolated: bool = True


class TanzilConfig(BaseModel):
    project_name: str = "tanzil-project"
    current_env: str = "development"
    profiles: List[EnvironmentProfile] = Field(
        default_factory=lambda: [
            EnvironmentProfile(name="development"),
            EnvironmentProfile(name="testing"),
            EnvironmentProfile(name="production"),
        ]
    )
    root_path: str = "."
