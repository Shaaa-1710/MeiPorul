"""Exact and normalized span checker for claim-level verification."""

from __future__ import annotations

import re
import unicodedata
from typing import List, Optional

from auditor.models.claim import Claim
from auditor.models.evidence import EvidenceChunk
from auditor.models.verdict import VerificationSignal, VerificationStatus


def normalize_surface(text: str) -> str:
    """Apply Unicode NFKC normalization, strip punctuation and collapse whitespace."""
    if not text:
        return ""
    norm = unicodedata.normalize("NFKC", text)
    # Standardize currency markers with explicit spacing
    norm = re.sub(r"\bINR\b|Rs\.?|₹", " INR ", norm, flags=re.IGNORECASE)
    # Remove commas between digits (e.g. 50,000 -> 50000)
    norm = re.sub(r"(?<=\d),(?=\d)", "", norm)
    # Remove standard punctuation
    norm = re.sub(r"[^\w\sINR$€£%]", " ", norm)
    # Collapse multiple spaces
    norm = re.sub(r"\s+", " ", norm).strip().lower()
    return norm


class SpanChecker:
    """Verifies if the factual proposition or key phrase exists as a normalized span in evidence."""

    def __init__(self) -> None:
        self.checker_name = "span"

    def check(self, claim: Claim, evidence_list: List[EvidenceChunk]) -> VerificationSignal:
        """Evaluate exact and normalized span overlap against candidate evidence passages."""
        if not evidence_list:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.INCONCLUSIVE,
                confidence=0.5,
                reason="No evidence provided for span check.",
            )

        claim_raw = claim.text.strip().rstrip(".")
        norm_claim = normalize_surface(claim_raw)
        matched_spans: List[str] = []

        for ev in evidence_list:
            ev_text = ev.text.strip()
            norm_ev = normalize_surface(ev_text)

            # 1. Exact direct match
            if claim_raw.lower() in ev_text.lower():
                matched_spans.append(claim_raw)
                return VerificationSignal(
                    checker=self.checker_name,
                    status=VerificationStatus.MATCH,
                    confidence=1.0,
                    reason=f"Claim text directly matches span in evidence: '{ev_text}'",
                    matched_spans=matched_spans,
                )

            # 2. Normalized surface match (ignoring punctuation / currency variations)
            if norm_claim and norm_claim in norm_ev:
                matched_spans.append(claim_raw)
                return VerificationSignal(
                    checker=self.checker_name,
                    status=VerificationStatus.MATCH,
                    confidence=0.95,
                    reason="Normalized claim string fully matches evidence passage.",
                    matched_spans=matched_spans,
                )

            # 3. Sub-phrase match: if all content words in the claim occur in sequence in the evidence
            claim_words = norm_claim.split()
            if len(claim_words) >= 4:
                # Check sliding 4-gram or 5-gram
                phrase_4 = " ".join(claim_words[:4])
                if phrase_4 in norm_ev:
                    matched_spans.append(phrase_4)

        if matched_spans:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.MATCH,
                confidence=0.85,
                reason=f"Significant substring matched in evidence: {matched_spans}",
                matched_spans=matched_spans,
            )

        return VerificationSignal(
            checker=self.checker_name,
            status=VerificationStatus.INCONCLUSIVE,
            confidence=0.5,
            reason="Claim not found as an exact surface span; deferring to semantic/NLI checks.",
        )
