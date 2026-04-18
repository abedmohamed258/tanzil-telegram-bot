from typing import List, Optional
from pydantic import BaseModel, Field


class EnvironmentProfile(BaseModel):
    name: str
    python_version: str = ">=3.10"
    node_version: str = ">=18"
    is_isolated: bool = True
    variables: dict = Field(default_factory=dict)


class TanzilConfig(BaseModel):
    project_name: str = "tanzil-project"
    current_env: str = "development"
    profiles: List[EnvironmentProfile] = Field(
        default_factory=lambda: [
            EnvironmentProfile(name="development", variables={"DEBUG": "true"}),
            EnvironmentProfile(
                name="testing", variables={"DEBUG": "false", "TEST_MODE": "true"}
            ),
            EnvironmentProfile(name="production", variables={"DEBUG": "false"}),
        ]
    )
    root_path: str = "."
