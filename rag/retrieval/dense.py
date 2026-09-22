"""Dense vector retrieval engine powered by persistent ChromaDB."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

try:
    import chromadb
    from chromadb.config import Settings
    from chromadb.utils import embedding_functions
except ImportError:
    chromadb = None  # type: ignore

from rag.ingestion.metadata import sanitize_metadata_for_chroma
from rag.ingestion.parser import Document

logger = logging.getLogger(__name__)

DEFAULT_PERSIST_DIR = os.getenv("CHROMADB_PERSIST_DIR", "./data/chroma_db")
DEFAULT_COLLECTION_NAME = os.getenv("CHROMADB_COLLECTION", "meiporul_chunks")


@dataclass
class RetrievedChunk:
    """Standardized representation of a chunk retrieved by any retrieval or reranking stage."""

    chunk_id: str
    page_content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    score: float = 0.0
    retrieval_method: str = "dense"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "page_content": self.page_content,
            "metadata": self.metadata,
            "score": self.score,
            "retrieval_method": self.retrieval_method,
        }


class ChromaClientManager:
    """Singleton-style manager for persistent ChromaDB client connections."""

    _instances: Dict[str, Any] = {}

    @classmethod
    def get_client(cls, persist_directory: str = DEFAULT_PERSIST_DIR) -> Any:
        if chromadb is None:
            raise ImportError(
                "chromadb is not installed. Please install it using `pip install chromadb`."
            )
        abs_path = str(Path(persist_directory).resolve())
        if abs_path not in cls._instances:
            os.makedirs(abs_path, exist_ok=True)
            client = chromadb.PersistentClient(path=abs_path)
            cls._instances[abs_path] = client
        return cls._instances[abs_path]


class DenseRetriever:
    """Dense vector retriever using ChromaDB for persistent indexing and similarity search."""

    def __init__(
        self,
        collection_name: str = DEFAULT_COLLECTION_NAME,
        persist_directory: str = DEFAULT_PERSIST_DIR,
        embedding_function: Optional[Any] = None,
    ):
        self.collection_name = collection_name
        self.persist_directory = persist_directory

        self.client = ChromaClientManager.get_client(self.persist_directory)

        # Default to Chroma's built-in ONNX / all-MiniLM-L6-v2 embedding function
        if embedding_function is None:
            self.embedding_function = embedding_functions.DefaultEmbeddingFunction()
        else:
            self.embedding_function = embedding_function

        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=self.embedding_function,
            metadata={"hnsw:space": "cosine"},
        )

    def add_documents(self, documents: List[Document], batch_size: int = 250) -> int:
        """Add or update document chunks in the persistent Chroma collection.
        
        Returns:
            Number of documents indexed.
        """
        if not documents:
            return 0

        total_added = 0
        for i in range(0, len(documents), batch_size):
            batch = documents[i : i + batch_size]
            ids: List[str] = []
            documents_text: List[str] = []
            metadatas: List[Dict[str, Any]] = []

            for doc_idx, doc in enumerate(batch):
                chunk_id = str(
                    doc.metadata.get("chunk_id")
                    or f"chunk_{i + doc_idx}_{hash(doc.page_content) & 0xFFFFFFFF}"
                )
                ids.append(chunk_id)
                documents_text.append(doc.page_content)
                meta = sanitize_metadata_for_chroma(doc.metadata)
                meta["chunk_id"] = chunk_id
                metadatas.append(meta)

            # Upsert into ChromaDB
            self.collection.upsert(
                ids=ids,
                documents=documents_text,
                metadatas=metadatas,
            )
            total_added += len(batch)

        logger.info(f"Indexed {total_added} chunks into collection '{self.collection_name}'.")
        return total_added

    def similarity_search_with_score(
        self,
        query: str,
        top_k: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievedChunk]:
        """Perform dense vector similarity search returning chunks with normalized similarity scores.
        
        Cosine distance d in Chroma is in [0, 2]; similarity score is normalized to [0, 1] as 1.0 - (d / 2.0).
        """
        if not query or not query.strip():
            return []

        count = self.collection.count()
        if count == 0:
            logger.warning(f"Chroma collection '{self.collection_name}' is empty.")
            return []

        actual_k = min(top_k, count)
        query_kwargs: Dict[str, Any] = {
            "query_texts": [query],
            "n_results": actual_k,
            "include": ["documents", "metadatas", "distances"],
        }
        if filter_metadata:
            query_kwargs["where"] = filter_metadata

        results = self.collection.query(**query_kwargs)

        retrieved: List[RetrievedChunk] = []
        if not results or not results.get("ids") or not results["ids"][0]:
            return retrieved

        ids = results["ids"][0]
        docs = results["documents"][0] if results.get("documents") else []
        metas = results["metadatas"][0] if results.get("metadatas") else []
        distances = results["distances"][0] if results.get("distances") else []

        for idx in range(len(ids)):
            c_id = ids[idx]
            text = docs[idx] if idx < len(docs) else ""
            meta = metas[idx] if idx < len(metas) else {}
            dist = distances[idx] if idx < len(distances) else 1.0

            # Convert cosine distance to cosine similarity
            # In Chroma cosine distance d = 1 - cos_sim, so cos_sim = 1 - d
            similarity = max(0.0, min(1.0, 1.0 - (dist / 2.0)))

            retrieved.append(
                RetrievedChunk(
                    chunk_id=c_id,
                    page_content=text,
                    metadata=meta,
                    score=similarity,
                    retrieval_method="dense",
                )
            )

        return retrieved

    def similarity_search(
        self,
        query: str,
        top_k: int = 5,
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievedChunk]:
        """Convenience method returning top-k chunks."""
        return self.similarity_search_with_score(query, top_k=top_k, filter_metadata=filter_metadata)

    def count(self) -> int:
        """Return total chunks stored in the collection."""
        return self.collection.count()

    def clear(self) -> None:
        """Delete and re-create collection for fresh indexing."""
        self.client.delete_collection(self.collection_name)
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=self.embedding_function,
            metadata={"hnsw:space": "cosine"},
        )
