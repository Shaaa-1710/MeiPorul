"""Unit tests for the health check endpoints."""

import asyncio
import httpx
import pytest
from backend.app.main import app


class SyncTestClient:
    def __init__(self, app_instance):
        self.app = app_instance
        self.base_url = "http://testserver"

    def request(self, method: str, url: str, **kwargs):
        async def _call():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url=self.base_url) as ac:
                return await ac.request(method, url, **kwargs)
        return asyncio.run(_call())

    def get(self, url: str, **kwargs):
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs):
        return self.request("POST", url, **kwargs)


@pytest.fixture
def client():
    return SyncTestClient(app)


def test_root_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["auditor"] == "ready"
    assert "version" in data
    assert "timestamp" in data
    # Check middleware headers
    assert "X-Request-ID" in response.headers
    assert "X-Process-Time-Ms" in response.headers


def test_api_prefixed_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["auditor"] == "ready"


def test_custom_request_id_propagation(client):
    custom_id = "TEST-REQ-12345"
    response = client.get("/health", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == custom_id
