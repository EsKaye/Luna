# Multi-stage build for Celestial Syndicate Cloud Services
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development

# Install development dependencies
RUN npm ci

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3004/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start development server
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy source code
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p logs uploads && \
    chown -R nodejs:nodejs logs uploads

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3004/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start production server
CMD ["npm", "start"]

# Kubernetes stage
FROM production AS kubernetes

# Add Kubernetes-specific configurations
COPY k8s/ /app/k8s/

# Labels for Kubernetes
LABEL org.opencontainers.image.title="Celestial Syndicate Cloud Services"
LABEL org.opencontainers.image.description="Cloud infrastructure and services for Celestial Syndicate"
LABEL org.opencontainers.image.vendor="Celestial Syndicate"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/your-org/celestial-syndicate"

# Security: Run as non-root
USER 1001

# Expose multiple ports for different services
EXPOSE 3004 6379 8080

# Graceful shutdown
STOPSIGNAL SIGTERM

# Default command
CMD ["npm", "start"] 