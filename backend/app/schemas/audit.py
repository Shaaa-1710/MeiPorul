"""Request and response Pydantic schemas for the Audit API."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class EvidenceInput(BaseModel):
    """Input payload for a single evidence chunk."""
    evidence_id: Optional[str] = Field(default=None, description="Client or retrieval-assigned evidence identifier")
    document_id: Optional[str] = Field(default=None, description="Source document identifier")
    chunk_id: Optional[str] = Field(default=None, description="Document chunk identifier")
    text: str = Field(..., min_length=1, max_length=50_000, description="Raw text of the retrieved evidence passage")
    page: Optional[int] = Field(default=None, ge=1, description="Page number where evidence appears")
    section: Optional[str] = Field(default=None, description="Section heading or path")
    source: Optional[str] = Field(default=None, description="Source document name or URL")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Arbitrary metadata from retrieval")

    @field_validator("text")
    @classmethod
    def validate_non_empty_text(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Evidence text must not be empty or solely whitespace.")
        return cleaned


class AuditRequest(BaseModel):
    """Request payload for auditing a generated RAG answer against retrieved evidence."""
    answer: str = Field(..., min_length=1, max_length=50_000, description="Generated answer text to be verified")
    evidence: List[EvidenceInput] = Field(..., min_length=1, max_length=100, description="Retrieved evidence chunks")

    @field_validator("answer")
    @classmethod
    def validate_non_empty_answer(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Answer must not be empty or solely whitespace.")
        return cleaned


class EvidenceOutput(BaseModel):
    """Normalized evidence trace attached to a claim verdict."""
    evidence_id: str = Field(..., description="Unique evidence ID")
    document_id: Optional[str] = Field(default=None, description="Document ID")
    chunk_id: Optional[str] = Field(default=None, description="Chunk ID")
    text: str = Field(..., description="Grounding passage text")
    page: Optional[int] = Field(default=None, description="Page number")
    section: Optional[str] = Field(default=None, description="Section heading")
    source: Optional[str] = Field(default=None, description="Source URL or filename")


class ClaimAuditOutput(BaseModel):
    """Per-claim audit verdict and signals."""
    claim_id: str = Field(..., description="Atomic claim identifier (e.g. C1, C2)")
    text: str = Field(..., description="Normalized standalone text of the claim")
    verdict: str = Field(..., description="SUPPORTED | CONTRADICTED | PARTIALLY_SUPPORTED | NOT_ENTAILED | UNCERTAIN")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Calibrated confidence score")
    reason: str = Field(..., description="Explanatory justification for the verdict")
    evidence: List[EvidenceOutput] = Field(default_factory=list, description="Grounding evidence passages")
    checks: Dict[str, Any] = Field(default_factory=dict, description="Detailed check breakdown (span, entity, numeric, etc.)")
    stage_decided: str = Field(default="deterministic", description="Stage where verdict was finalized: deterministic | nli | llm")
    is_escalated: bool = Field(default=False, description="Whether this claim required LLM escalation")


class AuditMetricsOutput(BaseModel):
    """Observability metrics for the audit execution."""
    claims_total: int = Field(default=0, description="Total number of evaluated claims")
    deterministic_count: int = Field(default=0, description="Claims resolved via deterministic checks")
    nli_count: int = Field(default=0, description="Claims resolved via NLI inference")
    llm_count: int = Field(default=0, description="Claims escalated to LLM")
    claims_supported: int = Field(default=0)
    claims_contradicted: int = Field(default=0)
    claims_partial: int = Field(default=0)
    claims_not_entailed: int = Field(default=0)
    claims_uncertain: int = Field(default=0)
    total_audit_latency_ms: float = Field(default=0.0, description="Auditor execution latency in milliseconds")


class AuditResponse(BaseModel):
    """API response model for POST /api/audit."""
    request_id: str = Field(..., description="Unique request identifier")
    overall_verdict: str = Field(..., description="Synthesized overall answer verdict")
    is_grounded: bool = Field(..., description="True only if all verifiable claims are SUPPORTED")
    claims: List[ClaimAuditOutput] = Field(default_factory=list, description="Claim-level audit breakdown")
    metrics: AuditMetricsOutput = Field(default_factory=AuditMetricsOutput, description="Execution performance metrics")
    latency_ms: float = Field(default=0.0, description="Total HTTP request processing latency in milliseconds")
