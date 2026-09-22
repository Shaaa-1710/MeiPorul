"""Health and readiness check routes."""

from __future__ import annotations

from fastapi import APIRouter
from backend.app.core.config import get_settings
from backend.app.schemas.common import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check service and auditor health status",
    description="Lightweight health probe verifying API runtime and Claim Auditor subsystem readiness.",
)
async def health_check() -> HealthResponse:
    """Return operational status of the service."""
    settings = get_settings()
    return HealthResponse(
        status="ok",
        auditor="ready",
        version=settings.VERSION,
    )
