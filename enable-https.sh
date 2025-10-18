#!/bin/sh

# Wait for nginx to be fully ready
echo "Waiting for nginx to be ready..."
sleep 20
echo "Checking if nginx is responding..."
for i in $(seq 1 15); do
    if nc -z ${CONTAINER_NAME} 80 2>/dev/null; then
        echo "Nginx is ready!"
        sleep 5
        break
    fi
    echo "Waiting for nginx... ($i/15)"
    sleep 2
done

# Check if certificates already exist
CERT_PATH="/etc/letsencrypt/live/${BASE_DOMAIN}"
CERT_FILE="${CERT_PATH}/fullchain.pem"
KEY_FILE="${CERT_PATH}/privkey.pem"

echo "Checking for existing SSL certificates..."

# Check if certificate files exist and are valid
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "Existing certificates found at $CERT_PATH"
    
    # Check if certificate is valid and not expired (more than 30 days remaining)
    if certbot certificates --cert-name ${BASE_DOMAIN} 2>/dev/null | grep -q "VALID"; then
        echo "Valid certificates found, checking expiration..."
        
        # Get certificate expiration date
        EXPIRY_DATE=$(certbot certificates --cert-name ${BASE_DOMAIN} 2>/dev/null | grep "Expiry Date" | awk '{print $3, $4, $5}')
        if [ -n "$EXPIRY_DATE" ]; then
            echo "Certificate expires on: $EXPIRY_DATE"
            
            # Check if certificate expires within 30 days
            EXPIRY_TIMESTAMP=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null)
            CURRENT_TIMESTAMP=$(date +%s)
            DAYS_UNTIL_EXPIRY=$(( (EXPIRY_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
            
            if [ $DAYS_UNTIL_EXPIRY -gt 30 ]; then
                echo "Certificate is valid for $DAYS_UNTIL_EXPIRY more days, using existing certificates"
                USE_EXISTING=true
            else
                echo "Certificate expires in $DAYS_UNTIL_EXPIRY days, attempting renewal..."
                USE_EXISTING=false
            fi
        else
            echo "Could not determine certificate expiration, attempting renewal..."
            USE_EXISTING=false
        fi
    else
        echo "Certificate validation failed, attempting renewal..."
        USE_EXISTING=false
    fi
else
    echo "No existing certificates found, requesting new ones..."
    USE_EXISTING=false
fi

# Request or renew SSL certificates if needed
if [ "$USE_EXISTING" = "false" ]; then
    echo "Requesting/renewing SSL certificates..."
    certbot certonly --webroot --webroot-path=/var/www/certbot --email ${SSL_EMAIL} --agree-tos --no-eff-email --keep-until-expiring --non-interactive -d ${BASE_DOMAIN} -d www.${BASE_DOMAIN}
    
    if [ $? -eq 0 ]; then
        echo "SSL certificates obtained/renewed successfully"
    else
        echo "SSL certificate request/renewal failed"
        # If we have existing certificates, use them even if renewal failed
        if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
            echo "Using existing certificates despite renewal failure"
        else
            echo "No certificates available, continuing without HTTPS..."
            exit 0
        fi
    fi
fi

# Proceed with HTTPS configuration if certificates are available
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo 'Configuring HTTPS with available certificates...'
    
    # Install docker-cli
    apk add --no-cache docker-cli
    
    # Create HTTP redirect configuration
    cat > /tmp/http-redirect.conf << EOF
# HTTP to HTTPS redirect for domain
server {
    listen 80;
    server_name ${BASE_DOMAIN} www.${BASE_DOMAIN};
    
    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://\\\$host\\\$request_uri;
    }
}
EOF
    
    # Create HTTPS configuration
    cat > /tmp/https.conf << EOF
server {
    listen 443 ssl;
    server_name ${BASE_DOMAIN} www.${BASE_DOMAIN};
    http2 on;
    root /usr/share/nginx/html;
    index index.html;
    
    ssl_certificate /etc/letsencrypt/live/${BASE_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${BASE_DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # DNS resolver for proxy
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\\\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \\\$uri =404;
    }
    
    location = /ads.txt {
        add_header Content-Type text/plain;
    }
    
    location / {
        try_files \\\$uri \\\$uri/ /index.html;
    }
    
    # RSS proxy endpoints with caching
    location /api/rss/espn {
        proxy_pass https://www.espn.com/espn/rss/nfl/news?null;
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
        proxy_set_header Host www.espn.com;
        proxy_set_header User-Agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 10s;
        proxy_intercept_errors on;
        error_page 502 503 504 = @rss_fallback;
        
        proxy_cache rss_cache;
        proxy_cache_valid 200 1h;
        proxy_cache_valid 404 502 503 504 5m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_background_update on;
        proxy_cache_lock on;
        proxy_cache_revalidate on;
        add_header X-Cache-Status \\\$upstream_cache_status;
    }
    
    location /api/rss/coldwire {
        proxy_pass https://www.thecoldwire.com/sports/nfl/feed/;
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
        proxy_set_header Host www.thecoldwire.com;
        proxy_set_header User-Agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 10s;
        proxy_intercept_errors on;
        error_page 502 503 504 = @rss_fallback;
        
        proxy_cache rss_cache;
        proxy_cache_valid 200 1h;
        proxy_cache_valid 404 502 503 504 5m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_background_update on;
        proxy_cache_lock on;
        proxy_cache_revalidate on;
        add_header X-Cache-Status \\\$upstream_cache_status;
    }
    
    location /api/rss/nyt {
        proxy_pass https://www.nytimes.com/svc/collections/v1/publish/http://www.nytimes.com/topic/organization/national-football-league/rss.xml;
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
        proxy_set_header Host www.nytimes.com;
        proxy_set_header User-Agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 10s;
        proxy_intercept_errors on;
        error_page 502 503 504 = @rss_fallback;
        
        proxy_cache rss_cache;
        proxy_cache_valid 200 1h;
        proxy_cache_valid 404 502 503 504 5m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_background_update on;
        proxy_cache_lock on;
        proxy_cache_revalidate on;
        add_header X-Cache-Status \\\$upstream_cache_status;
    }
    
    location /api/rss/wapo {
        proxy_pass https://feeds.washingtonpost.com/rss/rss_football-insider;
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
        proxy_set_header Host feeds.washingtonpost.com;
        proxy_set_header User-Agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 10s;
        proxy_intercept_errors on;
        error_page 502 503 504 = @rss_fallback;
        
        proxy_cache rss_cache;
        proxy_cache_valid 200 1h;
        proxy_cache_valid 404 502 503 504 5m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        proxy_cache_background_update on;
        proxy_cache_lock on;
        proxy_cache_revalidate on;
        add_header X-Cache-Status \\\$upstream_cache_status;
    }
    
    location @rss_fallback {
        return 200 '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>NFL News</title><description>Temporarily unavailable</description></channel></rss>';
        add_header Content-Type application/xml;
    }
    
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
    
    location ~ /\\.(?!well-known) { deny all; }
    location ~ \\.(env|ini|conf|config|yml|yaml|json)\\\$ { deny all; }
    location ~ ~\\\$ { deny all; }
    location ~ /(\\.htaccess|\\.htpasswd|\\.DS_Store|Thumbs\\.db)\\\$ { deny all; }
    location ~ \\.(ts|js\\.map|css\\.map|scss|sass|less)\\\$ { deny all; }
    location ~ /(package\\.json|package-lock\\.json|yarn\\.lock|composer\\.json)\\\$ { deny all; }
}
EOF
    
    # Copy configurations to nginx container
    docker cp /tmp/http-redirect.conf ${CONTAINER_NAME}:/etc/nginx/conf.d/http-redirect.conf
    docker cp /tmp/https.conf ${CONTAINER_NAME}:/etc/nginx/conf.d/https.conf
    
    # Remove the old default.conf for the domain (now handled by http-redirect.conf)
    docker exec ${CONTAINER_NAME} sh -c "sed -i '/# HTTP server for domain/,/^}/d' /etc/nginx/conf.d/default.conf"
    
    # Reload nginx
    docker exec ${CONTAINER_NAME} nginx -s reload
    
    echo 'HTTPS enabled successfully!'
else
    echo 'No SSL certificates available, continuing without HTTPS...'
fi