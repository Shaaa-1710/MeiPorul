"""Tests for verdict decision rules and aggregation."""

import pytest
from auditor.models import Claim, EvidenceChunk, VerificationSignal, VerificationStatus, VerdictType
from auditor.verdict import VerdictAggregator, VerdictRulesEngine


def test_numeric_mismatch_overrides_span():
    rules = VerdictRulesEngine()
    claim = Claim(claim_id="C1", text="The subsidy is ₹55,000.")
    evidence = [EvidenceChunk(text="The subsidy is ₹50,000.")]
    signals = {
        "span": VerificationSignal(checker="span", status=VerificationStatus.MATCH, confidence=0.9),
        "numeric": VerificationSignal(checker="numeric", status=VerificationStatus.MISMATCH, confidence=0.99, reason="Numeric mismatch: ₹55,000 vs ₹50,000"),
        "entity": VerificationSignal(checker="entity", status=VerificationStatus.MATCH, confidence=1.0),
    }
    verdict, conf, reason = rules.evaluate_deterministic_signals(signals, claim, evidence)
    assert verdict == VerdictType.CONTRADICTED
    assert conf >= 0.95


def test_hedge_mismatch_yields_partial_support():
    rules = VerdictRulesEngine()
    claim = Claim(claim_id="C1", text="Applications are processed in exactly 10 days.")
    evidence = [EvidenceChunk(text="Applications are processed in approximately 10 days.")]
    signals = {
        "span": VerificationSignal(checker="span", status=VerificationStatus.MATCH, confidence=0.9),
        "numeric": VerificationSignal(checker="numeric", status=VerificationStatus.MATCH, confidence=1.0),
        "hedge": VerificationSignal(checker="hedge", status=VerificationStatus.MISMATCH, confidence=0.92, reason="Exact vs approx"),
    }
    verdict, conf, reason = rules.evaluate_deterministic_signals(signals, claim, evidence)
    assert verdict == VerdictType.PARTIALLY_SUPPORTED
