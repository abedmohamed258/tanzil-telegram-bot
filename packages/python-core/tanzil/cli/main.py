import typer

from tanzil.cli.doctor import doctor
from tanzil.cli.init import init

app = typer.Typer()

# Add init and doctor directly to the main app as commands
app.command(name="init")(init)
app.command(name="doctor")(doctor)

if __name__ == "__main__":
    app()
