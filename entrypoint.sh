#!/bin/sh
set -e

echo "Starting NFL Zone application..."

# Make cache warmer executable
chmod +x /usr/local/bin/cache-warmer.sh

# Set up cron job to run cache warmer every hour
echo "0 * * * * /usr/local/bin/cache-warmer.sh >> /var/log/cache-warmer.log 2>&1" > /etc/crontabs/root

# Start cron in background
crond -l 2 &

# Start background cache warmer after a delay (let nginx start first)
(sleep 5 && /usr/local/bin/cache-warmer.sh) &

# Start nginx in foreground
exec nginx -g 'daemon off;'

