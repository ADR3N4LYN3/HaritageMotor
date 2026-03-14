# Heritage Motor

Multi-tenant B2B SaaS platform for premium vehicle storage facilities.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.25+, Fiber v2, PostgreSQL 16 |
| Frontend | Next.js 14.2 (App Router), TypeScript, Tailwind CSS |
| Auth | JWT (HS256), bcrypt, TOTP (RFC 6238) |
| Storage | Hetzner Object Storage (S3-compatible) |
| Analytics | Plausible CE (self-hosted) |
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
├── cmd/api/
│   ├── main.go                  # Entry point, config, cleanup, graceful shutdown
│   └── routes.go                # Route definitions, service/handler wiring
├── internal/
│   ├── auth/                    # JWT, bcrypt, TOTP
│   ├── config/                  # Environment config loader
│   ├── db/                      # Connection pool + migrations (001-019)
│   ├── domain/                  # Types (models), typed errors, password validation
│   ├── handler/                 # HTTP handlers (REST controllers)
│   │   ├── admin/               #   Superadmin: tenants CRUD, invitations, dashboard
│   │   ├── auth/                #   Authentication + MFA + change-password
│   │   ├── contact/             #   Public contact form (i18n confirmation)
│   │   ├── vehicle/             #   Vehicle CRUD + Move/Exit
│   │   ├── bay/                 #   Bay management
│   │   ├── event/               #   Event timeline
│   │   ├── task/                #   Task management
│   │   ├── document/            #   Document upload/management
│   │   ├── user/                #   User CRUD (admin)
│   │   ├── scan/                #   QR code resolution
│   │   ├── photo/               #   Photo signed-URL download
│   │   ├── audit/               #   Audit log viewer (admin only)
│   │   ├── activity/            #   Activity feed (all roles, tenant-scoped)
│   │   └── response.go          #   Shared response helpers
│   ├── middleware/               # Auth, Tenant RLS, RBAC, Audit, UploadLimiter
│   ├── service/                  # Business logic layer
│   │   ├── admin/                #   Superadmin tenant/user management
│   │   ├── auth/                 #   Login, MFA, logout, change-password
│   │   ├── contact/              #   Contact form + i18n confirmation email (EN/FR/DE)
│   │   │   ├── service.go        #     Business logic (Submit, send helpers)
│   │   │   └── templates.go      #     i18n HTML email builders (EN/FR/DE)
│   │   ├── mailer/               #   Email sending via Resend API
│   │   ├── plan/                 #   Plan limits enforcement (starter/pro/enterprise)
│   │   ├── vehicle/              #   Vehicle operations
│   │   ├── bay/                  #   Bay operations
│   │   ├── event/                #   Event operations
│   │   ├── task/                 #   Task operations
│   │   ├── document/             #   Document operations
│   │   ├── user/                 #   User operations
│   │   └── report/               #   PDF report generation (go-pdf/fpdf), dark luxury design
│   │       ├── service.go        #     Data loading + orchestration
│   │       ├── pdf_builder.go    #     PDF rendering (dark header, logo, gold accents, tables)
│   │       ├── logo.go           #     go:embed for logo-crest-v2.png
│   │       └── logo-crest-v2.png #     Embedded logo for PDF header
│   ├── storage/                  # S3 client
│   └── testutil/                 # Integration test infrastructure (Setup, Env, helpers)
├── pwa/                          # Next.js PWA frontend
├── video/                        # Remotion 4 hero video generator
│   └── src/                      #   HeroVideoV2/V3/V4 (v1 removed)
├── web/static/                   # Landing page, contact, privacy, legal, 404 (i18n EN/FR/DE)
├── docs/                         # Documentation (this folder)
├── Dockerfile                    # Go API Docker image
├── plausible/                    # Plausible Analytics config
│   ├── clickhouse-config.xml     #   ClickHouse logging config
│   └── clickhouse-user-config.xml#   ClickHouse user config
├── .gitattributes                # Git LFS tracking (hero-bg.mp4)
├── compose.yaml                  # Production orchestration
├── Caddyfile                     # Reverse proxy config
└── deploy.sh                     # Deployment script
```

## Quick Start (Development)

### Prerequisites

- Go 1.25+
- PostgreSQL 16
- Node.js 20+ (for PWA)
- Git LFS (large media files like `hero-bg.mp4` are tracked via LFS)

### Backend

```bash
# Clone
git clone <repo-url>
cd heritage-motor

# Environment
cp .env.example .env
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
cp .env.example .env
# Edit .env with production values (see inline comments)
docker compose up -d --build
```

## Documentation

| Document | Description |
|----------|-------------|
| [Pitch](pitch.md) | Non-technical pitch, value prop, business model |
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
- **Token blacklist**: Immediate JWT revocation via JTI or user-level blocks
- **Background goroutines**: Pre-capture Fiber ctx values, add recovery + timeout
- **Superadmin**: Platform-level role with no tenant context, manages tenants and invitations
- **Contact i18n**: Confirmation email translated in EN/FR/DE based on visitor's language preference
- **Landing i18n**: All static pages (index, contact, privacy, legal, 404) support EN/FR/DE via lang switcher, persisted in localStorage
- **PWA i18n**: Shared `useI18n` hook (`lib/i18n.ts`) + translation dictionaries (`lib/translations.ts`). LangSwitcher broadcasts changes to all hooks in real-time. Translated pages: dashboard, bays, DesktopTopBar, login, change-password
- **Currency toggle**: Pricing section supports EUR/USD switch, persisted in localStorage (`hm-currency`). Amounts: Starter €800/$880, Pro €1,400/$1,540, Climate add-on +€350/+$385
- **Typography**: DM Sans 300 (sans-serif) for headings, DM Sans 400/500 for UI. Cormorant Garamond reserved for brand/logo only ("HM", "Heritage Motor" on login/admin)
- **Export theming**: All exports (emails + PDF) aligned with the dark luxury brand. Emails use `Cormorant Garamond` + `DM Sans` font stacks with Georgia/Helvetica fallbacks. PDF report has dark header with embedded logo, Times serif headings (fpdf built-in closest to Cormorant), gold accents, dark table headers, branded footer
- **Email normalization**: TrimSpace + ToLower on both backend (Go) and frontend (TypeScript) before any auth/invite call

## Domains

| Domain | Purpose |
|--------|---------|
| `heritagemotor.app` | Landing page |
| `api.heritagemotor.app` | Go REST API |
| `app.heritagemotor.app` | PWA (mobile operators) |
| `stats.heritagemotor.app` | Plausible Analytics dashboard |
