import pytest
from fastapi.testclient import TestClient
from tanzil.api.main import app as main_app
from tanzil.api.health import app as health_app

def test_main_health():
    client = TestClient(main_app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_health_api():
    client = TestClient(health_app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert "checks" in response.json()

def test_main_unauthorized():
    client = TestClient(main_app)
    response = client.post("/tasks", json={"url": "https://example.com"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid Tanzil Token"

def test_main_authorized_purge(monkeypatch):
    monkeypatch.setenv("CORE_API_TOKEN", "test-token")
    # Reload the app or just the token check if possible, but easier to just mock it
    from tanzil.api import main
    monkeypatch.setattr(main, "CORE_API_TOKEN", "test-token")
    
    client = TestClient(main_app)
    response = client.post(
        "/tasks/purge", 
        params={"days": 5},
        headers={"X-Tanzil-Token": "test-token"}
    )
    assert response.status_code == 200
    assert response.json()["days"] == 5
