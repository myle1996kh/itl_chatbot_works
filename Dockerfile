# Multi-stage Dockerfile for ITL Chatbot - Full Stack with Environment Variables
# Builds both frontend and backend services in a single image

# ============================================================================
# Stage 1: Frontend Builder - Build React frontend
# ============================================================================
FROM node:20-alpine as frontend-builder

# Set working directory for frontend
WORKDIR /app/frontend

# Copy frontend files
COPY frontend/package*.json ./
COPY frontend/vite.config.ts ./
COPY frontend/tsconfig.json ./
COPY frontend/postcss.config.cjs ./
COPY frontend/tailwind.config.ts ./

# Install frontend dependencies
RUN npm install

# Copy frontend source code
COPY frontend/src ./src/
COPY frontend/public ./public/
COPY frontend/index.html ./
COPY frontend/assets ./assets/

# Build frontend
RUN npm run build

# ============================================================================
# Stage 2: Backend Builder - Install Python dependencies
# ============================================================================
FROM python:3.11-slim as backend-builder

# Install UV for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies using UV (much faster than pip)
# --system: Install to system Python instead of virtual env
# --frozen: Use exact versions from uv.lock
RUN uv sync --frozen --no-dev --system

# ============================================================================
# Stage 3: Runtime - Combine frontend and backend
# ============================================================================
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # Disable UV update checks in production
    UV_NO_UPDATE_CHECK=1

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Required for some Python packages
    libpq5 \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app && \
    chown -R appuser:appuser /app

# Set working directory
WORKDIR /app

# Copy installed Python packages from backend builder
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# Copy backend application code
COPY --chown=appuser:appuser backend/src ./src
COPY --chown=appuser:appuser backend/uv.lock ./uv.lock
COPY --chown=appuser:appuser backend/pyproject.toml ./pyproject.toml
COPY --chown=appuser:appuser backend/init-db.sql ./init-db.sql
COPY --chown=appuser:appuser backend/alembic.ini ./alembic.ini
COPY --chown=appuser:appuser backend/alembic ./alembic/

# Copy .env file from backend directory with proper permissions
COPY --chown=appuser:appuser backend/.env ./.env

# Copy built frontend from frontend builder
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create uploads directory
RUN mkdir -p ./uploads && chown -R appuser:appuser ./uploads

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=5)" || exit 1

# Run the application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]