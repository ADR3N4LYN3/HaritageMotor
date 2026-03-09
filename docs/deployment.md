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
┌──────────────────────────────────────────┐
│  Caddy :80/:443                          │
│  ├── heritagemotor.app → /srv/landing    │
│  ├── api.heritagemotor.app → api:8080    │
│  └── app.heritagemotor.app → app:3000    │
│                                          │
│  ┌─── web network ────────────────────┐  │
│  │  caddy ↔ api ↔ app                │  │
│  └────────────────────────────────────┘  │
│  ┌─── internal network ──────────────┐   │
│  │  api ↔ postgres, app              │   │
│  └────────────────────────────────────┘   │
│                                          │
│  PostgreSQL 16 (persistent volume)       │
└──────────────────────────────────────────┘
```

## Services

| Service | Image | Port | Network |
|---------|-------|------|---------|
| `postgres` | `postgres:16-alpine` | 5432 (internal) | internal |
| `api` | Go build (multi-stage) | 8080 (internal) | internal + web |
| `app` | Next.js standalone | 3000 (internal) | internal + web |
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

Create a `.env.prod` file on the server (never commit):

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

# Email (Resend)
RESEND_API_KEY=<resend-api-key>

# PWA
NEXT_PUBLIC_API_URL=https://api.heritagemotor.app/api/v1
NEXT_PUBLIC_APP_URL=https://app.heritagemotor.app
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

The `certs/` directory is mounted read-only into the Caddy container and referenced in `Caddyfile.prod`.

## Caddy Configuration

`Caddyfile.prod` defines 3 virtual hosts:

```
heritagemotor.app       → Static landing page (/srv/landing)
api.heritagemotor.app   → Reverse proxy to api:8080
app.heritagemotor.app   → Reverse proxy to app:3000
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
cp .env.prod.example .env.prod
nano .env.prod  # Fill in all values

# Setup SSL certificates
mkdir certs/
# Place origin.pem and origin.key

# Run database migrations
docker compose -f docker-compose.prod.yml run --rm api /app/api migrate

# Start all services
docker compose -f docker-compose.prod.yml up -d --build
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
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f caddy
```

### Health Check

```bash
curl https://api.heritagemotor.app/health
# Expected: {"status":"ok","service":"heritage-motor","database":"connected"}
```

## Volumes

| Volume | Purpose |
|--------|---------|
| `postgres_data` | PostgreSQL data persistence |
| `caddy_data` | Caddy TLS certificates and data |
| `caddy_config` | Caddy runtime configuration |

## Networks

| Network | Type | Purpose |
|---------|------|---------|
| `internal` | bridge | DB access (postgres ↔ api), app also connected |
| `web` | bridge | HTTP traffic (caddy ↔ api ↔ app) |

PostgreSQL is only accessible from the `internal` network and is not exposed to the host.
