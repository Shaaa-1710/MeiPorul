"""Tests for atomicity validation."""

import pytest
from auditor.decomposition import AtomicClaimValidator


@pytest.fixture
def validator():
    return AtomicClaimValidator()


def test_atomic_single_fact(validator):
    text = "The subsidy amount is ₹50,000."
    is_atomic, reason, _ = validator.is_atomic(text)
    assert is_atomic is True


def test_atomic_set_valued_entities(validator):
    text = "The scheme operates in Kerala and Tamil Nadu."
    is_atomic, reason, _ = validator.is_atomic(text)
    assert is_atomic is True


def test_compound_two_predicates(validator):
    text = "The program started in 2024 and provides ₹50,000."
    is_atomic, reason, subclaims = validator.is_atomic(text)
    assert is_atomic is False
    assert len(subclaims) == 2


def test_relative_clause_split(validator):
    text = "Scheme B, which operates in Kerala, provides ₹50,000."
    is_atomic, reason, subclaims = validator.is_atomic(text)
    assert is_atomic is False
    assert len(subclaims) == 2
