# Multi-stage production Dockerfile for Tanzil Bot
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

# Non-root user for security
RUN groupadd -r tanzil && useradd -r -g tanzil tanzil

COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /app /app

RUN mkdir -p /app/downloads /app/data && chown -R tanzil:tanzil /app/downloads /app/data

USER tanzil

ENV LOG_FORMAT=json
ENV PYTHONUNBUFFERED=1
ENV DATABASE_URL=sqlite:////app/data/tanzil.db

CMD ["tanzil", "server", "start"]
