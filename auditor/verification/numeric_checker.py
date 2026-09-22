"""Structural numeric, unit, currency, and range verification engine."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from auditor.models.claim import Claim
from auditor.models.evidence import EvidenceChunk
from auditor.models.verdict import VerificationSignal, VerificationStatus

# Multipliers for Indian and international numerical scales
SCALE_MULTIPLIERS: Dict[str, float] = {
    "lakh": 100_000.0,
    "lakhs": 100_000.0,
    "lac": 100_000.0,
    "lacs": 100_000.0,
    "crore": 10_000_000.0,
    "crores": 10_000_000.0,
    "cr": 10_000_000.0,
    "k": 1_000.0,
    "thousand": 1_000.0,
    "m": 1_000_000.0,
    "million": 1_000_000.0,
    "b": 1_000_000_000.0,
    "billion": 1_000_000_000.0,
}

# Unit conversions to base units (e.g. Bytes)
STORAGE_UNITS: Dict[str, float] = {
    "b": 1.0,
    "bytes": 1.0,
    "kb": 1_000.0,
    "mb": 1_000_000.0,
    "gb": 1_000_000_000.0,
    "tb": 1_000_000_000_000.0,
    "kib": 1024.0,
    "mib": 1024.0 ** 2,
    "gib": 1024.0 ** 3,
    "tib": 1024.0 ** 4,
}


class NumericFact:
    """Parsed structured numeric representation."""

    def __init__(
        self,
        raw: str,
        value: float,
        unit: str = "",
        currency: str = "",
        operator: str = "exact",
        is_percentage: bool = False,
    ) -> None:
        self.raw = raw
        self.value = value
        self.unit = unit.lower()
        self.currency = currency.upper()
        self.operator = operator.lower()
        self.is_percentage = is_percentage

    def __repr__(self) -> str:
        return f"NumericFact(val={self.value}, unit='{self.unit}', cur='{self.currency}', op='{self.operator}')"


class NumericChecker:
    """Verifies numeric quantities, currencies, scales, units, and mathematical equivalence."""

    def __init__(self) -> None:
        self.checker_name = "numeric"
        self._pattern = re.compile(
            r"(?P<operator>up\s+to|at\s+least|at\s+most|more\s+than|greater\s+than|less\s+than|approximately|about|around|exactly)?"
            r"\s*(?P<currency>₹|INR|Rs\.?|\$|€|£)?"
            r"\s*(?P<number>\d+(?:,\d+)*(?:\.\d+)?)"
            r"\s*(?P<scale>lakhs?|crores?|cr|lac|lacs|thousand|million|billion)?"
            r"\s*(?P<unit>TB|GB|MB|KB|TiB|GiB|MiB|KiB|bytes?|%|percent|days?|months?|years?|hrs?|hours?|mins?|minutes?)?",
            re.IGNORECASE,
        )

    def parse_numeric_facts(self, text: str) -> List[NumericFact]:
        """Extract and structurally normalize all numeric facts in a text string."""
        facts: List[NumericFact] = []
        for m in self._pattern.finditer(text):
            num_str = m.group("number")
            if not num_str:
                continue

            clean_num_str = num_str.replace(",", "")
            try:
                base_val = float(clean_num_str)
            except ValueError:
                continue

            scale_str = (m.group("scale") or "").strip().lower()
            unit_str = (m.group("unit") or "").strip().lower()
            cur_str = (m.group("currency") or "").strip()
            op_str = (m.group("operator") or "exact").strip().lower()

            # Normalize currency markers
            if cur_str in ["₹", "INR", "Rs", "Rs."]:
                currency = "INR"
            elif cur_str in ["$"]:
                currency = "USD"
            elif cur_str in ["€"]:
                currency = "EUR"
            elif cur_str in ["£"]:
                currency = "GBP"
            else:
                currency = ""

            # Check if scale was captured as part of unit or scale group
            multiplier = 1.0
            if scale_str in SCALE_MULTIPLIERS:
                multiplier = SCALE_MULTIPLIERS[scale_str]
            elif unit_str in SCALE_MULTIPLIERS:
                multiplier = SCALE_MULTIPLIERS[unit_str]
                unit_str = ""

            final_val = base_val * multiplier
            is_pct = "%" in unit_str or "percent" in unit_str

            facts.append(
                NumericFact(
                    raw=m.group(0).strip(),
                    value=final_val,
                    unit=unit_str,
                    currency=currency,
                    operator=op_str,
                    is_percentage=is_pct,
                )
            )
        return facts

    def _are_equivalent(self, nf1: NumericFact, nf2: NumericFact) -> Tuple[bool, str]:
        """Determine mathematical and unit equivalence between two numeric facts."""
        # 1. Check currency consistency
        if nf1.currency and nf2.currency and nf1.currency != nf2.currency:
            return False, f"Currency mismatch: {nf1.currency} vs {nf2.currency}"

        # 2. Check storage unit conversions (e.g. 2 TB vs 2000 GB or 2048 GB)
        if nf1.unit in STORAGE_UNITS and nf2.unit in STORAGE_UNITS:
            base1 = nf1.value * STORAGE_UNITS[nf1.unit]
            base2 = nf2.value * STORAGE_UNITS[nf2.unit]
            # Support decimal (1000) or binary (1024) conversions within 2.5% tolerance
            if abs(base1 - base2) / max(base1, base2, 1.0) < 0.05:
                return True, "Storage unit values match via conversion"
            return False, f"Storage capacity mismatch: {nf1.raw} vs {nf2.raw}"

        # 3. Direct unit check
        if nf1.unit and nf2.unit and nf1.unit != nf2.unit:
            return False, f"Unit mismatch: '{nf1.unit}' vs '{nf2.unit}'"

        # 4. Direct value check
        if abs(nf1.value - nf2.value) < 1e-5:
            return True, f"Numeric values match: {nf1.value}"

        return False, f"Numeric value mismatch: claim asserts {nf1.value} ({nf1.raw}) but evidence states {nf2.value} ({nf2.raw})"

    def check(self, claim: Claim, evidence_list: List[EvidenceChunk]) -> VerificationSignal:
        """
        Verify that numerical quantities in the claim are grounded in evidence.
        Catches minimal numeric perturbations (e.g. ₹50,000 -> ₹55,000).
        """
        if not evidence_list:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.INCONCLUSIVE,
                confidence=0.5,
                reason="No evidence provided for numeric check.",
            )

        claim_facts = self.parse_numeric_facts(claim.text)
        if not claim_facts:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.NEUTRAL,
                confidence=1.0,
                reason="No numeric quantities present in claim.",
            )

        evidence_text_combined = " ".join(ev.text for ev in evidence_list)
        evidence_facts = self.parse_numeric_facts(evidence_text_combined)

        if not evidence_facts:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.INCONCLUSIVE,
                confidence=0.5,
                reason=f"Claim asserts numeric value '{claim_facts[0].raw}', but no corresponding numbers found in evidence passages.",
                matched_spans=[cf.raw for cf in claim_facts],
            )

        for c_fact in claim_facts:
            match_found = False
            reasons = []

            for e_fact in evidence_facts:
                eq, reason = self._are_equivalent(c_fact, e_fact)
                if eq:
                    match_found = True
                    break
                else:
                    reasons.append(reason)

            if not match_found:
                # Direct numeric contradiction
                return VerificationSignal(
                    checker=self.checker_name,
                    status=VerificationStatus.MISMATCH,
                    confidence=0.99,
                    reason=f"Numeric contradiction: claim states '{c_fact.raw}' whereas evidence contains {', '.join([ef.raw for ef in evidence_facts])}.",
                    matched_spans=[c_fact.raw],
                    metadata={"claim_val": c_fact.value, "evidence_vals": [ef.value for ef in evidence_facts]},
                )

        return VerificationSignal(
            checker=self.checker_name,
            status=VerificationStatus.MATCH,
            confidence=0.98,
            reason=f"All numeric facts verified: {[cf.raw for cf in claim_facts]}",
            matched_spans=[cf.raw for cf in claim_facts],
        )
