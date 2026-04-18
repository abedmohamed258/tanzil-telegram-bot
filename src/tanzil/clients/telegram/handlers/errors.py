from aiogram import Router, types
import logging

router = Router()


@router.errors()
async def error_handler(exception: types.ErrorEvent):
    logging.exception(f"Update {exception.update} caused error: {exception.exception}")
    if exception.update.message:
        await exception.update.message.answer(
            "An internal error occurred. Please try again later."
        )
