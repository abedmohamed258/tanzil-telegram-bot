import asyncio
from typing import Any, Dict

import aiohttp

from tanzil.core.base import BaseComponent, ComponentState
from tanzil.core.events import Event, EventBus
from tanzil.models.download_task import DownloadTask, TaskStatus
from tanzil.utils.logging import get_logger


class DownloadManager(BaseComponent):
    def __init__(self, name: str):
        super().__init__(name)
        self.logger = get_logger("downloader")
        self.semaphore: asyncio.Semaphore | None = None
        self.session: aiohttp.ClientSession | None = None
        self._bus: EventBus | None = None

    async def initialize(self, settings: Dict[str, Any]) -> None:
        self.settings = settings
        max_parallel = settings.get("max_parallel", 5)
        self.semaphore = asyncio.Semaphore(max_parallel)
        self.state = ComponentState.INIT

    def set_bus(self, bus: EventBus):
        self._bus = bus
        self._bus.subscribe("downloader.fetch.request", self.handle_fetch_request)

    async def start(self) -> None:
        self.session = aiohttp.ClientSession()
        self.state = ComponentState.RUNNING
        self.logger.info("Download Manager started.")

    async def stop(self) -> None:
        if self.session:
            await self.session.close()
        self.state = ComponentState.STOPPED
        self.logger.info("Download Manager stopped.")

    async def handle_fetch_request(self, event: Event):
        url = event.payload.get("url")
        if not url:
            return

        asyncio.create_task(self.download(url))

    async def download(self, url: str):
        async with self.semaphore:
            task = DownloadTask(source_url=url, status=TaskStatus.DOWNLOADING)
            self.logger.info(f"Starting download: {url}")

            try:
                if self._bus:
                    await self._bus.emit(
                        "downloader.task.started", self.name, {"url": url}
                    )

                async with self.session.get(url) as response:
                    if response.status == 200:
                        await response.read()
                        task.status = TaskStatus.COMPLETED
                        self.logger.info(f"Completed download: {url}")
                    else:
                        task.status = TaskStatus.FAILED
                        task.error_message = f"HTTP {response.status}"
            except Exception as e:
                task.status = TaskStatus.FAILED
                task.error_message = str(e)
                self.logger.error(f"Download failed: {url} - {e}")

            if self._bus:
                await self._bus.emit(
                    "downloader.task.finished", self.name, task.model_dump(mode="json")
                )
