"""End-to-end integration tests for the ClaimAuditor pipeline covering all benchmark hard cases."""

import pytest
from auditor import ClaimAuditor, VerdictType


@pytest.fixture
def auditor():
    return ClaimAuditor()


def test_hard_case_1_numeric_substitution(auditor):
    evidence = ["The scheme provides ₹50,000 to eligible farmers."]
    answer = "The scheme provides ₹55,000."
    res = auditor.audit(answer, evidence)
    assert res.overall_verdict == VerdictType.CONTRADICTED
    assert res.is_grounded is False
    assert res.claims[0].verdict == VerdictType.CONTRADICTED
    assert res.claims[0].checks["numeric"] is False


def test_hard_case_2_entity_substitution(auditor):
    evidence = ["Applications are submitted at the Chennai office."]
    answer = "Applications are submitted at the Coimbatore office."
    res = auditor.audit(answer, evidence)
    assert res.overall_verdict == VerdictType.CONTRADICTED
    assert res.claims[0].verdict == VerdictType.CONTRADICTED
    assert res.claims[0].checks["entity"] is False


def test_hard_case_3_date_substitution(auditor):
    evidence = ["The program launched in 2025."]
    answer = "The program launched in 2024."
    res = auditor.audit(answer, evidence)
    assert res.overall_verdict == VerdictType.CONTRADICTED
    assert res.claims[0].verdict == VerdictType.CONTRADICTED


def test_hard_case_4_range_manipulation(auditor):
    evidence = ["Applicants must be between 18 and 25 years old."]
    answer = "Applicants must be between 18 and 30 years old."
    res = auditor.audit(answer, evidence)
    assert res.overall_verdict == VerdictType.CONTRADICTED
    assert res.claims[0].verdict == VerdictType.CONTRADICTED


def test_hard_case_5_approx_to_exact(auditor):
    evidence = ["Applications are generally processed in approximately 10 days."]
    answer = "Applications are processed in exactly 10 days."
    res = auditor.audit(answer, evidence)
    assert res.overall_verdict == VerdictType.PARTIALLY_SUPPORTED
    assert res.claims[0].verdict == VerdictType.PARTIALLY_SUPPORTED


def test_hard_case_6_upto_to_exact(auditor):
    evidence = ["Participants can receive up to ₹1 lakh."]
    answer = "Participants receive ₹1 lakh."
    res = auditor.audit(answer, evidence)
    assert res.overall_verdict == VerdictType.PARTIALLY_SUPPORTED
    assert res.claims[0].verdict == VerdictType.PARTIALLY_SUPPORTED


def test_hard_case_7_negation_flip(auditor):
    evidence = ["The applicant does not require a processing fee."]
    answer = "The applicant requires a processing fee."
    res = auditor.audit(answer, evidence)
    assert res.overall_verdict == VerdictType.CONTRADICTED
    assert res.claims[0].verdict == VerdictType.CONTRADICTED


def test_hard_case_8_partial_support(auditor):
    evidence = ["The scheme operates in Kerala and Tamil Nadu."]
    answer = "The scheme operates in Kerala, Tamil Nadu, and Karnataka."
    res = auditor.audit(answer, evidence)
    assert res.overall_verdict == VerdictType.PARTIALLY_SUPPORTED
    assert res.claims[0].verdict == VerdictType.PARTIALLY_SUPPORTED


def test_hard_case_9_unsupported_claim(auditor):
    evidence = ["No evidence regarding application deadline."]
    answer = "Applications must be submitted within 30 days."
    res = auditor.audit(answer, evidence)
    assert res.overall_verdict in [VerdictType.NOT_ENTAILED, VerdictType.CONTRADICTED]
    assert res.is_grounded is False


def test_hard_case_10_relation_swap(auditor):
    evidence = [
        "Scheme A provides ₹50,000.",
        "Scheme B provides ₹25,000."
    ]
    answer = "Scheme B provides ₹50,000."
    res = auditor.audit(answer, evidence)
    assert res.overall_verdict == VerdictType.CONTRADICTED
    assert res.claims[0].verdict == VerdictType.CONTRADICTED


def test_hard_case_11_paraphrase(auditor):
    evidence = ["The scheme began operations in 2024."]
    answer = "The program started in 2024."
    res = auditor.audit(answer, evidence)
    assert res.overall_verdict == VerdictType.SUPPORTED
    assert res.claims[0].verdict == VerdictType.SUPPORTED


def test_hard_case_12_correct_number_wrong_unit(auditor):
    evidence = ["Storage capacity is 2 TB."]
    answer = "Storage capacity is 2 MB."
    res = auditor.audit(answer, evidence)
    assert res.overall_verdict == VerdictType.CONTRADICTED
    assert res.claims[0].verdict == VerdictType.CONTRADICTED


def test_hard_case_13_unit_equivalent_representation(auditor):
    evidence = ["Storage capacity is 2 TB."]
    answer = "Storage capacity is 2000 GB."
    res = auditor.audit(answer, evidence)
    assert res.overall_verdict == VerdictType.SUPPORTED
    assert res.claims[0].verdict == VerdictType.SUPPORTED


def test_hard_case_14_compound_answer_decomposition(auditor):
    evidence = [
        "The project launched in 2024.",
        "It operates in Kerala.",
        "The budget is ₹50,000."
    ]
    answer = "The project launched in 2024, operates in Kerala, and has a budget of ₹55,000."
    res = auditor.audit(answer, evidence)
    assert len(res.claims) == 3
    assert res.claims[0].verdict == VerdictType.SUPPORTED
    assert res.claims[1].verdict == VerdictType.SUPPORTED
    assert res.claims[2].verdict == VerdictType.CONTRADICTED
    assert res.overall_verdict == VerdictType.CONTRADICTED


def test_observability_metrics(auditor):
    evidence = ["The subsidy is ₹50,000."]
    answer = "The subsidy is ₹50,000."
    res = auditor.audit(answer, evidence)
    assert res.metrics.total_claims == 1
    assert res.metrics.claims_supported == 1
    assert res.metrics.total_audit_latency_ms >= 0.0
