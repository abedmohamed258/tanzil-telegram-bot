import os

from tanzil.utils.logging import setup_logging

logger = setup_logging()


def create_structure(root: str):
    dirs = [
        ".tanzil",
        "bin",
        "packages/node-core",
        "packages/python-core/tanzil",
        "services",
        "scripts",
        "tests/integration",
        "tests/unit",
    ]
    for d in dirs:
        path = os.path.join(root, d)
        if not os.path.exists(path):
            os.makedirs(path, exist_ok=True)
            logger.info(f"Created directory: {path}")
        else:
            logger.info(f"Skipped existing directory: {path}")
