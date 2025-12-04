# Docker Setup for ITL Chatbot

This project includes Docker configurations for building and running the full-stack application.

## Production Deployment

### Building and Running

1. **Build and start the services:**
   ```bash
   docker-compose up --build
   ```

2. **Or build in detached mode:**
   ```bash
   docker-compose up --build -d
   ```

3. **To include admin tools (pgAdmin, Redis Commander):**
   ```bash
   docker-compose --profile admin up --build
   ```

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database
DB_NAME=chatbot_itl
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_PORT=32001

# Redis
REDIS_PASSWORD=your_redis_password
REDIS_PORT=6379

# Application
ENVIRONMENT=production
API_PORT=8000
LOG_LEVEL=INFO

# Security
FERNET_KEY=your_fernet_key_here
JWT_PUBLIC_KEY=your_jwt_public_key_here
DISABLE_AUTH=false

# CORS
CORS_ORIGINS=http://localhost:3000,https://your-frontend-domain.com

# Rate Limiting
DEFAULT_RATE_LIMIT_RPM=60
DEFAULT_RATE_LIMIT_TPM=10000

# LLM Providers (optional)
OPENROUTER_API_KEY=your_openrouter_key
PROTONX_API_KEY=your_protonx_key

# Admin Tools
PGADMIN_EMAIL=admin@itl.local
PGADMIN_PASSWORD=admin
PGADMIN_PORT=5050
REDIS_COMMANDER_PORT=8081
```

### Services

- **App**: Full-stack application (Backend + Frontend) on port 8000
- **PostgreSQL**: Database with pgvector extension on port 5432
- **Redis**: Cache and rate limiting on port 6379
- **pgAdmin** (optional): Database management on port 5050
- **Redis Commander** (optional): Redis management on port 8081

## Development Deployment

For development, use the development compose file:

1. **Start development services:**
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

2. **To stop all services:**
   ```bash
   docker-compose down
   ```

3. **To stop development services:**
   ```bash
   docker-compose -f docker-compose.dev.yml down
   ```

## Database Migration

Once the services are running, you may need to run database migrations:

```bash
# Enter the backend container
docker-compose exec app bash

# Run migrations inside the container
alembic upgrade head
```

## Volumes

The following named volumes are used:
- `postgres_data`: PostgreSQL data persistence
- `redis_data`: Redis data persistence
- `uploads_data`: File uploads storage
- `pgadmin_data`: pgAdmin configuration and session data

## Health Checks

All services have health checks configured to ensure they're running properly before dependent services start.

## Ports

- 8000: Main application (Backend API + Frontend)
- 32001: PostgreSQL database
- 6379: Redis cache
- 5050: pgAdmin (optional)
- 8081: Redis Commander (optional)

## Troubleshooting

1. **If you get permission errors on Windows:** Make sure your Docker Desktop settings allow file sharing for the project directory.

2. **If the build fails:** Check that you have the required files like `jwt_private.pem` in the project root.

3. **If services don't start properly:** Check logs with `docker-compose logs` or `docker-compose logs service_name` for specific service logs.