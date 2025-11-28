# Use Node.js 18 with Debian Bullseye (stable)
FROM node:18-bullseye

# Install Python3, pip, and FFmpeg
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally
RUN pip3 install --no-cache-dir yt-dlp

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port for health checks (if using webhooks)
EXPOSE 3000

# Start the bot with garbage collection enabled
CMD ["node", "--expose-gc", "dist/index.js"]
