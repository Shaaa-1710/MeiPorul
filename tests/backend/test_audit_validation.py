"""Validation constraint tests for the Audit API endpoint."""

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

    def post(self, url: str, **kwargs):
        return self.request("POST", url, **kwargs)


@pytest.fixture
def client():
    return SyncTestClient(app)


def test_empty_answer_fails_validation(client):
    payload = {
        "answer": "",
        "evidence": [{"text": "Valid evidence text."}],
    }
    response = client.post("/api/audit", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"] == "VALIDATION_ERROR"
    assert "request_id" in data


def test_whitespace_answer_fails_validation(client):
    payload = {
        "answer": "   \n\t  ",
        "evidence": [{"text": "Valid evidence text."}],
    }
    response = client.post("/api/audit", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"] == "VALIDATION_ERROR"


def test_missing_answer_fails_validation(client):
    payload = {
        "evidence": [{"text": "Valid evidence text."}],
    }
    response = client.post("/api/audit", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"] == "VALIDATION_ERROR"


def test_empty_evidence_list_fails_validation(client):
    payload = {
        "answer": "Valid answer text.",
        "evidence": [],
    }
    response = client.post("/api/audit", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"] == "VALIDATION_ERROR"


def test_evidence_empty_text_fails_validation(client):
    payload = {
        "answer": "Valid answer text.",
        "evidence": [{"text": "   "}],
    }
    response = client.post("/api/audit", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"] == "VALIDATION_ERROR"


def test_evidence_invalid_page_fails_validation(client):
    payload = {
        "answer": "Valid answer text.",
        "evidence": [{"text": "Valid text.", "page": -5}],
    }
    response = client.post("/api/audit", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["error"] == "VALIDATION_ERROR"


def test_malformed_json_fails(client):
    response = client.post(
        "/api/audit",
        content="not valid json",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
