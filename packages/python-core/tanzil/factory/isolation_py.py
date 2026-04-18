import os
import subprocess

from tanzil.utils.logging import setup_logging

logger = setup_logging()


def setup_python_isolation(root: str):
    venv_path = os.path.join(root, ".tanzil", "venv")
    if not os.path.exists(venv_path):
        logger.info(f"Creating Python virtual environment at {venv_path} using uv...")
        try:
            # Check if uv is installed
            subprocess.run(["uv", "--version"], capture_output=True, check=True)
            subprocess.run(["uv", "venv", venv_path], check=True)
            logger.info("Successfully created venv with uv.")
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.warning("uv not found or failed, falling back to python3 -m venv.")
            subprocess.run(["python3", "-m", "venv", venv_path], check=True)
    else:
        logger.info(f"Existing virtual environment found at {venv_path}.")
