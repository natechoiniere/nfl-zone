#!/bin/sh
# RSS Cache Warmer - Pre-fetches RSS feeds to warm nginx cache

echo "$(date): Starting RSS cache warmer..."

# Wait a moment for nginx to be ready if just starting
sleep 1

# List of RSS endpoints to warm
ENDPOINTS="espn coldwire nyt wapo"

# Fetch each endpoint to populate cache
for feed in $ENDPOINTS; do
    endpoint="http://localhost/api/rss/$feed"
    echo "$(date): Warming cache for $feed..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}|%{time_total}|%{size_download}" "$endpoint" 2>&1)
    code=$(echo "$response" | cut -d'|' -f1)
    time=$(echo "$response" | cut -d'|' -f2)
    size=$(echo "$response" | cut -d'|' -f3)
    
    if [ "$code" = "200" ]; then
        echo "$(date): ✓ $feed - HTTP $code - ${time}s - ${size} bytes"
    else
        echo "$(date): ✗ $feed - HTTP $code - FAILED"
    fi
done

echo "$(date): RSS cache warmer completed"

