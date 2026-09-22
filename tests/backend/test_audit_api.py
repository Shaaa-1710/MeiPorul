"""Unit and integration tests for POST /api/audit endpoint."""

import asyncio
from unittest.mock import MagicMock
import httpx
import pytest

from auditor.models import (
    AuditMetrics as InternalMetrics,
    AuditResponse as InternalResponse,
    ClaimAuditResult as InternalClaimResult,
    EvidenceChunk as InternalChunk,
    VerdictType,
)
from backend.app.api.dependencies import get_claim_auditor
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


# ==============================================================================
# 1. UNIT TESTS WITH MOCKED AUDITOR
# ==============================================================================

def test_mocked_auditor_successful_response(client):
    """Test API response serialization using a mocked ClaimAuditor."""
    mock_auditor = MagicMock()
    mock_internal_response = InternalResponse(
        answer="Mock answer.",
        claims=[
            InternalClaimResult(
                claim_id="C1",
                text="Mock claim text.",
                verdict=VerdictType.SUPPORTED,
                confidence=0.97,
                reason="Direct match in mock evidence.",
                evidence=[
                    InternalChunk(
                        evidence_id="EVD-001",
                        document_id="DOC-99",
                        text="Mock evidence text.",
                        page=3,
                    )
                ],
                checks={"span": True, "numeric": True, "entity": True},
                stage_decided="deterministic",
                is_escalated=False,
            )
        ],
        overall_verdict=VerdictType.SUPPORTED,
        is_grounded=True,
        metrics=InternalMetrics(
            total_claims=1,
            claims_supported=1,
            deterministic_count=1,
            total_audit_latency_ms=12.5,
        ),
    )
    mock_auditor.audit.return_value = mock_internal_response

    app.dependency_overrides[get_claim_auditor] = lambda: mock_auditor

    try:
        payload = {
            "answer": "Mock answer.",
            "evidence": [{"text": "Mock evidence text.", "document_id": "DOC-99", "page": 3}],
        }
        response = client.post("/api/audit", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["overall_verdict"] == "SUPPORTED"
        assert data["is_grounded"] is True
        assert len(data["claims"]) == 1
        assert data["claims"][0]["claim_id"] == "C1"
        assert data["claims"][0]["verdict"] == "SUPPORTED"
        assert data["claims"][0]["evidence"][0]["document_id"] == "DOC-99"
        assert data["metrics"]["deterministic_count"] == 1
        assert "request_id" in data
        assert "latency_ms" in data
    finally:
        app.dependency_overrides.pop(get_claim_auditor, None)


def test_mocked_auditor_execution_error_returns_500(client):
    """Test that an internal auditor failure is safely converted to HTTP 500."""
    mock_auditor = MagicMock()
    mock_auditor.audit.side_effect = RuntimeError("Fatal internal tensor failure")

    app.dependency_overrides[get_claim_auditor] = lambda: mock_auditor

    try:
        payload = {
            "answer": "Test answer.",
            "evidence": [{"text": "Test evidence text."}],
        }
        response = client.post("/api/audit", json=payload)
        assert response.status_code == 500
        data = response.json()
        assert data["error"] == "AUDITOR_EXECUTION_ERROR"
        assert "Fatal internal tensor failure" in data["message"]
        assert "request_id" in data
    finally:
        app.dependency_overrides.pop(get_claim_auditor, None)


# ==============================================================================
# 2. REAL CLAIM AUDITOR INTEGRATION TESTS
# ==============================================================================

def test_real_audit_test_1_numeric_contradiction(client):
    """Real Auditor: ₹50,000 vs ₹55,000 -> CONTRADICTED."""
    payload = {
        "answer": "The subsidy is ₹55,000.",
        "evidence": [
            {
                "evidence_id": "E1",
                "document_id": "DOC001",
                "page": 12,
                "text": "The subsidy is ₹50,000.",
            }
        ],
    }
    response = client.post("/api/audit", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overall_verdict"] == "CONTRADICTED"
    assert data["is_grounded"] is False
    assert len(data["claims"]) == 1
    assert data["claims"][0]["verdict"] == "CONTRADICTED"
    assert data["claims"][0]["checks"]["numeric"] is False


def test_real_audit_test_2_supported_paraphrase(client):
    """Real Auditor: began operations in 2024 vs started in 2024 -> SUPPORTED."""
    payload = {
        "answer": "The scheme started in 2024.",
        "evidence": [
            {
                "evidence_id": "E1",
                "text": "The scheme began operations in 2024 across southern districts.",
            }
        ],
    }
    response = client.post("/api/audit", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overall_verdict"] == "SUPPORTED"
    assert data["is_grounded"] is True
    assert data["claims"][0]["verdict"] == "SUPPORTED"


def test_real_audit_test_3_entity_mismatch(client):
    """Real Auditor: Chennai vs Coimbatore -> CONTRADICTED."""
    payload = {
        "answer": "Applications are submitted at the Coimbatore office.",
        "evidence": [
            {
                "evidence_id": "E1",
                "text": "Applications are submitted at the Chennai office.",
            }
        ],
    }
    response = client.post("/api/audit", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overall_verdict"] == "CONTRADICTED"
    assert data["claims"][0]["verdict"] == "CONTRADICTED"


def test_real_audit_test_4_hedge_precision(client):
    """Real Auditor: approx 10 days vs exactly 10 days -> PARTIALLY_SUPPORTED."""
    payload = {
        "answer": "Applications are processed in exactly 10 days.",
        "evidence": [
            {
                "evidence_id": "E1",
                "text": "Applications are generally processed in approximately 10 days.",
            }
        ],
    }
    response = client.post("/api/audit", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overall_verdict"] == "PARTIALLY_SUPPORTED"
    assert data["claims"][0]["verdict"] == "PARTIALLY_SUPPORTED"


def test_real_audit_test_5_unsupported_claim(client):
    """Real Auditor: no deadline evidence -> NOT_ENTAILED."""
    payload = {
        "answer": "Applications must be submitted within 30 days.",
        "evidence": [
            {
                "evidence_id": "E1",
                "text": "The handbook outlines general guidelines for eligible farming households.",
            }
        ],
    }
    response = client.post("/api/audit", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overall_verdict"] == "NOT_ENTAILED"
    assert data["is_grounded"] is False


def test_real_audit_test_6_compound_answer(client):
    """Real Auditor: compound answer splits into C1 (SUPPORTED), C2 (SUPPORTED), C3 (CONTRADICTED)."""
    payload = {
        "answer": "The project launched in 2024, operates in Kerala, and has a budget of ₹55,000.",
        "evidence": [
            {"evidence_id": "E1", "text": "The project launched in 2024."},
            {"evidence_id": "E2", "text": "It operates in Kerala."},
            {"evidence_id": "E3", "text": "The budget is ₹50,000."},
        ],
    }
    response = client.post("/api/audit", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["claims"]) == 3
    assert data["claims"][0]["verdict"] == "SUPPORTED"
    assert data["claims"][1]["verdict"] == "SUPPORTED"
    assert data["claims"][2]["verdict"] == "CONTRADICTED"
    assert data["overall_verdict"] == "CONTRADICTED"
    assert data["is_grounded"] is False
