import collections
from typing import Deque, Dict, Optional

from tanzil.models.task import ExtractionTask


class TaskRegistry:
    def __init__(self, max_size: int = 1000):
        self._tasks: Dict[str, ExtractionTask] = {}
        self._order: Deque[str] = collections.deque()
        self._max_size = max_size

    def add(self, task: ExtractionTask):
        self._prune_terminal_tasks()

        if len(self._tasks) >= self._max_size:
            raise RuntimeError(
                "Task registry capacity reached with active tasks still in memory"
            )

        self._tasks[task.id] = task
        self._order.append(task.id)

    def remove(self, task_id: str):
        if task_id in self._tasks:
            del self._tasks[task_id]

        try:
            self._order.remove(task_id)
        except ValueError:
            pass

    def get(self, task_id: str) -> Optional[ExtractionTask]:
        return self._tasks.get(task_id)

    def list_all(self) -> Dict[str, ExtractionTask]:
        return self._tasks.copy()

    def _prune_terminal_tasks(self):
        while len(self._tasks) >= self._max_size and self._order:
            oldest_id = self._order[0]
            oldest_task = self._tasks.get(oldest_id)
            if oldest_task is None:
                self._order.popleft()
                continue

            if not oldest_task.is_terminal:
                break

            self._order.popleft()
            del self._tasks[oldest_id]
