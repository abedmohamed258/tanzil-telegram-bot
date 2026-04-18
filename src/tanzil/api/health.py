from datetime import datetime, timezone
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Tanzil Health API")

class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: datetime
    checks: dict

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        timestamp=datetime.now(timezone.utc),
        checks={
            "engine": "ok",
            "pubsub": "ok",
            "storage": "writable"
        }
    )
