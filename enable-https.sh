#!/bin/sh

# Wait for nginx to start
sleep 10

# Request SSL certificates
certbot certonly --webroot --webroot-path=/var/www/certbot --email ${SSL_EMAIL} --agree-tos --no-eff-email -d ${BASE_DOMAIN} -d www.${BASE_DOMAIN}

if [ $? -eq 0 ]; then
    echo 'SSL certificates obtained successfully'
    
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
    echo 'SSL certificate request failed, continuing...'
fi