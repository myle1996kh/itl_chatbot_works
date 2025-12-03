# 🏗️ ITL AgentHub - Architecture Diagrams

This document contains visual diagrams to help understand the Docker architecture.

---

## 📊 Overall Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Host                              │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              itl-chatbot-network (Bridge)                 │ │
│  │                                                           │ │
│  │  ┌──────────────┐         ┌──────────────┐              │ │
│  │  │   Frontend   │         │   Backend    │              │ │
│  │  │   (Nginx)    │────────▶│  (FastAPI)   │              │ │
│  │  │              │         │              │              │ │
│  │  │  Port: 80    │         │  Port: 8000  │              │ │
│  │  └──────────────┘         └───────┬──────┘              │ │
│  │                                   │                      │ │
│  │                          ┌────────┴────────┐            │ │
│  │                          │                 │            │ │
│  │                   ┌──────▼──────┐   ┌─────▼─────┐      │ │
│  │                   │  PostgreSQL │   │   Redis   │      │ │
│  │                   │  +pgvector  │   │   Cache   │      │ │
│  │                   │             │   │           │      │ │
│  │                   │  Port: 5432 │   │ Port: 6379│      │ │
│  │                   └─────────────┘   └───────────┘      │ │
│  │                          │                 │            │ │
│  └──────────────────────────┼─────────────────┼────────────┘ │
│                             │                 │              │
│  ┌──────────────────────────▼─────────────────▼───────────┐  │
│  │                    Docker Volumes                       │  │
│  │  ┌──────────────────┐      ┌──────────────────┐       │  │
│  │  │ postgres_data    │      │   redis_data     │       │  │
│  │  │ (Persistent DB)  │      │ (Persistent Cache)│      │  │
│  │  └──────────────────┘      └──────────────────┘       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
         │                              │
         │ Port 80                      │ Port 8000
         │ (HTTP)                       │ (HTTP)
         ▼                              ▼
    ┌─────────┐                    ┌─────────┐
    │ Browser │                    │ API     │
    │ Users   │                    │ Clients │
    └─────────┘                    └─────────┘
```

---

## 🔄 Request Flow

### Frontend Request Flow

```
1. User visits http://yourdomain.com
   │
   ▼
2. Request hits Frontend Container (Nginx:80)
   │
   ├─ Static file? (CSS, JS, images)
   │  └─▶ Serve from /usr/share/nginx/html
   │
   └─ React route? (/admin, /dashboard)
      └─▶ Serve index.html → React Router handles it
```

### API Request Flow

```
1. Frontend makes API call: fetch('/api/chat')
   │
   ▼
2. Request goes to Backend Container (FastAPI:8000)
   │
   ├─▶ Authentication Middleware
   │   └─ Verify JWT token
   │
   ├─▶ Rate Limiting Middleware
   │   └─ Check Redis for rate limits
   │
   ├─▶ CORS Middleware
   │   └─ Verify origin is allowed
   │
   └─▶ Route Handler (/api/chat)
       │
       ├─▶ Query PostgreSQL
       │   └─ Get user session, history
       │
       ├─▶ Check Redis Cache
       │   └─ Cached response?
       │
       ├─▶ LLM Processing
       │   └─ Call OpenAI/Gemini/Anthropic
       │
       ├─▶ Save to PostgreSQL
       │   └─ Store message, update session
       │
       └─▶ Return JSON Response
```

---

## 🐳 Container Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    docker compose up -d                     │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐      ┌────────┐     ┌─────────┐
    │Postgres│      │ Redis  │     │ Backend │
    │        │      │        │     │         │
    │Building│      │Building│     │Building │
    └────┬───┘      └────┬───┘     └────┬────┘
         │               │              │
         ▼               ▼              │
    ┌────────┐      ┌────────┐         │
    │Starting│      │Starting│         │
    └────┬───┘      └────┬───┘         │
         │               │              │
         ▼               ▼              │
    ┌────────┐      ┌────────┐         │
    │Health  │      │Health  │         │
    │Check   │      │Check   │         │
    └────┬───┘      └────┬───┘         │
         │               │              │
         ▼               ▼              │
    ┌────────┐      ┌────────┐         │
    │Healthy │      │Healthy │         │
    └────┬───┘      └────┬───┘         │
         │               │              │
         └───────────────┴──────────────┤
                                        │ depends_on
                                        │ (wait for healthy)
                                        ▼
                                   ┌─────────┐
                                   │ Backend │
                                   │ Starts  │
                                   └────┬────┘
                                        │
                                        ▼
                                   ┌─────────┐
                                   │ Run     │
                                   │Migrations│
                                   └────┬────┘
                                        │
                                        ▼
                                   ┌─────────┐
                                   │ Start   │
                                   │ Uvicorn │
                                   └────┬────┘
                                        │
                                        ▼
                                   ┌─────────┐
                                   │ Healthy │
                                   └─────────┘
```

---

## 📦 Multi-Stage Build Process

### Backend Dockerfile

```
┌─────────────────────────────────────────────────────────────┐
│                    Stage 1: Builder                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FROM python:3.11-slim                                      │
│    │                                                        │
│    ├─▶ Install build tools (gcc, make, etc.)               │
│    │   Size: ~500MB                                        │
│    │                                                        │
│    ├─▶ Create virtual environment                          │
│    │   /opt/venv                                           │
│    │                                                        │
│    └─▶ Install Python packages                             │
│        pip install -r requirements.txt                     │
│        Size: ~1.2GB total                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ Copy only /opt/venv
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Stage 2: Runtime                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FROM python:3.11-slim                                      │
│    │                                                        │
│    ├─▶ Install runtime libraries only                      │
│    │   (no build tools)                                    │
│    │   Size: ~150MB                                        │
│    │                                                        │
│    ├─▶ Copy virtual environment from builder               │
│    │   COPY --from=builder /opt/venv /opt/venv            │
│    │   Size: ~250MB                                        │
│    │                                                        │
│    ├─▶ Copy application code                               │
│    │   Size: ~10MB                                         │
│    │                                                        │
│    └─▶ Create non-root user                                │
│        Final image size: ~400MB                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Result: 1.2GB → 400MB (3x smaller!)
```

---

## 🌐 Network Communication

```
┌──────────────────────────────────────────────────────────────┐
│                  External Network (Internet)                 │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ HTTP Requests
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    Docker Host (Server)                      │
│                                                              │
│  Port Mappings:                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 80:80    → Frontend Container                          │ │
│  │ 8000:8000 → Backend Container                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┼──────────────────────────────────┐│
│  │    itl-chatbot-network (172.18.0.0/16)                  ││
│  │                      │                                   ││
│  │  ┌───────────────────┼────────────────────────────────┐ ││
│  │  │                   │                                │ ││
│  │  │  Frontend ◀───────┘                                │ ││
│  │  │  172.18.0.4:80                                     │ ││
│  │  │       │                                            │ ││
│  │  │       │ API calls to                               │ ││
│  │  │       │ http://backend:8000                        │ ││
│  │  │       ▼                                            │ ││
│  │  │  Backend                                           │ ││
│  │  │  172.18.0.5:8000                                   │ ││
│  │  │       │                                            │ ││
│  │  │       ├─▶ postgresql://postgres:5432               │ ││
│  │  │       │   (connects to 172.18.0.2)                 │ ││
│  │  │       │                                            │ ││
│  │  │       └─▶ redis://redis:6379                       │ ││
│  │  │           (connects to 172.18.0.3)                 │ ││
│  │  │                                                    │ ││
│  │  │  PostgreSQL         Redis                          │ ││
│  │  │  172.18.0.2:5432    172.18.0.3:6379               │ ││
│  │  │  (internal only)    (internal only)               │ ││
│  │  │                                                    │ ││
│  │  └────────────────────────────────────────────────────┘ ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘

Key Points:
- Frontend and Backend are exposed to internet (port mapping)
- PostgreSQL and Redis are internal only (no port mapping)
- Services use DNS names (postgres, redis, backend)
- Docker automatically resolves names to IPs
```

---

## 💾 Data Persistence

```
┌──────────────────────────────────────────────────────────────┐
│                      Docker Host                             │
│                                                              │
│  /var/lib/docker/volumes/                                    │
│  │                                                           │
│  ├─ itl-postgres-data/                                       │
│  │  └─ _data/                                               │
│  │     ├─ base/          (database files)                   │
│  │     ├─ global/        (cluster-wide data)                │
│  │     ├─ pg_wal/        (write-ahead logs)                 │
│  │     └─ ...                                               │
│  │                                                           │
│  └─ itl-redis-data/                                          │
│     └─ _data/                                                │
│        └─ appendonly.aof  (Redis persistence)                │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Containers                          │ │
│  │                                                        │ │
│  │  ┌──────────────┐           ┌──────────────┐         │ │
│  │  │  PostgreSQL  │           │    Redis     │         │ │
│  │  │              │           │              │         │ │
│  │  │  /var/lib/   │◀─ Mount ─│  /data       │◀─ Mount│ │
│  │  │  postgresql/ │           │              │         │ │
│  │  │  data/       │           │              │         │ │
│  │  └──────────────┘           └──────────────┘         │ │
│  │        │                           │                  │ │
│  └────────┼───────────────────────────┼──────────────────┘ │
│           │                           │                    │
│           └───────────┬───────────────┘                    │
│                       │                                    │
│                  Data persists                             │
│                  even if container                         │
│                  is deleted!                               │
│                                                            │
└────────────────────────────────────────────────────────────┘

Lifecycle:
1. Container writes data → Volume on host
2. Container deleted → Volume remains
3. New container created → Mounts same volume
4. Data is still there! ✅
```

---

## 🔄 Update Process (Zero Downtime)

```
Step 1: Current State
┌─────────────────────────────────────┐
│  Backend v1.0 (running)             │
│  ├─ Container: itl-backend          │
│  └─ Serving requests ✅             │
└─────────────────────────────────────┘

Step 2: Build new image
┌─────────────────────────────────────┐
│  docker compose build backend       │
│  ├─ Creates: backend:latest (v1.1)  │
│  └─ Old container still running ✅  │
└─────────────────────────────────────┘

Step 3: Start new container
┌─────────────────────────────────────┐
│  docker compose up -d --no-deps     │
│  --build backend                    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Backend v1.0 (running) ✅   │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ Backend v1.1 (starting) ⏳  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘

Step 4: Health check passes
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐   │
│  │ Backend v1.0 (running) ✅   │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ Backend v1.1 (healthy) ✅   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘

Step 5: Old container removed
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐   │
│  │ Backend v1.0 (stopping) ⏹️  │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ Backend v1.1 (running) ✅   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘

Step 6: Complete
┌─────────────────────────────────────┐
│  Backend v1.1 (running) ✅          │
│  ├─ Container: itl-backend          │
│  └─ Serving requests ✅             │
└─────────────────────────────────────┘

Total downtime: 0 seconds! 🎉
```

---

## 🔒 Security Layers

```
┌──────────────────────────────────────────────────────────────┐
│                    Security Layers                           │
│                                                              │
│  Layer 1: Network Isolation                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ - PostgreSQL: No external access (internal only)       │ │
│  │ - Redis: No external access (internal only)            │ │
│  │ - Backend: Exposed but protected by firewall           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Layer 2: Container Isolation                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ - Each service runs in isolated container              │ │
│  │ - Non-root user (appuser:1000)                         │ │
│  │ - Read-only file system (where possible)               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Layer 3: Application Security                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ - JWT authentication                                   │ │
│  │ - CORS protection                                      │ │
│  │ - Rate limiting (Redis)                                │ │
│  │ - SQL injection prevention (SQLAlchemy ORM)            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Layer 4: Data Security                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ - Encrypted secrets (Fernet)                           │ │
│  │ - Environment variables (not in code)                  │ │
│  │ - Encrypted connections (TLS/SSL)                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Resource Allocation

```
Recommended Resources per Service:

┌─────────────┬─────────┬─────────┬──────────┬─────────────┐
│   Service   │   CPU   │  Memory │   Disk   │   Priority  │
├─────────────┼─────────┼─────────┼──────────┼─────────────┤
│ PostgreSQL  │ 1 core  │  2 GB   │  10 GB   │   High      │
│ Redis       │ 0.5 core│  512 MB │  1 GB    │   Medium    │
│ Backend     │ 2 cores │  2 GB   │  5 GB    │   High      │
│ Frontend    │ 0.5 core│  256 MB │  100 MB  │   Low       │
├─────────────┼─────────┼─────────┼──────────┼─────────────┤
│ TOTAL       │ 4 cores │  ~5 GB  │  ~16 GB  │             │
└─────────────┴─────────┴─────────┴──────────┴─────────────┘

Production Scaling:
- Light traffic: 2 CPU cores, 4 GB RAM
- Medium traffic: 4 CPU cores, 8 GB RAM
- Heavy traffic: 8+ CPU cores, 16+ GB RAM
```

---

## 🎯 Health Check Flow

```
Docker Engine
    │
    ├─ Every 30 seconds
    │
    ▼
┌─────────────────────────────────────┐
│  Run health check command           │
│  curl -f http://localhost:8000/health│
└────────────┬────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────┐      ┌─────────┐
│ Success │      │ Failure │
│ (200 OK)│      │ (Error) │
└────┬────┘      └────┬────┘
     │                │
     ▼                ▼
┌─────────┐      ┌─────────┐
│ Healthy │      │Unhealthy│
│   ✅    │      │   ❌    │
└─────────┘      └────┬────┘
                      │
                      ├─ Retry 1
                      ├─ Retry 2
                      └─ Retry 3
                           │
                           ▼
                      ┌─────────┐
                      │ Mark as │
                      │Unhealthy│
                      └────┬────┘
                           │
                           ▼
                      ┌─────────┐
                      │ Restart │
                      │Container│
                      │(optional)│
                      └─────────┘
```

---

**These diagrams should help you visualize how all the Docker components work together!**

**Last Updated**: December 2024
