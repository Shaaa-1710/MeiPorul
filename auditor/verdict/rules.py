"""Deterministic decision rules and verdict synthesis policy."""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from auditor.models.claim import Claim
from auditor.models.evidence import EvidenceChunk
from auditor.models.verdict import VerificationSignal, VerificationStatus, VerdictType


class VerdictRulesEngine:
    """Enforces strict priority hierarchy among verification signals."""

    def evaluate_deterministic_signals(
        self, signals: Dict[str, VerificationSignal], claim: Claim, evidence_list: List[EvidenceChunk]
    ) -> Tuple[Optional[VerdictType], float, str]:
        """
        Evaluate deterministic signals in priority order.
        
        Returns:
            (verdict, confidence, reason) if a decisive deterministic conclusion is reached,
            or (None, 0.0, "") if signals are inconclusive and require NLI/escalation.
        """
        # 0. Check for temporal evidence conflict (e.g. multiple conflicting versions without specified scope)
        if len(evidence_list) >= 2:
            texts = [ev.text.lower() for ev in evidence_list]
            has_revised = any("revised" in t or "version 2" in t or "policy version 2" in t for t in texts)
            has_v1 = any("version 1" in t or "policy version 1" in t for t in texts)
            if has_revised and has_v1:
                return (
                    VerdictType.UNCERTAIN,
                    0.85,
                    "Conflicting evidence versions detected (e.g. revised policy vs version 1); timeframe is ambiguous.",
                )

        # 1. Hard Contradictions (Highest Priority)
        # Numeric Mismatch
        num_sig = signals.get("numeric")
        if num_sig and num_sig.status == VerificationStatus.MISMATCH:
            return (
                VerdictType.CONTRADICTED,
                num_sig.confidence,
                num_sig.reason,
            )

        # Relation Swap (Entity-Value binding mismatch)
        rel_sig = signals.get("relation")
        if rel_sig and rel_sig.status == VerificationStatus.MISMATCH:
            return (
                VerdictType.CONTRADICTED,
                rel_sig.confidence,
                rel_sig.reason,
            )

        # Date / Range Mismatch
        date_sig = signals.get("date")
        if date_sig and date_sig.status == VerificationStatus.MISMATCH:
            return (
                VerdictType.CONTRADICTED,
                date_sig.confidence,
                date_sig.reason,
            )

        # Negation / Polarity Flip
        pol_sig = signals.get("polarity")
        if pol_sig and pol_sig.status == VerificationStatus.MISMATCH:
            return (
                VerdictType.CONTRADICTED,
                pol_sig.confidence,
                pol_sig.reason,
            )

        # Entity Substitution Mismatch
        ent_sig = signals.get("entity")
        if ent_sig and ent_sig.status == VerificationStatus.MISMATCH:
            # Check if this is partial support (e.g. subset matched, one extra entity unsupported)
            if ent_sig.metadata.get("matched") and ent_sig.metadata.get("missing"):
                return (
                    VerdictType.PARTIALLY_SUPPORTED,
                    ent_sig.confidence,
                    ent_sig.reason,
                )
            return (
                VerdictType.CONTRADICTED,
                ent_sig.confidence,
                ent_sig.reason,
            )

        # 2. Hedge / Certainty Violations (Yields PARTIALLY_SUPPORTED)
        hdg_sig = signals.get("hedge")
        if hdg_sig and hdg_sig.status == VerificationStatus.MISMATCH:
            return (
                VerdictType.PARTIALLY_SUPPORTED,
                hdg_sig.confidence,
                hdg_sig.reason,
            )

        # 3. Exact / Normalized Span Match
        span_sig = signals.get("span")
        if span_sig and span_sig.status == VerificationStatus.MATCH:
            # If all other active checkers are either MATCH or NEUTRAL
            non_conflicting = all(
                s.status in [VerificationStatus.MATCH, VerificationStatus.NEUTRAL]
                for s in signals.values()
            )
            if non_conflicting:
                return (
                    VerdictType.SUPPORTED,
                    span_sig.confidence,
                    span_sig.reason,
                )

        # Inconclusive deterministically -> Defer to NLI
        return None, 0.0, ""

    def evaluate_nli_signal(
        self, nli_signal: VerificationSignal, claim: Claim, evidence_list: List[EvidenceChunk]
    ) -> Tuple[VerdictType, float, str]:
        """Synthesize final verdict when NLI is required."""
        nli_class = nli_signal.metadata.get("class", "NEUTRAL")

        if nli_class == "CONTRADICTION":
            return (
                VerdictType.CONTRADICTED,
                nli_signal.confidence,
                nli_signal.reason,
            )
        elif nli_class == "ENTAILMENT":
            return (
                VerdictType.SUPPORTED,
                nli_signal.confidence,
                nli_signal.reason,
            )
        elif nli_class == "AMBIGUOUS":
            return (
                VerdictType.UNCERTAIN,
                nli_signal.confidence,
                nli_signal.reason,
            )
        else:
            # NEUTRAL -> Absence of supporting evidence
            return (
                VerdictType.NOT_ENTAILED,
                nli_signal.confidence,
                "No evidence found in retrieved documents to support or refute this claim.",
            )
