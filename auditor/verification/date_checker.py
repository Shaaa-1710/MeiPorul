"""Date, temporal, duration, and numerical range verification engine."""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from auditor.models.claim import Claim
from auditor.models.evidence import EvidenceChunk
from auditor.models.verdict import VerificationSignal, VerificationStatus

MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec"
]


class DateRangeChecker:
    """Verifies years, calendar dates, temporal durations, and range intervals."""

    def __init__(self) -> None:
        self.checker_name = "date"
        self.year_regex = re.compile(r"\b(19\d{2}|20\d{2}|21\d{2})\b")
        self.range_regex = re.compile(
            r"(?:between\s+(\d+)\s+and\s+(\d+)|(\d+)\s*[-–—to]+\s*(\d+))\s*(?:years?|days?|months?|old)?",
            re.IGNORECASE,
        )
        self.duration_regex = re.compile(
            r"(?:within|in|after|before)?\s*(\d+)\s*(days?|months?|years?|weeks?|hours?)",
            re.IGNORECASE,
        )

    def extract_years(self, text: str) -> List[int]:
        """Extract 4-digit calendar years."""
        return [int(m) for m in self.year_regex.findall(text)]

    def extract_ranges(self, text: str) -> List[Tuple[int, int]]:
        """Extract numeric intervals (start, end)."""
        ranges: List[Tuple[int, int]] = []
        for m in self.range_regex.finditer(text):
            g = m.groups()
            if g[0] and g[1]:
                ranges.append((int(g[0]), int(g[1])))
            elif g[2] and g[3]:
                ranges.append((int(g[2]), int(g[3])))
        return ranges

    def extract_durations(self, text: str) -> List[Tuple[int, str]]:
        """Extract durations like (30, 'days')."""
        durations: List[Tuple[int, str]] = []
        for m in self.duration_regex.finditer(text):
            val, unit = m.groups()
            durations.append((int(val), unit.lower().rstrip("s")))
        return durations

    def check(self, claim: Claim, evidence_list: List[EvidenceChunk]) -> VerificationSignal:
        """
        Verify dates, intervals, and durations.
        Detects year substitutions (2024 vs 2025) and range shifts (18-25 vs 18-30).
        """
        if not evidence_list:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.INCONCLUSIVE,
                confidence=0.5,
                reason="No evidence provided for date/range check.",
            )

        evidence_text_combined = " ".join(ev.text for ev in evidence_list)

        # 1. Range Interval Check
        claim_ranges = self.extract_ranges(claim.text)
        evidence_ranges = self.extract_ranges(evidence_text_combined)

        if claim_ranges and evidence_ranges:
            c_r = claim_ranges[0]
            e_r = evidence_ranges[0]
            if c_r != e_r:
                return VerificationSignal(
                    checker=self.checker_name,
                    status=VerificationStatus.MISMATCH,
                    confidence=0.99,
                    reason=f"Range boundary mismatch: claim specifies {c_r[0]}–{c_r[1]}, but evidence specifies {e_r[0]}–{e_r[1]}.",
                    matched_spans=[f"{c_r[0]}-{c_r[1]}"],
                    metadata={"claim_range": c_r, "evidence_range": e_r},
                )
            else:
                return VerificationSignal(
                    checker=self.checker_name,
                    status=VerificationStatus.MATCH,
                    confidence=0.98,
                    reason=f"Range interval verified: {c_r[0]}–{c_r[1]}",
                    matched_spans=[f"{c_r[0]}-{c_r[1]}"],
                )

        # 2. Year Check
        claim_years = self.extract_years(claim.text)
        evidence_years = self.extract_years(evidence_text_combined)

        if claim_years:
            for c_yr in claim_years:
                if evidence_years and c_yr not in evidence_years:
                    return VerificationSignal(
                        checker=self.checker_name,
                        status=VerificationStatus.MISMATCH,
                        confidence=0.98,
                        reason=f"Temporal mismatch: claim specifies year {c_yr}, but evidence states {evidence_years}.",
                        matched_spans=[str(c_yr)],
                        metadata={"claim_year": c_yr, "evidence_years": evidence_years},
                    )
                elif c_yr in evidence_years:
                    return VerificationSignal(
                        checker=self.checker_name,
                        status=VerificationStatus.MATCH,
                        confidence=0.98,
                        reason=f"Calendar year {c_yr} verified in evidence.",
                        matched_spans=[str(c_yr)],
                    )

        # 3. Duration / Deadline Check (e.g. 30 days vs 60 days)
        claim_durations = self.extract_durations(claim.text)
        evidence_durations = self.extract_durations(evidence_text_combined)

        if claim_durations and evidence_durations:
            c_dur = claim_durations[0]
            e_dur = evidence_durations[0]
            if c_dur != e_dur:
                return VerificationSignal(
                    checker=self.checker_name,
                    status=VerificationStatus.MISMATCH,
                    confidence=0.98,
                    reason=f"Duration mismatch: claim specifies {c_dur[0]} {c_dur[1]}s, but evidence states {e_dur[0]} {e_dur[1]}s.",
                    matched_spans=[f"{c_dur[0]} {c_dur[1]}"],
                    metadata={"claim_duration": c_dur, "evidence_duration": e_dur},
                )

        if not claim_years and not claim_ranges and not claim_durations:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.NEUTRAL,
                confidence=1.0,
                reason="No explicit date, year, or range found in claim.",
            )

        return VerificationSignal(
            checker=self.checker_name,
            status=VerificationStatus.INCONCLUSIVE,
            confidence=0.5,
            reason="Date/range check inconclusive; passing to semantic evaluation.",
        )
