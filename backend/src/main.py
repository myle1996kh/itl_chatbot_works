"""FastAPI application initialization."""
import sys
from pathlib import Path

# Add backend directory to Python path so imports work from any location
sys.path.insert(0, str(Path(__file__).parent.parent))

import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from src.config import settings
from src.utils.logging import configure_logging, get_logger
from src.utils.exceptions import SecurityError
import redis
from sqlalchemy import text
from src.config import engine

# Import ALL models to ensure SQLAlchemy relationships are properly registered
# This must be done before any database operations
# These imports appear "unused" but are required for SQLAlchemy relationship resolution
from src.models.tenant import Tenant  # noqa: F401
from src.models.session import ChatSession  # noqa: F401
from src.models.message import Message  # noqa: F401
from src.models.llm_model import LLMModel  # noqa: F401
from src.models.tenant_llm_config import TenantLLMConfig  # noqa: F401
from src.models.base_tool import BaseTool  # noqa: F401
from src.models.output_format import OutputFormat  # noqa: F401
from src.models.tool import ToolConfig  # noqa: F401
from src.models.agent import AgentConfig, AgentTools  # noqa: F401
from src.models.permissions import TenantAgentPermission, TenantToolPermission  # noqa: F401
from src.models.tenant_widget_config import TenantWidgetConfig  # noqa: F401
from src.models.user import User  # noqa: F401
from src.models.chat_user import ChatUser  # noqa: F401

# Import LLM manager to set up rate limiter
from src.services.llm_manager import llm_manager

# Configure logging
configure_logging()
logger = get_logger(__name__)

# Create FastAPI app
app = FastAPI(
    title="AgentHub Multi-Agent Chatbot Framework",
    description="Production-ready multi-tenant chatbot framework using LangChain 0.3+",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add middleware to handle OPTIONS requests explicitly (before CORS middleware)
# This ensures CORS preflight requests are processed before any auth dependencies
@app.middleware("http")
async def handle_cors_preflight(request: Request, call_next):
    """
    Middleware to handle CORS preflight (OPTIONS) requests.
    Returns 200 OK immediately without processing dependencies.
    """
    if request.method == "OPTIONS":
        return JSONResponse(
            status_code=200,
            content={},
            headers={
                "Access-Control-Allow-Origin": request.headers.get("Origin", "*"),
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "3600",
            }
        )
    return await call_next(request)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception Handlers
@app.exception_handler(SecurityError)
async def security_error_handler(request: Request, exc: SecurityError):
    """Handle security violations.

    Logs critical security events and returns generic error to prevent
    information leakage to potential attackers.
    """
    incident_id = str(uuid.uuid4())

    logger.critical(
        "security_violation",
        extra={
            "incident_id": incident_id,
            "error": str(exc),
            "details": exc.details,
            "path": request.url.path,
            "method": request.method,
        },
    )

    # Return generic error (don't leak details to client)
    return JSONResponse(
        status_code=500,
        content={
            "error": "A security policy violation occurred. This incident has been logged.",
            "incident_id": incident_id,
        },
    )


@app.on_event("startup")
async def startup_event():
    """Application startup event handler."""
    logger.info(
        "application_startup",
        environment=settings.ENVIRONMENT,
        api_host=settings.API_HOST,
        api_port=settings.API_PORT,
    )

    # Validate critical settings at startup
    if settings.ENVIRONMENT == "production":
        unsafe_settings = []

        if settings.DISABLE_AUTH:
            unsafe_settings.append("DISABLE_AUTH=true")

        if not settings.JWT_PUBLIC_KEY:
            unsafe_settings.append("JWT_PUBLIC_KEY not set")

        if unsafe_settings:
            logger.critical(
                "Unsafe production configuration - SHUTTING DOWN",
                extra={"unsafe_settings": unsafe_settings}
            )
            raise RuntimeError(
                f"Unsafe production settings: {', '.join(unsafe_settings)}"
            )

    # Initialize rate limiter if Redis is configured
    try:
        if settings.REDIS_URL:
            redis_client = redis.from_url(settings.REDIS_URL)
            llm_manager.set_rate_limiter(redis_client)
            logger.info("rate_limiter_initialized", redis_url=settings.REDIS_URL)
    except Exception as e:
        logger.error(
            "rate_limiter_initialization_failed",
            error=str(e),
            redis_url=getattr(settings, 'REDIS_URL', 'not set')
        )
        # Continue without rate limiting - it's not critical for startup


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event handler."""
    logger.info("application_shutdown")


@app.get("/health")
async def health_check():
    """Health check endpoint with basic DB connectivity test."""
    db_status = "up"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as e:
        db_status = "down"
        logger.error("health_check_db_failed", error=str(e))

    return {
        "status": "healthy" if db_status == "up" else "degraded",
        "database": db_status,
        "environment": settings.ENVIRONMENT,
        "version": "0.1.0"
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "AgentHub Multi-Agent Chatbot Framework",
        "version": "0.1.0",
        "docs": "/docs"
    }


# Import and include routers
from src.api import chat, sessions, auth, supporter, chat_users, sse

# Authentication endpoints (Phase 0)
app.include_router(auth.router, tags=["auth"])

# Chat and session management endpoints (Phase 3)
app.include_router(chat.router, tags=["chat"])
app.include_router(chat_users.router, tags=["chat-users"])
app.include_router(sessions.router, tags=["sessions"])

# SSE endpoints for real-time messaging
app.include_router(sse.router, tags=["sse"])

# Supporter chat endpoints (Phase 9 - Escalation)
app.include_router(supporter.router, tags=["supporter"])

# Admin endpoints (Phase 4 & Phase 8)
from src.api.admin import agents, tools, tenants, knowledge, escalation, sessions as admin_sessions, widgets, llm_models
# Public widget endpoints
from src.api import public_widgets

app.include_router(agents.router, tags=["admin-agents"])
app.include_router(tools.router, tags=["admin-tools"])
app.include_router(tenants.router, tags=["admin-tenants"])
app.include_router(knowledge.router, tags=["admin-knowledge"])
app.include_router(escalation.router, tags=["admin-escalations"])
app.include_router(admin_sessions.router, tags=["admin-sessions"])
app.include_router(widgets.router, tags=["admin-widgets"])
app.include_router(llm_models.router, tags=["admin-llm-models"])
app.include_router(public_widgets.router, tags=["public-widgets"])

# Monitoring endpoints (will be added in Phase 11)
# from src.api.admin import monitoring
# app.include_router(monitoring.router, tags=["admin-monitoring"])

# Serve static files for frontend
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

# Mount the frontend/dist directory
frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    # Serve widget.html for /widget/* routes
    @app.get("/widget/{full_path:path}")
    async def serve_widget(full_path: str):
        widget_path = frontend_dist / "widget.html"
        if widget_path.exists():
            return HTMLResponse(content=widget_path.read_text(encoding="utf-8"))
        return JSONResponse(status_code=404, content={"error": "Widget frontend not found"})

    # Serve index.html for root and other routes (SPA fallback)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Skip API routes
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("redoc") or full_path == "health":
            return JSONResponse(status_code=404, content={"error": "Not found"})
            
        index_path = frontend_dist / "index.html"
        if index_path.exists():
            return HTMLResponse(content=index_path.read_text(encoding="utf-8"))
        return JSONResponse(status_code=404, content={"error": "Frontend not found"})


if __name__ == "__main__":
    import uvicorn
    # Limit auto-reload file watching to the backend src directory and
    # exclude transient files that can cause spurious reloads on Windows
    # (e.g., __pycache__, .venv, log files). This helps avoid constant
    # restarts due to background tools touching files.
    extra_kwargs = {}
    if settings.ENVIRONMENT == "development":
        extra_kwargs.update({
            "reload": True,
            "reload_dirs": [str(Path(__file__).parent)],  # backend/src
            "reload_excludes": [
                "**/__pycache__/*",
                "**/*.pyc",
                "**/*.pyo",
                "**/*.log",
                "venv/*",
                ".venv/*",
                ".pytest_cache/*",
            ],
            "reload_delay": 0.5,
        })

    uvicorn.run(
        "src.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        **extra_kwargs
    )
