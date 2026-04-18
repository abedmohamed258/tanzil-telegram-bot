import pytest

from tanzil.clients.telegram.models.schemas import DownloadStatus, TelegramDownloadTask
from tanzil.clients.telegram.models.store import TaskStore


@pytest.mark.asyncio
async def test_task_store_isolates_tasks_per_user(tmp_path):
    store = TaskStore(str(tmp_path / "telegram_tasks.db"))
    await store.init()

    task_a = TelegramDownloadTask(
        task_id="11111111-1111-1111-1111-111111111111",
        engine_task_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        telegram_user_id=1,
        message_id=10,
        chat_id=100,
        source_url="https://example.com/a",
        status=DownloadStatus.DOWNLOADING,
    )
    task_b = TelegramDownloadTask(
        task_id="22222222-2222-2222-2222-222222222222",
        engine_task_id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        telegram_user_id=2,
        message_id=11,
        chat_id=200,
        source_url="https://example.com/b",
        status=DownloadStatus.DOWNLOADING,
    )

    await store.save_task(task_a)
    await store.save_task(task_b)

    tasks_user_1 = await store.list_tasks(1)
    tasks_user_2 = await store.list_tasks(2)

    assert [task.task_id for task in tasks_user_1] == [task_a.task_id]
    assert [task.task_id for task in tasks_user_2] == [task_b.task_id]
