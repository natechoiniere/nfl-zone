# Multi-stage build for Angular production deployment
# Stage 1: Build the Angular application
FROM node:22-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies (including dev dependencies needed for build)
RUN npm ci --silent

# Copy source code
COPY . .

# Build the application for production
# Note: Angular 17+ uses 'ng build' without --prod flag
RUN npx ng build --configuration=production

# Stage 2: Serve with nginx
FROM nginx:alpine AS production

# Install curl and envsubst for health checks and config processing
RUN apk add --no-cache curl gettext

# Copy custom nginx configuration template
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Copy built application from build stage
# Note: Angular 17+ builds to 'dist/superbowl-sunday/browser' by default
COPY --from=build /app/dist/superbowl-sunday/browser /usr/share/nginx/html

# Set proper permissions for nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Create nginx pid directory
RUN mkdir -p /var/run/nginx && \
    chown -R nginx:nginx /var/run/nginx

# Add signal handling script for graceful shutdown
RUN echo '#!/bin/sh' > /usr/local/bin/nginx-stop.sh && \
    echo 'nginx -s quit' >> /usr/local/bin/nginx-stop.sh && \
    chmod +x /usr/local/bin/nginx-stop.sh

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]