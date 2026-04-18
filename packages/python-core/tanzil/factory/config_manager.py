import os

from tanzil.models.profiles import TanzilConfig
from tanzil.utils.yaml import load_yaml, save_yaml


class ConfigManager:
    def __init__(self, root: str):
        self.root = root
        self.config_path = os.path.join(root, ".tanzil", "config.yaml")

    def load_config(self) -> TanzilConfig:
        if os.path.exists(self.config_path):
            data = load_yaml(self.config_path)
            return TanzilConfig(**data)
        return TanzilConfig()

    def switch_environment(self, env_name: str):
        config = self.load_config()
        # Verify profile exists
        if any(p.name == env_name for p in config.profiles):
            config.current_env = env_name
            save_yaml(self.config_path, config.model_dump())
            return True
        return False
