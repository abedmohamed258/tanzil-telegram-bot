import platform
import subprocess
from typing import Dict


def check_python() -> Dict[str, str]:
    return {"version": platform.python_version(), "status": "PASS"}


def check_node() -> Dict[str, str]:
    try:
        res = subprocess.run(
            ["node", "--version"], capture_output=True, text=True, check=True
        )
        return {"version": res.stdout.strip(), "status": "PASS"}
    except Exception:
        return {"version": "N/A", "status": "FAIL"}


def check_git() -> Dict[str, str]:
    try:
        res = subprocess.run(
            ["git", "--version"], capture_output=True, text=True, check=True
        )
        return {"version": res.stdout.strip(), "status": "PASS"}
    except Exception:
        return {"version": "N/A", "status": "FAIL"}


def run_health_check():
    checks = {"Python": check_python(), "Node.js": check_node(), "Git": check_git()}
    return checks
