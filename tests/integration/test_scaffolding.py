import sqlite3

import pytest

from tanzil.clients.telegram.models.schemas import DownloadStatus, TelegramDownloadTask
from tanzil.clients.telegram.models.store import TaskStore


@pytest.mark.asyncio
async def test_task_store_migrates_legacy_schema(tmp_path):
    db_path = tmp_path / "telegram_tasks.db"
    conn = sqlite3.connect(db_path)
    conn.execute(
        "CREATE TABLE tasks (task_id TEXT PRIMARY KEY, engine_task_id TEXT, message_id INTEGER, chat_id INTEGER, status TEXT)"
    )
    conn.commit()
    conn.close()

    store = TaskStore(str(db_path))
    await store.init()

    task = TelegramDownloadTask(
        task_id="33333333-3333-3333-3333-333333333333",
        engine_task_id="cccccccc-cccc-cccc-cccc-cccccccccccc",
        telegram_user_id=5,
        message_id=12,
        chat_id=300,
        source_url="https://example.com/c",
        status=DownloadStatus.DOWNLOADING,
    )
    await store.save_task(task)

    loaded = await store.get_task(task.task_id, task.telegram_user_id)
    assert loaded is not None
    assert loaded.source_url == task.source_url
