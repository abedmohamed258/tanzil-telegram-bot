#!/bin/bash
set -e

# Tanzil Spark Bootstrapper
# Responsibility: Find Python and launch the zero-dep bootstrap process

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Tanzil Spark Initializer ==="

# Find Python3
if command -v python3 &> /dev/null; then
    PYTHON_BIN="python3"
elif command -v python &> /dev/null; then
    PYTHON_BIN="python"
else
    echo "Error: Python is not installed. Please install Python 3.10+."
    exit 1
fi

# Run the bootstrap script
"$PYTHON_BIN" "$REPO_ROOT/scripts/bootstrap.py" --root "$REPO_ROOT"

# Now run the full init CLI from the venv
"$REPO_ROOT/bin/tanzil" init "$@"
