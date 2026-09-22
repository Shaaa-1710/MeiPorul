"""Audit service orchestrating interaction between the HTTP layer and the Claim Auditor."""

from __future__ import annotations

import time
from typing import Optional

from auditor import ClaimAuditor
from auditor.models import AuditResponse as AuditorInternalResponse
from backend.app.core.logging import get_logger
from backend.app.schemas.audit import (
    AuditMetricsOutput,
    AuditRequest,
    AuditResponse,
    ClaimAuditOutput,
    EvidenceOutput,
)

logger = get_logger("audit_service")


class AuditorExecutionError(Exception):
    """Raised when the internal Claim Auditor engine encounters an unrecoverable failure."""

    def __init__(self, message: str, original_error: Optional[Exception] = None) -> None:
        super().__init__(message)
        self.original_error = original_error


class AuditService:
    """Service layer encapsulating domain audit operations."""

    def __init__(self, auditor: Optional[ClaimAuditor] = None) -> None:
        self.auditor = auditor or ClaimAuditor()

    def audit(self, request: AuditRequest, request_id: str) -> AuditResponse:
        """
        Execute claim-level audit for an answer against provided evidence.
        
        Args:
            request: Validated AuditRequest schema.
            request_id: Unique correlation identifier for tracing.
            
        Returns:
            Normalized API-level AuditResponse.
        """
        t_start = time.perf_counter()
        logger.info(
            "Starting audit execution (evidence_count=%d, answer_len=%d)",
            len(request.evidence),
            len(request.answer),
            extra={"request_id": request_id},
        )

        # Convert EvidenceInput items to format expected by ClaimAuditor
        raw_evidence = []
        for idx, ev in enumerate(request.evidence, start=1):
            raw_evidence.append({
                "evidence_id": ev.evidence_id or f"EVD-{idx:03d}",
                "document_id": ev.document_id,
                "chunk_id": ev.chunk_id,
                "text": ev.text,
                "page": ev.page,
                "section": ev.section,
                "source": ev.source,
                "metadata": ev.metadata or {},
            })

        try:
            auditor_res: AuditorInternalResponse = self.auditor.audit(
                answer=request.answer,
                evidence=raw_evidence,
            )
        except Exception as exc:
            logger.error(
                "Claim Auditor execution failed: %s",
                str(exc),
                exc_info=True,
                extra={"request_id": request_id},
            )
            raise AuditorExecutionError(
                f"Claim verification failed during engine execution: {str(exc)}",
                original_error=exc,
            ) from exc

        # Map internal ClaimAuditResult list to API schema
        claims_out: list[ClaimAuditOutput] = []
        for c in auditor_res.claims:
            ev_out_list: list[EvidenceOutput] = []
            for ev in c.evidence:
                ev_out_list.append(
                    EvidenceOutput(
                        evidence_id=ev.evidence_id or "EVD-000",
                        document_id=ev.document_id,
                        chunk_id=ev.chunk_id,
                        text=ev.text,
                        page=ev.page,
                        section=ev.section,
                        source=ev.source,
                    )
                )

            claims_out.append(
                ClaimAuditOutput(
                    claim_id=c.claim_id,
                    text=c.text,
                    verdict=c.verdict.value,
                    confidence=c.confidence,
                    reason=c.reason,
                    evidence=ev_out_list,
                    checks=c.checks,
                    stage_decided=c.stage_decided,
                    is_escalated=c.is_escalated,
                )
            )

        metrics_out = AuditMetricsOutput(
            claims_total=auditor_res.metrics.total_claims,
            deterministic_count=auditor_res.metrics.deterministic_count,
            nli_count=auditor_res.metrics.nli_count,
            llm_count=auditor_res.metrics.llm_count,
            claims_supported=auditor_res.metrics.claims_supported,
            claims_contradicted=auditor_res.metrics.claims_contradicted,
            claims_partial=auditor_res.metrics.claims_partial,
            claims_not_entailed=auditor_res.metrics.claims_not_entailed,
            claims_uncertain=auditor_res.metrics.claims_uncertain,
            total_audit_latency_ms=auditor_res.metrics.total_audit_latency_ms,
        )

        total_service_latency_ms = round((time.perf_counter() - t_start) * 1000.0, 2)

        logger.info(
            "Audit completed: overall=%s, claims=%d (det=%d, nli=%d, llm=%d) in %.2fms",
            auditor_res.overall_verdict.value,
            metrics_out.claims_total,
            metrics_out.deterministic_count,
            metrics_out.nli_count,
            metrics_out.llm_count,
            total_service_latency_ms,
            extra={"request_id": request_id},
        )

        return AuditResponse(
            request_id=request_id,
            overall_verdict=auditor_res.overall_verdict.value,
            is_grounded=auditor_res.is_grounded,
            claims=claims_out,
            metrics=metrics_out,
            latency_ms=total_service_latency_ms,
        )
