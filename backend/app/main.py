"""FastAPI application entry point for the MeiPorul Claim Auditor API."""

from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from backend.app.api.dependencies import get_claim_auditor
from backend.app.api.routes.audit import router as audit_router
from backend.app.api.routes.health import router as health_router
from backend.app.core.config import get_settings
from backend.app.core.logging import get_logger, setup_logging
from backend.app.schemas.common import ErrorResponse
from backend.app.services.audit_service import AuditorExecutionError

settings = get_settings()
setup_logging(log_level=settings.LOG_LEVEL)
logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager: warm up components on startup."""
    logger.info("Initializing MeiPorul Claim Auditor Backend API (version=%s)...", settings.VERSION)
    # Warm up singleton auditor instance once on startup
    auditor = get_claim_auditor()
    logger.info("Claim Auditor subsystem initialized and ready (%s).", type(auditor).__name__)
    yield
    logger.info("Shutting down MeiPorul Claim Auditor Backend API.")


def create_app() -> FastAPI:
    """Build and configure the FastAPI application instance."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=(
            "Production-quality HTTP API for the MeiPorul Claim-Level Auditor. "
            "Evaluates generated RAG answers against retrieved evidence passages using a "
            "compute-efficient verification cascade."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # 1. Request ID & Timing Middleware
    @app.middleware("http")
    async def request_middleware(request: Request, call_next):
        t_start = time.perf_counter()
        req_id = request.headers.get("X-Request-ID") or f"AUD-{uuid.uuid4().hex[:12].upper()}"
        request.state.request_id = req_id

        response = await call_next(request)

        duration_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
        response.headers["X-Request-ID"] = req_id
        response.headers["X-Process-Time-Ms"] = str(duration_ms)
        return response

    # 2. Exception Handlers
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        req_id = getattr(request.state, "request_id", None)
        logger.warning(
            "Request validation failed: %s (path=%s)",
            exc.errors(),
            request.url.path,
            extra={"request_id": req_id},
        )
        error_payload = ErrorResponse(
            error="VALIDATION_ERROR",
            message="The request payload failed validation constraints.",
            request_id=req_id,
            details=exc.errors(),
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=jsonable_encoder(error_payload.model_dump()),
        )

    @app.exception_handler(AuditorExecutionError)
    async def auditor_error_handler(request: Request, exc: AuditorExecutionError) -> JSONResponse:
        req_id = getattr(request.state, "request_id", None)
        logger.error(
            "Auditor execution failure: %s",
            str(exc),
            extra={"request_id": req_id},
        )
        error_payload = ErrorResponse(
            error="AUDITOR_EXECUTION_ERROR",
            message=str(exc),
            request_id=req_id,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=jsonable_encoder(error_payload.model_dump()),
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        req_id = getattr(request.state, "request_id", None)
        error_payload = ErrorResponse(
            error="HTTP_ERROR",
            message=str(exc.detail),
            request_id=req_id,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=jsonable_encoder(error_payload.model_dump()),
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        req_id = getattr(request.state, "request_id", None)
        logger.critical(
            "Unhandled server exception: %s",
            str(exc),
            exc_info=True,
            extra={"request_id": req_id},
        )
        error_payload = ErrorResponse(
            error="INTERNAL_SERVER_ERROR",
            message="An unexpected internal error occurred during request processing.",
            request_id=req_id,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=jsonable_encoder(error_payload.model_dump()),
        )

    # 3. Mount Routes
    # Global root health endpoint
    app.include_router(health_router)

    # API v1 prefix routes
    app.include_router(health_router, prefix=settings.API_PREFIX)
    app.include_router(audit_router, prefix=settings.API_PREFIX)

    return app


app = create_app()
