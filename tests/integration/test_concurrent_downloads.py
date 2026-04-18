import asyncio

import pytest
import yaml

from tanzil.core.engine import Engine
from tanzil.models.task import TaskStatus


@pytest.mark.asyncio
async def test_cancelling_a_task_sets_terminal_state(tmp_path):
    config_file = tmp_path / "config.yaml"
    config_file.write_text(yaml.dump({"max_concurrency": 1}))

    engine = Engine(str(config_file))
    await engine.initialize()

    task_id = await engine.submit_task({"url": "https://example.com/file"})
    cancelled = await engine.cancel_task(task_id)
    assert cancelled is True

    await asyncio.sleep(0.05)
    status = await engine.get_task_status(task_id)
    assert status.status == TaskStatus.CANCELLED

    await engine.stop()
