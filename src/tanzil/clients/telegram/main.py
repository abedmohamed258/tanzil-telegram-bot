import asyncio
import logging
import os
import signal

from aiogram import Bot, Dispatcher

from .config import load_config
from .handlers import callbacks, commands, downloads, errors
from .middleware.auth import WhitelistMiddleware
from .models.store import TaskStore
from .utils.engine import EngineWrapper
from .utils.progress import ProgressReporter


async def main():

    config_path = os.getenv("TANZIL_CONFIG", "config.yaml")
    config = load_config(config_path)

    store = TaskStore(config.telegram.task_db_path)
    await store.init()

    bot = Bot(token=config.telegram.token.get_secret_value())
    dp = Dispatcher()

    progress_reporter = ProgressReporter(bot)
    
    # ... (integration with Starlette/FastAPI for webhook)
    engine_wrapper = EngineWrapper(
        host=os.getenv("TANZIL_CORE_HOST", "core"),
        port=int(os.getenv("TANZIL_CORE_PORT", "8000")),
        store=store,
        progress_reporter=progress_reporter,
        poll_interval=config.telegram.status_poll_interval_sec,
    )

    dp["store"] = store
    dp["engine_wrapper"] = engine_wrapper
    dp["config"] = config

    dp.update.outer_middleware(WhitelistMiddleware(config))

    dp.include_router(commands.router)
    dp.include_router(downloads.router)
    dp.include_router(callbacks.router)
    dp.include_router(errors.router)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(dp.stop_polling()))

    try:
        await dp.start_polling(bot)
    finally:
        await engine_wrapper.shutdown()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
