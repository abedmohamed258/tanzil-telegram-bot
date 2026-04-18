import pytest
from pydantic import ValidationError

from tanzil.models.config import EngineConfig


def test_valid_engine_config():
    config = EngineConfig(max_concurrency=10, log_level="DEBUG")

    assert config.max_concurrency == 10
    assert config.log_level == "DEBUG"


def test_invalid_parallel_downloads():
    with pytest.raises(ValidationError):
        EngineConfig(max_concurrency=0)


def test_default_values():
    config = EngineConfig()

    assert config.log_level == "INFO"
    assert config.max_concurrency == 50
