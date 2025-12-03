# 🚀 ITL AgentHub - Docker Quick Reference

## 📋 Quick Start Commands

```bash
# 1. Configure environment
cp .env.production .env
nano .env  # Update CHANGE_THIS values

# 2. Build and start
docker compose build
docker compose up -d

# 3. Check status
docker compose ps
docker compose logs -f

# 4. Access application
# Frontend: http://localhost:80
# Backend API: http://localhost:8000/docs
```

---

## 🎯 Common Operations

### Starting & Stopping

```bash
# Start all services
docker compose up -d

# Start with admin tools (pgAdmin, Redis Commander)
docker compose --profile admin up -d

# Stop all services
docker compose stop

# Stop and remove containers
docker compose down

# Stop and remove everything including volumes (⚠️ DELETES DATA)
docker compose down -v
```

### Viewing Logs

```bash
# All services (real-time)
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres

# Last 100 lines
docker compose logs --tail=100 backend
```

### Checking Status

```bash
# List containers and status
docker compose ps

# Resource usage (CPU, memory)
docker stats

# Health check
curl http://localhost:8000/health
curl http://localhost:80/health
```

### Rebuilding & Updating

```bash
# Rebuild all images
docker compose build

# Rebuild specific service
docker compose build backend

# Rebuild without cache (fresh build)
docker compose build --no-cache

# Update and restart (zero downtime)
docker compose up -d --no-deps --build backend
```

---

## 🔧 Maintenance Commands

### Database Operations

```bash
# Access PostgreSQL shell
docker compose exec postgres psql -U postgres -d chatbot_itl

# Run migrations
docker compose exec backend alembic upgrade head

# Backup database
docker compose exec postgres pg_dump -U postgres chatbot_itl > backup.sql

# Restore database
docker compose exec -T postgres psql -U postgres chatbot_itl < backup.sql

# Check database size
docker compose exec postgres psql -U postgres -d chatbot_itl -c "SELECT pg_size_pretty(pg_database_size('chatbot_itl'));"
```

### Redis Operations

```bash
# Access Redis CLI
docker compose exec redis redis-cli

# Check Redis memory usage
docker compose exec redis redis-cli INFO memory

# Flush all cache (⚠️ CLEARS ALL CACHE)
docker compose exec redis redis-cli FLUSHALL
```

### Backend Operations

```bash
# Access backend shell
docker compose exec backend bash

# Run Python shell
docker compose exec backend python

# Run tests
docker compose exec backend pytest

# Check Python packages
docker compose exec backend pip list
```

---

## 🐛 Troubleshooting

### Service Won't Start

```bash
# Check logs for errors
docker compose logs backend

# Check if port is already in use
netstat -ano | findstr :8000  # Windows
lsof -i :8000                 # Linux/Mac

# Restart specific service
docker compose restart backend

# Force recreate container
docker compose up -d --force-recreate backend
```

### Database Connection Issues

```bash
# Verify postgres is running
docker compose ps postgres

# Check postgres logs
docker compose logs postgres

# Test connection
docker compose exec postgres psql -U postgres -d chatbot_itl -c "SELECT 1;"

# Check if database exists
docker compose exec postgres psql -U postgres -c "\l"
```

### Out of Memory

```bash
# Check memory usage
docker stats

# Reduce backend workers (edit backend/Dockerfile)
# Change: --workers 4
# To: --workers 2

# Rebuild
docker compose up -d --build backend
```

### Disk Space Issues

```bash
# Check disk usage
docker system df

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything unused (⚠️ BE CAREFUL)
docker system prune -a
```

---

## 📊 Monitoring

### View Resource Usage

```bash
# Real-time stats
docker stats

# Specific container
docker stats itl-backend

# Format output
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Check Container Health

```bash
# All containers
docker compose ps

# Detailed health info
docker inspect itl-backend | grep -A 10 Health

# Health check endpoint
curl http://localhost:8000/health
```

### View Networks

```bash
# List networks
docker network ls

# Inspect network
docker network inspect itl-chatbot-network

# Check which containers are connected
docker network inspect itl-chatbot-network | grep Name
```

---

## 🔐 Security

### Update Passwords

```bash
# 1. Update .env file
nano .env

# 2. Recreate services with new environment
docker compose up -d --force-recreate

# 3. For database password, also update in database:
docker compose exec postgres psql -U postgres -c "ALTER USER postgres PASSWORD 'new_password';"
```

### View Environment Variables

```bash
# View all environment variables in container
docker compose exec backend env

# View specific variable
docker compose exec backend printenv DATABASE_URL
```

### Generate Secrets

```bash
# Generate Fernet key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Generate random password
openssl rand -base64 32
```

---

## 📦 Backup & Restore

### Full Backup

```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Backup database
docker compose exec postgres pg_dump -U postgres chatbot_itl > backups/$(date +%Y%m%d)/database.sql

# Backup volumes
docker run --rm -v itl-postgres-data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/$(date +%Y%m%d)/postgres-volume.tar.gz /data

# Backup .env file
cp .env backups/$(date +%Y%m%d)/.env
```

### Restore from Backup

```bash
# Restore database
docker compose exec -T postgres psql -U postgres chatbot_itl < backups/20241203/database.sql

# Restore volume
docker run --rm -v itl-postgres-data:/data -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/20241203/postgres-volume.tar.gz -C /
```

---

## 🧹 Cleanup

### Remove Specific Service

```bash
# Stop and remove
docker compose rm -s -f backend

# Remove image
docker rmi itl_chatbot_works-backend
```

### Clean Everything

```bash
# Stop all services
docker compose down

# Remove volumes (⚠️ DELETES DATA)
docker compose down -v

# Remove images
docker compose down --rmi all

# Clean Docker system
docker system prune -a --volumes
```

---

## 🔄 Development Workflow

### Local Development

```bash
# 1. Start services
docker compose up -d

# 2. Watch logs
docker compose logs -f backend

# 3. Make code changes (auto-reload enabled)

# 4. If dependencies change, rebuild
docker compose up -d --build backend
```

### Testing Changes

```bash
# Run tests
docker compose exec backend pytest

# Run specific test
docker compose exec backend pytest tests/test_chat.py

# Run with coverage
docker compose exec backend pytest --cov=src
```

### Debugging

```bash
# Access backend shell
docker compose exec backend bash

# Run Python debugger
docker compose exec backend python -m pdb src/main.py

# View environment
docker compose exec backend env
```

---

## 📈 Scaling

### Scale Backend

```bash
# Run 4 backend instances
docker compose up -d --scale backend=4

# Note: Remove port mapping in docker-compose.yml first
# Use load balancer to distribute traffic
```

### Add Load Balancer

```yaml
# Add to docker-compose.yml
nginx-lb:
  image: nginx:alpine
  ports:
    - "8000:80"
  volumes:
    - ./nginx-lb.conf:/etc/nginx/nginx.conf
  depends_on:
    - backend
```

---

## 🎓 Learning Resources

- **Docker Docs**: https://docs.docker.com/
- **Docker Compose**: https://docs.docker.com/compose/
- **Best Practices**: https://docs.docker.com/develop/dev-best-practices/
- **Troubleshooting**: https://docs.docker.com/config/daemon/troubleshoot/

---

## 🆘 Emergency Commands

### Service Crashed

```bash
# Check what happened
docker compose logs backend --tail=100

# Restart service
docker compose restart backend

# If still failing, recreate
docker compose up -d --force-recreate backend
```

### Database Corrupted

```bash
# Stop all services
docker compose down

# Restore from backup
docker compose up -d postgres
docker compose exec -T postgres psql -U postgres chatbot_itl < backups/latest/database.sql

# Start other services
docker compose up -d
```

### Out of Disk Space

```bash
# Check usage
docker system df

# Clean up
docker system prune -a
docker volume prune

# Remove old images
docker image prune -a --filter "until=24h"
```

---

## 📞 Getting Help

1. Check logs: `docker compose logs -f`
2. Check status: `docker compose ps`
3. Verify config: `docker compose config`
4. Read error messages
5. Search documentation
6. Ask the team

---

**Quick Tip**: Add these aliases to your shell for faster commands:

```bash
# Add to ~/.bashrc or ~/.zshrc
alias dc='docker compose'
alias dcup='docker compose up -d'
alias dcdown='docker compose down'
alias dclogs='docker compose logs -f'
alias dcps='docker compose ps'
alias dcrestart='docker compose restart'
```

Then use: `dc up -d` instead of `docker compose up -d`

---

**Last Updated**: December 2024
