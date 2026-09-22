"""Reranker module using CrossEncoder neural models with graceful algorithmic RRF fallback."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

try:
    from sentence_transformers import CrossEncoder
except ImportError:
    CrossEncoder = None  # type: ignore

from rag.retrieval.dense import RetrievedChunk

logger = logging.getLogger(__name__)

DEFAULT_CROSS_ENCODER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


class Reranker:
    """Reranks retrieved candidate chunks to maximize relevance to the user query."""

    def __init__(
        self,
        model_name: str = DEFAULT_CROSS_ENCODER_MODEL,
        device: Optional[str] = None,
        use_neural: bool = True,
    ):
        """
        Args:
            model_name: HuggingFace model identifier for sentence_transformers.CrossEncoder.
            device: 'cpu', 'cuda', etc. Defaults to auto-selection.
            use_neural: If False, forces the algorithmic fallback reranker.
        """
        self.model_name = model_name
        self.device = device
        self.use_neural = use_neural
        self._cross_encoder = None
        self._init_failed = False

    def _get_cross_encoder(self) -> Optional[Any]:
        """Lazy load CrossEncoder with graceful fallback."""
        if not self.use_neural or self._init_failed:
            return None

        if self._cross_encoder is not None:
            return self._cross_encoder

        if CrossEncoder is None:
            logger.warning(
                "sentence_transformers.CrossEncoder is unavailable. Falling back to algorithmic reranker."
            )
            self._init_failed = True
            return None

        try:
            logger.info(f"Loading CrossEncoder model '{self.model_name}'...")
            kwargs = {}
            if self.device:
                kwargs["device"] = self.device
            self._cross_encoder = CrossEncoder(self.model_name, **kwargs)
            return self._cross_encoder
        except Exception as e:
            logger.warning(
                f"Failed to load CrossEncoder '{self.model_name}': {e}. Falling back to algorithmic score booster."
            )
            self._init_failed = True
            return None

    def _algorithmic_fallback_rerank(
        self, query: str, chunks: List[RetrievedChunk]
    ) -> List[RetrievedChunk]:
        """Algorithmic reranker combining retrieval score with query term overlap & position penalty."""
        query_words = set(query.lower().split())
        scored_chunks: List[RetrievedChunk] = []

        for rank, chunk in enumerate(chunks):
            content_lower = chunk.page_content.lower()
            content_words = set(content_lower.split())

            # Lexical overlap fraction
            overlap = (
                len(query_words.intersection(content_words)) / len(query_words)
                if query_words
                else 0.0
            )

            # Exact phrase presence boost
            phrase_boost = 0.2 if query.lower() in content_lower else 0.0

            # Retrieval score contribution
            base_score = chunk.score

            # Position prior (mild decay for later candidates)
            pos_factor = 1.0 / (1.0 + 0.05 * rank)

            composite_score = (0.5 * base_score + 0.3 * overlap + phrase_boost) * pos_factor

            meta = dict(chunk.metadata)
            meta["rerank_type"] = "algorithmic_fallback"
            meta["lexical_overlap"] = round(overlap, 4)

            scored_chunks.append(
                RetrievedChunk(
                    chunk_id=chunk.chunk_id,
                    page_content=chunk.page_content,
                    metadata=meta,
                    score=composite_score,
                    retrieval_method="reranked",
                )
            )

        scored_chunks.sort(key=lambda c: c.score, reverse=True)
        return scored_chunks

    def rerank(
        self,
        query: str,
        chunks: List[RetrievedChunk],
        top_k: Optional[int] = None,
    ) -> List[RetrievedChunk]:
        """Rerank chunks for the given query.
        
        Args:
            query: Query string.
            chunks: Candidate chunks retrieved from previous stage.
            top_k: Number of reranked chunks to return (returns all if None).
            
        Returns:
            Reranked list of RetrievedChunk items ordered by descending relevance.
        """
        if not chunks:
            return []
        if not query or not query.strip():
            return chunks[:top_k] if top_k else chunks

        encoder = self._get_cross_encoder()

        # If neural encoder is not available, execute algorithmic fallback
        if encoder is None:
            reranked = self._algorithmic_fallback_rerank(query, chunks)
            return reranked[:top_k] if top_k else reranked

        # Cross-encoder scoring
        pairs = [[query, chunk.page_content] for chunk in chunks]
        try:
            scores = encoder.predict(pairs)
            
            # Min-max normalization for positive bounded scores
            min_s = float(min(scores))
            max_s = float(max(scores))
            score_range = max_s - min_s if max_s > min_s else 1.0

            reranked_chunks: List[RetrievedChunk] = []
            for idx, raw_score in enumerate(scores):
                chunk = chunks[idx]
                norm_score = float((raw_score - min_s) / score_range) if max_s > min_s else float(raw_score)

                meta = dict(chunk.metadata)
                meta["cross_encoder_raw"] = float(raw_score)
                meta["rerank_type"] = "cross_encoder"

                reranked_chunks.append(
                    RetrievedChunk(
                        chunk_id=chunk.chunk_id,
                        page_content=chunk.page_content,
                        metadata=meta,
                        score=norm_score,
                        retrieval_method="reranked",
                    )
                )

            reranked_chunks.sort(key=lambda c: c.score, reverse=True)
            return reranked_chunks[:top_k] if top_k else reranked_chunks

        except Exception as e:
            logger.error(f"CrossEncoder inference failed: {e}. Falling back to algorithmic rerank.")
            reranked = self._algorithmic_fallback_rerank(query, chunks)
            return reranked[:top_k] if top_k else reranked
