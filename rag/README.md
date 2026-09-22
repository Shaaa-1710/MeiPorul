# MeiPorul — RAG / Retrieval Subsystem (Member 2)

A modular, production-grade Retrieval-Augmented Generation (RAG) retrieval and indexing engine.

---

## 1. Architecture Overview

The RAG subsystem is designed to ingest raw multi-format documents, perform semantic boundary-aware chunking, index chunks into both dense vector storage (persistent ChromaDB) and sparse keyword storage (pure-Python BM25), combine candidates via Reciprocal Rank Fusion (RRF), apply neural reranking, filter near-duplicate and low-confidence noise, and assemble clean, citation-indexed context for downstream generation.

```
┌──────────────────┐
│  Raw Documents   │ (PDF, TXT, MD, CSV, JSON)
└────────┬─────────┘
         │
         ▼ (ingestion/parser.py + ingestion/metadata.py)
┌──────────────────┐
│ Structured Docs  │ Standardized metadata (doc_id, content_hash, page, source)
└────────┬─────────┘
         │
         ▼ (chunking/semantic_chunker.py)
┌──────────────────┐
│  Semantic Chunks │ Consecutive sentence distance thresholding + min/max token constraints
└────────┬─────────┘
         │
         ├────────────────────────────────────────┐
         │ (Indexing)                             │ (Indexing)
         ▼                                        ▼
┌──────────────────┐                     ┌──────────────────┐
│ ChromaDB (Dense) │                     │  BM25 (Sparse)   │
│  (retrieval/     │                     │  (retrieval/     │
│     dense.py)    │                     │    sparse.py)    │
└────────┬─────────┘                     └────────┬─────────┘
         │                                        │
         │  Query Vector Search                   │  Query Token Match
         └──────────────────┬─────────────────────┘
                            │
                            ▼ (retrieval/hybrid.py)
                 ┌──────────────────────┐
                 │ Reciprocal Rank      │ Dense + Sparse Candidate Fusion
                 │ Fusion (RRF)         │
                 └──────────┬───────────┘
                            │
                            ▼ (reranking/reranker.py)
                 ┌──────────────────────┐
                 │ CrossEncoder Rerank  │ ms-marco-MiniLM-L-6-v2
                 │ (Algorithmic Fallback)
                 └──────────┬───────────┘
                            │
                            ▼ (context/evidence_filter.py)
                 ┌──────────────────────┐
                 │ Evidence Filter      │ Deduplication, Score Thresholds,
                 │                      │ Token Jaccard Filter
                 └──────────┬───────────┘
                            │
                            ▼ (context/context_builder.py)
                 ┌──────────────────────┐
                 │ Context Builder      │ Provenance Citations,
                 │                      │ Token Budget Management
                 └──────────┬───────────┘
                            │
                            ▼ (generation/generator.py)
                 ┌──────────────────────┐
                 │ Generation Payload   │ Clean Prompt & Context Ready
                 │                      │ for Model Invocation
                 └──────────────────────┘
```

---

## 2. Directory & File Responsibilities

All retrieval and ingestion logic is strictly maintained inside `rag/`:

```
rag/
├── chunking/
│   └── semantic_chunker.py   # Sentence distance thresholding & boundary chunking
├── context/
│   ├── context_builder.py    # Formatted context assembler with provenance tags
│   └── evidence_filter.py    # Noise rejection, score cutoff & Jaccard deduplication
├── generation/
│   └── generator.py          # Prompt packaging contract (LLM execution placeholder)
├── ingestion/
│   ├── metadata.py           # Metadata extraction, hashing & ChromaDB sanitization
│   └── parser.py             # Multi-format document parser (PDF, TXT, MD, CSV, JSON)
├── reranking/
│   └── reranker.py           # CrossEncoder neural scoring + algorithmic fallback
├── retrieval/
│   ├── dense.py              # Persistent ChromaDB client, indexing & vector search
│   ├── hybrid.py             # Reciprocal Rank Fusion (RRF) candidate combiner
│   └── sparse.py             # Standalone zero-dependency pure-Python BM25Okapi
└── README.md                 # Complete subsystem documentation
```

---

## 3. Component Details & API Usage

### A. Document Ingestion (`rag/ingestion/`)

`DocumentParser` automatically selects the appropriate loader based on file extension and produces `Document` objects with standardized metadata.

```python
from rag.ingestion.parser import DocumentParser

parser = DocumentParser()

# Ingest single file (PDF, TXT, Markdown, CSV, JSON)
docs = parser.parse_file("path/to/research_paper.pdf")

# Ingest an entire directory recursively
all_docs = parser.parse_directory("path/to/docs/", recursive=True)
```

**Standardized Metadata fields (`rag/ingestion/metadata.py`):**
- `doc_id`: Unique deterministic document identifier.
- `source`: Absolute path or URI of source document.
- `filename`: Base name of the file.
- `file_type`: Extension type (`pdf`, `txt`, `md`, etc.).
- `page_number`: Page index (1-indexed for multi-page documents like PDF).
- `content_hash`: SHA-256 fingerprint of text content.
- `char_length`: Character length.
- `word_count`: Approximate word count.

---

### B. Semantic Chunking (`rag/chunking/semantic_chunker.py`)

`SemanticChunker` segments text into sentence windows, calculates embedding cosine distance between adjacent sentences, and triggers a split when semantic drift exceeds `similarity_threshold` while honoring `min_chunk_chars` and `max_chunk_chars`.

```python
from rag.chunking.semantic_chunker import SemanticChunker

chunker = SemanticChunker(
    similarity_threshold=0.5,
    min_chunk_chars=150,
    max_chunk_chars=1200,
    overlap_sentences=1,
)

chunks = chunker.chunk_documents(docs)
```

---

### C. Dense Vector Retrieval (`rag/retrieval/dense.py`)

Integrates persistent ChromaDB with cosine distance indexing.

- **Persistence Path**: Configurable via `CHROMADB_PERSIST_DIR` environment variable (default: `./data/chroma_db`).
- **Collection Name**: Configurable via `CHROMADB_COLLECTION` (default: `meiporul_chunks`).
- **Embedding Model**: Default ONNX / `all-MiniLM-L6-v2` embedding function.

```python
from rag.retrieval.dense import DenseRetriever

dense_retriever = DenseRetriever(
    collection_name="meiporul_chunks",
    persist_directory="./data/chroma_db",
)

# Index chunks
dense_retriever.add_documents(chunks)

# Similarity search
results = dense_retriever.similarity_search_with_score(query="sample query", top_k=5)
```

---

### D. Sparse Keyword Retrieval (`rag/retrieval/sparse.py`)

Zero-dependency, standalone pure-Python `BM25Okapi` implementation. Features custom tokenization, stopword removal, and Okapi IDF smoothing with negative-IDF flooring.

```python
from rag.retrieval.sparse import SparseRetriever

sparse_retriever = SparseRetriever(
    k1=1.5,
    b=0.75,
    persistence_path="./data/bm25_index.json",
)

# Index chunks
sparse_retriever.index_documents(chunks)

# Search
results = sparse_retriever.search(query="exact keyword phrase", top_k=5)
```

---

### E. Hybrid Retrieval (`rag/retrieval/hybrid.py`)

Fuses dense and sparse candidate sets using Reciprocal Rank Fusion:

$$\text{RRF\_Score}(d) = \sum_{m \in \{\text{dense}, \text{sparse}\}} \frac{w_m}{k + \text{rank}_m(d)}$$

```python
from rag.retrieval.hybrid import HybridRetriever

hybrid_retriever = HybridRetriever(
    dense_retriever=dense_retriever,
    sparse_retriever=sparse_retriever,
    dense_weight=0.6,
    sparse_weight=0.4,
    rrf_k=60,
)

fused_chunks = hybrid_retriever.retrieve(query="user query", top_k=10)
```

---

### F. Reranking (`rag/reranking/reranker.py`)

Uses `sentence_transformers.CrossEncoder` (`cross-encoder/ms-marco-MiniLM-L-6-v2`) to compute deep query-document relevance. If neural weights cannot be loaded (e.g. offline environment), it automatically falls back to an algorithmic scoring booster combining retrieval score, lexical query overlap, and position priors.

```python
from rag.reranking.reranker import Reranker

reranker = Reranker(model_name="cross-encoder/ms-marco-MiniLM-L-6-v2")
reranked_chunks = reranker.rerank(query="user query", chunks=fused_chunks, top_k=5)
```

---

### G. Evidence Filtering (`rag/context/evidence_filter.py`)

Prunes retrieved chunks by:
1. Minimum normalized score threshold (`min_score`).
2. Minimum character length (`min_char_length`).
3. SHA-256 exact content hash deduplication.
4. Token-level Jaccard similarity thresholding (`near_duplicate_threshold = 0.85`).

```python
from rag.context.evidence_filter import EvidenceFilter

filter_engine = EvidenceFilter(min_score=0.15, max_evidence_chunks=5)
clean_evidence = filter_engine.filter(reranked_chunks)
```

---

### H. Context Building (`rag/context/context_builder.py`)

Structures filtered chunks into formatted prompt context with source citations, page numbers, chunk identifiers, and strict token/character budget limits.

```python
from rag.context.context_builder import ContextBuilder

builder = ContextBuilder(max_context_chars=4000)
context = builder.build(clean_evidence)

print(context.formatted_context)
# Displays:
# --- CONTEXT EVIDENCE ---
# [1] document.pdf (page 2):
# <evidence chunk text>
# --- END OF CONTEXT ---
```

---

### I. Generation Interface (`rag/generation/generator.py`)

Prepares clean generation payloads for downstream LLMs without locking into any specific LLM provider or hardcoding API keys.

```python
from rag.generation.generator import RAGGenerator

generator = RAGGenerator()
payload = generator.prepare_payload(query="user query", context=context)

# payload.full_prompt is now ready for any LLM API (OpenAI, Anthropic, Gemini, local)
```

---

## 4. End-to-End Pipeline Example

```python
from rag.ingestion.parser import DocumentParser
from rag.chunking.semantic_chunker import SemanticChunker
from rag.retrieval.dense import DenseRetriever
from rag.retrieval.sparse import SparseRetriever
from rag.retrieval.hybrid import HybridRetriever
from rag.reranking.reranker import Reranker
from rag.context.evidence_filter import EvidenceFilter
from rag.context.context_builder import ContextBuilder
from rag.generation.generator import RAGGenerator

# 1. Parse documents
parser = DocumentParser()
docs = parser.parse_file("sample_doc.txt")

# 2. Chunk semantically
chunker = SemanticChunker(similarity_threshold=0.5, min_chunk_chars=100, max_chunk_chars=800)
chunks = chunker.chunk_documents(docs)

# 3. Index into vector & keyword databases
dense = DenseRetriever(persist_directory="./data/chroma_db")
dense.add_documents(chunks)

sparse = SparseRetriever()
sparse.index_documents(chunks)

# 4. Hybrid Search
hybrid = HybridRetriever(dense, sparse)
candidates = hybrid.retrieve(query="What are the key findings?", top_k=8)

# 5. Rerank
reranker = Reranker()
reranked = reranker.rerank(query="What are the key findings?", chunks=candidates, top_k=5)

# 6. Filter Evidence
evidence_filter = EvidenceFilter(min_score=0.2, max_evidence_chunks=4)
filtered = evidence_filter.filter(reranked)

# 7. Build Context
builder = ContextBuilder(max_context_chars=3000)
context = builder.build(filtered)

# 8. Prepare for Generator
generator = RAGGenerator()
payload = generator.prepare_payload(query="What are the key findings?", context=context)

print("Generated Prompt:\n", payload.full_prompt)
```
