"""Tests for entity-value relational binding checks."""

import pytest
from auditor.models import Claim, EvidenceChunk
from auditor.verification import RelationChecker


def test_cross_entity_attribute_swap():
    checker = RelationChecker()
    claim = Claim(claim_id="C1", text="Scheme B provides ₹50,000.")
    evidence = [
        EvidenceChunk(text="Scheme A provides financial support of ₹50,000."),
        EvidenceChunk(text="Scheme B provides financial support of ₹25,000.")
    ]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MISMATCH"
    assert "Scheme B" in sig.reason


def test_correct_entity_binding():
    checker = RelationChecker()
    claim = Claim(claim_id="C1", text="Scheme B provides ₹25,000.")
    evidence = [
        EvidenceChunk(text="Scheme A provides ₹50,000. Scheme B provides ₹25,000.")
    ]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MATCH"
