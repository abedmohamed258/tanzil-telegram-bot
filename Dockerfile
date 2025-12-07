# Use Node.js 20 with Debian Bookworm (Python 3.11) - Required by Supabase & yt-dlp
FROM node:20-bookworm

# Install Python3, pip, FFmpeg, aria2, git, and supervisor
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    aria2 \
    git \
    supervisor && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp (nightly for latest PO Token support) and the PO Token provider plugin
RUN pip3 install --no-cache-dir --break-system-packages --upgrade "yt-dlp[default]" && \
    pip3 install --no-cache-dir --break-system-packages bgutil-ytdlp-pot-provider && \
    yt-dlp --version && \
    python3 -c "import yt_dlp_plugins.extractor.getpot_bgutil_http; print('✅ PO Token plugin loaded')"

# Clone and build the PO Token HTTP server
WORKDIR /opt/pot-server
RUN git clone --single-branch --branch 1.2.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git . && \
    cd server && \
    npm install && \
    npx tsc

# Create app directory
WORKDIR /app

# Create necessary directories with permissions
RUN mkdir -p temp data downloads && chmod -R 777 temp data downloads

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev for TypeScript build)
RUN npm ci --ignore-scripts

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev

# Create supervisord configuration
RUN mkdir -p /etc/supervisor/conf.d
RUN echo '[supervisord]\n\
    nodaemon=true\n\
    logfile=/dev/stdout\n\
    logfile_maxbytes=0\n\
    \n\
    [program:pot-server]\n\
    command=node /opt/pot-server/server/build/main.js\n\
    autostart=true\n\
    autorestart=true\n\
    stdout_logfile=/dev/stdout\n\
    stdout_logfile_maxbytes=0\n\
    stderr_logfile=/dev/stderr\n\
    stderr_logfile_maxbytes=0\n\
    \n\
    [program:bot]\n\
    command=node --expose-gc /app/dist/index.js\n\
    autostart=true\n\
    autorestart=true\n\
    stdout_logfile=/dev/stdout\n\
    stdout_logfile_maxbytes=0\n\
    stderr_logfile=/dev/stderr\n\
    stderr_logfile_maxbytes=0\n' > /etc/supervisor/conf.d/app.conf

# Expose ports
EXPOSE 3000 4416

# Start supervisord to manage both processes
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/app.conf"]
