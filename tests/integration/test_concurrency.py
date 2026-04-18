import pytest
import asyncio
from tanzil.core.engine import Engine
from tanzil.models.task import TaskStatus
import yaml


@pytest.mark.asyncio
async def test_concurrent_tasks(tmp_path):
    config_file = tmp_path / "config.yaml"
    config_data = {"max_concurrency": 2}
    config_file.write_text(yaml.dump(config_data))

    engine = Engine(str(config_file))
    await engine.initialize()

    # Submit more tasks than concurrency limit
    task_ids = []
    for i in range(5):
        tid = await engine.submit_task({"url": f"http://site{i}.com"})
        task_ids.append(tid)

    deadline = asyncio.get_running_loop().time() + 2.0
    while asyncio.get_running_loop().time() < deadline:
        statuses = [await engine.get_task_status(tid) for tid in task_ids]
        if all(status.status == TaskStatus.COMPLETED for status in statuses):
            break
        await asyncio.sleep(0.05)

    for status in statuses:
        assert status.status == TaskStatus.COMPLETED
        assert "output" in status.results

    await engine.stop()
