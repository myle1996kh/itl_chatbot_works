# Multi-stage Dockerfile for ITL Chatbot - Full Stack Application
# Builds both frontend (React) and backend (FastAPI) in a single image

# ============================================================================
# Stage 1: Frontend Builder - Build React frontend with Vite
# ============================================================================
FROM node:20-alpine as frontend-builder

# Set working directory for frontend
WORKDIR /app/frontend

# Copy package files first (for better Docker cache utilization)
COPY frontend/package*.json ./
COPY frontend/vite.config.ts ./
COPY frontend/tsconfig.json ./
COPY frontend/tailwind.config.ts ./

# Install frontend dependencies (using npm ci for reproducible builds)
# npm ci is faster than npm install and ensures exact versions from package-lock.json
RUN npm ci

# Copy frontend source code
# Note: This project has a flat structure with components/pages/services at root level
COPY frontend/src ./src/
COPY frontend/components ./components/
COPY frontend/pages ./pages/
COPY frontend/services ./services/
COPY frontend/index.html ./
COPY frontend/App.tsx ./
COPY frontend/index.tsx ./
COPY frontend/types.ts ./
COPY frontend/constants.ts ./
COPY frontend/widget.tsx ./
COPY frontend/widget.html ./

# Build frontend (creates optimized static files in dist/)
RUN npm run build

# ============================================================================
# Stage 2: Backend Builder - Install Python dependencies with UV
# ============================================================================
FROM python:3.11-slim as backend-builder

# Set working directory
WORKDIR /app

# Install UV package manager (faster than pip)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies using UV
# --frozen: Use exact versions from uv.lock (reproducible builds)
# --no-dev: Skip development dependencies (pytest, black, etc.)
# Note: uv 0.5.0+ automatically installs to system Python when no venv is present
RUN UV_SYSTEM_PYTHON=1 uv sync --frozen --no-dev

# ============================================================================
# Stage 3: Runtime - Combine frontend and backend
# ============================================================================
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_NO_UPDATE_CHECK=1 \
    UV_SYSTEM_PYTHON=1

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Required for PostgreSQL/MongoDB connections
    libpq5 \
    # Clean up apt cache to reduce image size
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
# Running as root in containers is a security risk
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app && \
    chown -R appuser:appuser /app

# Set working directory
WORKDIR /app

# Copy installed Python packages from backend builder stage
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# Copy backend application code
COPY --chown=appuser:appuser backend/src ./src
COPY --chown=appuser:appuser backend/alembic.ini ./alembic.ini
COPY --chown=appuser:appuser backend/alembic ./alembic/

# Copy built frontend from frontend builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create uploads directory for file storage
RUN mkdir -p ./uploads && chown -R appuser:appuser ./uploads

# Switch to non-root user
USER appuser

# Expose port 8000
EXPOSE 8000

# Health check - Docker will ping this endpoint every 30s
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=5)" || exit 1

# Run the application
# --host 0.0.0.0: Listen on all network interfaces (required for Docker)
# --port 8000: Listen on port 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]