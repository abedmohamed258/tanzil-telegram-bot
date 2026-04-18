import json
import socket
from pathlib import Path
from typing import Annotated

import typer

from tanzil.cli.server import SOCKET_PATH, run_server

app = typer.Typer(help="Tanzil Engine CLI Client")


def send_command(command: dict):
    if not Path(SOCKET_PATH).exists():
        typer.secho(
            "Error: Server not running. "
            "Start it with 'tanzil server --config config.yaml' first.",
            fg=typer.colors.RED,
        )
        raise typer.Exit(1)

    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
        s.connect(SOCKET_PATH)
        s.sendall((json.dumps(command) + "\n").encode())

        chunks = []
        while True:
            chunk = s.recv(4096)
            if not chunk:
                break
            chunks.append(chunk)

        data = b"".join(chunks).decode().strip()
        return json.loads(data)


@app.command()
def server(config: Annotated[Path, typer.Option(help="Path to YAML config")]):
    """Start the Tanzil Engine Server (Daemon)."""
    run_server(str(config))


@app.command()
def submit(url: str):
    """Submit an extraction task to the running server."""
    response = send_command({"command": "submit", "payload": {"url": url}})
    typer.echo(json.dumps(response, indent=2))


@app.command()
def status(task_id: str):
    """Check the status of a specific task."""
    response = send_command({"command": "status", "task_id": task_id})
    typer.echo(json.dumps(response, indent=2))


@app.command()
def list():
    """List all tasks in the engine's memory."""
    response = send_command({"command": "list"})
    typer.echo(json.dumps(response, indent=2))


@app.command()
def cancel(task_id: str):
    """Cancel a running extraction task."""
    response = send_command({"command": "cancel", "task_id": task_id})
    typer.echo(json.dumps(response, indent=2))


if __name__ == "__main__":
    app()
