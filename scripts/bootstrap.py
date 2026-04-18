import os
import sys
import subprocess
import argparse
import json
import shutil


def run_cmd(cmd, cwd=None):
    print(f"Executing: {' '.join(cmd)}")
    subprocess.run(cmd, cwd=cwd, check=True)


def main():
    parser = argparse.ArgumentParser(description="Tanzil Zero-Dep Bootstrapper")
    parser.add_argument("--root", default=".", help="Project root")
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    venv_path = os.path.join(root, ".tanzil", "venv")

    print(f"--- Bootstrapping Tanzil Environment at {root} ---")

    # 1. Create .tanzil directory
    os.makedirs(os.path.join(root, ".tanzil"), exist_ok=True)

    # 2. Create Virtual Environment
    if not os.path.exists(venv_path):
        print("Creating virtual environment...")
        run_cmd([sys.executable, "-m", "venv", venv_path])

    # 3. Determine Python Executable in Venv
    if os.name == "nt":
        venv_python = os.path.join(venv_path, "Scripts", "python.exe")
    else:
        venv_python = os.path.join(venv_path, "bin", "python3")

    # 4. Install uv for performance (if possible) or use pip
    print("Installing core dependencies into venv...")
    run_cmd(
        [venv_python, "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"]
    )
    run_cmd([venv_python, "-m", "pip", "install", "typer", "pydantic", "pyyaml"])

    # 5. Install python-core as an editable package
    core_path = os.path.join(root, "packages", "python-core")
    if os.path.exists(core_path):
        print("Installing tanzil-core in editable mode...")
        run_cmd([venv_python, "-m", "pip", "install", "-e", core_path])

    print("\n--- Bootstrap Complete ---")


if __name__ == "__main__":
    main()
