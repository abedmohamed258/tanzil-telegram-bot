from typing import Any, Dict

import yaml


def load_yaml(path: str) -> Dict[str, Any]:
    with open(path, "r") as f:
        return yaml.safe_load(f)


def save_yaml(path: str, data: Dict[str, Any]):
    with open(path, "w") as f:
        yaml.safe_dump(data, f, default_flow_style=False)
