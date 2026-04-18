from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict

from tanzil.models.config import EngineConfig
from tanzil.models.task import ExtractionTask, TaskStatus, EventType
from tanzil.core.bus import EventBus
from tanzil.core.config import load_validated_config
from tanzil.core.registry import TaskRegistry

logger = logging.getLogger("tanzil.engine")


class Engine:
    def __init__(self, config_path: str):
        self.config: EngineConfig = load_validated_config(config_path, EngineConfig)
        self.bus = EventBus()
        self.registry = TaskRegistry(max_size=1000)
        self._semaphore = asyncio.Semaphore(self.config.max_concurrency)
        self._active_tasks: Dict[str, asyncio.Task] = {}
        self._initialized = False

    async def initialize(self):
        if self._initialized:
            return
        logger.info("Initializing Tanzil Engine...")
        await self.bus.start()
        self._initialized = True

    async def submit_task(self, payload: Dict[str, Any]) -> str:
        if not self._initialized:
            raise RuntimeError("Engine not initialized")

        task = ExtractionTask(
            source_url=payload.get("url"),
            owner_id=payload.get("owner_id"),
        )
        self.registry.add(task)

        async_task = asyncio.create_task(self._run_task(task, payload), name=task.id)
        self._active_tasks[task.id] = async_task
        async_task.add_done_callback(lambda _: self._active_tasks.pop(task.id, None))

        logger.info("Task submitted: %s", task.id)
        return task.id

    async def get_task_status(self, task_id: str) -> ExtractionTask:
        task = self.registry.get(task_id)
        if not task:
            raise KeyError(task_id)
        return task

    def list_tasks(self, owner_id: int | None = None) -> Dict[str, ExtractionTask]:
        tasks = self.registry.list_all()
        if owner_id is None:
            return tasks

        return {
            task_id: task
            for task_id, task in tasks.items()
            if task.owner_id == owner_id
        }

    async def cancel_task(self, task_id: str) -> bool:
        task = self.registry.get(task_id)
        if not task:
            raise KeyError(task_id)

        if task.is_terminal:
            return False

        running_task = self._active_tasks.get(task_id)
        if not running_task:
            return False

        task.status = TaskStatus.CANCELLED
        task.errors.append("Task cancelled by request")
        running_task.cancel()
        return True

    async def _run_task(self, task: ExtractionTask, payload: Dict[str, Any]):
        async with self._semaphore:
            task.status = TaskStatus.RUNNING
            task.progress = 0
            await self.bus.publish(
                EventType.TASK_STARTED,
                {
                    "task_id": task.id,
                    "owner_id": task.owner_id,
                    "status": task.status,
                },
            )

            try:
                for progress in (25, 50, 75):
                    await asyncio.sleep(0.05)
                    task.progress = progress
                    await self.bus.publish(
                        EventType.TASK_PROGRESS,
                        {
                            "task_id": task.id,
                            "owner_id": task.owner_id,
                            "progress": task.progress,
                            "status": task.status,
                        },
                    )

                await asyncio.sleep(0.05)
                task.status = TaskStatus.COMPLETED
                task.progress = 100
                task.results = {"output": f"Extracted from {payload.get('url', 'N/A')}"}
                logger.info("Task completed: %s", task.id)
                await self.bus.publish(
                    EventType.TASK_COMPLETED,
                    {
                        "task_id": task.id,
                        "owner_id": task.owner_id,
                        "results": task.results,
                        "status": task.status,
                        "progress": task.progress,
                    },
                )
            except asyncio.CancelledError:
                if task.status != TaskStatus.CANCELLED:
                    task.status = TaskStatus.CANCELLED
                    task.errors.append("Task cancelled during shutdown")

                cancel_reason = task.errors[-1] if task.errors else "Task cancelled"
                await self.bus.publish(
                    EventType.TASK_FAILED,
                    {
                        "task_id": task.id,
                        "owner_id": task.owner_id,
                        "error": cancel_reason,
                        "status": task.status,
                    },
                )
                raise
            except Exception as e:
                task.status = TaskStatus.FAILED
                task.errors.append(str(e))
                logger.error("Task failed: %s - %s", task.id, e)
                await self.bus.publish(
                    EventType.TASK_FAILED,
                    {
                        "task_id": task.id,
                        "owner_id": task.owner_id,
                        "error": str(e),
                        "status": task.status,
                    },
                )

    async def stop(self):
        logger.info("Stopping engine and cleaning up active tasks...")
        if self._active_tasks:
            for t in list(self._active_tasks.values()):
                t.cancel()
            await asyncio.gather(*self._active_tasks.values(), return_exceptions=True)

        await self.bus.stop()
        self._initialized = False
