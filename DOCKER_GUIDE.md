# Docker Deployment Guide

## Quick Start

### 1. Start Database Only (Development)
```bash
docker compose up -d postgres redis
```

Then run backend and frontend locally:
```bash
# Backend
cd backend
uvicorn src.main:app --reload

# Frontend (in another terminal)
cd frontend
npm run dev
```

### 2. Start Backend + Database (Hybrid)
```bash
docker compose up -d postgres redis backend
```

Then run frontend locally:
```bash
cd frontend
npm run dev
```

### 3. Full Production Deployment
```bash
docker compose --profile production up -d
```

## Environment Variables

Create `.env` file in root directory:
```env
# Database
DB_NAME=chatbot
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_PORT=5432

# Redis
REDIS_PORT=6379

# API
API_PORT=8000
FRONTEND_PORT=3000

# Security
FERNET_KEY=your_fernet_key
JWT_PUBLIC_KEY=your_jwt_public_key
DISABLE_AUTH=false

# LLM
OPENROUTER_API_KEY=your_key
PROTONX_API_KEY=your_key
```

## Useful Commands

```bash
# View logs
docker compose logs -f backend
docker compose logs -f postgres

# Restart a service
docker compose restart backend

# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes data)
docker compose down -v

# Rebuild a service
docker compose build backend
docker compose up -d backend
```

## Troubleshooting

### Backend can't connect to database
- Check if postgres is healthy: `docker compose ps`
- Check logs: `docker compose logs postgres`
- Verify DATABASE_URL in backend environment

### Frontend can't reach backend
- Update CORS_ORIGINS in backend environment
- Check backend is running: `curl http://localhost:8000/health`
