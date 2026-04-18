import re
from uuid import uuid4

from aiogram import Router, F
from aiogram.types import Message

from ..models.schemas import TelegramDownloadTask, DownloadStatus
from ..utils.engine import EngineWrapper
from ..utils.progress import get_progress_keyboard

router = Router()

URL_PATTERN = re.compile(
    r"(?P<url>(?:https?|ftp)://[^\s]+)",
    re.IGNORECASE,
)


from ..models.store import TaskStore


@router.message(F.text.regexp(URL_PATTERN))
async def handle_download_request(
    message: Message, engine_wrapper: EngineWrapper, store: TaskStore
):
    match = URL_PATTERN.search(message.text or "")
    if not match:
        return

    url = match.group("url")
    telegram_user_id = message.from_user.id if message.from_user else message.chat.id
    engine_task_id = await engine_wrapper.start_download(url, telegram_user_id)
    task_id = uuid4()
    progress_message = await message.answer(
        f"Download started: {url}",
        reply_markup=get_progress_keyboard(task_id),
    )

    task = TelegramDownloadTask(
        task_id=task_id,
        engine_task_id=engine_task_id,
        telegram_user_id=telegram_user_id,
        message_id=progress_message.message_id,
        chat_id=message.chat.id,
        source_url=url,
        status=DownloadStatus.DOWNLOADING,
    )

    await store.save_task(task)
    await engine_wrapper.track_task(task)
