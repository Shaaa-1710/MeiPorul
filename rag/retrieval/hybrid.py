"""Hybrid retrieval engine combining Dense (ChromaDB) and Sparse (BM25) via Reciprocal Rank Fusion (RRF)."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from rag.retrieval.dense import DenseRetriever, RetrievedChunk
from rag.retrieval.sparse import SparseRetriever

logger = logging.getLogger(__name__)


class HybridRetriever:
    """Combines vector similarity and lexical keyword retrieval using Reciprocal Rank Fusion."""

    def __init__(
        self,
        dense_retriever: DenseRetriever,
        sparse_retriever: SparseRetriever,
        dense_weight: float = 0.6,
        sparse_weight: float = 0.4,
        rrf_k: int = 60,
    ):
        """
        Args:
            dense_retriever: Dense vector retriever instance.
            sparse_retriever: BM25 sparse retriever instance.
            dense_weight: Weight assigned to dense ranking in RRF (0.0 to 1.0).
            sparse_weight: Weight assigned to sparse ranking in RRF (0.0 to 1.0).
            rrf_k: Smoothing constant in RRF denominator (standard: 60).
        """
        self.dense_retriever = dense_retriever
        self.sparse_retriever = sparse_retriever
        self.dense_weight = dense_weight
        self.sparse_weight = sparse_weight
        self.rrf_k = rrf_k

    def retrieve(
        self,
        query: str,
        top_k: int = 10,
        candidate_multiplier: int = 2,
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievedChunk]:
        """Execute hybrid search using Reciprocal Rank Fusion.
        
        Args:
            query: The user query string.
            top_k: Number of final chunks to return.
            candidate_multiplier: Multiplier for candidate pool fetched from each retriever before fusion.
            filter_metadata: Optional metadata filter for dense retrieval.
            
        Returns:
            List of fused and deduplicated RetrievedChunk items sorted by composite RRF score.
        """
        if not query or not query.strip():
            return []

        pool_k = top_k * candidate_multiplier

        # 1. Fetch dense candidates
        dense_results: List[RetrievedChunk] = []
        try:
            dense_results = self.dense_retriever.similarity_search_with_score(
                query=query,
                top_k=pool_k,
                filter_metadata=filter_metadata,
            )
        except Exception as e:
            logger.error(f"Dense retrieval error: {e}")

        # 2. Fetch sparse candidates
        sparse_results: List[RetrievedChunk] = []
        try:
            sparse_results = self.sparse_retriever.search(
                query=query,
                top_k=pool_k,
            )
        except Exception as e:
            logger.error(f"Sparse retrieval error: {e}")

        # If both empty, return empty
        if not dense_results and not sparse_results:
            return []

        # 3. Reciprocal Rank Fusion (RRF)
        # RRF formula: Score(d) = sum_m [ weight_m / (k + rank_m(d)) ]
        rrf_scores: Dict[str, float] = {}
        chunk_lookup: Dict[str, RetrievedChunk] = {}
        sub_scores: Dict[str, Dict[str, float]] = {}

        # Process dense ranks (1-indexed)
        for rank, chunk in enumerate(dense_results, start=1):
            cid = chunk.chunk_id
            chunk_lookup[cid] = chunk
            score_contribution = self.dense_weight / (self.rrf_k + rank)
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + score_contribution
            if cid not in sub_scores:
                sub_scores[cid] = {}
            sub_scores[cid]["dense_score"] = chunk.score
            sub_scores[cid]["dense_rank"] = rank

        # Process sparse ranks (1-indexed)
        for rank, chunk in enumerate(sparse_results, start=1):
            cid = chunk.chunk_id
            if cid not in chunk_lookup:
                chunk_lookup[cid] = chunk
            score_contribution = self.sparse_weight / (self.rrf_k + rank)
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + score_contribution
            if cid not in sub_scores:
                sub_scores[cid] = {}
            sub_scores[cid]["sparse_score"] = chunk.score
            sub_scores[cid]["sparse_rank"] = rank

        # Sort by RRF score descending
        sorted_chunk_ids = sorted(
            rrf_scores.keys(),
            key=lambda cid: rrf_scores[cid],
            reverse=True,
        )

        # Normalize final composite score to [0, 1]
        max_rrf = max(rrf_scores.values()) if rrf_scores else 1.0

        hybrid_results: List[RetrievedChunk] = []
        for cid in sorted_chunk_ids[:top_k]:
            original_chunk = chunk_lookup[cid]
            norm_score = rrf_scores[cid] / max_rrf if max_rrf > 0 else 0.0

            # Attach audit trace of retrieval scores in metadata
            meta = dict(original_chunk.metadata)
            meta["hybrid_rrf_raw"] = round(rrf_scores[cid], 6)
            meta.update(sub_scores.get(cid, {}))

            hybrid_results.append(
                RetrievedChunk(
                    chunk_id=cid,
                    page_content=original_chunk.page_content,
                    metadata=meta,
                    score=norm_score,
                    retrieval_method="hybrid",
                )
            )

        return hybrid_results
