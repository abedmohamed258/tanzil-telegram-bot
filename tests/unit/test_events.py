import asyncio

import pytest

from tanzil.core.bus import EventBus


@pytest.mark.asyncio
async def test_event_bus_preserves_publish_order():
    bus = EventBus()
    received = []

    async def callback(event):
        if event["id"] == 1:
            await asyncio.sleep(0.05)
        received.append(event["id"])

    bus.subscribe("test.*", callback)
    await bus.start()

    await bus.publish("test.one", {"id": 1})
    await bus.publish("test.two", {"id": 2})
    await asyncio.sleep(0.15)
    await bus.stop()

    assert received == [1, 2]


@pytest.mark.asyncio
async def test_event_bus_drains_queue_before_stop():
    bus = EventBus()
    received = []

    async def callback(event):
        await asyncio.sleep(0.01)
        received.append(event["id"])

    bus.subscribe("test.*", callback)
    await bus.start()

    for i in range(5):
        await bus.publish("test.event", {"id": i})

    await bus.stop()

    assert received == [0, 1, 2, 3, 4]
