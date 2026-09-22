"""Tests for structural numeric and unit verification."""

import pytest
from auditor.models import Claim, EvidenceChunk
from auditor.verification import NumericChecker


def test_numeric_substitution_detection():
    checker = NumericChecker()
    claim = Claim(claim_id="C1", text="The scheme provides ₹55,000.")
    evidence = [EvidenceChunk(text="The scheme provides ₹50,000.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MISMATCH"
    assert "₹55,000" in sig.reason


def test_unit_mismatch_contradiction():
    checker = NumericChecker()
    claim = Claim(claim_id="C1", text="Storage capacity is 2 MB.")
    evidence = [EvidenceChunk(text="Storage capacity is 2 TB.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MISMATCH"


def test_unit_equivalent_conversion():
    checker = NumericChecker()
    claim = Claim(claim_id="C1", text="Storage capacity is 2000 GB.")
    evidence = [EvidenceChunk(text="Storage capacity is 2 TB.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MATCH"


def test_indian_numbering_lakh_equivalence():
    checker = NumericChecker()
    claim = Claim(claim_id="C1", text="The sanction amount is ₹500,000.")
    evidence = [EvidenceChunk(text="The sanction amount is ₹5 lakh.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MATCH"
