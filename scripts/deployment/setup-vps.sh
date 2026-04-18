#!/bin/bash
set -e

echo "=== Tanzil VPS Setup ==="

# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Docker & Docker Compose if not present
if ! [ -x "$(command -v docker)" ]; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# 3. Create required directories
mkdir -p downloads config

# 4. Clone repo if needed
if [ ! -d ".git" ]; then
    echo "Cloning repository..."
    # Placeholder for actual clone logic
    # git clone https://github.com/youruser/tanzil.git .
fi

echo "Setup complete. Please configure your .env file and run 'docker compose -f docker-compose.prod.yml up -d'"
