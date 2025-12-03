# =============================================================================
# ITL CHATBOT - DOCKER IMAGE
# =============================================================================
# Multi-stage Docker build for production-ready FastAPI application
# Supports both development and production environments
# Uses UV for fast Python dependency management
# =============================================================================

FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq5 \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install UV for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# =============================================================================
# FRONTEND BUILD STAGE
# =============================================================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# Install frontend dependencies
COPY frontend/package*.json ./
RUN npm ci

# Build frontend for production
COPY frontend/ .
RUN npm run build

# =============================================================================
# DEVELOPMENT STAGE
# =============================================================================
FROM base AS development

# Copy dependency files first for better Docker layer caching
COPY pyproject.toml uv.lock ./

# Install ALL dependencies (including dev)
RUN uv sync --frozen

# Install additional development tools
RUN uv pip install --system \
    debugpy \
    ipython

# Copy application code
COPY . .

# Copy frontend build (for serving static files)
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create logs directory
RUN mkdir -p logs

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Set Python path
ENV PYTHONPATH=/app/backend \
    PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# Development command with hot reload
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# =============================================================================
# PRODUCTION STAGE
# =============================================================================
FROM base AS production

# Copy dependency files and install production dependencies only
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy application code
COPY . .

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create logs directory and set permissions
RUN mkdir -p logs && \
    useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Set Python path
ENV PYTHONPATH=/app/backend \
    PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production command with uvicorn (multiple workers)
CMD ["uvicorn", \
     "src.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--loop", "uvloop", \
     "--http", "httptools", \
     "--access-log", \
     "--log-level", "warning"]