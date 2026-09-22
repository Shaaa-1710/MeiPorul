"""NLI inference and verification package."""

from auditor.nli.model import LightweightNLIModel
from auditor.nli.verifier import NLIVerifier

__all__ = [
    "LightweightNLIModel",
    "NLIVerifier",
]
