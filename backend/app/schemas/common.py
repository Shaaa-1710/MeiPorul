"""Common Pydantic schemas for health, metadata, and standard error responses."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check endpoint response schema."""
    status: str = Field(default="ok", description="Service health status")
    auditor: str = Field(default="ready", description="Claim auditor subsystem status")
    version: str = Field(default="1.0.0", description="API version")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="Current UTC timestamp",
    )


class ErrorResponse(BaseModel):
    """Standardized error payload returned to client."""
    error: str = Field(..., description="Error category code (e.g. VALIDATION_ERROR, AUDITOR_ERROR)")
    message: str = Field(..., description="Human-readable error description")
    request_id: Optional[str] = Field(default=None, description="Unique correlation request ID")
    details: Optional[Any] = Field(default=None, description="Detailed diagnostic or field-level validation errors")
