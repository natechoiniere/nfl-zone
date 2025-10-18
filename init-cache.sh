#!/bin/sh
# Pre-warm RSS cache before nginx starts accepting traffic

echo "Pre-warming RSS cache..."

# Start nginx in daemon mode temporarily
nginx

# Wait for nginx to be fully ready
sleep 2

# Warm the cache
/usr/local/bin/cache-warmer.sh

echo "Cache pre-warmed successfully"

# Stop daemon nginx
nginx -s quit

# Wait for it to fully stop
sleep 1

