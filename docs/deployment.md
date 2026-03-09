# Deployment Guide

Heritage Motor uses Docker Compose for production deployment with Caddy as reverse proxy and Cloudflare for DNS/SSL.

## Infrastructure Overview

```
Internet
   |
Cloudflare (DNS + Proxy + SSL termination)
   |
Hetzner VPS
   |
┌───────────────────────────────────────────────────┐
│  Caddy :80/:443                                   │
│  ├── heritagemotor.app → /srv/landing             │
│  ├── api.heritagemotor.app → api:8080             │
│  ├── app.heritagemotor.app → app:3000             │
│  └── stats.heritagemotor.app → plausible:8000     │
│                                                   │
│  ┌─── web network ─────────────────────────────┐  │
│  │  caddy ↔ api ↔ app ↔ plausible             │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─── internal network ────────────────────────┐  │
│  │  api ↔ postgres                             │  │
│  │  plausible ↔ plausible_db ↔ clickhouse      │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  PostgreSQL 16 (app data, persistent volume)      │
│  PostgreSQL 16 (plausible config, persistent vol) │
│  ClickHouse (plausible events, persistent vol)    │
└───────────────────────────────────────────────────┘
```

## Services

| Service | Image | Port | Network |
|---------|-------|------|---------|
| `postgres` | `postgres:16-alpine` | 5432 (internal) | internal |
| `api` | Go build (multi-stage) | 8080 (internal) | internal + web |
| `app` | Next.js standalone | 3000 (internal) | internal + web |
| `plausible` | `ghcr.io/plausible/community-edition:v2.1` | 8000 (internal) | internal + web |
| `plausible_db` | `postgres:16-alpine` | 5432 (internal) | internal |
| `plausible_events_db` | `clickhouse/clickhouse-server:24.3-alpine` | 8123 (internal) | internal |
| `caddy` | `caddy:2-alpine` | 80, 443 (TCP+UDP) | web |

## Docker Images

### API (Go backend)

Multi-stage build in `./Dockerfile`:

- **Builder**: `golang:1.23-alpine` - compiles the binary
- **Runner**: `alpine:3.20` - minimal runtime with ca-certificates
- Binary: `/app/api`
- Exposed port: 8080

### PWA (Next.js frontend)

Multi-stage build in `./pwa/Dockerfile`:

- **Dependencies**: `node:20-alpine` - installs npm packages
- **Builder**: `node:20-alpine` - runs `npm run build`
- **Runner**: `node:20-alpine` - standalone server
- Uses Next.js `output: "standalone"` for minimal production image
- Exposed port: 3000

## Environment Variables

Create a `.env` file on the server (never commit):

```bash
# Database
POSTGRES_DB=heritage_motor
POSTGRES_USER=heritage_motor
POSTGRES_PASSWORD=<strong-password>

# API
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable
JWT_SECRET=<min-32-chars-random-string>
APP_ENV=production
APP_PORT=8080
LOG_LEVEL=info

# S3 Storage (Hetzner Object Storage)
S3_ENDPOINT=<hetzner-s3-endpoint>
S3_ACCESS_KEY=<s3-access-key>
S3_SECRET_KEY=<s3-secret-key>
S3_BUCKET=<bucket-name>
S3_REGION=eu-central

# RLS (heritage_app role)
HERITAGE_APP_PASSWORD=<strong-password>    # openssl rand -hex 32
DATABASE_APP_URL=postgresql://heritage_app:${HERITAGE_APP_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable

# Email (Resend)
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM=noreply@heritagemotor.app
CONTACT_EMAIL_TO=welcome@heritagemotor.app

# PWA
NEXT_PUBLIC_API_URL=https://api.heritagemotor.app/api/v1
NEXT_PUBLIC_APP_URL=https://app.heritagemotor.app

# Plausible Analytics
PLAUSIBLE_DB_PASSWORD=<strong-password>         # openssl rand -hex 32
PLAUSIBLE_SECRET_KEY=<64-char-base64-string>   # openssl rand -base64 48
PLAUSIBLE_TOTP_KEY=<44-char-base64-string>     # openssl rand -base64 32
```

### Production Config Validation

In production (`APP_ENV=production`), the following are **required** and will cause a fatal error if missing:

| Variable | Validation |
|----------|-----------|
| `JWT_SECRET` | Must be at least 32 characters, not the default value |
| `DATABASE_URL` | Must be set |
| `S3_ENDPOINT` | Must be set |
| `S3_ACCESS_KEY` | Must be set |
| `S3_SECRET_KEY` | Must be set |
| `S3_BUCKET` | Must be set |
| `RESEND_API_KEY` | Must be set |

## SSL / TLS with Cloudflare

Heritage Motor uses Cloudflare Origin Certificates for end-to-end encryption between Cloudflare and the origin server.

### Setup Steps

1. In Cloudflare dashboard, go to **SSL/TLS > Origin Server**
2. Create an Origin Certificate (RSA, 15 years)
3. On the server, create the certs directory:

```bash
mkdir -p certs/
# Paste the certificate into:
nano certs/origin.pem
# Paste the private key into:
nano certs/origin.key
chmod 600 certs/origin.key
```

4. Set Cloudflare SSL mode to **Full (strict)**

The `certs/` directory is mounted read-only into the Caddy container and referenced in the Caddyfile.

## Caddy Configuration

`Caddyfile` (mounted as `/etc/caddy/Caddyfile`) defines 4 virtual hosts:

```
heritagemotor.app         → Landing page (/srv/landing) + /contact + /api/v1/* → api:8080
api.heritagemotor.app     → Reverse proxy to api:8080
stats.heritagemotor.app   → Reverse proxy to plausible:8000
app.heritagemotor.app     → Reverse proxy to app:3000
```

All hosts use:
- Cloudflare Origin Certificate TLS
- HSTS and X-Content-Type-Options headers
- Server header removed

The landing page host additionally has X-Frame-Options, Referrer-Policy, and a restrictive Permissions-Policy. See `docs/security.md` for the per-host header matrix.

The PWA host additionally allows camera access (`Permissions-Policy: camera=(self)`) for QR scanning.

## Deployment Steps

### Initial Setup

```bash
# Clone the repository
git clone <repo-url>
cd HaritageMotor

# Create environment file
cp .env.example .env
nano .env  # Fill in all values

# Setup SSL certificates
mkdir certs/
# Place origin.pem and origin.key

# Run database migrations
docker compose run --rm api /app/api migrate

# Start all services
docker compose up -d --build
```

### Using deploy.sh

The `deploy.sh` script automates the deployment:

```bash
chmod +x deploy.sh
./deploy.sh
```

It performs:
1. `docker compose build` - Rebuilds images
2. Database migration (if applicable)
3. `docker compose up -d` - Starts/restarts services
4. `docker image prune -f` - Cleans dangling images

### Updating

```bash
git pull
./deploy.sh
```

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f app
docker compose logs -f caddy
```

### Health Check

```bash
curl https://api.heritagemotor.app/health
# Expected: {"status":"ok","service":"heritage-motor","database":"connected"}
```

## Plausible Analytics

Plausible Community Edition is self-hosted for privacy-friendly page view tracking.

### Components

- **Plausible** (`plausible:8000`): Analytics engine (Elixir/Phoenix)
- **Plausible DB** (`plausible_db:5432`): PostgreSQL for config/sessions (separate from app DB)
- **ClickHouse** (`plausible_events_db:8123`): Column store for analytics events

### Configuration

ClickHouse logging is reduced via config files in `plausible/`:
- `clickhouse-config.xml`: Disables query/trace/metric logs
- `clickhouse-user-config.xml`: Disables per-user query logging

Registration is set to `invite_only`. After first deploy, visit `https://stats.heritagemotor.app` to create the admin account and add the site `heritagemotor.app`.

### Script Integration

The Plausible tracking script is included in the landing page `<head>`:

```html
<script defer data-domain="heritagemotor.app" src="https://stats.heritagemotor.app/js/script.outbound-links.js"></script>
```

### DNS

Add a Cloudflare A record for `stats.heritagemotor.app` pointing to the same VPS IP. Ensure the Cloudflare Origin Certificate covers `stats.heritagemotor.app` (use a wildcard `*.heritagemotor.app` cert).

## Volumes

| Volume | Purpose |
|--------|---------|
| `postgres_data` | PostgreSQL data persistence (app) |
| `plausible_db_data` | PostgreSQL data persistence (Plausible config) |
| `plausible_events_data` | ClickHouse data persistence (analytics events) |
| `caddy_data` | Caddy TLS certificates and data |
| `caddy_config` | Caddy runtime configuration |

## Networks

| Network | Type | Purpose |
|---------|------|---------|
| `internal` | bridge | DB access (postgres ↔ api), app also connected |
| `web` | bridge | HTTP traffic (caddy ↔ api ↔ app) |

PostgreSQL is only accessible from the `internal` network and is not exposed to the host.
