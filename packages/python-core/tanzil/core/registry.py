import importlib.metadata
from typing import Dict, Type, List
from tanzil.core.base import BaseComponent


class ComponentRegistry:
    ENTRY_POINT_GROUP = "tanzil.components"

    @classmethod
    def discover_components(cls) -> Dict[str, Type[BaseComponent]]:
        """Discover components registered via entry points."""
        components = {}
        entry_points = importlib.metadata.entry_points().select(
            group=cls.ENTRY_POINT_GROUP
        )

        for entry_point in entry_points:
            try:
                component_class = entry_point.load()
                if issubclass(component_class, BaseComponent):
                    components[entry_point.name] = component_class
            except Exception as e:
                # Log registry error - could use the util here but keeping simple for registry logic
                pass
        return components
