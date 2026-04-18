import pytest

from tanzil.core.registry import TaskRegistry
from tanzil.models.task import ExtractionTask, TaskStatus


def test_registry_prunes_terminal_tasks_before_overflow():
    registry = TaskRegistry(max_size=2)

    completed = ExtractionTask(status=TaskStatus.COMPLETED)
    running = ExtractionTask(status=TaskStatus.RUNNING)
    registry.add(completed)
    registry.add(running)

    new_task = ExtractionTask(status=TaskStatus.PENDING)
    registry.add(new_task)

    assert registry.get(completed.id) is None
    assert registry.get(running.id) is running
    assert registry.get(new_task.id) is new_task


def test_registry_rejects_overflow_when_all_tasks_are_active():
    registry = TaskRegistry(max_size=2)
    registry.add(ExtractionTask(status=TaskStatus.RUNNING))
    registry.add(ExtractionTask(status=TaskStatus.PENDING))

    with pytest.raises(RuntimeError, match="capacity reached"):
        registry.add(ExtractionTask(status=TaskStatus.PENDING))
