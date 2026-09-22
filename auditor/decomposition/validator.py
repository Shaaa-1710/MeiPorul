"""Atomicity validator for checking whether a claim contains a single proposition."""

from __future__ import annotations

import re
from typing import Tuple, List

# Common coordinated noun phrase patterns that are single entity/set facts, NOT multi-predicate
COORDINATED_NOUN_PATTERNS = [
    r"\b(?:kerala|tamil nadu|karnataka|andhra pradesh|maharashtra|punjab|delhi)\s+and\s+(?:kerala|tamil nadu|karnataka|andhra pradesh|maharashtra|punjab|delhi)\b",
    r"\b(?:men|women|farmers|artisans|students|citizens|residents|children|adults|seniors)\s+and\s+(?:men|women|farmers|artisans|students|citizens|residents|children|adults|seniors)\b",
    r"\b(?:research|science|terms|policy|rules|health|safety|guidelines)\s+and\s+(?:development|technology|conditions|regulations|standards|wellness|security)\b",
    r"\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+and\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b",
    r"\b(?:between|from)\s+[^,]+\s+and\s+[^,]+",  # "between 10 and 20", "from 2020 and 2024"
]

# Verb indicators that signal a second predicate
VERB_PATTERNS = [
    r"\b(?:is|are|was|were|has|have|had|provides|provides\s+for|offers|started|launched|requires|costs|features|covers|extends|operates|gives|includes|grants|allows|mandates|charges|received|distributed)\b"
]


class AtomicClaimValidator:
    """Validates if a claim is strictly atomic and can be independently verified."""

    def __init__(self) -> None:
        self.conj_pattern = re.compile(
            r"\b(?:and|but|while|whereas|although|though|furthermore|moreover|as well as)\b",
            re.IGNORECASE,
        )
        self.clause_break_pattern = re.compile(
            r"\b(?:which\s+(?:is|was|are|were|provides|started|launched|operates)|where\s+it\s+(?:is|operates|provides))\b",
            re.IGNORECASE,
        )

    def is_atomic(self, claim_text: str) -> Tuple[bool, str, List[str]]:
        """
        Check whether claim_text expresses a single verifiable proposition.
        
        Returns:
            (is_atomic, reason, candidate_subclaims)
        """
        text = claim_text.strip().rstrip(".")
        if not text:
            return True, "Empty text", []

        # Check for clause break like ", which provides..." or ", which started in..."
        which_match = re.search(r",\s*(?:which|where)\s+", text, re.IGNORECASE)
        if which_match:
            parts = [p.strip() for p in re.split(r",\s*(?:which|where)\s+", text, flags=re.IGNORECASE) if p.strip()]
            if len(parts) > 1:
                return False, "Contains non-restrictive relative clause", parts

        # Check if there is a conjunction joining two separate predicates
        conj_matches = list(self.conj_pattern.finditer(text))
        if not conj_matches:
            return True, "Single proposition (no compound conjunctions)", []

        for match in conj_matches:
            start, end = match.span()
            before = text[:start].strip()
            after = text[end:].strip()

            # Check if this conjunction is part of a known set-valued or range pattern
            matched_entity_pattern = False
            for pat in COORDINATED_NOUN_PATTERNS:
                if re.search(pat, text[max(0, start - 25): min(len(text), end + 25)], re.IGNORECASE):
                    matched_entity_pattern = True
                    break

            if matched_entity_pattern:
                continue

            # Check if both before and after contain verbs (indicating coordinated clauses/predicates)
            has_verb_before = any(re.search(vp, before, re.IGNORECASE) for vp in VERB_PATTERNS)
            has_verb_after = any(re.search(vp, after, re.IGNORECASE) for vp in VERB_PATTERNS)

            if has_verb_before and has_verb_after:
                # Extract candidate subject to formulate complete standalone subclaims
                sub1 = before
                sub2 = after
                # If 'after' lacks an explicit subject, borrow subject from 'before'
                subject_match = re.match(r"^((?:The\s+|A\s+|An\s+)?[A-Za-z0-9\s_-]+?)\s+(?:is|are|was|were|has|have|had|provides|offers|started|launched|requires|operates|covers)", before, re.IGNORECASE)
                if subject_match and not any(re.match(r"^(?:it|they|the\s+|a\s+|this\s+)", sub2, re.IGNORECASE) for _ in [1]):
                    subj = subject_match.group(1).strip()
                    sub2 = f"{subj} {sub2}"
                return False, f"Contains multiple independent predicates joined by '{match.group()}'", [sub1, sub2]

        return True, "Valid atomic claim", []

    def validate_and_normalize(self, claims: List[str]) -> List[str]:
        """Flatten and decompose any compound claims in a list into atomic claims."""
        result: List[str] = []
        for claim_text in claims:
            is_atom, _, subclaims = self.is_atomic(claim_text)
            if not is_atom and subclaims:
                for sub in subclaims:
                    clean_sub = sub.strip()
                    if not clean_sub.endswith("."):
                        clean_sub += "."
                    result.append(clean_sub)
            else:
                clean_claim = claim_text.strip()
                if not clean_claim.endswith("."):
                    clean_claim += "."
                result.append(clean_claim)
        return result
