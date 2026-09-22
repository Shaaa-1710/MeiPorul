"""Tests for claim decomposition engine."""

import pytest
from auditor.decomposition import ClaimDecomposer
from auditor.models import ClaimType


@pytest.fixture
def decomposer():
    return ClaimDecomposer()


def test_single_sentence_decomposition(decomposer):
    answer = "The program provides ₹50,000 to eligible farmers."
    claims = decomposer.decompose(answer)
    assert len(claims) == 1
    assert claims[0].claim_id == "C1"
    assert "₹50,000" in claims[0].text
    assert claims[0].claim_type == ClaimType.NUMERIC


def test_coordinated_predicates_decomposition(decomposer):
    answer = "The program started in 2022 and provides ₹50,000 to eligible farmers in Kerala."
    claims = decomposer.decompose(answer)
    assert len(claims) == 2
    assert "started in 2022" in claims[0].text
    assert "provides ₹50,000" in claims[1].text


def test_serial_coordination_decomposition(decomposer):
    answer = "The project launched in 2024, operates in Kerala, and has a budget of ₹55,000."
    claims = decomposer.decompose(answer)
    assert len(claims) == 3
    assert "launched in 2024" in claims[0].text
    assert "operates in Kerala" in claims[1].text
    assert "₹55,000" in claims[2].text


def test_qualifier_preservation(decomposer):
    answer = "Participants can receive up to ₹1 lakh within approximately 10 days."
    claims = decomposer.decompose(answer)
    assert len(claims) >= 1
    text = claims[0].text
    assert "up to" in text.lower()
    assert "approximately" in text.lower() or "within" in text.lower()
