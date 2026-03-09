# Architecture

## Overview

Heritage Motor follows a layered architecture pattern with strict separation of concerns.

## Layers

```
┌─────────────────────────────────────────────┐
│           HTTP Layer (Fiber v2)              │
│  Handlers → parse request, validate, route  │
├─────────────────────────────────────────────┤
│          Middleware Pipeline                 │
│  Auth → Tenant RLS → Audit → RBAC          │
├─────────────────────────────────────────────┤
│          Service Layer                      │
│  Business logic, transactions, validation   │
├─────────────────────────────────────────────┤
│          Data Layer                         │
│  PostgreSQL (pgxpool) + S3 (aws-sdk-go-v2) │
└─────────────────────────────────────────────┘
```

### Handler Layer

Located in `internal/handler/`. Each handler package:
- Parses HTTP request (body, query, path params)
- Validates input using `go-playground/validator`
- Delegates to the service layer
- Maps service errors to HTTP status codes via `HandleServiceError`

### Middleware Pipeline

Every authenticated request passes through (in order):

1. **AuthMiddleware** (`internal/middleware/auth.go`): Validates JWT Bearer token, extracts `user_id`, `tenant_id`, `role` into Fiber locals
2. **TenantMiddleware** (`internal/middleware/tenant.go`): Verifies tenant is active (cached), acquires a DB connection, sets `SET LOCAL app.current_tenant_id` for RLS
3. **AuditMiddleware** (`internal/middleware/audit.go`): Captures request metadata and logs to `audit_log` in a background goroutine
4. **RBAC** (`internal/middleware/rbac.go`): Per-route role checks (`RequireAdmin`, `RequireOperatorOrAbove`, `RequireTechnicianOrAbove`)

### Service Layer

Located in `internal/service/`. Each service:
- Receives validated data from handlers
- Implements business logic and validation rules
- Manages database transactions where needed
- Returns domain types or typed errors

### Domain Layer

Located in `internal/domain/`:
- `types.go`: All domain structs (Tenant, User, Vehicle, Bay, Event, Task, Document, AuditEntry)
- `errors.go`: Typed error types (ErrNotFound, ErrForbidden, ErrValidation, ErrConflict, ErrUnauthorized)

### Data Layer

- **PostgreSQL**: Direct SQL queries using `pgx/v5` with connection pooling (`pgxpool`)
- **S3**: File storage via `aws-sdk-go-v2` for document uploads

## Request Flow

```
Client Request
    │
    ▼
┌─ Fiber Router ─────────────────────────────────────────┐
│  1. Global middleware: Recover, CORS                    │
│  2. Route matching: /api/v1/...                        │
│                                                        │
│  Unauthenticated routes:                               │
│    POST /auth/login → Rate limiter → AuthHandler       │
│    POST /auth/mfa/verify → Rate limiter → AuthHandler  │
│    POST /auth/refresh → Rate limiter → AuthHandler     │
│    GET /health → Health check                          │
│                                                        │
│  Authenticated routes:                                  │
│    AuthMiddleware                                       │
│      → TenantMiddleware (+ RLS)                        │
│        → AuditMiddleware (background)                  │
│          → [Optional RBAC]                             │
│            → Handler                                   │
│              → Service                                 │
│                → PostgreSQL / S3                        │
└────────────────────────────────────────────────────────┘
```

## Multi-Tenant Architecture

Heritage Motor uses PostgreSQL Row Level Security for tenant isolation:

```
JWT Token (contains tenant_id)
    │
    ▼
TenantMiddleware
    │
    ├── Verify tenant active (cached, 5min TTL)
    │
    ├── Acquire DB connection from pool
    │
    └── SET LOCAL app.current_tenant_id = '<uuid>'
         │
         ▼
    RLS Policy on every table:
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
```

Every business table has RLS enabled. The `tenant_id` is **never** taken from the URL or request body; it is always extracted from the authenticated JWT token.

## Service Naming Conventions

| Service | Constructor | Rationale |
|---------|-------------|-----------|
| Vehicle | `vehiclesvc.New()` | Historical convention |
| All others | `svc.NewService()` | Standard pattern |

| Handler | Constructor |
|---------|-------------|
| Vehicle | `vehiclehandler.New()` |
| All others | `handler.NewHandler()` |

## Error Handling

Domain errors flow through `HandleServiceError()` for consistent HTTP responses:

| Domain Error | HTTP Status | Response |
|-------------|-------------|----------|
| `ErrNotFound` | 404 | `{"error": "not_found", "resource": "..."}` |
| `ErrForbidden` | 403 | `{"error": "forbidden"}` |
| `ErrValidation` | 422 | `{"error": "validation", "field": "...", "message": "..."}` |
| `ErrConflict` | 409 | `{"error": "conflict", "message": "..."}` |
| `ErrUnauthorized` | 401 | `{"error": "unauthorized", "message": "..."}` |
| Other | 500 | `{"error": "internal"}` |

## Pagination

All list endpoints support pagination:

```json
{
  "data": [...],
  "total_count": 42,
  "page": 1,
  "per_page": 20
}
```

Query parameters: `?page=1&per_page=20` (defaults: page=1, per_page=20, max=100).

Pagination is normalized both at the handler level (via shared `PaginationParams.Normalize()`) and as a safety net in each service.

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `gofiber/fiber/v2` | v2.52 | HTTP framework |
| `jackc/pgx/v5` | v5.8 | PostgreSQL driver + pool |
| `golang-jwt/jwt/v5` | v5.3 | JWT token generation/validation |
| `google/uuid` | v1.6 | UUID generation |
| `go-playground/validator/v10` | v10.30 | Request validation |
| `rs/zerolog` | v1.34 | Structured JSON logging |
| `aws-sdk-go-v2/service/s3` | v1.96 | S3 file storage |
| `pquerna/otp` | v1.5 | TOTP for MFA |
| `joho/godotenv` | v1.5 | .env file loading |
| `golang.org/x/crypto` | v0.48 | bcrypt password hashing |
