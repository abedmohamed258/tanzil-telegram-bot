# Use Node.js 20 with Debian Bookworm (Python 3.11) - Required by Supabase & yt-dlp
FROM node:20-bookworm

# Install Python3, pip, FFmpeg AND aria2
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    aria2 && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally
RUN pip3 install --no-cache-dir yt-dlp

# Create app directory
WORKDIR /app

# Create necessary directories with permissions
RUN mkdir -p temp data downloads && chmod -R 777 temp data downloads

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev for TypeScript build)
# Use --ignore-scripts because prepare script needs source files
RUN npm ci --ignore-scripts

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port for health checks (if using webhooks)
EXPOSE 3000

# Start the bot with garbage collection enabled
CMD ["node", "--expose-gc", "dist/index.js"]
