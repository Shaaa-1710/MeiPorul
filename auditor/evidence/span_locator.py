"""High-precision character and substring locator across evidence chunks."""

from __future__ import annotations

import re
import unicodedata
from typing import Optional, Tuple

from auditor.models.evidence import EvidenceSpan


def normalize_text(text: str) -> str:
    """Normalize Unicode, strip excessive whitespace, and lowercase safely."""
    if not text:
        return ""
    # Normalize Unicode characters (e.g. non-breaking spaces, curly quotes, dashes)
    normalized = unicodedata.normalize("NFKC", text)
    # Replace various dash and quote characters
    normalized = re.sub(r"[–—−]", "-", normalized)
    normalized = re.sub(r"[\u2018\u2019`]", "'", normalized)
    normalized = re.sub(r"[\u201C\u201D]", '"', normalized)
    # Normalize whitespaces
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


class SpanLocator:
    """Locates relevant substrings and character spans inside evidence chunks."""

    def find_span(self, query: str, context: str) -> Optional[Tuple[int, int]]:
        """
        Locate character offsets (start, end) of query within context.
        Tries exact match first, then normalized matching.
        """
        if not query or not context:
            return None

        # 1. Exact direct match
        pos = context.find(query)
        if pos != -1:
            return pos, pos + len(query)

        # 2. Case-insensitive exact match
        lower_context = context.lower()
        lower_query = query.lower()
        pos = lower_context.find(lower_query)
        if pos != -1:
            return pos, pos + len(query)

        # 3. Normalized whitespace / punctuation match
        norm_q = normalize_text(query)
        norm_c = normalize_text(context)
        pos = norm_c.lower().find(norm_q.lower())
        if pos != -1:
            # Map back approximately to context bounds
            return 0, len(context)

        return None

    def extract_evidence_spans(self, claim_text: str, evidence_text: str) -> list[EvidenceSpan]:
        """Find key phrase and entity spans from the claim within the evidence text."""
        spans: list[EvidenceSpan] = []
        clean_claim = claim_text.strip().rstrip(".")

        # Check full claim substring
        full_loc = self.find_span(clean_claim, evidence_text)
        if full_loc:
            spans.append(
                EvidenceSpan(
                    start_char=full_loc[0],
                    end_char=full_loc[1],
                    text=evidence_text[full_loc[0]:full_loc[1]],
                    confidence=1.0,
                )
            )
            return spans

        # Check key numeric or entity phrases
        key_phrases = re.findall(
            r"(?:₹|INR|\$|€|£)?\s*\d+(?:,\d+)*(?:\.\d+)?\s*(?:lakh|lakhs|crore|crores|TB|GB|MB|%|years|days|months)?|\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b",
            clean_claim,
        )
        for phrase in key_phrases:
            phrase = phrase.strip()
            if len(phrase) >= 2:
                loc = self.find_span(phrase, evidence_text)
                if loc:
                    spans.append(
                        EvidenceSpan(
                            start_char=loc[0],
                            end_char=loc[1],
                            text=evidence_text[loc[0]:loc[1]],
                            confidence=0.9,
                        )
                    )

        return spans
