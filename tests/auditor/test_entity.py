"""Tests for entity verification and substitution detection."""

import pytest
from auditor.models import Claim, EvidenceChunk
from auditor.verification import EntityChecker


def test_entity_substitution_detection():
    checker = EntityChecker()
    claim = Claim(claim_id="C1", text="Applications must be submitted at the Coimbatore office.", entities=["Coimbatore"])
    evidence = [EvidenceChunk(text="Applications must be submitted at the Chennai office.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MISMATCH"
    assert "Coimbatore" in sig.reason
    assert "Chennai" in sig.reason


def test_entity_alias_normalization():
    checker = EntityChecker()
    claim = Claim(claim_id="C1", text="The initiative was launched by the Government of India.", entities=["Government of India"])
    evidence = [EvidenceChunk(text="The initiative was launched by the Govt. of India.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MATCH"


def test_partial_entity_list_detection():
    checker = EntityChecker()
    claim = Claim(claim_id="C1", text="The scheme operates in Kerala, Tamil Nadu, and Karnataka.", entities=["Kerala", "Tamil Nadu", "Karnataka"])
    evidence = [EvidenceChunk(text="The scheme operates in Kerala and Tamil Nadu.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MISMATCH"
    assert "Karnataka" in sig.metadata.get("missing", [])
