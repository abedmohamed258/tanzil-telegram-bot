from __future__ import annotations

import asyncio
import fnmatch
import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional

logger = logging.getLogger("tanzil.bus")


class EventBus:
    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue()
        self._subscribers: Dict[str, List[Callable[[Any], Awaitable[None]]]] = {}
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None

    def subscribe(self, pattern: str, callback: Callable[[Any], Awaitable[None]]):
        if pattern not in self._subscribers:
            self._subscribers[pattern] = []
        self._subscribers[pattern].append(callback)

    async def publish(self, event_type: str, payload: Any):
        if not self._running:
            raise RuntimeError("EventBus not started")
        await self._queue.put((event_type, payload))

    async def start(self):
        if self._worker_task and not self._worker_task.done():
            return
        self._running = True
        self._worker_task = asyncio.create_task(self._worker())

    async def stop(self):
        if not self._worker_task:
            return

        await self._queue.put(None)
        await self._worker_task
        self._worker_task = None
        self._running = False

    async def _worker(self):
        while True:
            item = await self._queue.get()
            try:
                if item is None:
                    return

                event_type, payload = item
                for pattern, callbacks in self._subscribers.items():
                    if fnmatch.fnmatch(event_type, pattern):
                        for callback in list(callbacks):
                            await self._safe_execute(callback, payload)
            finally:
                self._queue.task_done()

    async def _safe_execute(self, callback, payload):
        try:
            await callback(payload)
        except Exception as e:
            logger.exception("Error in subscriber callback: %s", e)
