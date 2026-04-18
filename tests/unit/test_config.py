
import pytest
import yaml

from tanzil.core.config import load_validated_config
from tanzil.models.config import EngineConfig


def test_load_valid_config(tmp_path):
    config_file = tmp_path / "config.yaml"
    config_data = {"max_concurrency": 10, "log_level": "DEBUG"}
    config_file.write_text(yaml.dump(config_data))

    config = load_validated_config(str(config_file), EngineConfig)
    assert config.max_concurrency == 10
    assert config.log_level == "DEBUG"


def test_load_invalid_config(tmp_path):
    config_file = tmp_path / "config.yaml"
    config_file.write_text("invalid: yaml: [")

    with pytest.raises(Exception, match="Invalid YAML format"):
        load_validated_config(str(config_file), EngineConfig)


def test_load_missing_config():
    with pytest.raises(Exception, match="Configuration file not found"):
        load_validated_config("nonexistent.yaml", EngineConfig)
