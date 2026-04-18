from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

from ..models.schemas import DownloadStatus, TelegramDownloadTask
from ..models.store import TaskStore


class EngineWrapper:
    def __init__(
        self,
        socket_path: str,
        store: TaskStore,
        progress_reporter: Optional[Any] = None,
        poll_interval: float = 0.2,
    ):
        self.socket_path = socket_path
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
        if "error" in response:
            raise RuntimeError(response["error"])
        return UUID(response["task_id"])

    async def cancel_download(self, engine_task_id: UUID):
        response = await self._send_command(
            {"command": "cancel", "task_id": str(engine_task_id)}
        )
        if "error" in response:
            raise RuntimeError(response["error"])

        monitor_task = self.active_tasks.pop(str(engine_task_id), None)
        if monitor_task:
            monitor_task.cancel()

        return bool(response.get("cancelled"))

    async def track_task(self, task: TelegramDownloadTask):
        engine_task_id = str(task.engine_task_id)
        existing = self.active_tasks.pop(engine_task_id, None)
        if existing:
            existing.cancel()

        self.active_tasks[engine_task_id] = asyncio.create_task(
            self._monitor_task(task), name=f"telegram-monitor-{engine_task_id}"
        )

    async def shutdown(self):
        if not self.active_tasks:
            return

        tasks = list(self.active_tasks.values())
        self.active_tasks.clear()
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_command(self, command: dict[str, Any]) -> dict[str, Any]:
        if not Path(self.socket_path).exists():
            raise RuntimeError(f"Core socket not found: {self.socket_path}")

        reader, writer = await asyncio.open_unix_connection(self.socket_path)
        try:
            writer.write((json.dumps(command) + "\n").encode())
            await writer.drain()
            data = await reader.readline()
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
