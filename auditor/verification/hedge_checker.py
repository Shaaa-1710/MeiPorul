"""Hedge, epistemic certainty, and modality verification engine."""

from __future__ import annotations

import re
from typing import List, Set

from auditor.models.claim import Claim
from auditor.models.evidence import EvidenceChunk
from auditor.models.verdict import VerificationSignal, VerificationStatus

APPROXIMATION_HEDGES: Set[str] = {
    "approximately", "about", "around", "generally", "usually", "typically",
    "roughly", "estimated", "nearly", "almost"
}

EXACTNESS_MARKERS: Set[str] = {
    "exactly", "precisely", "strictly", "specifically"
}

UPTO_MARKERS: Set[str] = {
    "up to", "maximum of", "capped at", "not exceeding"
}

ATLEAST_MARKERS: Set[str] = {
    "at least", "minimum of", "no less than"
}


class HedgeChecker:
    """Verifies certainty qualifiers, epistemic hedging, and upper/lower bound semantics."""

    def __init__(self) -> None:
        self.checker_name = "hedge"

    def _extract_hedges(self, text: str) -> Set[str]:
        """Extract hedge keywords and certainty markers."""
        lower = text.lower()
        found: Set[str] = set()

        for h in APPROXIMATION_HEDGES:
            if re.search(rf"\b{re.escape(h)}\b", lower):
                found.add("approximate")

        for em in EXACTNESS_MARKERS:
            if re.search(rf"\b{re.escape(em)}\b", lower):
                found.add("exact")

        for um in UPTO_MARKERS:
            if re.search(rf"\b{re.escape(um)}\b", lower):
                found.add("up_to")

        for am in ATLEAST_MARKERS:
            if re.search(rf"\b{re.escape(am)}\b", lower):
                found.add("at_least")

        return found

    def check(self, claim: Claim, evidence_list: List[EvidenceChunk]) -> VerificationSignal:
        """
        Verify that the claim preserves evidence hedge precision and boundary markers.
        """
        if not evidence_list:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.INCONCLUSIVE,
                confidence=0.5,
                reason="No evidence provided for hedge check.",
            )

        evidence_text_combined = " ".join(ev.text for ev in evidence_list)

        claim_hedges = self._extract_hedges(claim.text)
        evidence_hedges = self._extract_hedges(evidence_text_combined)

        # 1. Check approximate vs exact mismatch (e.g. approximately 10 days vs exactly 10 days)
        if "exact" in claim_hedges and "approximate" in evidence_hedges:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.MISMATCH,
                confidence=0.92,
                reason="Certainty mismatch: claim asserts exact precision ('exactly') but evidence specifies approximation ('approximately'/'generally').",
                matched_spans=["exactly"],
                metadata={"claim_hedges": list(claim_hedges), "evidence_hedges": list(evidence_hedges)},
            )

        if "approximate" in claim_hedges and "exact" in evidence_hedges:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.MISMATCH,
                confidence=0.88,
                reason="Certainty mismatch: claim hedges with approximation whereas evidence specifies exact value.",
                matched_spans=["approximate"],
            )

        # 2. Check 'up to' bound vs unconditional exact claim (e.g. up to ₹1 lakh vs ₹1 lakh)
        if "up_to" in evidence_hedges and "up_to" not in claim_hedges:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.MISMATCH,
                confidence=0.90,
                reason="Bound mismatch: evidence states 'up to' (ceiling amount) but claim states an unconditional exact amount.",
                matched_spans=["up to"],
                metadata={"issue": "dropped_upper_bound"},
            )

        # 3. Check 'at least' bound vs unconditional claim
        if "at_least" in evidence_hedges and "at_least" not in claim_hedges:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.MISMATCH,
                confidence=0.88,
                reason="Bound mismatch: evidence states 'at least' (floor amount) but claim states an unconditional exact amount.",
                matched_spans=["at least"],
            )

        return VerificationSignal(
            checker=self.checker_name,
            status=VerificationStatus.MATCH,
            confidence=0.95,
            reason="Hedges and certainty qualifiers are semantically aligned.",
        )
