# RAG PS-1 — Claim-Level Auditor

Repository skeleton for the production-oriented Claim-Level Auditor for RAG.

## Ownership
- `frontend/` — UI only; intentionally empty in this skeleton.
- `backend/` — APIs, orchestration, persistence, services.
- `rag/` — ingestion, retrieval, reranking, context construction, generation.
- `auditor/` — atomic claims, deterministic verification, NLI, selective escalation, verdicts.
- `shared/` — schemas/contracts/config/utilities shared across services.
- `evaluation/` — hard test cases, benchmarks, metrics, reports.
- `tests/` — unit, integration, and end-to-end tests.
- `deployment/` — container and deployment manifests.

## Core flow
User Query → Hybrid Retrieval → RAG Answer → Atomic Claims → Cheap Checks → NLI → Selective LLM Escalation → Claim Verdicts → Evidence → Final Response
