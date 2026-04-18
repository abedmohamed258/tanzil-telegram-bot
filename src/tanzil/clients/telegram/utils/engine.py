from __future__ import annotations

import asyncio
import json
from typing import Any, Optional
from uuid import UUID

import aiosqlite

from ..models.schemas import TelegramDownloadTask
from ..models.store import TaskStore


class EngineWrapper:
    def __init__(
        self,
        host: str,
        port: int,
        store: TaskStore,
        progress_reporter: Optional[Any] = None,
        poll_interval: float = 1.0,
    ):
        self.host = host
        self.port = port
        self.store = store
        self.progress_reporter = progress_reporter
        self.poll_interval = poll_interval
        self.active_tasks: dict[str, asyncio.Task] = {}

    async def start_download(self, url: str, telegram_user_id: int) -> UUID:
        response = await self._send_command(
            {
                "command": "submit",
                "payload": {"url": url, "owner_id": telegram_user_id},
            }
        )
        if response.get("status") == "error":
            raise RuntimeError(response.get("message", "Unknown error"))
        return UUID(response["task_id"])

    async def resume_tasks(self):
        """Resume monitoring for all active tasks in the database."""
        # Note: list_tasks currently requires a user_id.
        # We need a global task list for startup recovery.
        # For now, we rely on the specific database instance.
        async with aiosqlite.connect(self.store.db_path) as db:
            async with db.execute(
                "SELECT task_id, engine_task_id, telegram_user_id, message_id, "
                "chat_id, source_url, status FROM tasks"
            ) as cursor:
                async for row in cursor:
                    task = self.store._row_to_task(row)
                    await self.track_task(task)

    async def _send_command(self, command: dict[str, Any]) -> dict[str, Any]:
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port), timeout=5.0
            )
        except asyncio.TimeoutError:
            raise RuntimeError(f"Connection timeout to core at {self.host}:{self.port}")

        try:
            writer.write((json.dumps(command) + "\n").encode())
            await writer.drain()
            data = await asyncio.wait_for(reader.readline(), timeout=5.0)
        finally:
            writer.close()
            await writer.wait_closed()

        if not data:
            raise RuntimeError("Core server returned an empty response")

        return json.loads(data.decode())

    async def _monitor_task(self, task: TelegramDownloadTask):
        try:
            while True:
                status = await self._send_command(
                    {"command": "status", "task_id": str(task.engine_task_id)}
                )
                if "error" in status:
                    await self.progress_reporter.update_progress(
                        task.chat_id,
                        task.message_id,
                        f"Download status unavailable for {task.source_url}",
                        force=True,
                    )
                    await self.store.delete_task(task.task_id, task.telegram_user_id)
                    return

                task_status = status["status"]
                if task_status == "RUNNING":
                    progress = status.get("progress", 0)
                    await self.progress_reporter.update_progress(
                        task.chat_id,
                        task.message_id,
                        f"Downloading {task.source_url}: {progress}%",
                    )
                elif task_status == "COMPLETED":
                    output = status.get("results", {}).get("output", "Completed")
                    await self.progress_reporter.update_progress(
                        task.chat_id,
                        task.message_id,
                        f"Download completed: {output}",
                        force=True,
                    )
                    await self.store.delete_task(task.task_id, task.telegram_user_id)
                    return
                elif task_status in {"FAILED", "CANCELLED"}:
                    error_text = (
                        ", ".join(status.get("errors", [])) or task_status.title()
                    )
                    await self.progress_reporter.update_progress(
                        task.chat_id,
                        task.message_id,
                        f"Download ended: {error_text}",
                        force=True,
                    )
                    await self.store.delete_task(task.task_id, task.telegram_user_id)
                    return

                await asyncio.sleep(self.poll_interval)
        except asyncio.CancelledError:
            raise
        finally:
            self.progress_reporter.clear_message_throttle(task.chat_id, task.message_id)
            self.active_tasks.pop(str(task.engine_task_id), None)

    async def on_engine_progress(self, engine_task_id: UUID, progress_data: dict):
        if str(engine_task_id) in self.active_tasks and self.progress_reporter:
            progress = progress_data.get("percent", 0)
            chat_id = progress_data["chat_id"]
            message_id = progress_data["message_id"]
            await self.progress_reporter.update_progress(
                chat_id,
                message_id,
                f"Downloading: {progress}%",
            )
