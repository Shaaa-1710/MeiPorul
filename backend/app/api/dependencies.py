"""FastAPI dependencies for dependency injection of services and providers."""

from __future__ import annotations

import uuid
from typing import Optional
from fastapi import Depends, Request

from auditor import ClaimAuditor
from backend.app.services.audit_service import AuditService

# Singleton holder for ClaimAuditor to prevent repeated re-initialization
_singleton_auditor: Optional[ClaimAuditor] = None


def get_claim_auditor() -> ClaimAuditor:
    """Provide singleton instance of ClaimAuditor across requests."""
    global _singleton_auditor
    if _singleton_auditor is None:
        _singleton_auditor = ClaimAuditor()
    return _singleton_auditor


def set_claim_auditor(auditor: ClaimAuditor) -> None:
    """Set custom or mock ClaimAuditor instance (useful for unit testing)."""
    global _singleton_auditor
    _singleton_auditor = auditor


def get_audit_service(
    auditor: ClaimAuditor = Depends(get_claim_auditor),
) -> AuditService:
    """Dependency provider for AuditService with injected ClaimAuditor."""
    return AuditService(auditor=auditor)


def get_request_id(request: Request) -> str:
    """Extract correlation request ID from request state or header."""
    if hasattr(request.state, "request_id") and request.state.request_id:
        return str(request.state.request_id)
    header_req_id = request.headers.get("X-Request-ID")
    if header_req_id:
        return header_req_id
    return f"AUD-{uuid.uuid4().hex[:12].upper()}"
