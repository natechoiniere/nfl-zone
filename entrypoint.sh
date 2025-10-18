#!/bin/sh
set -e

echo "Starting NFL Zone application..."

# Make cache warmer executable
chmod +x /usr/local/bin/cache-warmer.sh

# Set up cron job to run cache warmer every hour
echo "0 * * * * /usr/local/bin/cache-warmer.sh >> /var/log/cache-warmer.log 2>&1" > /etc/crontabs/root

# Start cron in background
crond -l 2 &

# Start nginx as daemon first
nginx

# Wait for nginx to be ready
sleep 3

# Initial cache warm-up
echo "Running initial cache warm-up..."
/usr/local/bin/cache-warmer.sh

# Stop nginx daemon
nginx -s quit

# Start nginx in foreground for Docker
exec nginx -g 'daemon off;'

