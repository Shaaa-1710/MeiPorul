"""Evidence selector for picking the most relevant passages for each claim."""

from __future__ import annotations

import re
from typing import Any, List, Union

from auditor.evidence.span_locator import SpanLocator, normalize_text
from auditor.models.claim import Claim
from auditor.models.evidence import EvidenceChunk

STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "with", "at", "by", "for",
    "from", "in", "into", "of", "off", "on", "onto", "over", "to", "up", "is", "are",
    "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "it", "its", "this", "that", "these", "those", "they", "them", "their", "will",
    "would", "should", "can", "could", "may", "might", "must",
}


class EvidenceSelector:
    """Selects and ranks candidate evidence passages for a specific claim."""

    def __init__(self) -> None:
        self.span_locator = SpanLocator()

    def normalize_evidence_list(
        self, raw_evidence: List[Union[EvidenceChunk, dict[str, Any], str]]
    ) -> List[EvidenceChunk]:
        """Convert arbitrary raw evidence representations into typed EvidenceChunk models."""
        normalized: List[EvidenceChunk] = []
        for idx, item in enumerate(raw_evidence, start=1):
            if isinstance(item, EvidenceChunk):
                normalized.append(item)
            elif isinstance(item, dict):
                evidence_id = str(item.get("evidence_id") or f"EVD-{idx:03d}")
                normalized.append(
                    EvidenceChunk(
                        evidence_id=evidence_id,
                        document_id=item.get("document_id"),
                        chunk_id=item.get("chunk_id"),
                        text=item.get("text", "").strip(),
                        page=item.get("page"),
                        section=item.get("section"),
                        source=item.get("source"),
                        metadata=item.get("metadata", {}),
                        score=item.get("score"),
                        effective_date=item.get("effective_date"),
                        version=item.get("version"),
                    )
                )
            elif isinstance(item, str):
                normalized.append(
                    EvidenceChunk(
                        evidence_id=f"EVD-{idx:03d}",
                        text=item.strip(),
                    )
                )
        return normalized

    def _tokenize(self, text: str) -> set[str]:
        """Extract significant lowercase tokens."""
        clean = re.sub(r"[^a-zA-Z0-9₹$€]", " ", text.lower())
        tokens = clean.split()
        return {t for t in tokens if t not in STOPWORDS and len(t) > 1}

    def score_relevance(self, claim: Claim, evidence: EvidenceChunk) -> float:
        """Compute lexical and entity overlap score between claim and evidence passage."""
        claim_tokens = self._tokenize(claim.text)
        evidence_tokens = self._tokenize(evidence.text)

        if not claim_tokens or not evidence_tokens:
            return 0.0

        overlap = claim_tokens.intersection(evidence_tokens)
        base_score = len(overlap) / len(claim_tokens)

        # Entity boost
        for ent in claim.entities:
            if ent.lower() in evidence.text.lower():
                base_score += 0.25

        # Numeric / currency boost
        for num in claim.numeric_facts:
            raw_num = num.get("raw", "")
            if raw_num and raw_num.lower() in evidence.text.lower():
                base_score += 0.3

        return round(base_score, 4)

    def select_best_evidence(
        self, claim: Claim, evidence_list: List[EvidenceChunk], top_k: int = 3
    ) -> List[EvidenceChunk]:
        """Select top-k most relevant evidence chunks for a claim with attached matched spans."""
        if not evidence_list:
            return []

        scored_chunks: List[tuple[float, EvidenceChunk]] = []
        for chunk in evidence_list:
            score = self.score_relevance(claim, chunk)
            # Find and attach matched spans
            spans = self.span_locator.extract_evidence_spans(claim.text, chunk.text)
            chunk_copy = chunk.model_copy()
            chunk_copy.spans = spans
            scored_chunks.append((score, chunk_copy))

        # Sort descending by relevance score
        scored_chunks.sort(key=lambda x: x[0], reverse=True)

        selected = [chunk for _, chunk in scored_chunks[:top_k]]
        return selected

    def extract_salient_sentence(self, claim: Claim, chunk_text: str) -> str:
        """Extract the single sentence in a chunk with highest lexical overlap."""
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", chunk_text) if s.strip()]
        if not sentences:
            return chunk_text
        if len(sentences) == 1:
            return sentences[0]

        claim_tokens = self._tokenize(claim.text)
        best_sent = sentences[0]
        best_overlap = -1

        for sent in sentences:
            sent_tokens = self._tokenize(sent)
            overlap = len(claim_tokens.intersection(sent_tokens))
            if overlap > best_overlap:
                best_overlap = overlap
                best_sent = sent

        return best_sent
