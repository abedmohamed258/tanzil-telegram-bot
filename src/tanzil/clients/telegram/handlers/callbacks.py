from aiogram import Router, F
from aiogram.types import CallbackQuery
from uuid import UUID

from ..utils.engine import EngineWrapper

router = Router()


from ..models.store import TaskStore


@router.callback_query(F.data.startswith("cancel:"))
async def cb_cancel_download(
    callback: CallbackQuery, engine_wrapper: EngineWrapper, store: TaskStore
):
    task_id_str = callback.data.split(":")[1]
    try:
        task_id = UUID(task_id_str)
        if callback.from_user is None:
            await callback.answer("Unable to resolve user context.", show_alert=True)
            return

        task = await store.get_task(task_id, callback.from_user.id)
        if task:
            await engine_wrapper.cancel_download(task.engine_task_id)
            await store.delete_task(task_id, callback.from_user.id)
            await callback.answer("Download cancelled.")
            if callback.message:
                await callback.message.edit_text(f"Task {task_id} was cancelled.")
        else:
            await callback.answer("Task not found.", show_alert=True)
    except Exception:
        await callback.answer("Error cancelling task.")
