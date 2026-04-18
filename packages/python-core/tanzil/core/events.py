import asyncio
from datetime import datetime
from typing import Any, Dict, Callable, List, Awaitable
from pydantic import BaseModel, Field


class Event(BaseModel):
    type: str
    source: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class EventBus:
    def __init__(self):
        self._queue: asyncio.Queue[Event] = asyncio.Queue()
        self._subscribers: Dict[str, List[Callable[[Event], Awaitable[None]]]] = {}
        self._running = False

    def subscribe(self, event_type: str, callback: Callable[[Event], Awaitable[None]]):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)

    async def emit(self, event_type: str, source: str, payload: Dict[str, Any]):
        event = Event(type=event_type, source=source, payload=payload)
        await self._queue.put(event)

    async def start(self):
        self._running = True
        while self._running:
            event = await self._queue.get()
            # Support wildcard subscriptions or exact match
            for pattern, callbacks in self._subscribers.items():
                if self._matches(event.type, pattern):
                    for callback in callbacks:
                        asyncio.create_task(callback(event))
            self._queue.task_done()

    def stop(self):
        self._running = False

    def _matches(self, event_type: str, pattern: str) -> bool:
        if pattern == "*":
            return True
        if pattern.endswith(".*"):
            prefix = pattern[:-2]
            return event_type.startswith(prefix)
        return event_type == pattern
