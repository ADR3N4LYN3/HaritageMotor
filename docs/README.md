# Heritage Motor

Multi-tenant B2B SaaS platform for premium vehicle storage facilities.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.22+, Fiber v2, PostgreSQL 16 |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Auth | JWT (HS256), bcrypt, TOTP (RFC 6238) |
| Storage | Hetzner Object Storage (S3-compatible) |
| Infra | Docker, Caddy, Cloudflare |
| Email | Resend |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PWA (Next.js 14)                        │
│          app.heritagemotor.app — Mobile operators            │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────────┐
│                   Go API (Fiber v2)                          │
│                api.heritagemotor.app                         │
│  ┌──────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Auth │  │ Handlers │  │ Middleware │  │  Services    │  │
│  │ JWT  │  │ REST API │  │ Auth/RLS   │  │  Business    │  │
│  │ TOTP │  │ Validate │  │ RBAC/Audit │  │  Logic       │  │
│  └──────┘  └──────────┘  └────────────┘  └──────┬───────┘  │
│                                                  │          │
│  ┌──────────────────────────────────────────────┐│          │
│  │  PostgreSQL 16 (RLS multi-tenant isolation)  ││  S3      │
│  └──────────────────────────────────────────────┘│  Storage │
└──────────────────────────────────────────────────┴──────────┘
```

## Project Structure

```
heritage-motor/
├── cmd/api/main.go              # Entry point, route wiring
├── internal/
│   ├── auth/                    # JWT, bcrypt, TOTP
│   ├── config/                  # Environment config loader
│   ├── db/                      # Connection pool + migrations (001-011)
│   ├── domain/                  # Types (models) + typed errors
│   ├── handler/                 # HTTP handlers (REST controllers)
│   │   ├── auth/                #   Authentication + MFA
│   │   ├── vehicle/             #   Vehicle CRUD + Move/Exit
│   │   ├── bay/                 #   Bay management
│   │   ├── event/               #   Event timeline
│   │   ├── task/                #   Task management
│   │   ├── document/            #   Document upload/management
│   │   ├── user/                #   User CRUD (admin)
│   │   ├── scan/                #   QR code resolution
│   │   ├── audit/               #   Audit log viewer
│   │   └── response.go          #   Shared response helpers
│   ├── middleware/               # Auth, Tenant RLS, RBAC, Audit
│   ├── service/                  # Business logic layer
│   │   ├── auth/                 #   Login, MFA, tokens
│   │   ├── vehicle/              #   Vehicle operations
│   │   ├── bay/                  #   Bay operations
│   │   ├── event/                #   Event operations
│   │   ├── task/                 #   Task operations
│   │   ├── document/             #   Document operations
│   │   └── user/                 #   User operations
│   └── storage/                  # S3 client
├── pwa/                          # Next.js PWA frontend
├── web/static/                   # Landing page
├── docs/                         # Documentation (this folder)
├── Dockerfile                    # Go API Docker image
├── docker-compose.prod.yml       # Production orchestration
├── Caddyfile.prod                # Reverse proxy config
└── deploy.sh                     # Deployment script
```

## Quick Start (Development)

### Prerequisites

- Go 1.22+
- PostgreSQL 16
- Node.js 20+ (for PWA)

### Backend

```bash
# Clone
git clone <repo-url>
cd heritage-motor

# Environment
cp .env.prod.example .env
# Edit .env with your local PostgreSQL credentials

# Run migrations
go run cmd/api/main.go migrate

# Start API
go run cmd/api/main.go
# → http://localhost:3000
```

### Frontend (PWA)

```bash
cd pwa
npm install
npm run dev
# → http://localhost:3001
```

### Docker (Production)

```bash
cp .env.prod.example .env.prod
# Edit .env.prod with production values
docker compose -f docker-compose.prod.yml up -d --build
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](architecture.md) | System architecture, layers, data flow |
| [API Reference](api-reference.md) | Complete REST API documentation |
| [Database](database.md) | Schema, migrations, RLS policies |
| [Security](security.md) | Auth, RBAC, hardening measures |
| [Deployment](deployment.md) | Docker, Caddy, Cloudflare setup |
| [PWA](pwa.md) | Mobile operator frontend |

## Key Design Decisions

- **RLS isolation**: `tenant_id` always from JWT claims, never from URL/body
- **Events append-only**: PostgreSQL rules prevent UPDATE/DELETE on events table
- **Audit append-only**: Same protection on audit_log table
- **Soft delete**: All business entities use `deleted_at` column
- **S3 keys only**: Database stores S3 keys, never signed URLs
- **Refresh token rotation**: SHA-256 hash stored, old token revoked on refresh
- **Background goroutines**: Pre-capture Fiber ctx values, add recovery + timeout

## Domains

| Domain | Purpose |
|--------|---------|
| `heritagemotor.app` | Landing page |
| `api.heritagemotor.app` | Go REST API |
| `app.heritagemotor.app` | PWA (mobile operators) |
