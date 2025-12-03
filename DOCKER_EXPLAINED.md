# 🎓 Docker & Docker Compose Explained for ITL AgentHub

This document explains the Docker setup for the ITL AgentHub chatbot in detail, designed to help you understand every component and how they work together.

---

## 📚 Table of Contents

1. [What is Docker?](#what-is-docker)
2. [What is Docker Compose?](#what-is-docker-compose)
3. [File Structure Overview](#file-structure-overview)
4. [Dockerfile Explained (Backend)](#dockerfile-explained-backend)
5. [Dockerfile Explained (Frontend)](#dockerfile-explained-frontend)
6. [Docker Compose Explained](#docker-compose-explained)
7. [Environment Variables](#environment-variables)
8. [Networking](#networking)
9. [Data Persistence](#data-persistence)
10. [Common Commands](#common-commands)

---

## 🐳 What is Docker?

**Docker** is a platform that packages your application and all its dependencies into a standardized unit called a **container**.

### Key Concepts:

1. **Container**: A lightweight, standalone package that includes:
   - Your application code
   - Runtime environment (Python, Node.js, etc.)
   - System libraries
   - Dependencies

2. **Image**: A blueprint for creating containers (like a class in OOP)

3. **Dockerfile**: A recipe/script that defines how to build an image

### Why Use Docker?

✅ **Consistency**: "It works on my machine" → "It works everywhere"  
✅ **Isolation**: Each service runs in its own environment  
✅ **Portability**: Deploy anywhere (local, cloud, on-premise)  
✅ **Scalability**: Easily run multiple instances  
✅ **Version Control**: Track changes to your infrastructure  

### Analogy:

Think of Docker like shipping containers:
- **Container**: Standardized box that can hold anything
- **Image**: The packing instructions
- **Dockerfile**: The blueprint for packing
- **Ship (Docker Engine)**: Transports containers anywhere

---

## 🎼 What is Docker Compose?

**Docker Compose** is a tool for defining and running **multi-container** applications.

### Why We Need It:

Your ITL AgentHub application has **4 services**:
1. PostgreSQL (Database)
2. Redis (Cache)
3. Backend (FastAPI)
4. Frontend (React/Nginx)

Without Docker Compose, you'd need to:
```bash
# Start each service manually
docker run postgres...
docker run redis...
docker run backend...
docker run frontend...
```

With Docker Compose:
```bash
# Start everything with one command
docker compose up
```

### Key Features:

- **Orchestration**: Manages multiple containers
- **Dependencies**: Ensures services start in correct order
- **Networking**: Automatically creates network for services to communicate
- **Configuration**: Single YAML file for all services

---

## 📁 File Structure Overview

Here's what we created and why:

```
itl_chatbot_works/
├── backend/
│   ├── Dockerfile              # How to build backend image
│   └── migrations/
│       └── init.sql            # Database initialization
├── frontend/
│   ├── Dockerfile              # How to build frontend image
│   └── nginx.conf              # Web server configuration
├── docker-compose.yml          # Orchestrates all services
├── .dockerignore               # Files to exclude from build
├── .env.production             # Production environment template
└── DEPLOYMENT.md               # Deployment instructions
```

---

## 🔧 Dockerfile Explained (Backend)

The backend Dockerfile uses a **multi-stage build** to create a small, secure image.

### Stage 1: Builder (Lines 1-30)

```dockerfile
FROM python:3.11-slim as builder
```

**Purpose**: Install dependencies and compile packages

**Why separate stage?**
- Build tools (gcc, make) are large (~500MB)
- We only need them during installation
- Final image doesn't need build tools

**What it does:**
1. Installs system dependencies (PostgreSQL client, compilers)
2. Creates Python virtual environment
3. Installs Python packages from `requirements.txt`

### Stage 2: Runtime (Lines 32-end)

```dockerfile
FROM python:3.11-slim
```

**Purpose**: Create minimal production image

**What it does:**
1. Starts with fresh, clean Python image
2. Copies only the virtual environment (not build tools)
3. Copies application code
4. Creates non-root user for security
5. Sets up health check

### Key Security Features:

1. **Non-root user**:
   ```dockerfile
   RUN useradd -m -u 1000 appuser
   USER appuser
   ```
   Running as root is dangerous - if container is compromised, attacker has root access.

2. **Health check**:
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=10s \
       CMD curl -f http://localhost:8000/health || exit 1
   ```
   Docker automatically checks if service is healthy every 30 seconds.

3. **Multi-stage build**:
   - Builder stage: ~1.2GB
   - Final image: ~400MB (3x smaller!)

### The CMD Command:

```dockerfile
CMD ["sh", "-c", "alembic upgrade head && uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4"]
```

**What this does:**
1. `alembic upgrade head` - Run database migrations
2. `uvicorn src.main:app` - Start FastAPI server
3. `--host 0.0.0.0` - Listen on all network interfaces (required for Docker)
4. `--port 8000` - Use port 8000
5. `--workers 4` - Run 4 worker processes (for handling concurrent requests)

---

## 🎨 Dockerfile Explained (Frontend)

The frontend Dockerfile also uses multi-stage build.

### Stage 1: Builder

```dockerfile
FROM node:20-alpine as builder
```

**What it does:**
1. Installs Node.js dependencies (`npm ci`)
2. Builds React app (`npm run build`)
3. Creates optimized static files in `/app/dist`

**Why `npm ci` instead of `npm install`?**
- `npm ci` is faster and more reliable for production
- Uses exact versions from `package-lock.json`
- Ensures reproducible builds

### Stage 2: Nginx Server

```dockerfile
FROM nginx:1.25-alpine
```

**What it does:**
1. Copies built files from builder stage
2. Configures Nginx to serve the SPA
3. Sets up health check

**Why Nginx?**
- **Fast**: Serves static files extremely efficiently
- **Small**: Alpine image is only ~40MB
- **Production-ready**: Battle-tested web server
- **Caching**: Built-in support for browser caching

### The nginx.conf File:

This configures how Nginx serves your React app:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**What this means:**
1. User requests `/admin/dashboard`
2. Nginx tries to find file `/admin/dashboard`
3. File doesn't exist (it's a React route)
4. Nginx serves `/index.html` instead
5. React Router handles the routing

This is called **SPA fallback** - essential for React Router to work.

---

## 🎼 Docker Compose Explained

Let's break down the `docker-compose.yml` file section by section.

### Version and Services:

```yaml
version: '3.8'

services:
  postgres:
    # ...
  redis:
    # ...
  backend:
    # ...
  frontend:
    # ...
```

**Services** are the containers you want to run. Each service is a separate container.

### PostgreSQL Service:

```yaml
postgres:
  image: pgvector/pgvector:pg15
  container_name: itl-postgres
  restart: unless-stopped
  environment:
    POSTGRES_DB: ${DB_NAME:-chatbot_itl}
    POSTGRES_USER: ${DB_USER:-postgres}
    POSTGRES_PASSWORD: ${DB_PASSWORD:-Postgres123!}
```

**Key points:**

1. **image**: Uses pre-built image with pgvector extension
2. **container_name**: Friendly name (instead of random name)
3. **restart: unless-stopped**: Auto-restart if crashes
4. **environment**: Configuration via environment variables
5. **${DB_NAME:-chatbot_itl}**: Use `DB_NAME` from `.env`, fallback to `chatbot_itl`

### Health Checks:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres -d chatbot_itl"]
  interval: 10s
  timeout: 5s
  retries: 5
```

**What this does:**
- Every 10 seconds, run `pg_isready` command
- If command fails 5 times, mark service as unhealthy
- Other services can wait for this to be healthy before starting

### Dependencies:

```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
```

**What this means:**
1. Don't start backend until postgres is healthy
2. Don't start backend until redis is healthy
3. Ensures correct startup order

### Volumes:

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
```

**What this does:**
- Creates named volume `postgres_data`
- Mounts it to `/var/lib/postgresql/data` inside container
- Data persists even if container is deleted

**Without volumes:**
- Delete container → lose all data ❌
- With volumes → data is safe ✅

### Networks:

```yaml
networks:
  itl-network:
    driver: bridge
```

**What this does:**
- Creates isolated network for all services
- Services can communicate using service names
- Example: Backend connects to `postgres:5432` (not `localhost:5432`)

### Profiles:

```yaml
pgadmin:
  # ...
  profiles:
    - admin
```

**What this does:**
- Service only starts when profile is activated
- Start with admin tools: `docker compose --profile admin up`
- Start without admin tools: `docker compose up`

---

## 🔐 Environment Variables

Environment variables configure your application without changing code.

### How They Work:

1. **Define in `.env` file:**
   ```
   DB_PASSWORD=mySecretPassword
   ```

2. **Reference in `docker-compose.yml`:**
   ```yaml
   environment:
     POSTGRES_PASSWORD: ${DB_PASSWORD}
   ```

3. **Access in application:**
   ```python
   import os
   password = os.getenv("DB_PASSWORD")
   ```

### Why Use Environment Variables?

✅ **Security**: Secrets not in code  
✅ **Flexibility**: Different values for dev/staging/production  
✅ **12-Factor App**: Industry best practice  

### Critical Variables:

| Variable | Purpose | Example |
|----------|---------|---------|
| `FERNET_KEY` | Encrypts API keys in database | `kN8j3xP5mR7q...` |
| `JWT_PUBLIC_KEY` | Verifies authentication tokens | `-----BEGIN PUBLIC KEY-----...` |
| `DB_PASSWORD` | Database password | `MyStr0ngP@ssw0rd!` |
| `CORS_ORIGINS` | Allowed frontend domains | `https://app.example.com` |
| `ENVIRONMENT` | Environment mode | `production` |

---

## 🌐 Networking

Docker creates an isolated network for your services.

### How Services Communicate:

```
┌─────────────────────────────────────┐
│     itl-network (172.18.0.0/16)     │
│                                     │
│  ┌──────────┐      ┌──────────┐   │
│  │ Backend  │─────▶│ Postgres │   │
│  │172.18.0.4│      │172.18.0.2│   │
│  └──────────┘      └──────────┘   │
│       │                             │
│       ▼                             │
│  ┌──────────┐                      │
│  │  Redis   │                      │
│  │172.18.0.3│                      │
│  └──────────┘                      │
└─────────────────────────────────────┘
```

### Service Discovery:

Inside the network, services use **service names** as hostnames:

```python
# Backend connects to database
DATABASE_URL = "postgresql://postgres:password@postgres:5432/chatbot"
#                                              ^^^^^^^^
#                                              Service name, not IP!

# Backend connects to Redis
REDIS_URL = "redis://redis:6379"
#                   ^^^^^
#                   Service name
```

**Docker's DNS** automatically resolves:
- `postgres` → `172.18.0.2`
- `redis` → `172.18.0.3`
- `backend` → `172.18.0.4`

### Port Mapping:

```yaml
ports:
  - "8000:8000"
#    ^^^^  ^^^^
#    Host  Container
```

**What this means:**
- **Container port 8000**: Backend listens on port 8000 inside container
- **Host port 8000**: Exposed to outside world on port 8000
- Access from browser: `http://localhost:8000`

**Internal vs External:**
- **Internal only** (no port mapping): `postgres`, `redis`
- **External** (with port mapping): `backend`, `frontend`

---

## 💾 Data Persistence

Containers are **ephemeral** (temporary). When deleted, data is lost.

### Solution: Volumes

```yaml
volumes:
  postgres_data:
    name: itl-postgres-data
  redis_data:
    name: itl-redis-data
```

### How Volumes Work:

```
┌─────────────────────────────────────┐
│          Docker Host                │
│                                     │
│  /var/lib/docker/volumes/           │
│  ├── itl-postgres-data/             │
│  │   └── _data/                     │
│  │       └── [database files]       │
│  │                                  │
│  └── itl-redis-data/                │
│      └── _data/                     │
│          └── [cache files]          │
│                                     │
│  ┌──────────────┐                  │
│  │  Container   │                  │
│  │  ┌────────┐  │                  │
│  │  │ /var/  │◀─┼─── Volume Mount  │
│  │  │ lib/   │  │                  │
│  │  │postgres│  │                  │
│  │  └────────┘  │                  │
│  └──────────────┘                  │
└─────────────────────────────────────┘
```

### Lifecycle:

1. **Create container**: Volume is created
2. **Write data**: Saved to volume (on host)
3. **Delete container**: Volume remains
4. **Create new container**: Reattach same volume → data is back!

### Managing Volumes:

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect itl-postgres-data

# Backup volume
docker run --rm -v itl-postgres-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data

# Remove volume (WARNING: deletes data!)
docker volume rm itl-postgres-data
```

---

## 🎮 Common Commands

### Starting Services:

```bash
# Start all services in background
docker compose up -d

# Start with admin tools
docker compose --profile admin up -d

# Start specific service
docker compose up -d backend

# Start and rebuild images
docker compose up -d --build
```

### Stopping Services:

```bash
# Stop all services (containers remain)
docker compose stop

# Stop and remove containers
docker compose down

# Stop and remove containers + volumes (WARNING: deletes data!)
docker compose down -v
```

### Viewing Logs:

```bash
# All services
docker compose logs

# Follow logs (real-time)
docker compose logs -f

# Specific service
docker compose logs backend

# Last 100 lines
docker compose logs --tail=100 backend
```

### Checking Status:

```bash
# List running containers
docker compose ps

# Check resource usage
docker stats

# View service health
docker compose ps --format json | jq '.[].Health'
```

### Executing Commands:

```bash
# Run command in running container
docker compose exec backend bash

# Run database migrations
docker compose exec backend alembic upgrade head

# Access PostgreSQL shell
docker compose exec postgres psql -U postgres -d chatbot_itl

# Access Redis CLI
docker compose exec redis redis-cli
```

### Rebuilding:

```bash
# Rebuild all images
docker compose build

# Rebuild specific service
docker compose build backend

# Rebuild without cache (fresh build)
docker compose build --no-cache
```

### Scaling:

```bash
# Run 4 backend instances
docker compose up -d --scale backend=4

# Note: Need to remove port mapping for scaling to work
# Use load balancer (Nginx, Traefik) to distribute traffic
```

### Cleaning Up:

```bash
# Remove stopped containers
docker compose rm

# Remove unused images
docker image prune

# Remove everything (containers, networks, volumes, images)
docker system prune -a --volumes
```

---

## 🚀 Deployment Workflow

Here's the typical workflow for deploying:

### 1. Development:

```bash
# Use development environment
cp .env.example .env

# Start services
docker compose up -d

# View logs
docker compose logs -f

# Make changes to code
# (changes auto-reload in development)
```

### 2. Testing:

```bash
# Run tests in container
docker compose exec backend pytest

# Check health
curl http://localhost:8000/health
```

### 3. Production Deployment:

```bash
# On production server
git clone <repo>
cd itl_chatbot_works

# Configure production environment
cp .env.production .env
nano .env  # Update all CHANGE_THIS values

# Build images
docker compose build

# Start services
docker compose up -d

# Verify deployment
docker compose ps
curl http://localhost:8000/health

# Monitor logs
docker compose logs -f
```

### 4. Updates:

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build

# Or zero-downtime update:
docker compose up -d --no-deps --build backend
```

---

## 🎯 Best Practices

### 1. Security:

✅ Never commit `.env` files  
✅ Use strong passwords (20+ characters)  
✅ Run containers as non-root user  
✅ Keep images updated  
✅ Use secrets management for production  

### 2. Performance:

✅ Use multi-stage builds  
✅ Minimize image layers  
✅ Use `.dockerignore`  
✅ Cache dependencies  
✅ Use health checks  

### 3. Maintenance:

✅ Regular backups  
✅ Monitor logs  
✅ Update dependencies  
✅ Document changes  
✅ Test before deploying  

---

## 📖 Further Learning

### Recommended Resources:

1. **Docker Official Docs**: https://docs.docker.com/
2. **Docker Compose Docs**: https://docs.docker.com/compose/
3. **Best Practices**: https://docs.docker.com/develop/dev-best-practices/
4. **Security**: https://docs.docker.com/engine/security/

### Key Concepts to Master:

- [ ] Images vs Containers
- [ ] Volumes and bind mounts
- [ ] Networking (bridge, host, overlay)
- [ ] Multi-stage builds
- [ ] Health checks
- [ ] Docker Compose orchestration
- [ ] Environment variables
- [ ] Logging and monitoring

---

## 🤝 Getting Help

If you encounter issues:

1. **Check logs**: `docker compose logs -f`
2. **Check status**: `docker compose ps`
3. **Verify config**: `docker compose config`
4. **Read error messages carefully**
5. **Search Docker docs**
6. **Ask the team**

---

**Remember**: Docker is a powerful tool, but it takes practice. Don't be afraid to experiment in development!

**Last Updated**: December 2024  
**Author**: ITL AgentHub DevOps Team
