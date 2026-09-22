"""Tests for exact and normalized span checker and locator."""

import pytest
from auditor.evidence import SpanLocator
from auditor.models import Claim, EvidenceChunk
from auditor.verification import SpanChecker


def test_exact_span_match():
    checker = SpanChecker()
    claim = Claim(claim_id="C1", text="Eligible farmers receive ₹50,000.")
    evidence = [EvidenceChunk(text="Eligible farmers receive ₹50,000.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MATCH"
    assert sig.confidence >= 0.95


def test_normalized_currency_span_match():
    checker = SpanChecker()
    claim = Claim(claim_id="C1", text="The grant is ₹50,000.")
    evidence = [EvidenceChunk(text="The grant is INR 50,000.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MATCH"


def test_span_locator_offsets():
    locator = SpanLocator()
    context = "The financial assistance is ₹50,000 per family."
    offsets = locator.find_span("₹50,000", context)
    assert offsets is not None
    assert context[offsets[0]:offsets[1]] == "₹50,000"
