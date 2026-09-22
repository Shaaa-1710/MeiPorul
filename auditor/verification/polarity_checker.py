"""Polarity and negation verification engine for detecting logical contradiction flips."""

from __future__ import annotations

import re
from typing import List, Tuple

from auditor.models.claim import Claim
from auditor.models.evidence import EvidenceChunk
from auditor.models.verdict import VerificationSignal, VerificationStatus

NEGATION_TERMS = [
    r"\bnot\b", r"\bnever\b", r"\bno\b", r"\bdoes\s+not\b", r"\bdo\s+not\b",
    r"\bdid\s+not\b", r"\bcannot\b", r"\bcan't\b", r"\bwithout\b", r"\bneither\b",
    r"\bnor\b", r"\bprohibited\b", r"\bforbidden\b", r"\bdisallowed\b"
]

ANTONYM_POLARITY_PAIRS: List[Tuple[str, str]] = [
    ("required", "optional"),
    ("mandatory", "optional"),
    ("allowed", "prohibited"),
    ("permitted", "prohibited"),
    ("compulsory", "voluntary"),
    ("eligible", "ineligible"),
    ("covered", "excluded"),
]


class PolarityChecker:
    """Verifies logical assertion polarity and catches adversarial negation flips."""

    def __init__(self) -> None:
        self.checker_name = "polarity"
        self.neg_regex = re.compile("|".join(NEGATION_TERMS), re.IGNORECASE)

    def _has_explicit_negation(self, text: str) -> bool:
        """Check if text contains explicit negative polarity particles."""
        return bool(self.neg_regex.search(text))

    def check(self, claim: Claim, evidence_list: List[EvidenceChunk]) -> VerificationSignal:
        """
        Check for polarity mismatch or negation flip between claim and evidence.
        """
        if not evidence_list:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.INCONCLUSIVE,
                confidence=0.5,
                reason="No evidence provided for polarity check.",
            )

        evidence_text_combined = " ".join(ev.text for ev in evidence_list)

        claim_neg = self._has_explicit_negation(claim.text)
        evidence_neg = self._has_explicit_negation(evidence_text_combined)

        # 1. Check Antonym Polarity Pairs (e.g. required vs optional, prohibited vs allowed)
        claim_lower = claim.text.lower()
        ev_lower = evidence_text_combined.lower()

        for term_a, term_b in ANTONYM_POLARITY_PAIRS:
            if (term_a in claim_lower and term_b in ev_lower) or (term_b in claim_lower and term_a in ev_lower):
                return VerificationSignal(
                    checker=self.checker_name,
                    status=VerificationStatus.MISMATCH,
                    confidence=0.98,
                    reason=f"Polarity flip detected: claim uses '{term_a if term_a in claim_lower else term_b}', but evidence asserts opposite '{term_b if term_a in claim_lower else term_a}'.",
                    matched_spans=[term_a if term_a in claim_lower else term_b],
                )

        # 2. Check Explicit Negation Flip when content words match heavily
        if claim_neg != evidence_neg:
            # Check lexical similarity of non-negation words
            claim_tokens = {w for w in re.findall(r"\w+", claim_lower) if not self._has_explicit_negation(w)}
            ev_tokens = {w for w in re.findall(r"\w+", ev_lower) if not self._has_explicit_negation(w)}
            if claim_tokens:
                overlap = len(claim_tokens.intersection(ev_tokens)) / len(claim_tokens)
                if overlap >= 0.5:
                    flip_direction = "claim is positive while evidence is negative" if evidence_neg else "claim is negative while evidence is positive"
                    return VerificationSignal(
                        checker=self.checker_name,
                        status=VerificationStatus.MISMATCH,
                        confidence=0.96,
                        reason=f"Negation contradiction detected ({flip_direction}): '{claim.text}' vs '{evidence_text_combined}'.",
                        matched_spans=[m.group() for m in self.neg_regex.finditer(claim.text if claim_neg else evidence_text_combined)],
                    )

        return VerificationSignal(
            checker=self.checker_name,
            status=VerificationStatus.MATCH,
            confidence=0.9,
            reason="Polarity aligned between claim and evidence.",
        )
