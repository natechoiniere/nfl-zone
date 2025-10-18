#!/bin/sh
# RSS Cache Warmer - Pre-fetches RSS feeds to warm nginx cache

echo "$(date): Starting RSS cache warmer..."

# List of RSS endpoints to warm
ENDPOINTS="
http://localhost/api/rss/espn
http://localhost/api/rss/coldwire
http://localhost/api/rss/nyt
http://localhost/api/rss/wapo
"

# Fetch each endpoint to populate cache
for endpoint in $ENDPOINTS; do
    echo "$(date): Warming cache for $endpoint"
    curl -s -o /dev/null -w "HTTP %{http_code} - %{time_total}s\n" "$endpoint" || echo "Failed to fetch $endpoint"
done

echo "$(date): RSS cache warmer completed"

