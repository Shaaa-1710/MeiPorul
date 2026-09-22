"""Metadata extraction, standardization, and sanitization for ingested documents."""

from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Union


def compute_content_hash(text: str) -> str:
    """Compute a deterministic SHA-256 hash of text content."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sanitize_metadata_for_chroma(metadata: Dict[str, Any]) -> Dict[str, Union[str, int, float, bool]]:
    """Sanitize metadata values so they are strictly acceptable by ChromaDB.
    
    ChromaDB allows metadata values of types: str, int, float, bool.
    Complex types (lists, dicts, None) are cast to string or excluded.
    """
    sanitized: Dict[str, Union[str, int, float, bool]] = {}
    for key, val in metadata.items():
        if val is None:
            continue
        if isinstance(val, (bool, int, float, str)):
            sanitized[str(key)] = val
        elif isinstance(val, (list, tuple, set, dict)):
            sanitized[str(key)] = str(val)
        else:
            sanitized[str(key)] = str(val)
    return sanitized


class MetadataExtractor:
    """Extracts and standardizes document metadata."""

    def __init__(self, default_source_name: Optional[str] = None):
        self.default_source_name = default_source_name

    def extract_from_file(
        self,
        file_path: Union[str, Path],
        page_number: int = 1,
        total_pages: int = 1,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Extract standardized metadata for a file or file page."""
        path = Path(file_path)
        stats = path.stat() if path.exists() else None
        
        file_name = path.name
        file_ext = path.suffix.lower().lstrip(".")
        file_size = stats.st_size if stats else 0
        created_at = (
            datetime.fromtimestamp(stats.st_mtime, tz=timezone.utc).isoformat()
            if stats
            else datetime.now(timezone.utc).isoformat()
        )

        doc_id = f"{path.stem}_p{page_number}_{hashlib.md5(f'{file_name}:{page_number}'.encode()).hexdigest()[:8]}"

        meta: Dict[str, Any] = {
            "doc_id": doc_id,
            "source": str(path.resolve()) if path.exists() else str(path),
            "filename": file_name,
            "file_type": file_ext or "text",
            "file_size": file_size,
            "page_number": page_number,
            "total_pages": total_pages,
            "created_at": created_at,
        }

        if extra_metadata:
            meta.update(extra_metadata)

        return meta

    def standardize(
        self,
        page_content: str,
        base_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Attach content hash and sanitize for downstream vector store persistence."""
        meta = dict(base_metadata or {})
        meta["content_hash"] = compute_content_hash(page_content)
        meta["char_length"] = len(page_content)
        meta["word_count"] = len(page_content.split())
        return sanitize_metadata_for_chroma(meta)
