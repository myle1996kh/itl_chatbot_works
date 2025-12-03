# ============================================================================
# Multi-Stage Dockerfile for ITL AgentHub Backend (Production)
# ============================================================================
# This Dockerfile creates an optimized production image for the FastAPI backend
# using multi-stage builds to minimize final image size and improve security.

# ============================================================================
# Stage 1: Builder - Install dependencies and compile Python packages
# ============================================================================
FROM python:3.11-slim AS builder

# Set working directory
WORKDIR /app

# Install system dependencies required for building Python packages
# - build-essential: C/C++ compilers for native extensions
# - libpq-dev: PostgreSQL client library headers
# - git: For installing packages from git repositories
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY requirements.txt ./

# Create virtual environment and install dependencies
# Using --no-cache-dir to reduce image size
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip and install dependencies
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# ============================================================================
# Stage 2: Runtime - Create minimal production image
# ============================================================================
FROM python:3.11-slim

# Set metadata labels
LABEL maintainer="ITL AgentHub Team"
LABEL description="Production FastAPI backend for multi-tenant chatbot"
LABEL version="0.1.0"

# Set environment variables
# PYTHONUNBUFFERED: Force Python stdout/stderr to be unbuffered (better for Docker logs)
# PYTHONDONTWRITEBYTECODE: Prevent Python from writing .pyc files
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH"

# Install runtime dependencies only (no build tools)
# - libpq5: PostgreSQL client library (runtime)
# - curl: For health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
# Running as non-root is a Docker security best practice
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app && \
    chown -R appuser:appuser /app

# Set working directory
WORKDIR /app

# Copy virtual environment from builder stage
COPY --from=builder --chown=appuser:appuser /opt/venv /opt/venv

# Copy application code
# Copy only necessary files to keep image lean
COPY --chown=appuser:appuser ./src ./src
COPY --chown=appuser:appuser ./alembic ./alembic
COPY --chown=appuser:appuser ./alembic.ini ./alembic.ini

# Note: migrations/ and JWT keys are optional
# They can be provided via volume mounts or environment variables in production

# Switch to non-root user
USER appuser

# Expose port 8000 (FastAPI default)
EXPOSE 8000

# Health check
# Docker will periodically check if the container is healthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command: Run database migrations then start the application
# Using exec form for proper signal handling
CMD ["sh", "-c", "alembic upgrade head && uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4"]
