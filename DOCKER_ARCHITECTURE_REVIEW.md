# Docker Architecture Review & Optimization

## 📊 Current Architecture Analysis

### Current Setup: Monolithic (Single Image)
```
┌─────────────────────────────────────┐
│      itl-chatbot container          │
│  ┌────────────┐  ┌──────────────┐  │
│  │  Frontend  │  │   Backend    │  │
│  │  (React)   │  │  (FastAPI)   │  │
│  │   :3000    │  │   :8000      │  │
│  └────────────┘  └──────────────┘  │
│         Port 8000 exposed           │
└─────────────────────────────────────┘
```

---

## ✅ What's Working Well

### 1. Multi-stage Build
```dockerfile
FROM node:20-alpine as frontend-builder  # ✅ Good
FROM python:3.11-slim as backend-builder # ✅ Good
FROM python:3.11-slim                    # ✅ Slim runtime
```

### 2. Security Best Practices
```dockerfile
RUN useradd -m -u 1000 appuser  # ✅ Non-root user
USER appuser                     # ✅ Drop privileges
```

### 3. Health Check
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s \
    CMD python -c "import urllib.request; ..." # ✅ Good
```

### 4. Docker Compose Dependencies
```yaml
app:
  depends_on:
    postgres:
      condition: service_healthy  # ✅ Wait for DB ready
    redis:
      condition: service_healthy  # ✅ Wait for Redis ready
```

---

## ⚠️ Issues Found

### Issue 1: UV Command - Environment Variable Missing

**Current:**
```dockerfile
RUN UV_SYSTEM_PYTHON=1 uv sync --frozen --no-dev
```

**Problem:** `UV_SYSTEM_PYTHON=1` chỉ áp dụng cho RUN command, không persist vào runtime

**Fix Needed:**
```dockerfile
# Set as ENV for both build and runtime
ENV UV_SYSTEM_PYTHON=1

RUN uv sync --frozen --no-dev
```

### Issue 2: Frontend Build Context Issues

**Current:**
```dockerfile
COPY frontend/public ./public/  # ❌ MISSING!
```

**Missing files:**
- `frontend/public/` directory (clear-duplicates.html chưa được copy!)
- `frontend/.env` nếu có

**Fix:**
```dockerfile
COPY frontend/public ./public/
COPY frontend/.env* ./     # Optional env files
```

### Issue 3: Backend Python Path

**Current:**
```dockerfile
COPY --from=backend-builder /usr/local/bin /usr/local/bin
```

**Risk:** Copy TOÀN BỘ /usr/local/bin (có thể overwrites Python binaries)

**Better:**
```dockerfile
# Copy only uv if needed
COPY --from=backend-builder /usr/local/bin/uv /usr/local/bin/uv
```

### Issue 4: Frontend Static Files Serving

**Current:** Backend serves frontend static files

**Problem:**
- ❌ Inefficient (Python serves static files)
- ❌ No caching headers
- ❌ No compression

**Better:** Use Nginx

---

## 🎯 Recommended Architectures

## Option A: Keep Monolithic (Current + Improvements)

**Best for:** Small teams, simple deployment, <1000 users

### Improved Dockerfile:

```dockerfile
# ============================================================================
# Stage 1: Frontend Builder
# ============================================================================
FROM node:20-alpine as frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./
COPY frontend/vite.config.ts ./
COPY frontend/tsconfig.json ./
COPY frontend/tailwind.config.ts ./

# Install dependencies
RUN npm ci

# Copy all frontend source
COPY frontend/ ./

# Build (includes public/ directory)
RUN npm run build

# ============================================================================
# Stage 2: Backend Builder
# ============================================================================
FROM python:3.11-slim as backend-builder

WORKDIR /app

# Install UV
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set UV to use system Python
ENV UV_SYSTEM_PYTHON=1

# Copy dependency files
COPY backend/pyproject.toml backend/uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev

# ============================================================================
# Stage 3: Runtime
# ============================================================================
FROM python:3.11-slim

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_NO_UPDATE_CHECK=1 \
    UV_SYSTEM_PYTHON=1

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    # Add nginx for serving frontend
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app /var/log/nginx /var/lib/nginx && \
    chown -R appuser:appuser /app /var/log/nginx /var/lib/nginx

WORKDIR /app

# Copy Python packages
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages \
     /usr/local/lib/python3.11/site-packages

# Copy backend code
COPY --chown=appuser:appuser backend/src ./src
COPY --chown=appuser:appuser backend/alembic.ini ./
COPY --chown=appuser:appuser backend/alembic ./alembic/

# Copy frontend build
COPY --from=frontend-builder --chown=appuser:appuser \
     /app/frontend/dist ./frontend/dist

# Create uploads directory
RUN mkdir -p ./uploads && chown -R appuser:appuser ./uploads

# Switch to app user
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=5)" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Option B: Microservices (Separate Frontend & Backend)

**Best for:** Medium-large teams, >1000 users, need separate scaling

### Architecture:

```
┌──────────────┐
│    Nginx     │  :80 (Reverse Proxy)
│  (Frontend)  │
└──────┬───────┘
       │
       ├─────→ /api/* → Backend (:8000)
       │
       └─────→ /* → Static Files
```

### File Structure:

```
itl_chatbot_works/
├── frontend/
│   └── Dockerfile          # Frontend-only
├── backend/
│   └── Dockerfile          # Backend-only
├── nginx/
│   └── nginx.conf          # Reverse proxy config
└── docker-compose.yml      # Orchestration
```

### frontend/Dockerfile:

```dockerfile
FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### backend/Dockerfile:

```dockerfile
FROM python:3.11-slim

ENV UV_SYSTEM_PYTHON=1 \
    PYTHONUNBUFFERED=1

# Install UV
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy and install dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy application code
COPY src ./src
COPY alembic.ini ./
COPY alembic ./alembic/

# Create non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml (Microservices):

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: itl-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: chatbot_itl
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD:-change-this-password}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - itl-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    container_name: itl-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - itl-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: itl-backend
    restart: unless-stopped
    env_file:
      - backend/.env
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD:-change-this-password}@postgres:5432/chatbot_itl
      REDIS_URL: redis://redis:6379
      ENVIRONMENT: ${ENVIRONMENT:-production}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - itl-network
    volumes:
      - uploads_data:/app/uploads
    # Only expose to internal network
    # Port 8000 not exposed externally - only via nginx

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: itl-frontend
    restart: unless-stopped
    # Only expose to internal network
    networks:
      - itl-network

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: itl-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"  # For HTTPS
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro  # SSL certificates
    depends_on:
      - backend
      - frontend
    networks:
      - itl-network

networks:
  itl-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  uploads_data:
    driver: local
```

### nginx/nginx.conf:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss;

    # Upstream backends
    upstream backend {
        server backend:8000;
    }

    upstream frontend {
        server frontend:80;
    }

    server {
        listen 80;
        server_name localhost;

        # Frontend static files
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Backend API
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

            # SSE support
            proxy_buffering off;
            proxy_cache off;
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
            chunked_transfer_encoding off;
        }

        # Health check
        location /health {
            proxy_pass http://backend/health;
        }
    }
}
```

---

## 🎯 Decision Matrix

| Criteria | Monolithic (Current) | Microservices |
|----------|---------------------|---------------|
| **Complexity** | ⭐ Low | ⭐⭐⭐ High |
| **Deploy Speed** | ⭐⭐⭐ Fast | ⭐⭐ Moderate |
| **Scaling** | ⭐ Limited | ⭐⭐⭐ Flexible |
| **Resource Usage** | ⭐⭐ Moderate | ⭐ More containers |
| **Development** | ⭐⭐⭐ Simple | ⭐⭐ Complex |
| **Production Ready** | ⭐⭐ Good for small | ⭐⭐⭐ Better for scale |
| **Cost** | ⭐⭐⭐ Lower | ⭐⭐ Higher |

---

## 💡 Recommendations

### For Current Stage (MVP/Small Scale):
**✅ Keep Monolithic with improvements:**

1. Fix UV environment variable
2. Add missing frontend/public copy
3. Add Nginx for static file serving (optional)
4. Monitor and optimize

### For Growth Stage (>1000 users):
**✅ Migrate to Microservices:**

1. Separate frontend/backend Dockerfiles
2. Add Nginx reverse proxy
3. Implement proper logging
4. Add monitoring (Prometheus/Grafana)

---

## 🔧 Quick Fixes for Current Dockerfile

```dockerfile
# Fix 1: UV Environment
ENV UV_SYSTEM_PYTHON=1  # Add this at line 65

# Fix 2: Copy frontend public directory
COPY frontend/public ./public/  # Add to frontend builder stage

# Fix 3: Don't overwrite binaries
# Remove: COPY --from=backend-builder /usr/local/bin /usr/local/bin
# Keep only: Python packages copy
```

---

## 📋 Testing Checklist

After implementing fixes:

- [ ] Build succeeds: `docker-compose build --no-cache`
- [ ] All services start: `docker-compose up -d`
- [ ] Health checks pass: `docker-compose ps`
- [ ] Frontend loads: `curl http://localhost:8000`
- [ ] Backend API works: `curl http://localhost:8000/health`
- [ ] SSE works: Test realtime messaging
- [ ] Database connects: Check logs
- [ ] Redis connects: Check logs

---

## 🎉 Summary

**Current Status:**
- ✅ Multi-stage build working
- ✅ Security good (non-root user)
- ⚠️ UV environment variable needs fix
- ⚠️ Missing frontend public files
- ⚠️ Could optimize with Nginx

**Recommended Action:**
1. **Short term:** Apply quick fixes above
2. **Long term:** Plan microservices migration when needed

**Keep monolithic IF:**
- Team size < 5 people
- Traffic < 1000 concurrent users
- Simple deployment preferred

**Migrate to microservices IF:**
- Need independent scaling
- Multiple teams working
- High traffic expected
- Need CDN for frontend
