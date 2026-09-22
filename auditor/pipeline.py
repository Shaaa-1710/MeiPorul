"""Main entry point for the Claim-Level Auditor pipeline."""

from __future__ import annotations

import time
from typing import Any, List, Optional, Union

from auditor.decomposition import ClaimDecomposer
from auditor.evidence import EvidenceSelector
from auditor.models import (
    AuditMetrics,
    AuditResponse,
    Claim,
    ClaimAuditResult,
    EvidenceChunk,
    VerificationSignal,
    VerdictType,
)
from auditor.nli import NLIVerifier
from auditor.verdict import VerdictAggregator, VerdictRulesEngine
from auditor.verification import (
    DateRangeChecker,
    EntityChecker,
    HedgeChecker,
    NumericChecker,
    PolarityChecker,
    RelationChecker,
    SpanChecker,
)


class ClaimAuditor:
    """
    Production-grade Claim-Level Auditor engine.
    
    Accepts:
        Generated RAG Answer + Retrieved Evidence Passages
    Produces:
        Atomic Claims + Per-claim verification signals + Grounding Evidence + Final Verdicts + Observability Telemetry
    """

    def __init__(
        self,
        decomposer: Optional[ClaimDecomposer] = None,
        evidence_selector: Optional[EvidenceSelector] = None,
        nli_verifier: Optional[NLIVerifier] = None,
    ) -> None:
        self.decomposer = decomposer or ClaimDecomposer()
        self.selector = evidence_selector or EvidenceSelector()
        self.nli_verifier = nli_verifier or NLIVerifier()
        self.aggregator = VerdictAggregator()
        self.rules_engine = VerdictRulesEngine()

        # Deterministic verification cascade
        self.span_checker = SpanChecker()
        self.entity_checker = EntityChecker()
        self.numeric_checker = NumericChecker()
        self.date_checker = DateRangeChecker()
        self.polarity_checker = PolarityChecker()
        self.hedge_checker = HedgeChecker()
        self.relation_checker = RelationChecker()

    def audit(
        self,
        answer: str,
        evidence: List[Union[EvidenceChunk, dict[str, Any], str]],
    ) -> AuditResponse:
        """
        Execute complete verification cascade on a generated answer against evidence.
        """
        t_start = time.perf_counter()
        metrics = AuditMetrics()

        # 1. Claim Decomposition Phase
        t_decomp_start = time.perf_counter()
        claims = self.decomposer.decompose(answer)
        metrics.decomposition_latency_ms = round((time.perf_counter() - t_decomp_start) * 1000.0, 2)

        # Normalize evidence passages
        normalized_evidence = self.selector.normalize_evidence_list(evidence)

        claim_results: List[ClaimAuditResult] = []
        det_latency_acc = 0.0
        nli_latency_acc = 0.0
        llm_latency_acc = 0.0

        for claim in claims:
            # 2. Evidence Selection for Claim
            best_evidence = self.selector.select_best_evidence(claim, normalized_evidence, top_k=2)

            # 3. Deterministic Verification Cascade
            t_det_start = time.perf_counter()
            signals: dict[str, VerificationSignal] = {}

            signals["span"] = self.span_checker.check(claim, best_evidence)
            signals["entity"] = self.entity_checker.check(claim, best_evidence)
            signals["numeric"] = self.numeric_checker.check(claim, best_evidence)
            signals["date"] = self.date_checker.check(claim, best_evidence)
            signals["polarity"] = self.polarity_checker.check(claim, best_evidence)
            signals["hedge"] = self.hedge_checker.check(claim, best_evidence)
            signals["relation"] = self.relation_checker.check(claim, best_evidence)

            det_latency_acc += (time.perf_counter() - t_det_start) * 1000.0

            # 4. Check if deterministically decisive
            det_verdict, _, _ = self.rules_engine.evaluate_deterministic_signals(
                signals, claim, best_evidence
            )

            if det_verdict is not None:
                # Decisive without NLI
                metrics.deterministic_count += 1
                res = self.aggregator.aggregate_claim(
                    claim=claim,
                    evidence_list=best_evidence,
                    signals=signals,
                    nli_signal=None,
                    stage_decided="deterministic",
                )
                claim_results.append(res)
                continue

            # 5. Lightweight NLI Inference
            t_nli_start = time.perf_counter()
            nli_signal = self.nli_verifier.verify_claim(claim, best_evidence)
            nli_latency_acc += (time.perf_counter() - t_nli_start) * 1000.0

            nli_class = nli_signal.metadata.get("class", "NEUTRAL")
            if nli_class in ["ENTAILMENT", "CONTRADICTION", "NEUTRAL"]:
                metrics.nli_count += 1
                res = self.aggregator.aggregate_claim(
                    claim=claim,
                    evidence_list=best_evidence,
                    signals=signals,
                    nli_signal=nli_signal,
                    stage_decided="nli",
                )
                claim_results.append(res)
            else:
                # Ambiguous -> LLM Escalation Route
                metrics.llm_count += 1
                res = self.aggregator.aggregate_claim(
                    claim=claim,
                    evidence_list=best_evidence,
                    signals=signals,
                    nli_signal=nli_signal,
                    stage_decided="llm",
                    is_escalated=True,
                )
                claim_results.append(res)

        metrics.deterministic_latency_ms = round(det_latency_acc, 2)
        metrics.nli_latency_ms = round(nli_latency_acc, 2)
        metrics.llm_latency_ms = round(llm_latency_acc, 2)
        metrics.total_audit_latency_ms = round((time.perf_counter() - t_start) * 1000.0, 2)

        return self.aggregator.synthesize_response(answer, claim_results, metrics)
