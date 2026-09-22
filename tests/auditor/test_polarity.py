"""Tests for polarity, negation, and antonym requirement checks."""

import pytest
from auditor.models import Claim, EvidenceChunk
from auditor.verification import PolarityChecker


def test_negation_drop_contradiction():
    checker = PolarityChecker()
    claim = Claim(claim_id="C1", text="The applicant requires a processing fee.")
    evidence = [EvidenceChunk(text="The applicant does not require a processing fee.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MISMATCH"


def test_antonym_requirement_flip():
    checker = PolarityChecker()
    claim = Claim(claim_id="C1", text="Submission of Aadhaar card is optional.")
    evidence = [EvidenceChunk(text="Submission of Aadhaar card is mandatory.")]
    sig = checker.check(claim, evidence)
    assert sig.status.value == "MISMATCH"
