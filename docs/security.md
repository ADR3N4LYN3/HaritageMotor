# Security

Heritage Motor implements defense-in-depth security across authentication, authorization, data isolation, and API hardening.

## Authentication

### JWT Token Flow

```
Client                    API                     Database
  │                        │                         │
  ├─ POST /auth/login ────►│                         │
  │   {email, password}    ├─ bcrypt verify ─────────┤
  │                        │                         │
  │  ◄─── LoginResult ────┤                         │
  │  {access_token,        │                         │
  │   refresh_token, user} │                         │
  │                        │                         │
  ├─ GET /api/v1/... ─────►│                         │
  │  Authorization: Bearer ├─ JWT validate ──────────┤
  │                        ├─ SET LOCAL tenant_id ───┤
  │                        │                         │
  │  ◄─── Response ────────┤                         │
  │                        │                         │
  ├─ POST /auth/refresh ──►│                         │
  │   {refresh_token}      ├─ Hash compare ──────────┤
  │                        ├─ Revoke old token ──────┤
  │                        ├─ Issue new pair ─────────┤
  │  ◄─── New tokens ─────┤                         │
```

### Token Configuration

| Token | Algorithm | Default Expiry | Storage |
|-------|-----------|---------------|---------|
| Access Token | HS256 | 15 minutes | Client memory (Zustand) |
| Refresh Token | 32-byte random | 7 days | DB as SHA-256 hash |
| MFA Pending Token | HS256 | 5 minutes | Client (temporary) |

### JWT Claims

```go
type Claims struct {
    UserID   uuid.UUID
    TenantID uuid.UUID
    Role     string
    jwt.RegisteredClaims
}
```

### Password Hashing

- Algorithm: bcrypt
- Cost factor: 12
- Implemented in `internal/auth/password.go`

### Multi-Factor Authentication (TOTP)

- Standard: RFC 6238 (TOTP)
- Library: `github.com/pquerna/otp`
- Issuer: "Heritage Motor"
- Flow: Setup → Enable (verify code) → Required on login

### Refresh Token Rotation

Each refresh uses token rotation:
1. Client sends refresh token
2. Server verifies SHA-256 hash against DB
3. Old token is revoked (`revoked_at = NOW()`)
4. New access + refresh token pair is issued

## Authorization (RBAC)

### Roles

| Role | Level | Capabilities |
|------|-------|-------------|
| `superadmin` | Platform | Tenant CRUD, invitations, global dashboard (no tenant context) |
| `admin` | Tenant-high | Full tenant access, user management, audit log |
| `operator` | Tenant-mid | Vehicle CRUD, bay management, moves, exits |
| `technician` | Tenant-base | Task completion, event creation, document upload |
| `viewer` | Tenant-read | Read-only access to vehicles, bays, events, tasks |

### Middleware Chain

```
Request → AuthMiddleware → Per-user limiter → RequirePasswordChanged → TenantMiddleware → AuditMiddleware → RBAC → Handler
```

1. **AuthMiddleware**: Validates JWT, checks token blacklist (sync.Map cache 30s), extracts `user_id`, `tenant_id`, `role`, `jti`, `expires_at`
2. **Per-user rate limiter**: 100 req/min per user_id
3. **RequirePasswordChanged**: Blocks all routes except `/auth/change-password` if `password_change_required=true`
4. **TenantMiddleware**: Verifies tenant active (cached 5min), acquires DB connection on appPool, sets RLS context
5. **AuditMiddleware**: Logs request to audit_log in background goroutine
6. **RBAC Middleware**: Per-route role check

Superadmin routes: `Auth → RequireSuperAdmin` (no TenantMiddleware, uses ownerPool)

### Route Protection

| Middleware | Routes |
|-----------|--------|
| `RequireSuperAdmin()` | GET /admin/*, POST /admin/*, PATCH /admin/*, DELETE /admin/* |
| `RequireAdmin()` | DELETE vehicles/:id, DELETE documents/:docId, DELETE tasks/:id, DELETE /mfa, GET /users, POST /users, PATCH /users/:id, DELETE /users/:id, GET /audit |
| `RequireOperatorOrAbove()` | POST vehicles, PATCH vehicles, POST move, POST exit, POST/PATCH/DELETE bays |
| `RequireTechnicianOrAbove()` | POST events, POST documents, POST/PATCH tasks, POST complete |
| No RBAC (authenticated) | GET vehicles, GET bays, GET events, GET tasks, GET /me, POST /auth/change-password, POST /auth/logout |
| No auth | POST /login, POST /mfa/verify, POST /refresh, POST /contact, GET /health |

## Multi-Tenant Isolation (RLS)

### How It Works

PostgreSQL Row Level Security ensures complete data isolation between tenants:

```sql
-- Example policy on vehicles table
CREATE POLICY vehicles_tenant_isolation ON vehicles
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### Enforcement

1. `tenant_id` is **always** extracted from the JWT, never from URL or request body
2. `TenantMiddleware` sets `app.current_tenant_id` via `SET LOCAL` on each request
3. `SET LOCAL` scoping ensures the setting only applies within the current transaction
4. RLS policies on all business tables filter rows automatically

### Tables with RLS

All business tables have RLS enabled:
- `tenants`, `users`, `vehicles`, `bays`, `events`, `tasks`, `documents`, `audit_log`, `refresh_tokens`

### Tenant Validation Cache

The tenant middleware verifies tenant existence and active status against the database, with results cached in-memory (sync.Map) for 5 minutes to avoid per-request DB lookups.

## API Hardening

### Token Blacklist

Immediate JWT revocation without waiting for token expiry (migration 015):

- **Table**: `token_blacklist` in PostgreSQL (survives restarts)
- **Two modes**: `jti` (single token) or `user_id` (all tokens for a user)
- **Checked by**: AuthMiddleware on every request (`SELECT EXISTS(... WHERE (jti=$1 OR user_id=$2) AND expires_at > NOW())`)
- **Cache**: sync.Map with 30s TTL, `InvalidateBlacklistCache()` for immediate invalidation
- **Fail-open**: Logs warning if DB is unavailable, allows request through
- **Logout**: Blacklists access token JTI + revokes refresh token
- **User delete**: Revokes all refresh tokens + blacklists user_id for access token duration

### Password Strength

All user-created passwords must meet:
- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 digit (0-9)
- At least 1 special character

Enforced in `internal/domain/password.go` via `ValidatePasswordStrength()`.

### Rate Limiting

Endpoints are rate-limited to prevent brute-force and abuse:

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /auth/login` | 5 requests | 15 minutes | IP + path |
| `POST /auth/mfa/verify` | 5 requests | 15 minutes | IP + path |
| `POST /auth/refresh` | 5 requests | 15 minutes | IP + path |
| `POST /contact` | 3 requests | 15 minutes | IP |
| Authenticated routes | 100 requests | 1 minute | user_id |

Exceeded limits return `429 Too Many Requests`.

### Anti-Bot Protection (Cloudflare Turnstile)

Cloudflare Turnstile is used on public-facing endpoints to prevent bot abuse. A shared `turnstile.Verifier` (`internal/turnstile/`) handles server-side token verification via the siteverify API.

#### Login (`POST /auth/login`)

| Layer | Mechanism | Behavior |
|-------|-----------|----------|
| Cloudflare Turnstile (compact widget) | Token in `cf_turnstile_response`, verified server-side | If invalid → 403; if `TURNSTILE_SECRET_KEY` empty → skipped (dev mode) |
| Rate limiting | 5 req / 15 min per IP | If exceeded → 429 |

The PWA login page uses Turnstile **auto-rendering** via a `cf-turnstile` div with `data-callback` pointing to a global function that stores the token in React state. The widget auto-challenges on page load and the token is passed in the login request body as `cf_turnstile_response`. Requires `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (PWA build arg) and `TURNSTILE_SECRET_KEY` (backend env var).

```tsx
// Auto-rendering approach (pwa/app/login/page.tsx)
<Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
<div className="cf-turnstile" data-sitekey={siteKey} data-callback="__hmTurnstileCb" data-theme="dark" data-size="compact" />
```

> **Explicit render vs auto-rendering**: The original `render=explicit` + `turnstile.render()` approach was unreliable (race conditions with script loading). Auto-rendering via the `cf-turnstile` CSS class is simpler and more robust.

#### Contact Form (`POST /contact`)

| Layer | Mechanism | Behavior |
|-------|-----------|----------|
| Honeypot | Hidden `website` field (CSS off-screen) | If filled → fake 201 (bot thinks it succeeded) |
| Cloudflare Turnstile | Token in `cf_turnstile_response`, verified server-side | If invalid → 500; if `TURNSTILE_SECRET_KEY` empty → skipped (dev mode) |
| Rate limiting | 3 req / 15 min per IP | If exceeded → 429 |

Turnstile verification is **fail-open** on network/decode errors (falls back to rate limiting).

#### Turnstile Hostname Configuration

In the Cloudflare Dashboard (Turnstile > Widget settings), **all hostnames** where the widget renders must be listed:

- `heritagemotor.app` — landing page contact form
- `app.heritagemotor.app` — PWA login page

If a hostname is missing, Turnstile returns an invalid token and the backend responds with `403 bot verification failed`.

#### CSP Requirements for Turnstile

Hosts that render the Turnstile widget need these CSP directives:

```
script-src: https://challenges.cloudflare.com
frame-src: https://challenges.cloudflare.com
connect-src: https://challenges.cloudflare.com
```

Both the landing page and PWA Caddy blocks include these in their `Content-Security-Policy` headers.

### Upload Limiter

Per-user bandwidth rate limiting for file uploads (`internal/middleware/upload_limiter.go`):

| Setting | Value |
|---------|-------|
| Max cumulative bytes | 200 MB per user |
| Window | 10 minutes (sliding) |
| Applied to | POST documents, POST events |

Reads `Content-Length` header (no body buffering). Returns `429` if threshold exceeded.

### CORS

- **Production**: Only `https://app.heritagemotor.app` and `https://heritagemotor.app`
- **Development**: `http://localhost:3000` and `http://localhost:3001`
- Credentials: enabled
- Configurable via `CORS_ORIGINS` env var

### File Upload Validation

Document uploads are validated before processing:

| Check | Limit |
|-------|-------|
| File size | Max 20 MB per file |
| MIME type | Whitelist: image/jpeg, image/png, image/webp, image/heic, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain |
| Filename | Sanitized: stripped of `/`, `\`, `..`, null bytes |
| Body limit | 50 MB total (Fiber config) |

### Security Headers

Applied by Caddy. Headers vary per host:

| Header | Landing page | API | PWA |
|--------|:---:|:---:|:---:|
| `Strict-Transport-Security` (HSTS) | `max-age=31536000; includeSubDomains; preload` | `max-age=31536000; includeSubDomains` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options: nosniff` | Yes | Yes | Yes |
| `X-Frame-Options: DENY` | Yes | Yes | Yes |
| `Referrer-Policy: strict-origin-when-cross-origin` | Yes | Yes | Yes |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | — | `camera=(self), microphone=()` |
| `Content-Security-Policy` | Restrictive (self + Google Fonts + Turnstile + Plausible) | `default-src 'none'; frame-ancestors 'none'` | Restrictive (self + API) |
| `-Server` (removed) | Yes | Yes | Yes |

The PWA subdomain allows `camera=(self)` for QR scanning via the device camera.

**Token Blacklist Cleanup**: A background goroutine runs every hour to purge expired entries from `token_blacklist` (`DELETE WHERE expires_at < NOW()`).

### Graceful Shutdown

The server handles SIGINT/SIGTERM with a 30-second timeout context, ensuring in-flight requests complete before shutdown.

## Audit Log

Mutating requests (POST, PATCH, PUT, DELETE) on authenticated endpoints are logged to an append-only `audit_log` table. GET/HEAD/OPTIONS requests and auth routes (except `/me`) are excluded.

```sql
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    user_id         UUID,
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     UUID,
    old_values      JSONB,
    new_values      JSONB,
    ip_address      INET,
    user_agent      TEXT,
    request_id      TEXT,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The `action` field is derived from the HTTP method and path (e.g., `vehicles.create`, `vehicles.move`, `tasks.complete`). The `resource_type` is extracted from the URL path and singularized (e.g., `vehicle`, `task`).

### Implementation

- Logging runs in a **background goroutine** to avoid blocking the request
- All `fiber.Ctx` values are captured into a value struct **before** the goroutine launches (prevents Fiber ctx reuse race condition)
- Goroutine includes `defer recover()` and a 5-second timeout context
- The audit_log table has PostgreSQL rules preventing UPDATE and DELETE

## Data Protection

### Soft Delete

All business entities (vehicles, tasks, users) use soft delete (`deleted_at` column). Hard deletes are only used for bays (which must be in `free` status).

### Events Immutability

The events table is append-only, enforced by PostgreSQL rules:

```sql
CREATE RULE no_update_events AS ON UPDATE TO events DO INSTEAD NOTHING;
CREATE RULE no_delete_events AS ON DELETE TO events DO INSTEAD NOTHING;
```

### S3 Storage

- Document files are stored in Hetzner Object Storage (S3-compatible)
- Only S3 keys are stored in the database, never signed URLs
- Keys follow the pattern: `{tenant_id}/documents/{vehicle_id}/{timestamp}_{filename}`

### Connection Pool Security

| Setting | Value | Purpose |
|---------|-------|---------|
| MaxConns | 25 | Prevent connection exhaustion |
| MinConns | 5 | Keep warm connections |
| MaxConnLifetime | 2 hours | Rotate connections to prevent stale state |
| MaxConnIdleTime | 5 minutes | Release unused connections |
