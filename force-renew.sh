#!/bin/sh
# Force SSL certificate renewal (e.g. after expiry). Run on host where docker-compose is used.
# Usage: ./force-renew.sh [BASE_DOMAIN] [CONTAINER_NAME]
# Or set BASE_DOMAIN, CONTAINER_NAME, SSL_EMAIL in .env and: ./force-renew.sh

set -e

cd "$(dirname "$0")"
[ -f .env ] && . ./.env

BASE_DOMAIN="${1:-${BASE_DOMAIN}}"
CONTAINER_NAME="${2:-${CONTAINER_NAME}}"
SSL_EMAIL="${SSL_EMAIL:?Set SSL_EMAIL in .env}"

[ -n "$BASE_DOMAIN" ] || { echo "Usage: $0 [BASE_DOMAIN] [CONTAINER_NAME] or set in .env"; exit 1; }
[ -n "$CONTAINER_NAME" ] || CONTAINER_NAME="superbowl-sunday"

echo "Forcing certificate renewal for $BASE_DOMAIN..."

docker compose run --rm --entrypoint "" \
  -e SSL_EMAIL="$SSL_EMAIL" \
  -e BASE_DOMAIN="$BASE_DOMAIN" \
  -e CONTAINER_NAME="$CONTAINER_NAME" \
  certbot \
  certbot certonly --webroot --webroot-path=/var/www/certbot \
  --email "$SSL_EMAIL" --agree-tos --no-eff-email --force-renewal \
  --non-interactive -d "$BASE_DOMAIN" -d "www.$BASE_DOMAIN"

echo "Reloading nginx..."
docker exec "$CONTAINER_NAME" nginx -s reload

echo "Done. Verify with: openssl s_client -connect $BASE_DOMAIN:443 -servername $BASE_DOMAIN </dev/null 2>/dev/null | openssl x509 -noout -dates"
