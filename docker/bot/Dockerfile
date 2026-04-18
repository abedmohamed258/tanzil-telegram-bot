FROM python:3.10-slim-bookworm

RUN groupadd -r tanzil && useradd -r -g tanzil tanzil

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY src/ /app/src/
ENV PYTHONPATH=/app/src

RUN chown -R tanzil:tanzil /app
USER tanzil

CMD ["python", "-m", "tanzil.clients.telegram.main"]
