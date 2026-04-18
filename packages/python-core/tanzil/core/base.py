from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict


class ComponentState(Enum):
    INIT = "INIT"
    RUNNING = "RUNNING"
    STOPPED = "STOPPED"
    ERROR = "ERROR"


class BaseComponent(ABC):
    def __init__(self, name: str):
        self.name = name
        self.state = ComponentState.INIT
        self.settings: Dict[str, Any] = {}

    @abstractmethod
    async def initialize(self, settings: Dict[str, Any]) -> None:
        """Initialize the component with its settings."""
        pass

    @abstractmethod
    async def start(self) -> None:
        """Start the component's main logic."""
        pass

    @abstractmethod
    async def stop(self) -> None:
        """Gracefully shut down the component."""
        pass
