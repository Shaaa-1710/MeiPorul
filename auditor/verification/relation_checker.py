"""Relation and entity-value binding verification engine."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from auditor.models.claim import Claim
from auditor.models.evidence import EvidenceChunk
from auditor.models.verdict import VerificationSignal, VerificationStatus


VERB_CATEGORIES: Dict[str, str] = {
    "provides": "financial", "provides for": "financial", "offers": "financial",
    "gives": "financial", "costs": "financial", "has": "financial", "budget": "financial",
    "started in": "temporal", "launched in": "temporal", "began": "temporal",
    "operates in": "location", "operates": "location", "located in": "location"
}


class RelationChecker:
    """Verifies relational bindings between subjects, actions, and numeric/attribute values."""

    def __init__(self) -> None:
        self.checker_name = "relation"
        self.binding_regex = re.compile(
            r"(?P<entity>Scheme\s+[A-Z0-9]+|[A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*)"
            r"\s+(?P<verb>provides|provides\s+for|offers|gives|requires|costs|has|features|started\s+in|launched\s+in|operates\s+in)"
            r"\s+(?P<value>[^,.;]+)",
            re.IGNORECASE,
        )

    def _extract_bindings(self, text: str) -> List[Tuple[str, str, str]]:
        """Extract (Entity, Verb, Value) triples from text."""
        bindings: List[Tuple[str, str, str]] = []
        # Split text into individual sentences first to preserve local binding scope
        sentences = re.split(r"(?<=[.!?])\s+|\n", text)
        for sent in sentences:
            # Match: Entity verb Value
            match = re.search(
                r"(?P<entity>Scheme\s+[A-Z0-9]+|[A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*)"
                r"\s+(?P<verb>provides|provides\s+for|offers|gives|requires|costs|has|features|started\s+in|launched\s+in|operates\s+in)"
                r"\s+(?P<value>(?:₹|INR|\$|€|£)?\s*\d+(?:,\d+)*(?:\.\d+)?(?:\s*[a-zA-Z%]+)?|[^.!?]+)",
                sent,
                re.IGNORECASE,
            )
            if match:
                ent = match.group("entity").strip()
                verb = match.group("verb").strip().lower()
                val = match.group("value").strip().rstrip(".")
                val = re.sub(r"\s+\b(?:in|at|for|to|since|from|by|on)\b$", "", val, flags=re.IGNORECASE).strip()
                bindings.append((ent, verb, val))
        return bindings

    def _get_verb_cat(self, verb: str) -> str:
        for k, v in VERB_CATEGORIES.items():
            if k in verb:
                return v
        return verb

    def check(self, claim: Claim, evidence_list: List[EvidenceChunk]) -> VerificationSignal:
        """
        Verify relational bindings and detect entity-value attribute swaps (e.g. Scheme A vs Scheme B).
        """
        if not evidence_list:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.INCONCLUSIVE,
                confidence=0.5,
                reason="No evidence provided for relation check.",
            )

        claim_bindings = self._extract_bindings(claim.text)
        if not claim_bindings:
            return VerificationSignal(
                checker=self.checker_name,
                status=VerificationStatus.NEUTRAL,
                confidence=1.0,
                reason="No explicit entity-value relational bindings extracted from claim.",
            )

        evidence_text_combined = "\n".join(ev.text for ev in evidence_list)
        evidence_bindings = self._extract_bindings(evidence_text_combined)

        for c_ent, c_verb, c_val in claim_bindings:
            c_vcat = self._get_verb_cat(c_verb)
            # Find evidence bindings matching the same subject entity and same relation category
            matching_ev_bindings = [
                (e_ent, e_verb, e_val)
                for (e_ent, e_verb, e_val) in evidence_bindings
                if (c_ent.lower() in e_ent.lower() or e_ent.lower() in c_ent.lower())
                and self._get_verb_cat(e_verb) == c_vcat
            ]

            if matching_ev_bindings:
                # Check if the value matches for that entity
                val_match = False
                ev_val_str = ""
                for e_ent, e_verb, e_val in matching_ev_bindings:
                    ev_val_str = e_val
                    # Extract numbers from values if present
                    c_nums = re.findall(r"\d+(?:,\d+)*", c_val)
                    e_nums = re.findall(r"\d+(?:,\d+)*", e_val)
                    if c_nums and e_nums:
                        c_num_clean = [n.replace(",", "") for n in c_nums]
                        e_num_clean = [n.replace(",", "") for n in e_nums]
                        if c_num_clean == e_num_clean:
                            val_match = True
                            break
                    else:
                        # Non-numeric value comparison (excluding common symbols)
                        c_words = {w for w in re.findall(r"\w+", c_val.lower()) if len(w) > 1}
                        e_words = {w for w in re.findall(r"\w+", e_val.lower()) if len(w) > 1}
                        if c_words and e_words and len(c_words.intersection(e_words)) / len(c_words) >= 0.7:
                            val_match = True
                            break

                if not val_match:
                    return VerificationSignal(
                        checker=self.checker_name,
                        status=VerificationStatus.MISMATCH,
                        confidence=0.98,
                        reason=f"Relational binding swap detected: '{c_ent}' is bound to '{c_val}' in claim, but evidence binds '{c_ent}' to '{ev_val_str}'.",
                        matched_spans=[f"{c_ent} -> {c_val}"],
                        metadata={"entity": c_ent, "claim_val": c_val, "evidence_val": ev_val_str},
                    )

        return VerificationSignal(
            checker=self.checker_name,
            status=VerificationStatus.MATCH,
            confidence=0.92,
            reason="Entity-value relational bindings are consistent with evidence.",
        )
