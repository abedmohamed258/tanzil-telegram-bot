# Production Dockerfile for Tanzil Core Engine
# In this architecture, the bot and core are often bundled together
# This Dockerfile can be used for a standalone engine if needed
FROM python:3.10-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
COPY packages/ ./packages/
COPY src/ ./src/

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

FROM python:3.10-slim

WORKDIR /app

RUN groupadd -r tanzil && useradd -r -g tanzil tanzil

COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app /app

USER tanzil

ENV LOG_FORMAT=json
ENV PYTHONUNBUFFERED=1

# Core engine specifically (adjust command as needed)
CMD ["tanzil", "server", "start"]
