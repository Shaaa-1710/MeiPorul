"""Tests for NLI model and verification."""

import pytest
from auditor.models import Claim, EvidenceChunk
from auditor.nli import LightweightNLIModel, NLIVerifier


def test_nli_entailment_scoring():
    model = LightweightNLIModel()
    premise = "The renewable energy scheme began operations in 2024 across southern districts."
    hypothesis = "The scheme started in 2024."
    probs = model.predict_pair(premise, hypothesis)
    assert probs["ENTAILMENT"] > 0.60
    assert probs["CONTRADICTION"] < 0.10


def test_nli_contradiction_scoring():
    model = LightweightNLIModel()
    premise = "The grant application was accepted by the committee."
    hypothesis = "The grant application was rejected by the committee."
    probs = model.predict_pair(premise, hypothesis)
    assert probs["CONTRADICTION"] > 0.70


def test_nli_verifier_claim():
    verifier = NLIVerifier()
    claim = Claim(claim_id="C1", text="The scheme began in 2024.")
    evidence = [EvidenceChunk(text="The scheme launched in 2024.")]
    sig = verifier.verify_claim(claim, evidence)
    assert sig.status.value == "MATCH"
