import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.security import APIKeyHeader

from tanzil.models.schemas import Task

app = FastAPI(title="Tanzil Core API", version="1.0.0")

API_KEY_HEADER = APIKeyHeader(name="X-Tanzil-Token", auto_error=False)
CORE_API_TOKEN = os.getenv("CORE_API_TOKEN", "changeme")

async def get_api_key(api_key: str = Security(API_KEY_HEADER)):
    if api_key != CORE_API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Tanzil Token",
        )
    return api_key

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc),
        "engine": "ok",
        "storage": "writable"
    }

@app.post("/tasks", response_model=Task, dependencies=[Depends(get_api_key)])
async def create_task(payload: dict):
    # logic to call tanzil.core.engine.submit_task
    pass

@app.get("/tasks/{task_id}", response_model=Task, dependencies=[Depends(get_api_key)])
async def get_task(task_id: str):
    # logic to call tanzil.core.engine.get_task
    pass

@app.post("/tasks/purge", dependencies=[Depends(get_api_key)])
async def purge_old_tasks(days: int = 7):
    # logic to call tanzil.core.engine.purge_old_tasks
    return {"status": "purged", "days": days}

# SSE for real-time updates
@app.get("/tasks/events", dependencies=[Depends(get_api_key)])
async def task_events():
    # stream events from tanzil.core.bus
    pass
