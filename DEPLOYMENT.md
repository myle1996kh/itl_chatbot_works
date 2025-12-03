# 🚀 ITL AgentHub - Production Deployment Guide

This guide explains how to deploy the ITL AgentHub chatbot application using Docker and Docker Compose.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Detailed Deployment Steps](#detailed-deployment-steps)
- [Configuration](#configuration)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)

---

## 🔧 Prerequisites

Before deploying, ensure you have:

1. **Docker** (version 20.10+)
   ```bash
   docker --version
   ```

2. **Docker Compose** (version 2.0+)
   ```bash
   docker compose version
   ```

3. **Minimum Server Requirements:**
   - **CPU:** 2 cores (4+ recommended for production)
   - **RAM:** 4GB minimum (8GB+ recommended)
   - **Disk:** 20GB minimum (SSD recommended)
   - **OS:** Linux (Ubuntu 20.04+, Debian 11+, RHEL 8+) or Windows Server

4. **Network Requirements:**
   - Port 80 (Frontend)
   - Port 8000 (Backend API)
   - Port 5432 (PostgreSQL - can be internal only)
   - Port 6379 (Redis - can be internal only)

---

## 🏗️ Architecture Overview

The application consists of 4 main services:

```
┌─────────────┐
│   Nginx     │  Port 80 (Frontend)
│  (Frontend) │
└──────┬──────┘
       │
┌──────▼──────┐
│   FastAPI   │  Port 8000 (Backend)
│  (Backend)  │
└──┬───────┬──┘
   │       │
┌──▼───┐ ┌▼────────┐
│Redis │ │PostgreSQL│
│Cache │ │+pgvector │
└──────┘ └──────────┘
```

**Service Descriptions:**

1. **Frontend (Nginx):** Serves the React SPA and widget
2. **Backend (FastAPI):** Handles API requests, agent orchestration, and business logic
3. **PostgreSQL:** Stores relational data and vector embeddings (pgvector)
4. **Redis:** Provides caching and rate limiting

---

## ⚡ Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd itl_chatbot_works
```

### 2. Configure Environment

```bash
# Copy the production environment template
cp .env.production .env

# Edit the .env file with your configuration
nano .env  # or use your preferred editor
```

**CRITICAL:** Update these values in `.env`:
- `FERNET_KEY` - Generate with: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- `DB_PASSWORD` - Strong password for PostgreSQL
- `REDIS_PASSWORD` - Strong password for Redis
- `JWT_PUBLIC_KEY` - Your RS256 public key
- `CORS_ORIGINS` - Your production domain(s)

### 3. Build and Start Services

```bash
# Build all images
docker compose build

# Start all services
docker compose up -d

# View logs
docker compose logs -f
```

### 4. Verify Deployment

```bash
# Check service health
docker compose ps

# Test backend health
curl http://localhost:8000/health

# Test frontend
curl http://localhost:80/health
```

### 5. Access the Application

- **Frontend:** http://your-domain.com (or http://localhost:80)
- **Backend API Docs:** http://your-domain.com:8000/docs
- **pgAdmin (optional):** http://your-domain.com:5050

---

## 📝 Detailed Deployment Steps

### Step 1: Prepare the Server

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Add your user to docker group (optional)
sudo usermod -aG docker $USER
newgrp docker
```

### Step 2: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (if not already allowed)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### Step 3: Set Up SSL/TLS (Recommended)

For production, use a reverse proxy like Nginx or Traefik with Let's Encrypt:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Step 4: Configure Environment Variables

Edit `.env` file with production values:

```bash
# Security
FERNET_KEY=<generated-key>
JWT_PUBLIC_KEY="<your-public-key>"
DISABLE_AUTH=false
ENVIRONMENT=production

# Database
DB_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>

# Application
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
LOG_LEVEL=WARNING
```

### Step 5: Initialize Database

```bash
# Start only database services first
docker compose up -d postgres redis

# Wait for database to be ready
docker compose logs -f postgres

# Run database migrations
docker compose exec backend alembic upgrade head
```

### Step 6: Start All Services

```bash
# Start all services
docker compose up -d

# Monitor startup
docker compose logs -f
```

---

## ⚙️ Configuration

### Environment Variables

All configuration is done via the `.env` file. Key variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `FERNET_KEY` | Encryption key for API keys | - | ✅ |
| `JWT_PUBLIC_KEY` | RS256 public key for auth | - | ✅ |
| `DB_PASSWORD` | PostgreSQL password | - | ✅ |
| `REDIS_PASSWORD` | Redis password | - | ✅ |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | - | ✅ |
| `ENVIRONMENT` | Environment (production/development) | production | ✅ |
| `LOG_LEVEL` | Logging level | WARNING | ❌ |
| `API_PORT` | Backend API port | 8000 | ❌ |
| `FRONTEND_PORT` | Frontend port | 80 | ❌ |

### Docker Compose Profiles

The `docker-compose.yml` supports profiles for optional services:

```bash
# Start with admin tools (pgAdmin, Redis Commander)
docker compose --profile admin up -d

# Start without admin tools (production)
docker compose up -d
```

### Scaling Services

Scale the backend for high traffic:

```bash
# Run 4 backend instances
docker compose up -d --scale backend=4
```

---

## 📊 Monitoring and Maintenance

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

### Check Service Health

```bash
# View running containers
docker compose ps

# Check resource usage
docker stats

# Health check endpoints
curl http://localhost:8000/health  # Backend
curl http://localhost:80/health    # Frontend
```

### Database Backups

```bash
# Backup PostgreSQL database
docker compose exec postgres pg_dump -U postgres chatbot_itl > backup_$(date +%Y%m%d).sql

# Restore from backup
docker compose exec -T postgres psql -U postgres chatbot_itl < backup_20241203.sql
```

### Update Application

```bash
# Pull latest code
git pull

# Rebuild images
docker compose build

# Restart services with zero downtime
docker compose up -d --no-deps --build backend frontend
```

---

## 🔍 Troubleshooting

### Backend Won't Start

**Symptom:** Backend container exits immediately

**Solution:**
```bash
# Check logs
docker compose logs backend

# Common issues:
# 1. Database not ready - wait for postgres health check
# 2. Missing environment variables - check .env file
# 3. Migration errors - run: docker compose exec backend alembic upgrade head
```

### Database Connection Errors

**Symptom:** `could not connect to server: Connection refused`

**Solution:**
```bash
# Verify postgres is running
docker compose ps postgres

# Check postgres logs
docker compose logs postgres

# Test connection
docker compose exec postgres psql -U postgres -d chatbot_itl -c "SELECT 1;"
```

### Frontend Shows 502 Bad Gateway

**Symptom:** Nginx returns 502 error

**Solution:**
```bash
# Check if backend is running
docker compose ps backend

# Verify backend health
curl http://localhost:8000/health

# Check Nginx logs
docker compose logs frontend
```

### High Memory Usage

**Symptom:** Server running out of memory

**Solution:**
```bash
# Check memory usage
docker stats

# Reduce backend workers in backend/Dockerfile:
# Change: --workers 4
# To: --workers 2

# Rebuild and restart
docker compose up -d --build backend
```

---

## 🔒 Security Best Practices

### 1. Use Strong Passwords

```bash
# Generate strong passwords
openssl rand -base64 32
```

### 2. Enable HTTPS

Always use SSL/TLS in production with Let's Encrypt or your certificate provider.

### 3. Restrict Database Access

```yaml
# In docker-compose.yml, remove port exposure for postgres:
postgres:
  # ports:
  #   - "5432:5432"  # Comment this out
```

### 4. Regular Updates

```bash
# Update Docker images regularly
docker compose pull
docker compose up -d
```

### 5. Enable Firewall

```bash
# Only expose necessary ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 5432/tcp  # Block external database access
```

### 6. Monitor Logs

Set up log aggregation (e.g., ELK stack, Grafana Loki) to detect security issues.

### 7. Backup Regularly

Automate database backups with cron:

```bash
# Add to crontab (crontab -e)
0 2 * * * cd /path/to/itl_chatbot_works && docker compose exec postgres pg_dump -U postgres chatbot_itl > /backups/backup_$(date +\%Y\%m\%d).sql
```

---

## 📞 Support

For issues or questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review logs: `docker compose logs -f`
3. Check GitHub Issues
4. Contact the development team

---

## 📄 License

[Your License Here]

---

**Last Updated:** December 2024  
**Version:** 0.1.0
