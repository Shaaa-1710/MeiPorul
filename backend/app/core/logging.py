"""Structured logging configuration for backend services."""

from __future__ import annotations

import logging
import sys
from typing import Optional


class RequestIdFilter(logging.Filter):
    """Logging filter to inject request_id if present in log record context."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return True


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """Initialize standard structured logging for the application."""
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    root_logger = logging.getLogger("meiporul")
    root_logger.setLevel(numeric_level)

    # Avoid duplicate handlers if already configured
    if not root_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(numeric_level)

        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [req:%(request_id)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        handler.addFilter(RequestIdFilter())
        root_logger.addHandler(handler)

    return root_logger


def get_logger(name: str = "meiporul") -> logging.Logger:
    """Return a logger configured under the application namespace."""
    return logging.getLogger(f"meiporul.{name}")
