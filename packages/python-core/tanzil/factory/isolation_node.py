import os
import subprocess

from tanzil.utils.logging import setup_logging

logger = setup_logging()


def setup_node_isolation(root: str):
    node_modules = os.path.join(root, "node_modules")
    if not os.path.exists(node_modules):
        logger.info("Initializing Node.js workspace dependencies with pnpm...")
        try:
            # Check if pnpm is installed
            subprocess.run(["pnpm", "--version"], capture_output=True, check=True)
            subprocess.run(["pnpm", "install"], cwd=root, check=True)
            logger.info("pnpm install completed.")
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.warning("pnpm not found, falling back to npm.")
            subprocess.run(["npm", "install"], cwd=root, check=True)
    else:
        logger.info("Node.js node_modules already exists.")
