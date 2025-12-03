# ============================================================================
# Multi-Stage Dockerfile for ITL AgentHub Frontend (Production)
# ============================================================================
# This Dockerfile builds the React/Vite frontend and serves it with Nginx

# ============================================================================
# Stage 1: Builder - Build the React application
# ============================================================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
# Using --frozen-lockfile ensures reproducible builds
RUN npm ci --frozen-lockfile

# Copy source code
COPY . .

# Build the application for production
# Vite will create optimized bundles in /app/dist
RUN npm run build

# ============================================================================
# Stage 2: Runtime - Serve with Nginx
# ============================================================================
FROM nginx:1.25-alpine

# Set metadata labels
LABEL maintainer="ITL AgentHub Team"
LABEL description="Production frontend for multi-tenant chatbot"
LABEL version="0.1.0"

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Start Nginx
# daemon off ensures Nginx runs in foreground (required for Docker)
CMD ["nginx", "-g", "daemon off;"]
