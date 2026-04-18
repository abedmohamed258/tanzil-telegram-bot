import pytest
import yaml

from tanzil.core.engine import Engine


@pytest.mark.asyncio
async def test_engine_lifecycle_transitions(tmp_path):
    config_file = tmp_path / "config.yaml"
    config_file.write_text(yaml.dump({"max_concurrency": 2}))

    engine = Engine(str(config_file))
    assert engine._initialized is False

    await engine.initialize()
    assert engine._initialized is True

    await engine.initialize()
    assert engine._initialized is True

    await engine.stop()
    assert engine._initialized is False
