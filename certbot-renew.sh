#!/bin/sh
# Periodic SSL certificate renewal for production.
# Runs certbot renew every 12 hours; reloads nginx only when a cert was renewed.
# Requires: certbot, docker-cli, env BASE_DOMAIN, CONTAINER_NAME.

set -e
# Avoid exiting when certbot renew returns 1 (e.g. "no renewal needed")

echo "SSL renewal loop starting (interval: 12h)..."

# Install docker-cli so we can reload nginx after renewal
apk add --no-cache docker-cli >/dev/null 2>&1

# Wait for initial certbot run (enable-https) to finish before first renewal check
echo "Waiting 5m for initial cert setup to complete..."
sleep 300

while true; do
    echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] Running certbot renew..."
    # --deploy-hook runs only when a cert was renewed; reload nginx then.
    # certbot exits 1 when "no renewal needed"; we don't treat that as fatal.
    certbot renew \
        --webroot \
        --webroot-path=/var/www/certbot \
        --deploy-hook "docker exec ${CONTAINER_NAME} nginx -s reload" \
        --no-random-sleep-on-renew \
        2>&1 || true
    echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] Renewal check complete."
    echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] Sleeping 12 hours until next renewal check..."
    sleep 43200
done
