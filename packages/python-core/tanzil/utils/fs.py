import os
import tempfile

from tanzil.utils.logging import setup_logging

logger = setup_logging()


def safe_create_directory(path: str):
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)
        logger.info(f"Created directory: {path}")
    else:
        logger.info(f"Directory already exists (Safe Merge): {path}")


def atomic_write_file(path: str, content: str):
    """Writes a file atomically using a temporary file and os.replace."""
    dir_name = os.path.dirname(path)
    fd, temp_path = tempfile.mkstemp(dir=dir_name, prefix=".tmp_")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(content)
        os.replace(temp_path, path)
        logger.info(f"Atomically wrote file: {path}")
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        logger.error(f"Failed to write file {path}: {e}")
        raise
