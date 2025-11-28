# Docker Deployment Guide

**Project**: ITL Chatbot Backend  
**Docker**: Production-ready with UV for fast builds

---

## 🚀 Quick Start

### 1. Build and Run

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Check status
docker-compose ps
```

### 2. Access Services

- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

---

## 📋 Prerequisites

### Required Files

1. **`.env`** - Environment configuration
2. **`jwt_private.pem`** - JWT private key
3. **`pyproject.toml`** - Python dependencies
4. **`uv.lock`** - Locked dependencies

### Create .env File

```bash
# Copy template
cp Checklist_production/.env.production.template .env

# Edit with your values
nano .env
```

**Required Environment Variables**:
```bash
# Security (REQUIRED)
FERNET_KEY=kN8j3xP5mR7qT9wV2yB4nL6oC1eH3fA8gD0iK5sU9jM=
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# Database (REQUIRED)
DB_PASSWORD=your_strong_password_here

# Application
ENVIRONMENT=production
DISABLE_AUTH=false
LOG_LEVEL=WARNING
CORS_ORIGINS=https://yourdomain.com
```

---

## 🏗️ Docker Architecture

### Multi-Stage Build

**Stage 1: Builder**
- Uses UV for ultra-fast dependency installation
- Installs all Python packages
- ~10x faster than pip

**Stage 2: Runtime**
- Minimal production image
- Non-root user for security
- Only runtime dependencies

### Services

1. **postgres** - PostgreSQL 15 with pgvector
2. **redis** - Redis 7 for caching
3. **backend** - FastAPI application
4. **pgadmin** - Database admin (optional)
5. **redis-commander** - Redis admin (optional)

---

## 🔧 Commands

### Basic Operations

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart backend only
docker-compose restart backend

# View logs
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f postgres

# Check status
docker-compose ps

# Execute command in container
docker-compose exec backend python -c "print('Hello')"
```

### Database Operations

```bash
# Run database migrations
docker-compose exec backend alembic upgrade head

# Create security indexes
docker-compose exec backend python create_security_indexes.py

# Access PostgreSQL shell
docker-compose exec postgres psql -U postgres -d chatbot_itl

# Backup database
docker-compose exec postgres pg_dump -U postgres chatbot_itl > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres chatbot_itl < backup.sql
```

### Development with Admin Tools

```bash
# Start with pgAdmin and Redis Commander
docker-compose --profile admin up -d

# Access admin tools
# pgAdmin: http://localhost:5050
# Redis Commander: http://localhost:8081
```

---

## 🔒 Security Best Practices

### 1. Environment Variables

**Never commit**:
- `.env` file
- `jwt_private.pem`
- Any secrets

**Use strong passwords**:
```bash
# Generate secure password
openssl rand -base64 32
```

### 2. JWT Keys

```bash
# Keys are mounted read-only
volumes:
  - ./jwt_private.pem:/app/jwt_private.pem:ro
```

### 3. Non-Root User

Container runs as `appuser` (UID 1000) for security.

### 4. Health Checks

All services have health checks:
- Backend: HTTP /health endpoint
- PostgreSQL: pg_isready
- Redis: redis-cli ping

---

## 📊 Monitoring

### Health Checks

```bash
# Check all services
docker-compose ps

# Check backend health
curl http://localhost:8000/health

# Check logs
docker-compose logs --tail=100 backend
```

### Resource Usage

```bash
# View resource usage
docker stats

# View specific container
docker stats itl_chatbot_backend
```

---

## 🐛 Troubleshooting

### Backend Won't Start

**Check logs**:
```bash
docker-compose logs backend
```

**Common issues**:
1. Missing `.env` file
2. Missing `jwt_private.pem`
3. Database not ready
4. Invalid environment variables

**Solution**:
```bash
# Verify .env exists
ls -la .env

# Verify JWT key exists
ls -la jwt_private.pem

# Check database
docker-compose logs postgres

# Restart services
docker-compose restart
```

### Database Connection Error

**Check**:
```bash
# Verify postgres is running
docker-compose ps postgres

# Check postgres logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U postgres -d chatbot_itl -c "SELECT 1"
```

### Permission Errors

**Fix ownership**:
```bash
# If volumes have wrong permissions
docker-compose down
sudo chown -R 1000:1000 ./uploads
docker-compose up -d
```

---

## 🔄 Updates & Maintenance

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose build backend
docker-compose up -d backend

# Check logs
docker-compose logs -f backend
```

### Update Dependencies

```bash
# Update uv.lock
uv lock

# Rebuild image
docker-compose build --no-cache backend
docker-compose up -d backend
```

### Backup Data

```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres chatbot_itl | gzip > backup_$(date +%Y%m%d).sql.gz

# Backup volumes
docker run --rm -v itl_chatbot_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data
```

---

## 🚀 Production Deployment

### 1. Prepare Environment

```bash
# Set production values in .env
ENVIRONMENT=production
DISABLE_AUTH=false
LOG_LEVEL=WARNING
DB_PASSWORD=<strong_password>
```

### 2. Build Image

```bash
# Build production image
docker-compose build

# Or build with specific tag
docker build -t itl-chatbot-backend:v1.0.0 .
```

### 3. Deploy

```bash
# Start services
docker-compose up -d

# Verify health
curl http://localhost:8000/health

# Check logs
docker-compose logs -f backend
```

### 4. Post-Deployment

```bash
# Create database indexes
docker-compose exec backend python create_security_indexes.py

# Verify authentication
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
# Should return 401 Unauthorized
```

---

## 📝 Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `FERNET_KEY` | Encryption key | `kN8j3xP5mR7qT9wV2yB4nL6oC1eH3fA8gD0iK5sU9jM=` |
| `JWT_PUBLIC_KEY` | JWT public key | `"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"` |
| `DB_PASSWORD` | Database password | `your_strong_password` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `production` | Environment name |
| `DISABLE_AUTH` | `false` | Disable auth (dev only) |
| `LOG_LEVEL` | `WARNING` | Log level |
| `DB_NAME` | `chatbot_itl` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PORT` | `5432` | Database port |
| `REDIS_PORT` | `6379` | Redis port |
| `API_PORT` | `8000` | API port |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed origins |

---

## 🎯 Performance Tuning

### PostgreSQL

```yaml
environment:
  POSTGRES_SHARED_BUFFERS: 256MB
  POSTGRES_EFFECTIVE_CACHE_SIZE: 1GB
  POSTGRES_WORK_MEM: 16MB
```

### Redis

```yaml
command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### Backend

```yaml
environment:
  DB_POOL_SIZE: 20
  DB_MAX_OVERFLOW: 10
```

---

## 📚 Additional Resources

- **Dockerfile**: Multi-stage build with UV
- **docker-compose.yml**: Full stack configuration
- **.dockerignore**: Build optimization
- **Checklist_production/**: All deployment guides

---

**Quick Reference**:
```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Logs
docker-compose logs -f

# Status
docker-compose ps

# Restart
docker-compose restart backend
```
