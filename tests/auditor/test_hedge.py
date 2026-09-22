"""Tests for hedge, epistemic certainty, and bound qualifiers."""

import pytest
from auditor.models import Claim, EvidenceChunk
from auditor.verification import HedgeChecker


def test_approximate_to_exact_mismatch():
    checker = HedgeChecker()
    claim = Claim(claim_id="C1", text="Applications are processed in exactly 10 days.")
    evidence = [EvidenceChunk(text="Applications are generally processed in approximately 10 days.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MISMATCH"
    assert "exact" in sig.reason.lower() or "approximately" in sig.reason.lower()


def test_dropped_upto_bound_mismatch():
    checker = HedgeChecker()
    claim = Claim(claim_id="C1", text="Participants receive ₹1 lakh.")
    evidence = [EvidenceChunk(text="Participants can receive up to ₹1 lakh.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MISMATCH"
    assert sig.metadata.get("issue") == "dropped_upper_bound"
