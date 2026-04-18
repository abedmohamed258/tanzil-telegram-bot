from __future__ import annotations

import logging
import time
from uuid import UUID

from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest
from aiogram.utils.keyboard import InlineKeyboardBuilder

logger = logging.getLogger("tanzil.telegram.progress")


def get_progress_keyboard(task_id: UUID):
    builder = InlineKeyboardBuilder()
    builder.button(text="Cancel", callback_data=f"cancel:{task_id}")
    return builder.as_markup()


class ProgressReporter:
    def __init__(self, bot: Bot):
        self.bot = bot
        self.last_update = {}  # {(chat_id, message_id): timestamp}

    async def update_progress(
        self, chat_id: int, message_id: int, text: str, *, force: bool = False
    ):
        current_time = time.time()
        throttle_key = (chat_id, message_id)
        last_time = self.last_update.get(throttle_key, 0)

        # Throttling to 1 edit per second
        if not force and current_time - last_time < 1.0:
            return

        try:
            await self.bot.edit_message_text(
                text, chat_id=chat_id, message_id=message_id
            )
            self.last_update[throttle_key] = current_time
        except TelegramBadRequest as exc:
            if "message is not modified" in exc.message:
                return
            if "message to edit not found" in exc.message:
                self.last_update.pop(throttle_key, None)
                return
            logger.warning(
                "Telegram API error for %s/%s: %s",
                chat_id,
                message_id,
                exc,
            )
        except Exception as exc:
            logger.warning(
                "Failed to update progress message %s/%s: %s",
                chat_id,
                message_id,
                exc,
            )

    def clear_message_throttle(self, chat_id: int, message_id: int):
        self.last_update.pop((chat_id, message_id), None)
