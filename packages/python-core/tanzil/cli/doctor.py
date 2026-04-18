import typer

from tanzil.utils.health import run_health_check

app = typer.Typer()


@app.command()
def doctor():
    typer.echo("=== Tanzil SDK Health Check ===")
    results = run_health_check()
    for tool, data in results.items():
        status = data["status"]
        version = data["version"]
        color = typer.colors.GREEN if status == "PASS" else typer.colors.RED
        typer.echo(f"{tool}: {typer.style(status, fg=color)} (Version: {version})")


if __name__ == "__main__":
    app()
