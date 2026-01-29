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
- **certbot**: SSL certificate management (initial setup only; runs once and exits)
- **certbot-renew**: Periodic SSL renewal (every 12h); reloads nginx when certs are renewed
- **watchtower**: Auto-updates containers

## SSL certificate renewal

Let's Encrypt certificates are valid for 90 days. Renewal is automated.

**What was wrong before:** The `certbot` service only ran once at deploy (as an init step) and then exited. Nothing ran `certbot renew` periodically, so certs expired after ~90 days if the stack ran without a full redeploy. The `certbot-renew` service fixes this by running renewal every 12 hours.

- **Initial setup**: The `certbot` service runs once at deploy, obtains certs, and configures HTTPS.
- **Ongoing renewal**: The `certbot-renew` service runs every 12 hours, runs `certbot renew`, and reloads nginx only when a cert was renewed.

**If your certificate has already expired** (e.g. the stack ran 90+ days without the renewer):

1. Ensure `BASE_DOMAIN`, `CONTAINER_NAME`, and `SSL_EMAIL` are set in `.env`.
2. Run a one-off force renewal:
   ```bash
   chmod +x force-renew.sh
   ./force-renew.sh
   ```
3. Deploy the updated stack (including `certbot-renew`) so future renewals are automatic:
   ```bash
   docker compose pull && docker compose up -d
   ```

**Verify certificate dates:**
```bash
echo | openssl s_client -connect your-domain.com:443 -servername your-domain.com 2>/dev/null | openssl x509 -noout -dates
```