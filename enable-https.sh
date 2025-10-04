#!/bin/sh

# Wait for nginx to start
sleep 10

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
    certbot certonly --webroot --webroot-path=/var/www/certbot --email ${SSL_EMAIL} --agree-tos --no-eff-email -d ${BASE_DOMAIN} -d www.${BASE_DOMAIN}
    
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
    
    # Create HTTPS configuration
    cat > /tmp/https.conf << EOF
server {
    listen 443 ssl;
    http2 on;
    server_name ${BASE_DOMAIN} www.${BASE_DOMAIN};
    root /usr/share/nginx/html;
    index index.html;
    ssl_certificate /etc/letsencrypt/live/${BASE_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${BASE_DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    location ~ /\. { deny all; }
    location ~ \.(env|ini|conf|config|yml|yaml|json)$ { deny all; }
    location ~ ~$ { deny all; }
    location ~ /(\.htaccess|\.htpasswd|\.DS_Store|Thumbs\.db)$ { deny all; }
    location ~ \.(ts|js\.map|css\.map|scss|sass|less)$ { deny all; }
    location ~ /(package\.json|package-lock\.json|yarn\.lock|composer\.json)$ { deny all; }
}
EOF
    
    # Copy configuration to nginx container and reload
    docker cp /tmp/https.conf ${CONTAINER_NAME}:/etc/nginx/conf.d/https.conf
    docker exec ${CONTAINER_NAME} nginx -s reload
    
    echo 'HTTPS enabled successfully!'
else
    echo 'No SSL certificates available, continuing without HTTPS...'
fi