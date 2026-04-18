from abc import ABC, abstractmethod
from tanzil.models.config import TanzilConfig


class BaseFactory(ABC):
    def __init__(self, config: TanzilConfig):
        self.config = config

    @abstractmethod
    def run(self):
        pass
