"""Sparse retrieval engine implementing pure-Python BM25Okapi with tokenizer and persistence."""

from __future__ import annotations

import json
import math
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

from rag.ingestion.parser import Document
from rag.retrieval.dense import RetrievedChunk

DEFAULT_STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't",
    "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't",
    "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm",
    "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more",
    "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or",
    "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
    "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's",
    "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they",
    "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under",
    "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who",
    "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll",
    "you're", "you've", "your", "yours", "yourself", "yourselves"
}


def default_tokenizer(text: str, remove_stopwords: bool = True) -> List[str]:
    """Tokenize, lowercase, strip punctuation and optionally remove stopwords."""
    tokens = re.findall(r"\b[a-zA-Z0-9_\-\.]{2,}\b", text.lower())
    if remove_stopwords:
        tokens = [t for t in tokens if t not in DEFAULT_STOPWORDS]
    return tokens


class BM25Okapi:
    """Production-quality, standalone pure-Python implementation of BM25Okapi."""

    def __init__(
        self,
        corpus: Sequence[List[str]],
        k1: float = 1.5,
        b: float = 0.75,
        epsilon: float = 0.25,
    ):
        self.k1 = k1
        self.b = b
        self.epsilon = epsilon

        self.corpus_size = len(corpus)
        self.doc_lengths = [len(doc) for doc in corpus]
        self.avg_doc_len = sum(self.doc_lengths) / self.corpus_size if self.corpus_size > 0 else 0.0

        # Term frequency per document
        self.doc_freqs: List[Counter[str]] = [Counter(doc) for doc in corpus]

        # Calculate document frequency (DF) for each term across corpus
        self.df: Dict[str, int] = {}
        for counts in self.doc_freqs:
            for term in counts.keys():
                self.df[term] = self.df.get(term, 0) + 1

        # Calculate inverse document frequency (IDF) for each term
        self.idf: Dict[str, float] = {}
        self._calculate_idf()

    def _calculate_idf(self) -> None:
        """Calculate Okapi IDF for each term with negative-weight floor."""
        negative_idfs: List[str] = []
        idf_sum = 0.0

        for term, freq in self.df.items():
            # Standard Okapi IDF formula: ln((N - n + 0.5) / (n + 0.5) + 1)
            raw_idf = math.log(
                (self.corpus_size - freq + 0.5) / (freq + 0.5) + 1.0
            )
            self.idf[term] = raw_idf
            idf_sum += raw_idf
            if raw_idf < 0:
                negative_idfs.append(term)

        avg_idf = idf_sum / len(self.idf) if self.idf else 0.0
        eps = self.epsilon * avg_idf

        # Floor negative IDF terms to epsilon * avg_idf
        for term in negative_idfs:
            self.idf[term] = eps

    def get_scores(self, query_tokens: List[str]) -> List[float]:
        """Compute BM25 score for a tokenized query against all indexed documents."""
        scores = [0.0] * self.corpus_size
        if self.corpus_size == 0 or not query_tokens:
            return scores

        for q_token in query_tokens:
            if q_token not in self.idf:
                continue
            q_idf = self.idf[q_token]

            for doc_idx, freq_counter in enumerate(self.doc_freqs):
                tf = freq_counter.get(q_token, 0)
                if tf == 0:
                    continue
                doc_len = self.doc_lengths[doc_idx]
                # BM25 term score
                numerator = tf * (self.k1 + 1.0)
                denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avg_doc_len))
                scores[doc_idx] += q_idf * (numerator / denominator)

        return scores


class SparseRetriever:
    """Sparse keyword retrieval engine using BM25Okapi over indexed chunks."""

    def __init__(
        self,
        k1: float = 1.5,
        b: float = 0.75,
        persistence_path: Optional[str] = None,
    ):
        self.k1 = k1
        self.b = b
        self.persistence_path = persistence_path

        self.documents: List[Document] = []
        self.tokenized_corpus: List[List[str]] = []
        self.bm25: Optional[BM25Okapi] = None

        if self.persistence_path and os.path.exists(self.persistence_path):
            self.load(self.persistence_path)

    def index_documents(self, documents: List[Document]) -> int:
        """Index a list of Document instances into the BM25 sparse index."""
        if not documents:
            return 0

        self.documents = list(documents)
        self.tokenized_corpus = [default_tokenizer(doc.page_content) for doc in self.documents]
        self.bm25 = BM25Okapi(self.tokenized_corpus, k1=self.k1, b=self.b)

        if self.persistence_path:
            self.save(self.persistence_path)

        return len(self.documents)

    def search(self, query: str, top_k: int = 5) -> List[RetrievedChunk]:
        """Perform BM25 sparse search and return top-k RetrievedChunk items with normalized scores."""
        if not query or not query.strip() or not self.bm25 or not self.documents:
            return []

        tokens = default_tokenizer(query)
        if not tokens:
            return []

        raw_scores = self.bm25.get_scores(tokens)
        max_score = max(raw_scores) if raw_scores else 0.0

        # Sort indices by score descending
        ranked_indices = sorted(
            range(len(raw_scores)),
            key=lambda i: raw_scores[i],
            reverse=True,
        )

        results: List[RetrievedChunk] = []
        for idx in ranked_indices[:top_k]:
            score = raw_scores[idx]
            if score <= 0.0:
                continue

            doc = self.documents[idx]
            chunk_id = str(doc.metadata.get("chunk_id", f"sparse_chunk_{idx}"))
            # Normalize BM25 score to [0, 1] relative to top hit
            norm_score = (score / max_score) if max_score > 0 else 0.0

            results.append(
                RetrievedChunk(
                    chunk_id=chunk_id,
                    page_content=doc.page_content,
                    metadata=doc.metadata,
                    score=norm_score,
                    retrieval_method="sparse",
                )
            )

        return results

    def save(self, file_path: str) -> None:
        """Persist documents and tokens to disk."""
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "documents": [d.to_dict() for d in self.documents],
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)

    def load(self, file_path: str) -> None:
        """Load sparse index from disk."""
        path = Path(file_path)
        if not path.is_file():
            return
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        docs = [Document.from_dict(d) for d in data.get("documents", [])]
        self.index_documents(docs)
