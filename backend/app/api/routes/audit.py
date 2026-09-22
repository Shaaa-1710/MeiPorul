"""Claim audit route exposing the verification engine."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from backend.app.api.dependencies import get_audit_service, get_request_id
from backend.app.schemas.audit import AuditRequest, AuditResponse
from backend.app.schemas.common import ErrorResponse
from backend.app.services.audit_service import AuditService

router = APIRouter(tags=["Audit"])


@router.post(
    "/audit",
    response_model=AuditResponse,
    status_code=status.HTTP_200_OK,
    summary="Audit a generated answer against retrieved evidence",
    description=(
        "Decomposes a generated RAG answer into atomic claims, executes the multi-stage "
        "verification cascade (deterministic checks -> NLI -> selective escalation), "
        "and returns structured claim-level verdicts with attached grounding evidence."
    ),
    responses={
        status.HTTP_200_OK: {
            "description": "Successful audit evaluation with per-claim verdicts.",
            "model": AuditResponse,
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Invalid or malformed audit request payload.",
            "model": ErrorResponse,
        },
        status.HTTP_422_UNPROCESSABLE_ENTITY: {
            "description": "Schema validation failure (e.g. empty answer or empty evidence list).",
            "model": ErrorResponse,
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "description": "Claim Auditor engine execution failure.",
            "model": ErrorResponse,
        },
    },
)
def audit_answer(
    request: AuditRequest,
    service: AuditService = Depends(get_audit_service),
    request_id: str = Depends(get_request_id),
) -> AuditResponse:
    """Execute claim-level hallucination audit on the provided answer and evidence."""
    return service.audit(request=request, request_id=request_id)
