"""
TreeMeasure AI – FastAPI Application Entry Point
=================================================
Orchestrates all routers, middleware, startup events, and error handlers.
"""

import time
import uuid
import asyncio
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from app.config import settings
from app.api.routes import health, inference, measurements
from app.models import model_registry

log = structlog.get_logger(__name__)


# ─── Lifespan (startup / shutdown) ────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load heavy ML models once at startup so they're warm for requests."""
    log.info("startup.begin", env=settings.ENV)
    await model_registry.load_all()
    log.info("startup.models_loaded", models=list(model_registry.loaded_models))
    yield
    log.info("shutdown.begin")
    await model_registry.unload_all()


# ─── App Factory ──────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="TreeMeasure AI API",
        description=(
            "Production-ready REST API for AI-powered tree height and trunk diameter "
            "measurement using a multi-model deep learning pipeline."
        ),
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # ─── Middleware ───────────────────────────────────────────────────────────
    _origins = settings.ALLOWED_ORIGINS
    _creds   = "*" not in _origins   # credentials can't be used with wildcard
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_origin_regex=r"https://.*\.vercel\.app" if "*" in _origins else None,
        allow_credentials=_creds,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        start = time.perf_counter()
        response = await call_next(request)
        duration = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"]    = request_id
        response.headers["X-Response-Time"] = f"{duration:.1f}ms"
        log.info(
            "http.request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round(duration, 1),
            request_id=request_id,
        )
        return response

    # ─── Global error handler ─────────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        log.error("unhandled_exception", error=str(exc), path=request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error. Please try again later."},
        )

    # ─── Routers ──────────────────────────────────────────────────────────────
    app.include_router(health.router,        prefix="/api",              tags=["Health"])
    app.include_router(inference.router,     prefix="/api/inference",    tags=["Inference"])
    app.include_router(measurements.router,  prefix="/api/measurements", tags=["Measurements"])

    # ─── Convenience routes ───────────────────────────────────────────────────
    @app.get("/", include_in_schema=False)
    async def root():
        return {
            "name": "TreeMeasure AI API",
            "version": "1.0.0",
            "docs": "/api/docs",
            "redoc": "/api/redoc",
            "health": "/api/health",
            "openapi": "/api/openapi.json",
        }

    @app.get("/docs", include_in_schema=False)
    async def docs_redirect():
        return RedirectResponse(url="/api/docs")

    @app.get("/redoc", include_in_schema=False)
    async def redoc_redirect():
        return RedirectResponse(url="/api/redoc")

    return app


app = create_app()
