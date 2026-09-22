"""Tests for date, year, and range boundary verification."""

import pytest
from auditor.models import Claim, EvidenceChunk
from auditor.verification import DateRangeChecker


def test_year_substitution_detection():
    checker = DateRangeChecker()
    claim = Claim(claim_id="C1", text="The program launched in 2024.")
    evidence = [EvidenceChunk(text="The program launched in 2025.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MISMATCH"


def test_duration_substitution_detection():
    checker = DateRangeChecker()
    claim = Claim(claim_id="C1", text="Applications must be submitted within 60 days.")
    evidence = [EvidenceChunk(text="Applications must be submitted within 30 days.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MISMATCH"


def test_range_boundary_expansion_detection():
    checker = DateRangeChecker()
    claim = Claim(claim_id="C1", text="Applicants must be between 18 and 30 years old.")
    evidence = [EvidenceChunk(text="Applicants must be between 18 and 25 years old.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MISMATCH"
