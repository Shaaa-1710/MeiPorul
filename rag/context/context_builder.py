"""Context builder to assemble high-fidelity evidence contexts with provenance citations."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from rag.retrieval.dense import RetrievedChunk

logger = logging.getLogger(__name__)


@dataclass
class EvidenceSnippet:
    """Structured evidence item with provenance for audit and generation."""

    citation_id: int
    chunk_id: str
    source: str
    filename: str
    page_number: int
    content: str
    score: float

    def format_citation(self) -> str:
        """Format a clear, standard source citation tag."""
        return f"[Evidence {self.citation_id} | Source: {self.filename} (p. {self.page_number}) | Chunk: {self.chunk_id}]"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "citation_id": self.citation_id,
            "chunk_id": self.chunk_id,
            "source": self.source,
            "filename": self.filename,
            "page_number": self.page_number,
            "content": self.content,
            "score": self.score,
        }


@dataclass
class AssembledContext:
    """Container holding both formatted context text and structured evidence items."""

    formatted_context: str
    evidence_items: List[EvidenceSnippet] = field(default_factory=list)
    total_characters: int = 0
    estimated_tokens: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "formatted_context": self.formatted_context,
            "evidence_items": [item.to_dict() for item in self.evidence_items],
            "total_characters": self.total_characters,
            "estimated_tokens": self.estimated_tokens,
        }


class ContextBuilder:
    """Transforms filtered chunks into structured, citation-indexed context ready for generation."""

    def __init__(
        self,
        max_context_chars: int = 6000,
        include_scores: bool = False,
        header_template: str = "--- CONTEXT EVIDENCE ---",
        footer_template: str = "--- END OF CONTEXT ---",
    ):
        """
        Args:
            max_context_chars: Hard budget limit on context character count.
            include_scores: Whether to print internal relevance score in the header tag.
            header_template: Prefix header for formatted context string.
            footer_template: Suffix footer for formatted context string.
        """
        self.max_context_chars = max_context_chars
        self.include_scores = include_scores
        self.header_template = header_template
        self.footer_template = footer_template

    def build(self, chunks: List[RetrievedChunk]) -> AssembledContext:
        """Assemble retrieved chunks into structured and formatted context.
        
        Args:
            chunks: Filtered retrieved chunks.
            
        Returns:
            AssembledContext with structured evidence list and formatted prompt string.
        """
        if not chunks:
            return AssembledContext(
                formatted_context="",
                evidence_items=[],
                total_characters=0,
                estimated_tokens=0,
            )

        evidence_items: List[EvidenceSnippet] = []
        context_blocks: List[str] = []
        current_chars = len(self.header_template) + len(self.footer_template) + 10

        for idx, chunk in enumerate(chunks, start=1):
            meta = chunk.metadata or {}
            filename = str(meta.get("filename") or "unknown_document")
            source = str(meta.get("source") or filename)
            page_number = int(meta.get("page_number", 1))

            snippet = EvidenceSnippet(
                citation_id=idx,
                chunk_id=chunk.chunk_id,
                source=source,
                filename=filename,
                page_number=page_number,
                content=chunk.page_content.strip(),
                score=round(chunk.score, 4),
            )

            score_str = f" | Score: {snippet.score:.3f}" if self.include_scores else ""
            block_header = f"[{snippet.citation_id}] {filename} (page {page_number}{score_str}):"
            block = f"{block_header}\n{snippet.content}"

            # Check character budget
            if current_chars + len(block) + 2 > self.max_context_chars:
                # If budget exceeded on very first chunk, truncate it
                if not context_blocks:
                    allowed = self.max_context_chars - current_chars - len(block_header) - 10
                    truncated_content = snippet.content[: max(0, allowed)] + " ... [truncated]"
                    context_blocks.append(f"{block_header}\n{truncated_content}")
                    evidence_items.append(snippet)
                else:
                    logger.info(
                        f"Context budget reached ({self.max_context_chars} chars). Omitted {len(chunks) - idx + 1} remaining chunks."
                    )
                break

            context_blocks.append(block)
            evidence_items.append(snippet)
            current_chars += len(block) + 2

        formatted_context = (
            f"{self.header_template}\n\n"
            + "\n\n".join(context_blocks)
            + f"\n\n{self.footer_template}"
        )

        total_chars = len(formatted_context)
        # Approximate 4 characters per token
        estimated_tokens = max(1, total_chars // 4)

        return AssembledContext(
            formatted_context=formatted_context,
            evidence_items=evidence_items,
            total_characters=total_chars,
            estimated_tokens=estimated_tokens,
        )
