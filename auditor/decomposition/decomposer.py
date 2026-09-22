"""Claim decomposition engine for splitting RAG answers into atomic verifiable claims."""

from __future__ import annotations

import re
from typing import Any, List, Optional

from auditor.decomposition.validator import AtomicClaimValidator
from auditor.models.claim import Claim, ClaimType, NormalizedFact

# Common sentence boundaries that preserve numbers and abbreviations
ABBREVIATIONS = r"(?:Govt|Gov|Dr|Mr|Mrs|Ms|Prof|Inc|Ltd|Co|vs|e\.g|i\.e|No|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Rs|INR)\."


class ClaimDecomposer:
    """Decomposes generated RAG answers into atomic, verifiable Claim objects."""

    def __init__(self) -> None:
        self.validator = AtomicClaimValidator()
        self._setup_regexes()

    def _setup_regexes(self) -> None:
        # Regex for sentence splitting with safe boundary detection
        self.sentence_split_regex = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9₹\"'‘“])")
        self.numeric_regex = re.compile(
            r"(?:₹|INR|\$|€|£)?\s*\d+(?:,\d+)*(?:\.\d+)?\s*(?:lakh|lakhs|crore|crores|k|M|B|TB|GB|MB|KB|%|days|months|years|hours|minutes)?\b",
            re.IGNORECASE,
        )
        self.year_regex = re.compile(r"\b(19\d{2}|20\d{2}|21\d{2})\b")
        self.range_regex = re.compile(
            r"\b(?:\d+[\s–\-]+to[\s–\-]+\d+|\d+[\s–\-]+\d+|between\s+\d+\s+and\s+\d+)\b",
            re.IGNORECASE,
        )
        self.qualifier_regex = re.compile(
            r"\b(up\s+to|at\s+least|at\s+most|more\s+than|less\s+than|approximately|about|around|generally|usually|typically|within|exactly|mandatory|optional|prohibited|allowed)\b",
            re.IGNORECASE,
        )

    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into raw sentences handling bullet points and punctuation."""
        lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
        sentences: List[str] = []
        for line in lines:
            # Strip bullet prefixes if any
            clean_line = re.sub(r"^[-*•\d+.)]\s*", "", line)
            splits = self.sentence_split_regex.split(clean_line)
            for s in splits:
                s = s.strip()
                if s:
                    sentences.append(s)
        return sentences

    def _extract_clauses(self, sentence: str) -> List[str]:
        """Split complex compound sentences into atomic propositional clauses."""
        s = sentence.strip().rstrip(".")
        if not s:
            return []

        # Check for serial coordination: "launched in 2024, operates in Kerala, and has a budget of ₹55,000"
        # Match pattern: Subj verb1..., verb2..., and verb3...
        serial_match = re.search(
            r"^((?:The\s+|A\s+|An\s+)?[A-Za-z0-9\s_-]+?)\s+((?:launched|started|operates|provides|requires|offers|has|costs|covers|is|was|were)\s+[^,]+),\s+((?:launched|started|operates|provides|requires|offers|has|costs|covers|is|was|were|operates in)\s+[^,]+),?\s+and\s+((?:launched|started|operates|provides|requires|offers|has|costs|covers|is|was|were|a budget of)\s+.+)$",
            s,
            re.IGNORECASE,
        )
        if serial_match:
            subject = serial_match.group(1).strip()
            c1 = f"{subject} {serial_match.group(2).strip()}."
            c2 = f"{subject} {serial_match.group(3).strip()}."
            part3 = serial_match.group(4).strip()
            if not any(part3.lower().startswith(v) for v in ["has ", "provides ", "requires ", "operates ", "is ", "was "]):
                part3 = f"has {part3}"
            c3 = f"{subject} {part3}."
            return [c1, c2, c3]

        # Check for two-part coordinated predicates: "The program started in 2022 and provides ₹50,000 to eligible farmers in Kerala."
        coord_match = re.search(
            r"^((?:The\s+|A\s+|An\s+)?[A-Za-z0-9\s_-]+?)\s+((?:started|launched|originated|was founded|was created|began operations)\s+in\s+\d{4})\s+and\s+((?:provides|offers|gives|covers|requires|mandates)\s+.+)$",
            s,
            re.IGNORECASE,
        )
        if coord_match:
            subject = coord_match.group(1).strip()
            c1 = f"{subject} {coord_match.group(2).strip()}."
            c2 = f"{subject} {coord_match.group(3).strip()}."
            return [c1, c2]

        # Check for relative clauses: "Scheme B, which operates in Kerala, provides ₹50,000."
        rel_match = re.search(
            r"^((?:The\s+|A\s+|An\s+)?[A-Za-z0-9\s_-]+?),\s*which\s+([^,]+),\s*(.+)$",
            s,
            re.IGNORECASE,
        )
        if rel_match:
            subject = rel_match.group(1).strip()
            c1 = f"{subject} {rel_match.group(2).strip()}."
            c2 = f"{subject} {rel_match.group(3).strip()}."
            return [c1, c2]

        # Check with atomic claim validator
        is_atom, _, subclaims = self.validator.is_atomic(s)
        if not is_atom and subclaims:
            return [sub if sub.endswith(".") else f"{sub}." for sub in subclaims]

        return [s if s.endswith(".") else f"{s}."]

    def _classify_claim(self, text: str) -> ClaimType:
        """Infer the ClaimType category based on textual characteristics."""
        if self.range_regex.search(text):
            return ClaimType.RANGE
        if self.year_regex.search(text) or any(m in text.lower() for m in ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "deadline", "duration"]):
            return ClaimType.DATE
        if re.search(r"(?:₹|INR|\$|€|£|\d+\s*(?:lakh|crore|TB|GB|MB|KB|%))", text, re.IGNORECASE):
            return ClaimType.NUMERIC
        if any(w in text.lower() for w in ["office", "department", "ministry", "government", "chennai", "coimbatore", "kerala", "tamil nadu", "delhi", "bangalore"]):
            return ClaimType.ENTITY
        if any(w in text.lower() for w in ["if", "unless", "provided that", "eligible when", "subject to"]):
            return ClaimType.CONDITIONAL
        if any(w in text.lower() for w in ["more than", "less than", "higher", "lower", "compared to"]):
            return ClaimType.COMPARATIVE
        if any(w in text.lower() for w in ["provides", "operates", "administered by", "launched by", "affiliated with"]):
            return ClaimType.RELATION
        return ClaimType.FACT

    def _extract_entities(self, text: str) -> List[str]:
        """Extract candidate named entities from claim text."""
        # Match capitalized phrases / names / schemes
        entity_matches = re.findall(
            r"\b(?:Scheme\s+[A-Z0-9]+|Govt\.?\s+of\s+[A-Z][a-z]+|Government\s+of\s+[A-Z][a-z]+|[A-Z][a-z0-9]+(?:\s+(?:of\s+)?[A-Z][a-z0-9]+)*)\b",
            text,
        )
        stopwords = {"The", "A", "An", "This", "That", "It", "They", "These", "Those", "Applications", "Participants", "Eligible"}
        entities = [e.strip() for e in entity_matches if e.strip() not in stopwords]
        return list(dict.fromkeys(entities))

    def _extract_numeric_facts(self, text: str) -> List[dict[str, Any]]:
        """Extract numbers, currency, and units into structured records."""
        facts: List[dict[str, Any]] = []
        for m in self.numeric_regex.finditer(text):
            raw = m.group().strip()
            facts.append({"raw": raw, "span": m.span()})
        return facts

    def _extract_qualifiers(self, text: str) -> List[str]:
        """Extract hedges, certainty qualifiers, and bounds."""
        qualifiers = [m.group().strip().lower() for m in self.qualifier_regex.finditer(text)]
        return list(dict.fromkeys(qualifiers))

    def decompose(self, answer: str) -> List[Claim]:
        """
        Decompose a generated RAG answer into an ordered list of atomic claims.
        """
        if not answer or not answer.strip():
            return []

        raw_sentences = self._split_into_sentences(answer)
        atomic_clauses: List[tuple[str, str]] = []  # (clause, source_sentence)

        for sent in raw_sentences:
            extracted = self._extract_clauses(sent)
            for clause in extracted:
                # Secondary validation pass to ensure atomicity
                sub_extracted = self.validator.validate_and_normalize([clause])
                for sub in sub_extracted:
                    atomic_clauses.append((sub, sent))

        claims: List[Claim] = []
        for idx, (clause_text, source_sent) in enumerate(atomic_clauses, start=1):
            claim_id = f"C{idx}"
            claim_type = self._classify_claim(clause_text)
            entities = self._extract_entities(clause_text)
            numeric_facts = self._extract_numeric_facts(clause_text)
            qualifiers = self._extract_qualifiers(clause_text)

            # Determine if this claim is verifiable vs pure pleasantry
            is_verifiable = len(clause_text.split()) >= 3 and not any(
                clause_text.lower().startswith(g)
                for g in ["hello", "thank you", "thanks", "hope this helps", "you are welcome"]
            )

            claim = Claim(
                claim_id=claim_id,
                text=clause_text,
                source_sentence=source_sent,
                claim_type=claim_type,
                normalized_facts=[
                    NormalizedFact(
                        subject=entities[0] if entities else "",
                        predicate="asserts",
                        object_value=clause_text,
                        qualifiers=qualifiers,
                    )
                ],
                entities=entities,
                numeric_facts=numeric_facts,
                qualifiers=qualifiers,
                atomic=True,
                is_verifiable=is_verifiable,
            )
            claims.append(claim)

        return claims
