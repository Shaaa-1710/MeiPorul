"""Semantic chunker using sentence boundary detection, embedding distance thresholding, and size constraints."""

from __future__ import annotations

import logging
import math
import re
from typing import Any, Callable, Dict, List, Optional, Sequence, Union

from rag.ingestion.metadata import compute_content_hash, sanitize_metadata_for_chroma
from rag.ingestion.parser import Document

logger = logging.getLogger(__name__)


def _split_into_sentences(text: str) -> List[str]:
    """Split text into sentences using standard regex boundaries."""
    # Pattern to match end of sentence punctuation followed by space or newline
    sentence_pattern = r'(?<=[.!?])\s+(?=[A-Z0-9"\'`])|\n{2,}'
    raw_sentences = re.split(sentence_pattern, text)
    sentences = [s.strip() for s in raw_sentences if s.strip()]
    if not sentences and text.strip():
        sentences = [text.strip()]
    return sentences


def _cosine_distance(vec_a: Sequence[float], vec_b: Sequence[float]) -> float:
    """Compute cosine distance between two numeric vectors."""
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 1.0
    similarity = dot / (norm_a * norm_b)
    # Clamp to [-1.0, 1.0] for floating point stability
    similarity = max(-1.0, min(1.0, similarity))
    return 1.0 - similarity


class SemanticChunker:
    """Chunks documents using semantic sentence-window similarity with min/max boundary constraints."""

    def __init__(
        self,
        similarity_threshold: float = 0.5,
        min_chunk_chars: int = 150,
        max_chunk_chars: int = 1200,
        overlap_sentences: int = 1,
        embedding_fn: Optional[Callable[[List[str]], List[List[float]]]] = None,
    ):
        """
        Args:
            similarity_threshold: Cosine distance threshold above which a split occurs (0.0 to 1.0).
            min_chunk_chars: Minimum character length for a chunk before a split can occur.
            max_chunk_chars: Hard upper limit on character length per chunk.
            overlap_sentences: Number of trailing sentences to include as overlap in subsequent chunk.
            embedding_fn: Optional custom embedding callable; defaults to Chroma's DefaultEmbeddingFunction.
        """
        self.similarity_threshold = similarity_threshold
        self.min_chunk_chars = min_chunk_chars
        self.max_chunk_chars = max_chunk_chars
        self.overlap_sentences = max(0, overlap_sentences)
        self._embedding_fn = embedding_fn

    def _get_embedding_fn(self) -> Callable[[List[str]], List[List[float]]]:
        """Lazy-load embedding function if none provided."""
        if self._embedding_fn is not None:
            return self._embedding_fn

        try:
            from chromadb.utils import embedding_functions
            default_ef = embedding_functions.DefaultEmbeddingFunction()
            self._embedding_fn = default_ef
            return self._embedding_fn
        except Exception as e:
            logger.warning(
                f"Could not load Chroma DefaultEmbeddingFunction: {e}. Falling back to lexical n-gram vectors."
            )
            # Fallback zero-dependency deterministic character/token frequency embedder
            def fallback_embedder(texts: List[str]) -> List[List[float]]:
                vectors: List[List[float]] = []
                vocab = {w: i for i, w in enumerate(["the", "is", "at", "which", "on", "and", "a", "an", "in", "to", "for", "with", "as", "by", "that", "this"])}
                for t in texts:
                    vec = [0.0] * (len(vocab) + 16)
                    words = re.findall(r"\w+", t.lower())
                    for w in words:
                        if w in vocab:
                            vec[vocab[w]] += 1.0
                        else:
                            vec[len(vocab) + (hash(w) % 16)] += 1.0
                    vectors.append(vec)
                return vectors

            self._embedding_fn = fallback_embedder
            return self._embedding_fn

    def _calculate_sentence_distances(self, sentences: List[str]) -> List[float]:
        """Compute cosine distance between consecutive sentences."""
        if len(sentences) <= 1:
            return []

        embedder = self._get_embedding_fn()
        try:
            embeddings = embedder(sentences)
        except Exception as e:
            logger.warning(f"Error computing sentence embeddings: {e}, using zero distances.")
            return [0.0] * (len(sentences) - 1)

        distances: List[float] = []
        for i in range(len(embeddings) - 1):
            dist = _cosine_distance(embeddings[i], embeddings[i + 1])
            distances.append(dist)
        return distances

    def split_text(self, text: str, parent_metadata: Optional[Dict[str, Any]] = None) -> List[Document]:
        """Split raw text into semantic chunks wrapped in Document instances."""
        if not text or not text.strip():
            return []

        sentences = _split_into_sentences(text)
        if len(sentences) <= 1:
            meta = dict(parent_metadata or {})
            meta["chunk_index"] = 0
            meta["chunk_id"] = f"{meta.get('doc_id', 'chunk')}_c0"
            meta["content_hash"] = compute_content_hash(text.strip())
            return [Document(page_content=text.strip(), metadata=sanitize_metadata_for_chroma(meta))]

        distances = self._calculate_sentence_distances(sentences)

        chunks: List[List[str]] = []
        current_chunk: List[str] = [sentences[0]]
        current_len = len(sentences[0])

        for i in range(len(distances)):
            next_sent = sentences[i + 1]
            dist = distances[i]
            proposed_len = current_len + 1 + len(next_sent)

            # Check whether we should split:
            # 1. Distance exceeds threshold AND current length >= min_chunk_chars
            # 2. OR proposed length exceeds max_chunk_chars
            should_split_semantic = dist >= self.similarity_threshold and current_len >= self.min_chunk_chars
            should_split_hard = proposed_len > self.max_chunk_chars and current_len >= self.min_chunk_chars

            if should_split_semantic or should_split_hard:
                chunks.append(list(current_chunk))
                # Compute overlap
                if self.overlap_sentences > 0 and len(current_chunk) >= self.overlap_sentences:
                    overlap = current_chunk[-self.overlap_sentences :]
                    current_chunk = list(overlap) + [next_sent]
                else:
                    current_chunk = [next_sent]
                current_len = sum(len(s) for s in current_chunk) + len(current_chunk) - 1
            else:
                current_chunk.append(next_sent)
                current_len = proposed_len

        if current_chunk:
            chunks.append(current_chunk)

        # Build Document objects with updated metadata
        doc_chunks: List[Document] = []
        parent_id = parent_metadata.get("doc_id", "doc") if parent_metadata else "doc"

        for idx, chunk_sentences in enumerate(chunks):
            content = " ".join(chunk_sentences).strip()
            if not content:
                continue

            meta = dict(parent_metadata or {})
            meta["parent_doc_id"] = parent_id
            meta["chunk_index"] = idx
            meta["chunk_id"] = f"{parent_id}_c{idx}"
            meta["content_hash"] = compute_content_hash(content)
            meta["char_length"] = len(content)
            meta["word_count"] = len(content.split())
            meta["total_chunks_in_doc"] = len(chunks)

            doc_chunks.append(
                Document(
                    page_content=content,
                    metadata=sanitize_metadata_for_chroma(meta),
                )
            )

        return doc_chunks

    def chunk_documents(self, documents: List[Document]) -> List[Document]:
        """Process multiple documents and return a flattened list of chunks."""
        all_chunks: List[Document] = []
        for doc in documents:
            chunks = self.split_text(doc.page_content, parent_metadata=doc.metadata)
            all_chunks.extend(chunks)
        return all_chunks
