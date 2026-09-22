"""Evidence package for selection, ranking, and span tracking."""

from auditor.evidence.selector import EvidenceSelector
from auditor.evidence.span_locator import SpanLocator, normalize_text

__all__ = [
    "EvidenceSelector",
    "SpanLocator",
    "normalize_text",
]
