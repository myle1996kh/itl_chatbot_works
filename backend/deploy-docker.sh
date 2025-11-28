#!/bin/bash
# Quick deployment script for Docker

set -e  # Exit on error

echo "=================================="
echo "ITL Chatbot - Docker Deployment"
echo "=================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo ""
    echo "Creating .env from template..."
    cp .env.docker .env
    echo "✅ .env created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and set:"
    echo "   - DB_PASSWORD (strong password)"
    echo "   - JWT_PUBLIC_KEY (from jwt_public.pem)"
    echo "   - CORS_ORIGINS (your domain)"
    echo ""
    read -p "Press Enter after updating .env..."
fi

# Check if jwt_private.pem exists
if [ ! -f jwt_private.pem ]; then
    echo "⚠️  jwt_private.pem not found!"
    echo ""
    echo "Generating JWT keys..."
    python generate_jwt_keys.py
    echo "✅ JWT keys generated"
    echo ""
fi

# Build and start services
echo "Building Docker images..."
docker-compose build

echo ""
echo "Starting services..."
docker-compose up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

# Check service status
echo ""
echo "Service Status:"
docker-compose ps

# Check backend health
echo ""
echo "Checking backend health..."
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy!"
else
    echo "⚠️  Backend health check failed"
    echo "   Check logs: docker-compose logs backend"
fi

echo ""
echo "=================================="
echo "Deployment Complete!"
echo "=================================="
echo ""
echo "Services:"
echo "  - Backend API: http://localhost:8000"
echo "  - API Docs: http://localhost:8000/docs"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
echo "Useful commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - Stop: docker-compose down"
echo "  - Restart: docker-compose restart backend"
echo ""
