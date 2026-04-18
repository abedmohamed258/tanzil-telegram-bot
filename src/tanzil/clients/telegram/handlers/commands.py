from uuid import UUID

from aiogram import Router
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import Message

from ..models.store import TaskStore
from ..utils.engine import EngineWrapper

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message):
    await message.answer(
        "Welcome to Tanzil Bot!\n\n"
        "Send me a download link to get started.\n"
        "Available commands:\n"
        "/list - Show active downloads\n"
        "/cancel {id} - Stop a download"
    )


@router.message(Command("list"))
async def cmd_list(message: Message, store: TaskStore):
    user_id = message.from_user.id
    tasks = await store.list_tasks(user_id)
    if not tasks:
        return await message.answer("No active downloads.")

    text = "Active downloads:\n"
    for task in tasks:
        text += f"- {task.task_id}: {task.status} ({task.source_url})\n"
    await message.answer(text)


@router.message(Command("cancel"))
async def cmd_cancel(
    message: Message,
    command: CommandObject,
    store: TaskStore,
    engine_wrapper: EngineWrapper,
):
    if not command.args:
        return await message.answer("Please specify task ID: /cancel {id}")

    try:
        task_id = UUID(command.args)
        task = await store.get_task(task_id, message.from_user.id)
        if task:
            await engine_wrapper.cancel_download(task.engine_task_id)
            await store.delete_task(task_id, message.from_user.id)
            await message.answer(f"Cancelled task {task_id}")
        else:
            await message.answer("Task ID not found.")
    except ValueError:
        await message.answer("Invalid Task ID.")
