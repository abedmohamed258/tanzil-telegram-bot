
import typer

from tanzil.factory.config_manager import ConfigManager
from tanzil.factory.isolation_node import setup_node_isolation
from tanzil.factory.isolation_py import setup_python_isolation
from tanzil.factory.scaffold import create_structure
from tanzil.utils.fs import atomic_write_file

app = typer.Typer()


@app.command()
def init(
    env: str = typer.Option("development", help="Environment profile"),
    project_name: str = typer.Option("tanzil-project", help="Project name"),
    root: str = typer.Option(".", help="Project root"),
):
    typer.echo(f"Initializing Tanzil Project: {project_name} (Environment: {env})")

    # Create directories
    create_structure(root)

    # Isolated environments
    setup_python_isolation(root)
    setup_node_isolation(root)

    # Configuration management
    manager = ConfigManager(root)
    config = manager.load_config()
    config.project_name = project_name

    if any(p.name == env for p in config.profiles):
        config.current_env = env
    else:
        typer.echo(
            f"Warning: Environment profile '{env}' not found. "
            "Defaulting to development."
        )
        config.current_env = "development"

    # Atomic write for config
    # Actually use YAML for the config file as per research,
    # but pydantic to yaml is easiest via dict
    import yaml

    config_yaml = yaml.dump(config.model_dump(), default_flow_style=False)
    atomic_write_file(manager.config_path, config_yaml)

    typer.echo(f"Configuration initialized at {manager.config_path}")


if __name__ == "__main__":
    app()
