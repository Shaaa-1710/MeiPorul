"""Evidence filter to remove low-relevance snippets, near-duplicates, and noise."""

from __future__ import annotations

import logging
import re
from typing import List, Optional, Set

from rag.ingestion.metadata import compute_content_hash
from rag.retrieval.dense import RetrievedChunk

logger = logging.getLogger(__name__)


def _jaccard_similarity(text_a: str, text_b: str) -> float:
    """Compute token-level Jaccard similarity between two texts."""
    tokens_a = set(re.findall(r"\w+", text_a.lower()))
    tokens_b = set(re.findall(r"\w+", text_b.lower()))
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a.intersection(tokens_b)
    union = tokens_a.union(tokens_b)
    return len(intersection) / len(union)


class EvidenceFilter:
    """Filters, deduplicates, and prunes retrieved chunks to retain only high-quality evidence."""

    def __init__(
        self,
        min_score: float = 0.15,
        min_char_length: int = 50,
        near_duplicate_threshold: float = 0.85,
        max_evidence_chunks: int = 7,
    ):
        """
        Args:
            min_score: Minimum normalized score required to retain a chunk.
            min_char_length: Discard chunks shorter than this length (trivial fragments/headers).
            near_duplicate_threshold: Jaccard similarity threshold above which a chunk is deemed redundant.
            max_evidence_chunks: Maximum number of clean evidence chunks to keep.
        """
        self.min_score = min_score
        self.min_char_length = min_char_length
        self.near_duplicate_threshold = near_duplicate_threshold
        self.max_evidence_chunks = max_evidence_chunks

    def filter(self, chunks: List[RetrievedChunk]) -> List[RetrievedChunk]:
        """Apply sequential filtering: score cutoff, min length, exact deduplication, and near deduplication.
        
        Args:
            chunks: Retrieved or reranked candidate chunks.
            
        Returns:
            Filtered list of high-quality evidence chunks.
        """
        if not chunks:
            return []

        filtered: List[RetrievedChunk] = []
        seen_hashes: Set[str] = set()

        for chunk in chunks:
            # 1. Score threshold check
            if chunk.score < self.min_score:
                logger.debug(f"Discarding chunk {chunk.chunk_id}: score {chunk.score:.3f} < {self.min_score}")
                continue

            # 2. Minimum length check
            text = chunk.page_content.strip()
            if len(text) < self.min_char_length:
                logger.debug(f"Discarding chunk {chunk.chunk_id}: length {len(text)} < {self.min_char_length}")
                continue

            # 3. Exact hash deduplication
            content_hash = chunk.metadata.get("content_hash") or compute_content_hash(text)
            if content_hash in seen_hashes:
                logger.debug(f"Discarding chunk {chunk.chunk_id}: exact duplicate content")
                continue

            # 4. Near-duplicate check against already accepted chunks
            is_near_dup = False
            for accepted in filtered:
                sim = _jaccard_similarity(text, accepted.page_content)
                if sim >= self.near_duplicate_threshold:
                    logger.debug(
                        f"Discarding chunk {chunk.chunk_id}: near duplicate of {accepted.chunk_id} (sim={sim:.2f})"
                    )
                    is_near_dup = True
                    break

            if is_near_dup:
                continue

            # Passed all filters
            seen_hashes.add(content_hash)
            filtered.append(chunk)

            if len(filtered) >= self.max_evidence_chunks:
                break

        return filtered
