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
| `admin` | Highest | Full access, user management, audit log |
| `operator` | Mid | Vehicle CRUD, bay management, moves, exits |
| `technician` | Base | Task completion, event creation, document upload |

### Middleware Chain

```
Request → AuthMiddleware → TenantMiddleware → AuditMiddleware → RBAC → Handler
```

1. **AuthMiddleware**: Validates JWT, extracts `user_id`, `tenant_id`, `role`
2. **TenantMiddleware**: Verifies tenant active (cached 5min), acquires DB connection, sets RLS context
3. **AuditMiddleware**: Logs request to audit_log in background goroutine
4. **RBAC Middleware**: Per-route role check

### Route Protection

| Middleware | Routes |
|-----------|--------|
| `RequireAdmin()` | DELETE vehicles/:id, DELETE documents/:docId, DELETE tasks/:id, DELETE /mfa, GET /users, POST /users, PATCH /users/:id, DELETE /users/:id, GET /audit |
| `RequireOperatorOrAbove()` | POST vehicles, PATCH vehicles, POST move, POST exit, POST/PATCH/DELETE bays |
| `RequireTechnicianOrAbove()` | POST events, POST documents, POST/PATCH tasks, POST complete |
| No RBAC (authenticated) | GET vehicles, GET bays, GET events, GET tasks, GET /me |
| No auth | POST /login, POST /mfa/verify, POST /refresh, GET /health |

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

### Rate Limiting

Auth endpoints are rate-limited to prevent brute-force attacks:

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /auth/login` | 5 requests | 15 minutes | IP + path |
| `POST /auth/mfa/verify` | 5 requests | 15 minutes | IP + path |
| `POST /auth/refresh` | 5 requests | 15 minutes | IP + path |

Exceeded limits return `429 Too Many Requests`.

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
| `X-Frame-Options: DENY` | Yes | — | — |
| `Referrer-Policy: strict-origin-when-cross-origin` | Yes | — | — |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | — | `camera=(self), microphone=()` |
| `-Server` (removed) | Yes | Yes | Yes |

The PWA subdomain allows `camera=(self)` for QR scanning via the device camera.

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
