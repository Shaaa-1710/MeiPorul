"""NLI verification wrapper and ambiguity classification."""

from __future__ import annotations

from typing import List, Optional

from auditor.models.claim import Claim
from auditor.models.evidence import EvidenceChunk
from auditor.models.verdict import VerificationSignal, VerificationStatus
from auditor.nli.model import LightweightNLIModel


class NLIVerifier:
    """NLI verifier applying batch inference to claim-evidence pairs."""

    def __init__(self, model: Optional[LightweightNLIModel] = None) -> None:
        self.checker_name = "nli"
        self.model = model or LightweightNLIModel()

    def verify_claim(
        self, claim: Claim, evidence_list: List[EvidenceChunk]
    ) -> VerificationSignal:
        """
        Evaluate NLI inference over candidate evidence passages for a claim.
        """
        if not evidence_list:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.INCONCLUSIVE,
                confidence=0.5,
                reason="No evidence provided for NLI verification.",
                metadata={"class": "NEUTRAL", "probabilities": {"ENTAILMENT": 0.0, "CONTRADICTION": 0.0, "NEUTRAL": 1.0}},
            )

        best_signal: Optional[VerificationSignal] = None
        max_entailment = 0.0
        max_contradiction = 0.0

        for ev in evidence_list:
            probs = self.model.predict_pair(premise=ev.text, hypothesis=claim.text)
            p_entail = probs.get("ENTAILMENT", 0.0)
            p_contra = probs.get("CONTRADICTION", 0.0)
            p_neutral = probs.get("NEUTRAL", 0.0)

            if p_contra >= 0.75:
                return VerificationSignal(
                    checker=self.checker_name,
                    status=VerificationStatus.MISMATCH,
                    confidence=p_contra,
                    reason=f"NLI predicted CONTRADICTION (p={p_contra:.2f}) with evidence: '{ev.text}'",
                    metadata={"class": "CONTRADICTION", "probabilities": probs, "evidence_id": ev.evidence_id},
                )

            if p_entail >= 0.70:
                return VerificationSignal(
                    checker=self.checker_name,
                    status=VerificationStatus.MATCH,
                    confidence=p_entail,
                    reason=f"NLI predicted ENTAILMENT (p={p_entail:.2f}) with evidence: '{ev.text}'",
                    metadata={"class": "ENTAILMENT", "probabilities": probs, "evidence_id": ev.evidence_id},
                )

            if p_neutral >= 0.70:
                best_signal = VerificationSignal(
                    checker=self.checker_name,
                    status=VerificationStatus.INCONCLUSIVE,
                    confidence=p_neutral,
                    reason=f"NLI predicted NEUTRAL / absence of evidence (p={p_neutral:.2f}).",
                    metadata={"class": "NEUTRAL", "probabilities": probs, "evidence_id": ev.evidence_id},
                )
            else:
                best_signal = VerificationSignal(
                    checker=self.checker_name,
                    status=VerificationStatus.INCONCLUSIVE,
                    confidence=max(p_entail, p_neutral),
                    reason=f"NLI inconclusive/ambiguous (entail={p_entail:.2f}, neutral={p_neutral:.2f}).",
                    metadata={"class": "AMBIGUOUS", "probabilities": probs, "evidence_id": ev.evidence_id},
                )

        return best_signal or VerificationSignal(
            checker=self.checker_name,
            status=VerificationStatus.INCONCLUSIVE,
            confidence=0.5,
            reason="NLI found neutral/unrelated evidence.",
            metadata={"class": "NEUTRAL"},
        )
