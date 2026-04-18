from __future__ import annotations

from pathlib import Path
from uuid import UUID

import aiosqlite

from .schemas import DownloadStatus, TelegramDownloadTask


class TaskStore:
    def __init__(self, db_path: str = "telegram_tasks.db"):
        self.db_path = db_path

    async def init(self):
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    task_id TEXT PRIMARY KEY,
                    engine_task_id TEXT,
                    telegram_user_id INTEGER,
                    message_id INTEGER,
                    chat_id INTEGER,
                    source_url TEXT,
                    status TEXT
                )
                """
            )
            await self._ensure_column(db, "telegram_user_id", "INTEGER DEFAULT 0")
            await self._ensure_column(db, "source_url", "TEXT DEFAULT ''")
            await db.commit()

    async def save_task(self, task: TelegramDownloadTask):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT OR REPLACE INTO tasks "
                "(task_id, engine_task_id, telegram_user_id, message_id, chat_id, "
                "source_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    str(task.task_id),
                    str(task.engine_task_id),
                    task.telegram_user_id,
                    task.message_id,
                    task.chat_id,
                    task.source_url,
                    task.status.value,
                ),
            )
            await db.commit()

    async def get_task(self, task_id: UUID, telegram_user_id: int):
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT task_id, engine_task_id, telegram_user_id, message_id, "
                "chat_id, source_url, status FROM tasks "
                "WHERE task_id = ? AND telegram_user_id = ?",
                (str(task_id), telegram_user_id),
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    return self._row_to_task(row)
        return None

    async def list_tasks(self, telegram_user_id: int):
        tasks = []
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT task_id, engine_task_id, telegram_user_id, message_id, "
                "chat_id, source_url, status FROM tasks "
                "WHERE telegram_user_id = ? ORDER BY rowid ASC",
                (telegram_user_id,),
            ) as cursor:
                async for row in cursor:
                    tasks.append(self._row_to_task(row))
        return tasks

    async def delete_task(self, task_id: UUID, telegram_user_id: int):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "DELETE FROM tasks WHERE task_id = ? AND telegram_user_id = ?",
                (str(task_id), telegram_user_id),
            )
            await db.commit()

    def _row_to_task(self, row) -> TelegramDownloadTask:
        return TelegramDownloadTask(
            task_id=UUID(row[0]),
            engine_task_id=UUID(row[1]),
            telegram_user_id=row[2],
            message_id=row[3],
            chat_id=row[4],
            source_url=row[5],
            status=DownloadStatus(row[6]),
        )

    async def _ensure_column(self, db, column_name: str, column_def: str):
        async with db.execute("PRAGMA table_info(tasks)") as cursor:
            columns = {row[1] async for row in cursor}

        if column_name not in columns:
            await db.execute(f"ALTER TABLE tasks ADD COLUMN {column_name} {column_def}")
