# Superbowl Sunday Application

Angular application with nginx and SSL support.

## Quick Deploy

1. **Configure environment:**
   ```bash
   cp .env.example .env
   nano .env
   ```

2. **Deploy:**
   ```bash
   docker-compose up -d
   ```

3. **Check status:**
   ```bash
   docker-compose ps
   ```

That's it! The deployment is fully automated:
- SSL certificates are requested automatically from Let's Encrypt
- HTTPS is enabled automatically after certificates are obtained
- All security configurations are applied automatically
- No manual steps required - just run `docker compose up -d`

## Environment Variables

Edit `.env` file with your values:

```bash
SSL_EMAIL=your-email@example.com
BASE_DOMAIN=your-domain.com
PUBLIC_IP=your.server.ip.address
APP_NAME=superbowl-sunday
CONTAINER_NAME=superbowl-sunday
```

## Services

- **superbowl-sunday**: Angular app with nginx
- **certbot**: SSL certificate management
- **watchtower**: Auto-updates containers