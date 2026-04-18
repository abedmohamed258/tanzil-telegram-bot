# Tanzil Core Engine

Foundation for the Tanzil bot ecosystem.

## Component Registration

Components are registered via Python entry points in `pyproject.toml`:

```toml
[project.entry-points."tanzil.components"]
my_component = "my_package.module:MyComponent"
```

Components must inherit from `tanzil.core.base.BaseComponent` and implement `initialize`, `start`, and `stop`.
