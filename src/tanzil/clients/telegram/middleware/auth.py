from typing import Any, Awaitable, Callable, Dict

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject

from ..config import Config


class WhitelistMiddleware(BaseMiddleware):
    def __init__(self, config: Config) -> None:
        self.config = config

    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any],
    ) -> Any:
        user = data.get("event_from_user")
        allowed_users = self.config.telegram.authorized_users
        if allowed_users and user and user.id not in allowed_users:
            if isinstance(event, Message):
                return await event.answer("Access Denied: You are not authorized.")
            elif isinstance(event, CallbackQuery):
                return await event.answer("Access Denied.", show_alert=True)
            return  # Drop other unauthorized events

        return await handler(event, data)
