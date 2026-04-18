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

    def unsubscribe(self, pattern: str, callback: Callable[[Any], Awaitable[None]]):
        if pattern in self._subscribers:
            try:
                self._subscribers[pattern].remove(callback)
            except ValueError:
                pass

    async def publish(self, event_type: str, payload: Any):
        if not self._running:
            # Drop events if bus is not running, or log it
            return
        await self._queue.put((event_type, payload))

    async def start(self):
        if self._worker_task and not self._worker_task.done():
            return
        self._running = True
        self._worker_task = asyncio.create_task(self._worker(), name="event-bus-worker")

    async def stop(self):
        if not self._worker_task:
            return

        self._running = False
        await self._queue.put(None)
        await self._worker_task
        self._worker_task = None

    async def _worker(self):
        while True:
            item = await self._queue.get()
            try:
                if item is None:
                    break

                event_type, payload = item
                for pattern, callbacks in self._subscribers.items():
                    if fnmatch.fnmatch(event_type, pattern):
                        for callback in list(callbacks):
                            # Parallel execution of subscribers to prevent HOL blocking
                            asyncio.create_task(self._safe_execute(callback, payload))
            finally:
                self._queue.task_done()

    async def _safe_execute(self, callback, payload):
        try:
            await callback(payload)
        except Exception as e:
            logger.exception("Error in subscriber callback: %s", e)
