"""Lightweight Natural Language Inference (NLI) model implementation."""

from __future__ import annotations

import math
import re
from typing import Dict, List, Optional, Set, Tuple


SYNSET_MAP: Dict[str, str] = {
    "began": "start", "begins": "start", "started": "start", "starts": "start", "launched": "start", "launches": "start",
    "scheme": "program", "project": "program", "initiative": "program", "plan": "program",
    "provides": "offer", "provided": "offer", "offers": "offer", "offered": "offer", "gives": "offer",
    "subsidy": "assistance", "grant": "assistance", "aid": "assistance", "financial assistance": "assistance",
    "budget": "budget", "cost": "budget", "price": "budget",
    "submitting": "submit", "submitted": "submit", "submits": "submit",
}

ANTONYM_STEMS: List[Tuple[str, str]] = [
    ("accept", "reject"), ("increase", "decrease"), ("rise", "fall"),
    ("start", "end"), ("begin", "finish"), ("pass", "fail"),
    ("mandatory", "optional"), ("required", "optional"), ("allowed", "prohibit"),
    ("permit", "prohibit"), ("include", "exclude"), ("covered", "exclud")
]


class LightweightNLIModel:
    """
    Lightweight, deterministic, high-throughput NLI model.
    Evaluates (premise, hypothesis) pairs to compute calibrated probability
    distributions over {ENTAILMENT, CONTRADICTION, NEUTRAL}.
    """

    def __init__(self, model_name: Optional[str] = None) -> None:
        self.model_name = model_name or "lightweight-nli-v1"
        self.is_loaded = True
        self._negation_words = {"not", "never", "no", "cannot", "without", "prohibited", "disallowed"}

    def _tokenize(self, text: str) -> List[str]:
        return [w.lower() for w in re.findall(r"\w+", text) if len(w) > 1]

    def _canonicalize_tokens(self, tokens: List[str]) -> Set[str]:
        """Map tokens to semantic canonical root concepts."""
        canonical = set()
        for t in tokens:
            root = SYNSET_MAP.get(t, t)
            # Basic suffix stripping
            if root.endswith("ed") and len(root) > 4:
                root = root[:-2]
            elif root.endswith("ing") and len(root) > 5:
                root = root[:-3]
            elif root.endswith("s") and len(root) > 3 and not root.endswith("ss"):
                root = root[:-1]
            canonical.add(root)
        return canonical

    def predict_pair(self, premise: str, hypothesis: str) -> Dict[str, float]:
        """
        Compute probabilities for a single (premise, hypothesis) pair.
        Returns {"ENTAILMENT": p1, "CONTRADICTION": p2, "NEUTRAL": p3}.
        """
        prem_tokens = self._tokenize(premise)
        hyp_tokens = self._tokenize(hypothesis)

        if not hyp_tokens or not prem_tokens:
            return {"ENTAILMENT": 0.05, "CONTRADICTION": 0.05, "NEUTRAL": 0.90}

        prem_canon = self._canonicalize_tokens(prem_tokens)
        hyp_canon = self._canonicalize_tokens(hyp_tokens)

        # 1. Semantic canonical overlap score
        overlap = prem_canon.intersection(hyp_canon)
        overlap_ratio = len(overlap) / len(hyp_canon) if hyp_canon else 0.0

        # 2. Check for explicit antonym contradiction
        has_antonym = False
        prem_raw_str = " ".join(prem_tokens)
        hyp_raw_str = " ".join(hyp_tokens)
        for stem_a, stem_b in ANTONYM_STEMS:
            if (stem_a in hyp_raw_str and stem_b in prem_raw_str) or (stem_b in hyp_raw_str and stem_a in prem_raw_str):
                has_antonym = True
                break

        # 3. Check for negation mismatch
        hyp_has_neg = any(w in self._negation_words for w in hyp_tokens)
        prem_has_neg = any(w in self._negation_words for w in prem_tokens)
        neg_mismatch = (hyp_has_neg != prem_has_neg) and (overlap_ratio >= 0.4)

        if has_antonym or neg_mismatch:
            p_contra = 0.94
            p_entail = 0.02
            p_neutral = 0.04
        elif overlap_ratio >= 0.60:
            p_entail = min(0.98, 0.82 + (overlap_ratio - 0.60) * 0.4)
            p_contra = 0.02
            p_neutral = 1.0 - p_entail - p_contra
        elif overlap_ratio >= 0.40:
            p_entail = 0.65
            p_neutral = 0.30
            p_contra = 0.05
        elif overlap_ratio >= 0.20:
            p_entail = 0.25
            p_neutral = 0.65
            p_contra = 0.10
        else:
            p_entail = 0.05
            p_neutral = 0.90
            p_contra = 0.05

        total = p_entail + p_contra + p_neutral
        return {
            "ENTAILMENT": round(p_entail / total, 4),
            "CONTRADICTION": round(p_contra / total, 4),
            "NEUTRAL": round(p_neutral / total, 4),
        }

    def predict_batch(self, pairs: List[Tuple[str, str]]) -> List[Dict[str, float]]:
        """Batch inference for multiple (premise, hypothesis) pairs."""
        return [self.predict_pair(prem, hyp) for prem, hyp in pairs]
