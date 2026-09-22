"""Verdict aggregator for synthesizing claim-level and answer-level audit reports."""

from __future__ import annotations

from typing import Dict, List

from auditor.models.claim import Claim
from auditor.models.evidence import EvidenceChunk
from auditor.models.verdict import (
    AuditMetrics,
    AuditResponse,
    ClaimAuditResult,
    VerificationSignal,
    VerificationStatus,
    VerdictType,
)
from auditor.verdict.rules import VerdictRulesEngine


class VerdictAggregator:
    """Aggregates verification signals into strongly typed audit results."""

    def __init__(self) -> None:
        self.rules_engine = VerdictRulesEngine()

    def format_checks_summary(
        self, signals: Dict[str, VerificationSignal], nli_signal: VerificationSignal | None = None
    ) -> Dict[str, Any]:
        """Produce a clean, human-readable check outcome map."""
        checks: Dict[str, Any] = {}
        for name, sig in signals.items():
            if sig.status == VerificationStatus.MATCH:
                checks[name] = True
            elif sig.status == VerificationStatus.MISMATCH:
                checks[name] = False
            elif sig.status == VerificationStatus.NEUTRAL:
                checks[name] = "neutral"
            else:
                checks[name] = "inconclusive"

        if nli_signal:
            nli_class = nli_signal.metadata.get("class", "NEUTRAL")
            checks["nli"] = nli_class
        else:
            checks["nli"] = "SKIPPED_DETERMINISTIC"

        return checks

    def aggregate_claim(
        self,
        claim: Claim,
        evidence_list: List[EvidenceChunk],
        signals: Dict[str, VerificationSignal],
        nli_signal: VerificationSignal | None = None,
        stage_decided: str = "deterministic",
        is_escalated: bool = False,
    ) -> ClaimAuditResult:
        """Synthesize a complete ClaimAuditResult for a single atomic claim."""
        # Check deterministic signals first
        det_verdict, det_conf, det_reason = self.rules_engine.evaluate_deterministic_signals(
            signals, claim, evidence_list
        )

        if det_verdict is not None:
            final_verdict = det_verdict
            confidence = det_conf
            reason = det_reason
            stage = "deterministic"
        elif nli_signal is not None:
            final_verdict, confidence, reason = self.rules_engine.evaluate_nli_signal(
                nli_signal, claim, evidence_list
            )
            stage = "nli"
        else:
            final_verdict = VerdictType.UNCERTAIN
            confidence = 0.5
            reason = "Verification inconclusive across all checks."
            stage = stage_decided

        checks_map = self.format_checks_summary(signals, nli_signal if stage != "deterministic" else None)

        return ClaimAuditResult(
            claim_id=claim.claim_id,
            text=claim.text,
            verdict=final_verdict,
            confidence=confidence,
            reason=reason,
            evidence=evidence_list,
            checks=checks_map,
            signals=list(signals.values()) + ([nli_signal] if nli_signal else []),
            stage_decided=stage,
            is_escalated=is_escalated,
        )

    def synthesize_response(
        self, answer: str, claim_results: List[ClaimAuditResult], metrics: AuditMetrics
    ) -> AuditResponse:
        """Synthesize final answer-level AuditResponse."""
        if not claim_results:
            return AuditResponse(
                answer=answer,
                claims=[],
                overall_verdict=VerdictType.SUPPORTED,
                is_grounded=True,
                metrics=metrics,
            )

        # Count verdicts
        verdict_counts = {v: 0 for v in VerdictType}
        for cr in claim_results:
            verdict_counts[cr.verdict] += 1

        metrics.total_claims = len(claim_results)
        metrics.claims_supported = verdict_counts[VerdictType.SUPPORTED]
        metrics.claims_contradicted = verdict_counts[VerdictType.CONTRADICTED]
        metrics.claims_partial = verdict_counts[VerdictType.PARTIALLY_SUPPORTED]
        metrics.claims_not_entailed = verdict_counts[VerdictType.NOT_ENTAILED]
        metrics.claims_uncertain = verdict_counts[VerdictType.UNCERTAIN]

        # Determine overall verdict priority:
        # CONTRADICTED > PARTIALLY_SUPPORTED > NOT_ENTAILED > UNCERTAIN > SUPPORTED
        if verdict_counts[VerdictType.CONTRADICTED] > 0:
            overall = VerdictType.CONTRADICTED
            is_grounded = False
        elif verdict_counts[VerdictType.PARTIALLY_SUPPORTED] > 0:
            overall = VerdictType.PARTIALLY_SUPPORTED
            is_grounded = False
        elif verdict_counts[VerdictType.NOT_ENTAILED] > 0:
            overall = VerdictType.NOT_ENTAILED
            is_grounded = False
        elif verdict_counts[VerdictType.UNCERTAIN] > 0:
            overall = VerdictType.UNCERTAIN
            is_grounded = False
        else:
            overall = VerdictType.SUPPORTED
            is_grounded = True

        return AuditResponse(
            answer=answer,
            claims=claim_results,
            overall_verdict=overall,
            is_grounded=is_grounded,
            metrics=metrics,
        )
