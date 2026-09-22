"""Named entity verification and entity substitution detection."""

from __future__ import annotations

import re
from typing import Dict, List, Set, Tuple

from auditor.models.claim import Claim
from auditor.models.evidence import EvidenceChunk
from auditor.models.verdict import VerificationSignal, VerificationStatus

# Canonical alias mapping for common institutional and geographical entities
ENTITY_ALIASES: Dict[str, str] = {
    "govt of india": "government of india",
    "govt. of india": "government of india",
    "goi": "government of india",
    "union government": "government of india",
    "central government": "government of india",
    "tn govt": "government of tamil nadu",
    "tamil nadu govt": "government of tamil nadu",
    "rbi": "reserve bank of india",
    "sbi": "state bank of india",
    "who": "world health organization",
    "aiims": "all india institute of medical sciences",
}

# Known entity categories for mismatch detection
LOCATION_ENTITIES = {
    "chennai", "coimbatore", "madurai", "kerala", "tamil nadu", "karnataka",
    "andhra pradesh", "telangana", "delhi", "mumbai", "bengaluru", "bangalore",
    "hyderabad", "kochi", "thiruvananthapuram", "pune", "kolkata"
}


def normalize_entity_name(entity: str) -> str:
    """Normalize entity casing, punctuation, and known acronyms/aliases."""
    clean = re.sub(r"[^\w\s]", "", entity).strip().lower()
    clean = re.sub(r"\s+", " ", clean)
    return ENTITY_ALIASES.get(clean, clean)


class EntityChecker:
    """Verifies named entity alignment and detects adversarial entity substitutions."""

    def __init__(self) -> None:
        self.checker_name = "entity"

    def _extract_entities_from_text(self, text: str) -> List[str]:
        """Extract capitalized entity candidates and scheme identifiers."""
        # Find capital phrases (e.g. "Chennai office", "Government of India", "Govt. of India", "Scheme A")
        matches = re.findall(
            r"\b(?:Scheme\s+[A-Z0-9]+|Govt\.?\s+of\s+[A-Z][a-z]+|Government\s+of\s+[A-Z][a-z]+|[A-Z][a-z0-9]+(?:\s+(?:of\s+)?[A-Z][a-z0-9]+)*)\b",
            text,
        )
        stopwords = {
            "The", "A", "An", "This", "That", "It", "They", "These", "Those",
            "Applications", "Participants", "Eligible", "Storage", "Policy",
            "Version", "Section", "Page", "Applicant", "Program", "Project"
        }
        entities = [m.strip() for m in matches if m.strip() not in stopwords]
        # Also check for known location keywords in case text is lowercase
        lower = text.lower()
        for loc in LOCATION_ENTITIES:
            if loc in lower and not any(loc in e.lower() for e in entities):
                entities.append(loc.title())
        return list(dict.fromkeys(entities))

    def check(self, claim: Claim, evidence_list: List[EvidenceChunk]) -> VerificationSignal:
        """
        Compare entities in the claim against evidence passages.
        Detects entity substitutions (e.g., Chennai vs Coimbatore).
        """
        if not evidence_list:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.INCONCLUSIVE,
                confidence=0.5,
                reason="No evidence provided for entity check.",
            )

        # Collect entities from claim and evidence
        claim_entities = claim.entities if claim.entities else self._extract_entities_from_text(claim.text)
        evidence_text_combined = " ".join(ev.text for ev in evidence_list)
        evidence_entities = self._extract_entities_from_text(evidence_text_combined)

        if not claim_entities:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.NEUTRAL,
                confidence=1.0,
                reason="No distinct named entities detected in claim.",
            )

        norm_ev_text = normalize_entity_name(evidence_text_combined)
        norm_ev_entities = {normalize_entity_name(e) for e in evidence_entities}

        matched_entities: List[str] = []
        missing_entities: List[str] = []
        substituted_entities: List[Tuple[str, str]] = []

        for ent in claim_entities:
            norm_ent = normalize_entity_name(ent)

            # Direct or alias match in combined evidence
            if norm_ent in norm_ev_text or norm_ent in norm_ev_entities:
                matched_entities.append(ent)
            else:
                missing_entities.append(ent)
                # Check for category-based substitution (e.g. Location mismatch)
                if norm_ent in LOCATION_ENTITIES:
                    # Find if another location entity is present in evidence
                    for ev_ent in norm_ev_entities:
                        if ev_ent in LOCATION_ENTITIES and ev_ent != norm_ent:
                            substituted_entities.append((ent, ev_ent))

        # Check for partial missing entities (e.g., "Kerala, Tamil Nadu, and Karnataka" vs "Kerala and Tamil Nadu")
        if matched_entities and missing_entities:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.MISMATCH,
                confidence=0.88,
                reason=f"Entities {matched_entities} matched, but extra entity '{missing_entities[0]}' is unsupported in evidence.",
                matched_spans=matched_entities,
                metadata={"matched": matched_entities, "missing": missing_entities},
            )

        # Check for explicit entity substitution (e.g. Coimbatore vs Chennai)
        if substituted_entities:
            claim_e, ev_e = substituted_entities[0]
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.MISMATCH,
                confidence=0.98,
                reason=f"Entity substitution detected: claim asserts '{claim_e}' but evidence states '{ev_e.title()}'.",
                matched_spans=[claim_e],
                metadata={"claim_entity": claim_e, "evidence_entity": ev_e},
            )

        if missing_entities and not matched_entities:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.MISMATCH,
                confidence=0.85,
                reason=f"Named entities {missing_entities} not found in retrieved evidence.",
                metadata={"missing": missing_entities},
            )

        return VerificationSignal(
            checker=self.checker_name,
            status=VerificationStatus.MATCH,
            confidence=0.95,
            reason=f"All named entities matched: {matched_entities}",
            matched_spans=matched_entities,
            metadata={"matched": matched_entities},
        )
