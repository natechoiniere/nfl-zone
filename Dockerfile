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

# Install curl, envsubst for health checks and config processing
RUN apk add --no-cache curl gettext dcron

# Copy custom nginx configuration template
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Copy built application from build stage
# Note: Angular 17+ builds to 'dist/superbowl-sunday/browser' by default
COPY --from=build /app/dist/superbowl-sunday/browser /usr/share/nginx/html

# Copy ads.txt, robots.txt, and sitemap.xml files for Google AdSense and SEO
COPY ads.txt /usr/share/nginx/html/ads.txt
COPY robots.txt /usr/share/nginx/html/robots.txt
COPY sitemap.xml /usr/share/nginx/html/sitemap.xml

# Copy cache warmer and entrypoint scripts
COPY cache-warmer.sh /usr/local/bin/cache-warmer.sh
COPY entrypoint.sh /entrypoint.sh

# Set proper permissions
RUN chmod +x /usr/local/bin/cache-warmer.sh && \
    chmod +x /entrypoint.sh && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    mkdir -p /var/cache/nginx/rss && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    mkdir -p /var/run/nginx && \
    chown -R nginx:nginx /var/run/nginx && \
    touch /var/log/cache-warmer.log && \
    chown nginx:nginx /var/log/cache-warmer.log

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Use entrypoint script to start cron and nginx
ENTRYPOINT ["/entrypoint.sh"]