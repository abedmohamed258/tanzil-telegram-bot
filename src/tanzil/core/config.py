from typing import Type, TypeVar

import yaml
from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)


def load_validated_config(path: str, model_class: Type[T]) -> T:
    try:
        with open(path, "r") as f:
            data = yaml.safe_load(f) or {}
        return model_class.model_validate(data)
    except FileNotFoundError as e:
        raise Exception(f"Configuration file not found: {path}") from e
    except yaml.YAMLError as e:
        raise Exception(f"Invalid YAML format: {e}") from e
    except ValidationError as e:
        raise Exception(f"Configuration validation failed: {e}") from e
