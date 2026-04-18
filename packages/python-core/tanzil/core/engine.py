import yaml
import asyncio
from typing import Dict, Any
from statemachine import StateMachine, State
from tanzil.core.base import BaseComponent
from tanzil.core.events import EventBus
from tanzil.core.registry import ComponentRegistry
from tanzil.models.engine_config import EngineConfig
from tanzil.utils.logging import get_logger, setup_logging


class TanzilEngine(StateMachine):
    # States
    init = State("Init", initial=True)
    running = State("Running")
    stopped = State("Stopped", final=True)
    error = State("Error", final=True)

    # Transitions
    start_engine = init.to(running)
    stop_engine = running.to(stopped)
    fail_engine = running.to(error) | init.to(error)

    def __init__(self, config: EngineConfig):
        self.config = config
        self.logger = get_logger("engine")
        self._events_bus = EventBus()
        self.components: Dict[str, BaseComponent] = {}
        super().__init__()

    @property
    def events(self) -> EventBus:
        return self._events_bus

    @classmethod
    def from_yaml(cls, path: str):
        with open(path, "r") as f:
            data = yaml.safe_load(f)
        config = EngineConfig(**data)
        setup_logging(config.engine_settings.log_level)
        return cls(config)

    async def start(self):
        self.logger.info("Initializing engine...")
        try:
            # 1. Start Event Bus
            asyncio.create_task(self.events.start())

            # 2. Discover and Initialize Components
            available_classes = ComponentRegistry.discover_components()
            for comp_cfg in self.config.components:
                if comp_cfg.enabled and comp_cfg.name in available_classes:
                    self.logger.info(f"Loading component: {comp_cfg.name}")
                    comp_instance = available_classes[comp_cfg.name](comp_cfg.name)
                    await comp_instance.initialize(comp_cfg.settings)

                    # Inject event bus if component supports it
                    if hasattr(comp_instance, "set_bus"):
                        comp_instance.set_bus(self.events)

                    self.components[comp_cfg.name] = comp_instance

            # 3. Start Components
            for comp in self.components.values():
                await comp.start()

            self.start_engine()
            self.logger.info("Engine running.")
        except Exception as e:
            self.logger.error(f"Engine failure during start: {e}")
            self.fail_engine()
            raise

    async def stop(self):
        self.logger.info("Stopping engine...")
        for comp in self.components.values():
            await comp.stop()
        self.events.stop()
        self.stop_engine()
        self.logger.info("Engine stopped.")
