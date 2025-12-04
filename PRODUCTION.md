# Production Deployment for ITL Chatbot

This document describes how to deploy the ITL Chatbot application in a production environment using Docker.

## Production Docker Setup

The production deployment uses:

- **Dockerfile.prod**: Optimized multi-stage build for production
- **docker-compose.prod.yml**: Production configuration with separate services
- **nginx.conf**: Reverse proxy configuration for production

## Prerequisites

- Docker and Docker Compose installed
- At least 4GB of RAM recommended for the full stack
- SSL certificate (optional but recommended for production)

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Database configuration
POSTGRES_DB=chatbot_db
POSTGRES_USER=chatbot_user
POSTGRES_PASSWORD=your_secure_password

# API Keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_API_KEY=your_google_api_key

# Application settings
LOG_LEVEL=info
FASTAPI_ENV=production

# Security settings
FERNET_KEY=your-fernet-key-here  # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----"
DISABLE_AUTH=false  # Must be false in production

# Environment settings
ENVIRONMENT=production
API_HOST=0.0.0.0
API_PORT=8000

# CORS settings
CORS_ORIGINS=https://your-domain.com,https://subdomain.your-domain.com

# Database pool settings
DB_POOL_SIZE=50
DB_MAX_OVERFLOW=20

# Cache settings
CACHE_TTL_SECONDS=3600

# Rate limiting
DEFAULT_RATE_LIMIT_RPM=100
DEFAULT_RATE_LIMIT_TPM=50000

# Optional: Additional API keys
OPENROUTER_API_KEY=your_openrouter_api_key
```

For development purposes, you can create a simplified `.env` file:

```bash
# Development settings
POSTGRES_DB=chatbot_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=dev_password

# Security settings
FERNET_KEY=your-fernet-key-here  # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
JWT_PUBLIC_KEY=  # Empty for dev if using DISABLE_AUTH=true
DISABLE_AUTH=true  # Only for development

# Environment settings
ENVIRONMENT=development
LOG_LEVEL=DEBUG

# CORS settings for development
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Database pool settings
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
```

## Building and Running

### 1. Build the production image

```bash
docker build -f Dockerfile.prod -t itl-chatbot:prod .
```

Or run the deployment script:

On Linux/Mac:
```bash
chmod +x deploy_prod.sh
./deploy_prod.sh
```

On Windows:
```bash
deploy_prod.bat
```

### 2. Run the production containers

```bash
docker-compose -f docker-compose.prod.yml up -d
```

With environment file:
```bash
docker-compose -f docker-compose.prod.yml --env-file .env up -d
```

### 3. Verify the deployment

Check if all services are running:
```bash
docker-compose -f docker-compose.prod.yml ps
```

View application logs:
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

## Production Features

- **Multi-stage build**: Reduces final image size and attack surface
- **Non-root user**: Runs the application as a non-root user for security
- **Health checks**: Built-in health checking for container orchestration
- **Multiple workers**: Gunicorn with multiple Uvicorn workers for better performance
- **Reverse proxy**: Nginx handles static files and SSL termination
- **Persistent storage**: Volumes for database and file uploads
- **Resource isolation**: Separate services for database, Redis, and application

## Scaling

To scale the application vertically:
```bash
docker-compose -f docker-compose.prod.yml up -d --scale app=3
```

## Security Considerations

- Use HTTPS with SSL certificates in production
- Regularly update base images and dependencies
- Implement proper network segmentation
- Use secrets management for API keys and passwords
- Monitor container logs for security events

## Monitoring

The application includes a health check endpoint at `/health` that can be used with container orchestration platforms.

## Troubleshooting

### Check container logs
```bash
docker-compose -f docker-compose.prod.yml logs -f app
```

### Check database connectivity
```bash
docker-compose -f docker-compose.prod.yml logs -f db
```

### Check Redis connectivity
```bash
docker-compose -f docker-compose.prod.yml logs -f redis
```

### Access the application container
```bash
docker-compose -f docker-compose.prod.yml exec app sh
```

## Updating the Application

1. Pull the latest code
2. Rebuild the production image
3. Restart the containers

```bash
git pull origin main
docker build -f Dockerfile.prod -t itl-chatbot:prod .
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

## Cleanup

To stop and remove containers:
```bash
docker-compose -f docker-compose.prod.yml down
```

To remove containers, networks, and volumes:
```bash
docker-compose -f docker-compose.prod.yml down -v
```