"""Document parsing engine supporting PDF, TXT, Markdown, CSV, and JSON formats."""

from __future__ import annotations

import csv
import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None  # type: ignore

from rag.ingestion.metadata import MetadataExtractor

logger = logging.getLogger(__name__)


@dataclass
class Document:
    """Standardized document representation for the MeiPorul RAG system."""

    page_content: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "page_content": self.page_content,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Document":
        return cls(
            page_content=data.get("page_content", ""),
            metadata=data.get("metadata", {}),
        )


class DocumentParser:
    """Parses raw files into clean, structured Document instances."""

    def __init__(self, metadata_extractor: Optional[MetadataExtractor] = None):
        self.metadata_extractor = metadata_extractor or MetadataExtractor()

    def clean_text(self, text: str) -> str:
        """Normalize whitespace, remove null bytes, and clean line breaks."""
        if not text:
            return ""
        # Remove null characters
        text = text.replace("\x00", "")
        # Normalize newlines
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        # Collapse multiple horizontal whitespaces (except newlines)
        text = re.sub(r"[ \t]+", " ", text)
        # Collapse 3+ consecutive newlines into 2
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def parse_pdf(self, file_path: Union[str, Path]) -> List[Document]:
        """Extract text from PDF page by page."""
        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f"PDF file not found: {path}")

        if PdfReader is None:
            raise ImportError(
                "pypdf is required to parse PDF files. Install with `pip install pypdf`."
            )

        documents: List[Document] = []
        try:
            reader = PdfReader(str(path))
            total_pages = len(reader.pages)
            for page_idx, page in enumerate(reader.pages, start=1):
                raw_text = page.extract_text() or ""
                cleaned = self.clean_text(raw_text)
                if not cleaned:
                    continue
                meta = self.metadata_extractor.extract_from_file(
                    file_path=path,
                    page_number=page_idx,
                    total_pages=total_pages,
                )
                standardized_meta = self.metadata_extractor.standardize(cleaned, meta)
                documents.append(Document(page_content=cleaned, metadata=standardized_meta))
        except Exception as e:
            logger.error(f"Error parsing PDF file {path}: {e}")
            raise

        return documents

    def parse_text(self, file_path: Union[str, Path]) -> List[Document]:
        """Parse plain text or Markdown files."""
        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f"File not found: {path}")

        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                raw_text = f.read()
        except Exception as e:
            logger.error(f"Error reading text file {path}: {e}")
            raise

        cleaned = self.clean_text(raw_text)
        if not cleaned:
            return []

        meta = self.metadata_extractor.extract_from_file(
            file_path=path,
            page_number=1,
            total_pages=1,
        )
        standardized_meta = self.metadata_extractor.standardize(cleaned, meta)
        return [Document(page_content=cleaned, metadata=standardized_meta)]

    def parse_json(self, file_path: Union[str, Path]) -> List[Document]:
        """Parse JSON documents (array of objects or single dictionary)."""
        path = Path(file_path)
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            data = json.load(f)

        documents: List[Document] = []
        records = data if isinstance(data, list) else [data]

        for idx, item in enumerate(records, start=1):
            if isinstance(item, dict):
                content = item.get("text") or item.get("content") or item.get("page_content")
                if not content:
                    content = json.dumps(item, ensure_ascii=False)
            else:
                content = str(item)

            cleaned = self.clean_text(content)
            if not cleaned:
                continue

            extra_meta = {"record_index": idx}
            if isinstance(item, dict):
                extra_meta.update(
                    {k: v for k, v in item.items() if k not in ["text", "content", "page_content"]}
                )

            meta = self.metadata_extractor.extract_from_file(
                file_path=path,
                page_number=idx,
                total_pages=len(records),
                extra_metadata=extra_meta,
            )
            standardized_meta = self.metadata_extractor.standardize(cleaned, meta)
            documents.append(Document(page_content=cleaned, metadata=standardized_meta))

        return documents

    def parse_csv(self, file_path: Union[str, Path]) -> List[Document]:
        """Parse CSV rows into formatted documents."""
        path = Path(file_path)
        documents: List[Document] = []
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            reader = list(csv.DictReader(f))
            total_rows = len(reader)
            for row_idx, row in enumerate(reader, start=1):
                # Represent row as human-readable key-value pairs
                row_str = " | ".join(f"{k}: {v}" for k, v in row.items() if v)
                cleaned = self.clean_text(row_str)
                if not cleaned:
                    continue
                meta = self.metadata_extractor.extract_from_file(
                    file_path=path,
                    page_number=row_idx,
                    total_pages=total_rows,
                    extra_metadata={"row_index": row_idx},
                )
                standardized_meta = self.metadata_extractor.standardize(cleaned, meta)
                documents.append(Document(page_content=cleaned, metadata=standardized_meta))

        return documents

    def parse_file(self, file_path: Union[str, Path]) -> List[Document]:
        """Dispatch parsing based on file suffix."""
        path = Path(file_path)
        ext = path.suffix.lower()

        if ext == ".pdf":
            return self.parse_pdf(path)
        elif ext in [".txt", ".md", ".markdown", ".log", ".rst"]:
            return self.parse_text(path)
        elif ext == ".json":
            return self.parse_json(path)
        elif ext == ".csv":
            return self.parse_csv(path)
        else:
            # Fallback to plain text
            logger.warning(f"Unrecognized extension '{ext}' for {path}, parsing as text.")
            return self.parse_text(path)

    def parse_directory(
        self,
        dir_path: Union[str, Path],
        recursive: bool = True,
        allowed_extensions: Optional[List[str]] = None,
    ) -> List[Document]:
        """Parse all supported documents inside a directory."""
        directory = Path(dir_path)
        if not directory.is_dir():
            raise NotADirectoryError(f"Directory not found: {directory}")

        valid_exts = set(
            allowed_extensions
            or [".pdf", ".txt", ".md", ".markdown", ".json", ".csv"]
        )

        pattern = "**/*" if recursive else "*"
        all_docs: List[Document] = []

        for p in directory.glob(pattern):
            if p.is_file() and p.suffix.lower() in valid_exts:
                try:
                    docs = self.parse_file(p)
                    all_docs.extend(docs)
                except Exception as e:
                    logger.warning(f"Skipping failed file {p}: {e}")

        return all_docs
