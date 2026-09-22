"""Generation interface and prompt preparation contract for downstream RAG generators."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from rag.context.context_builder import AssembledContext

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_INSTRUCTION = (
    "You are a helpful and precise assistant. Answer the user question based strictly on the provided context evidence. "
    "If the context does not contain sufficient facts to answer the question, state that the information is unavailable. "
    "Cite the evidence numbers [1], [2], etc., where applicable."
)


@dataclass
class GenerationPayload:
    """Standardized payload passed to downstream language model generators."""

    query: str
    assembled_context: AssembledContext
    system_instruction: str = DEFAULT_SYSTEM_INSTRUCTION
    full_prompt: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "assembled_context": self.assembled_context.to_dict(),
            "system_instruction": self.system_instruction,
            "full_prompt": self.full_prompt,
            "parameters": self.parameters,
        }


class RAGGenerator:
    """RAG generation interface. Prepares prompts and context for downstream model invocation."""

    def __init__(self, default_system_instruction: str = DEFAULT_SYSTEM_INSTRUCTION):
        self.default_system_instruction = default_system_instruction

    def prepare_payload(
        self,
        query: str,
        context: AssembledContext,
        system_instruction: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> GenerationPayload:
        """Construct the prompt package combining system instruction, evidence context, and user query.
        
        Args:
            query: The user query or task prompt.
            context: AssembledContext from the context builder.
            system_instruction: Optional override for system prompt instructions.
            parameters: Optional generation hyperparameters (temperature, max_tokens, etc.).
            
        Returns:
            GenerationPayload ready for consumption by any model backend.
        """
        sys_inst = system_instruction or self.default_system_instruction
        prompt_parts = []

        if context.formatted_context:
            prompt_parts.append(context.formatted_context)

        prompt_parts.append(f"Question: {query}")
        prompt_parts.append("Answer:")

        full_prompt = "\n\n".join(prompt_parts)

        return GenerationPayload(
            query=query,
            assembled_context=context,
            system_instruction=sys_inst,
            full_prompt=full_prompt,
            parameters=parameters or {},
        )

    def generate(self, payload: GenerationPayload) -> str:
        """Placeholder for actual LLM execution.
        
        Per architectural specifications, no specific LLM is implemented here.
        Integration points should implement this method or inject a client callback.
        """
        logger.info(
            f"RAGGenerator.generate called for query '{payload.query}' with {len(payload.assembled_context.evidence_items)} evidence items."
        )
        raise NotImplementedError(
            "RAGGenerator.generate is an abstract interface placeholder. "
            "Implement your LLM provider integration (e.g., OpenAI, Anthropic, Gemini, or local vLLM) here."
        )
