import os
import asyncio
from aiogram.types import Message, FSInputFile


async def deliver_file(message: Message, file_path: str, upload_limit_mb: int = 50):
    if not os.path.exists(file_path):
        await message.answer("Download completed, but the file could not be found.")
        return

    # Offload blocking OS call to thread
    file_size = await asyncio.to_thread(os.path.getsize, file_path)
    file_size_mb = file_size / (1024 * 1024)

    if file_size_mb <= upload_limit_mb:
        await message.answer_document(
            FSInputFile(file_path), caption="Download complete!"
        )
    else:
        await message.answer(
            f"File is too large ({file_size_mb:.2f}MB) for Telegram upload.\n"
            f"File remains on disk at: {file_path}"
        )
