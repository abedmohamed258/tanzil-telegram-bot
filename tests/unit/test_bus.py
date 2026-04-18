import asyncio

import pytest

from tanzil.core.bus import EventBus


@pytest.mark.asyncio
async def test_bus_glob_subscription():
    bus = EventBus()
    await bus.start()

    events = []

    async def subscriber(payload):
        events.append(payload)

    bus.subscribe("TASK_*", subscriber)

    await bus.publish("TASK_STARTED", {"id": 1})
    await bus.publish("TASK_COMPLETED", {"id": 1})
    await bus.publish("OTHER_EVENT", {"id": 2})

    # Allow some time for processing
    await asyncio.sleep(0.1)

    assert len(events) == 2
    assert events[0]["id"] == 1
    assert events[1]["id"] == 1

    await bus.stop()
