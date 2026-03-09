# Database

PostgreSQL 16 with Row Level Security for multi-tenant data isolation.

## Schema Overview

```
tenants ──┬── users ──── refresh_tokens
          ├── vehicles ──┬── events
          │    │         ├── tasks
          │    │         └── documents
          │    └── FK ──► bays
          └── audit_log
```

All business tables enforce tenant isolation via RLS policies using `current_setting('app.current_tenant_id')`.

## Migrations

Migrations are located in `internal/db/migrations/` and run sequentially on startup.

| # | File | Description |
|---|------|-------------|
| 001 | `001_tenants.up.sql` | Tenants table with plan check constraint |
| 002 | `002_users.up.sql` | Users table, `user_role` ENUM, RLS policy |
| 003 | `003_vehicles.up.sql` | Vehicles table, `vehicle_status` ENUM, RLS policy |
| 004 | `004_bays.up.sql` | Bays table, `bay_status` ENUM, RLS policy, FK from vehicles |
| 005 | `005_events.up.sql` | Events table, `event_type` ENUM, append-only rules, RLS |
| 006 | `006_tasks.up.sql` | Tasks table, `task_type`/`task_status` ENUMs, RLS |
| 007 | `007_documents.up.sql` | Documents table, `document_type` ENUM, RLS |
| 008 | `008_audit_log.up.sql` | Audit log, append-only rules (no RLS — admin-scoped) |
| 009 | `009_refresh_tokens.up.sql` | Refresh tokens with hash-based lookup |
| 010 | `010_qr_tokens.up.sql` | QR token columns on vehicles and bays |
| 011 | `011_events_user_index.up.sql` | Index on `events(user_id, occurred_at DESC)` |
| 012 | `012_rls_enable.up.sql` | Enable RLS on all business tables |
| 013 | `013_rls_enforce.up.sql` | `heritage_app` role, grants, policies with missing_ok |
| 014 | `014_rls_harden.up.sql` | FORCE RLS on all business tables |
| 015 | `015_token_blacklist.up.sql` | Token blacklist table for JWT revocation |
| 016 | `016_contact_requests.up.sql` | Contact form submissions (public, no RLS) |
| 017 | `017_superadmin_role.up.sql` | Add `superadmin` to `user_role` ENUM |
| 018 | `018_superadmin_schema.up.sql` | Tenant status, password_change_required, plan_limits, invitations |

## ENUM Types

### user_role

```sql
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'operator', 'technician', 'viewer');
```

### vehicle_status

```sql
CREATE TYPE vehicle_status AS ENUM ('stored', 'out', 'transit', 'maintenance', 'sold');
```

### bay_status

```sql
CREATE TYPE bay_status AS ENUM ('free', 'occupied', 'reserved', 'maintenance');
```

### event_type

```sql
CREATE TYPE event_type AS ENUM (
    'vehicle_intake', 'vehicle_exit', 'vehicle_moved',
    'task_completed', 'document_added', 'photo_added',
    'status_changed', 'note_added', 'incident_reported'
);
```

### task_type

```sql
CREATE TYPE task_type AS ENUM ('battery_start', 'tire_pressure', 'wash', 'fluid_check', 'custom');
```

### task_status

```sql
CREATE TYPE task_status AS ENUM ('pending', 'completed', 'overdue', 'cancelled');
```

### document_type

```sql
CREATE TYPE document_type AS ENUM (
    'storage_contract', 'insurance', 'mandate',
    'technical_control', 'expertise', 'other'
);
```

## Table Definitions

### tenants

Root entity. All other business tables reference `tenants(id)`.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `name` | TEXT | NOT NULL |
| `slug` | TEXT | NOT NULL, UNIQUE |
| `country` | TEXT | NOT NULL, default `'FR'` |
| `timezone` | TEXT | NOT NULL, default `'Europe/Paris'` |
| `plan` | TEXT | NOT NULL, default `'starter'`, CHECK `IN ('starter', 'pro', 'enterprise')` |
| `active` | BOOLEAN | NOT NULL, default `true` |
| `status` | TEXT | NOT NULL, default `'active'` (active/suspended/trial) |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |
| `deleted_at` | TIMESTAMPTZ | Soft delete |

**Indexes:** `idx_tenants_slug` on `slug` WHERE `deleted_at IS NULL`.

### users

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `tenant_id` | UUID | Nullable (NULL for superadmin), FK `tenants(id)` CASCADE |
| `email` | TEXT | NOT NULL |
| `password_hash` | TEXT | NOT NULL |
| `password_change_required` | BOOLEAN | NOT NULL, default `false` |
| `first_name` | TEXT | NOT NULL |
| `last_name` | TEXT | NOT NULL |
| `role` | `user_role` | NOT NULL, default `'operator'` |
| `totp_secret` | TEXT | Nullable (set when MFA is configured) |
| `totp_enabled` | BOOLEAN | NOT NULL, default `false` |
| `last_login_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |
| `deleted_at` | TIMESTAMPTZ | Soft delete |

**Indexes:**
- `idx_users_email_tenant` — UNIQUE on `(email, tenant_id)` WHERE `deleted_at IS NULL`
- `idx_users_tenant` on `tenant_id` WHERE `deleted_at IS NULL`

**RLS:** `users_tenant_isolation` — `USING (tenant_id = current_setting('app.current_tenant_id')::UUID)`

### vehicles

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `tenant_id` | UUID | NOT NULL, FK `tenants(id)` CASCADE |
| `make` | TEXT | NOT NULL |
| `model` | TEXT | NOT NULL |
| `year` | INTEGER | Nullable |
| `color` | TEXT | Nullable |
| `license_plate` | TEXT | Nullable |
| `vin` | TEXT | Nullable |
| `owner_name` | TEXT | NOT NULL |
| `owner_email` | TEXT | Nullable |
| `owner_phone` | TEXT | Nullable |
| `owner_notes` | TEXT | Nullable |
| `status` | `vehicle_status` | NOT NULL, default `'stored'` |
| `current_bay_id` | UUID | Nullable, FK `bays(id)` SET NULL |
| `notes` | TEXT | Nullable |
| `tags` | TEXT[] | default `'{}'` |
| `qr_token` | TEXT | Nullable (added in migration 010) |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |
| `deleted_at` | TIMESTAMPTZ | Soft delete |

**Indexes:**
- `idx_vehicles_tenant` on `tenant_id` WHERE `deleted_at IS NULL`
- `idx_vehicles_status` on `(tenant_id, status)` WHERE `deleted_at IS NULL`
- `idx_vehicles_owner` on `(tenant_id, owner_email)` WHERE `deleted_at IS NULL`
- `idx_vehicles_qr_token` — UNIQUE on `qr_token` WHERE `qr_token IS NOT NULL`

**RLS:** `vehicles_tenant_isolation` — `USING (tenant_id = current_setting('app.current_tenant_id')::UUID)`

### bays

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `tenant_id` | UUID | NOT NULL, FK `tenants(id)` CASCADE |
| `code` | TEXT | NOT NULL |
| `zone` | TEXT | Nullable |
| `description` | TEXT | Nullable |
| `status` | `bay_status` | NOT NULL, default `'free'` |
| `features` | TEXT[] | default `'{}'` |
| `qr_token` | TEXT | Nullable (added in migration 010) |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |

**Indexes:**
- `idx_bays_code_tenant` — UNIQUE on `(code, tenant_id)`
- `idx_bays_tenant_status` on `(tenant_id, status)`
- `idx_bays_qr_token` — UNIQUE on `qr_token` WHERE `qr_token IS NOT NULL`

**RLS:** `bays_tenant_isolation` — `USING (tenant_id = current_setting('app.current_tenant_id')::UUID)`

**Note:** Bays do NOT have a `deleted_at` column — they use hard delete (only when status is `free`).

### events

Append-only table. PostgreSQL rules prevent UPDATE and DELETE.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `tenant_id` | UUID | NOT NULL, FK `tenants(id)` CASCADE |
| `vehicle_id` | UUID | NOT NULL, FK `vehicles(id)` CASCADE |
| `user_id` | UUID | NOT NULL, FK `users(id)` |
| `event_type` | `event_type` | NOT NULL |
| `metadata` | JSONB | NOT NULL, default `'{}'` |
| `photo_keys` | TEXT[] | default `'{}'` |
| `notes` | TEXT | Nullable |
| `occurred_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |
| `source` | TEXT | NOT NULL, default `'web_app'` |

**Indexes:**
- `idx_events_vehicle_timeline` on `(vehicle_id, occurred_at DESC)`
- `idx_events_tenant` on `(tenant_id, occurred_at DESC)`
- `idx_events_type` on `(tenant_id, event_type, occurred_at DESC)`
- `idx_events_user` on `(user_id, occurred_at DESC)` (migration 011)

**Immutability Rules:**
```sql
CREATE RULE no_update_events AS ON UPDATE TO events DO INSTEAD NOTHING;
CREATE RULE no_delete_events AS ON DELETE TO events DO INSTEAD NOTHING;
```

**RLS:** `events_tenant_isolation` — `USING (tenant_id = current_setting('app.current_tenant_id')::UUID)`

### tasks

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `tenant_id` | UUID | NOT NULL, FK `tenants(id)` CASCADE |
| `vehicle_id` | UUID | NOT NULL, FK `vehicles(id)` CASCADE |
| `assigned_to` | UUID | Nullable, FK `users(id)` SET NULL |
| `task_type` | `task_type` | NOT NULL |
| `title` | TEXT | NOT NULL |
| `description` | TEXT | Nullable |
| `status` | `task_status` | NOT NULL, default `'pending'` |
| `due_date` | TIMESTAMPTZ | Nullable |
| `completed_at` | TIMESTAMPTZ | Nullable |
| `completed_by` | UUID | Nullable, FK `users(id)` |
| `recurrence_days` | INTEGER | Nullable |
| `next_due_date` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |
| `deleted_at` | TIMESTAMPTZ | Soft delete |

**Indexes:**
- `idx_tasks_vehicle` on `vehicle_id` WHERE `deleted_at IS NULL`
- `idx_tasks_tenant_status` on `(tenant_id, status)` WHERE `deleted_at IS NULL`
- `idx_tasks_assigned` on `(assigned_to, due_date)` WHERE `deleted_at IS NULL AND status = 'pending'`

**RLS:** `tasks_tenant_isolation` — `USING (tenant_id = current_setting('app.current_tenant_id')::UUID)`

### documents

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `tenant_id` | UUID | NOT NULL, FK `tenants(id)` CASCADE |
| `vehicle_id` | UUID | NOT NULL, FK `vehicles(id)` CASCADE |
| `uploaded_by` | UUID | NOT NULL, FK `users(id)` |
| `doc_type` | `document_type` | NOT NULL |
| `filename` | TEXT | NOT NULL |
| `s3_key` | TEXT | NOT NULL, UNIQUE |
| `mime_type` | TEXT | NOT NULL |
| `size_bytes` | BIGINT | NOT NULL |
| `expires_at` | TIMESTAMPTZ | Nullable |
| `notes` | TEXT | Nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |
| `deleted_at` | TIMESTAMPTZ | Soft delete |

**Indexes:**
- `idx_documents_vehicle` on `vehicle_id` WHERE `deleted_at IS NULL`
- `idx_documents_tenant` on `tenant_id` WHERE `deleted_at IS NULL`

**RLS:** `documents_tenant_isolation` — `USING (tenant_id = current_setting('app.current_tenant_id')::UUID)`

### audit_log

Append-only table. PostgreSQL rules prevent UPDATE and DELETE.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `tenant_id` | UUID | NOT NULL |
| `user_id` | UUID | Nullable |
| `action` | TEXT | NOT NULL |
| `resource_type` | TEXT | NOT NULL |
| `resource_id` | UUID | Nullable |
| `old_values` | JSONB | Nullable |
| `new_values` | JSONB | Nullable |
| `ip_address` | INET | Nullable |
| `user_agent` | TEXT | Nullable |
| `request_id` | TEXT | Nullable |
| `occurred_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |

**Indexes:**
- `idx_audit_tenant_time` on `(tenant_id, occurred_at DESC)`
- `idx_audit_user` on `(user_id, occurred_at DESC)`
- `idx_audit_resource` on `(resource_type, resource_id, occurred_at DESC)`

**Immutability Rules:**
```sql
CREATE RULE no_update_audit AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_log DO INSTEAD NOTHING;
```

**Note:** No RLS on audit_log — access is restricted at the handler level (admin only).

### refresh_tokens

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `user_id` | UUID | NOT NULL, FK `users(id)` CASCADE |
| `tenant_id` | UUID | Nullable (NULL for superadmin), FK `tenants(id)` CASCADE |
| `token_hash` | TEXT | NOT NULL, UNIQUE |
| `expires_at` | TIMESTAMPTZ | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |
| `revoked_at` | TIMESTAMPTZ | Nullable |

**Indexes:**
- `idx_refresh_tokens_user` on `user_id` WHERE `revoked_at IS NULL`
- `idx_refresh_tokens_hash` on `token_hash` WHERE `revoked_at IS NULL`

### token_blacklist

Enables immediate JWT revocation on logout or user deletion (migration 015).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `jti` | TEXT | Nullable (token-level block) |
| `user_id` | UUID | Nullable (user-level block) |
| `expires_at` | TIMESTAMPTZ | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |

**Constraint:** `CHECK (jti IS NOT NULL OR user_id IS NOT NULL)`

**Indexes:**
- `idx_token_blacklist_jti` — UNIQUE on `jti` WHERE `jti IS NOT NULL`
- `idx_token_blacklist_user` on `user_id` WHERE `user_id IS NOT NULL`

### contact_requests

Public landing page contact form submissions (migration 016). No RLS (no tenant context).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `name` | TEXT | NOT NULL |
| `email` | TEXT | NOT NULL |
| `company` | TEXT | default `''` |
| `vehicles` | TEXT | default `''` |
| `message` | TEXT | default `''` |
| `ip_address` | TEXT | default `''` |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |

**Indexes:** `idx_contact_requests_created` on `created_at DESC`

### plan_limits

Per-plan resource limits, enforced by the plan service (migration 018).

| Column | Type | Constraints |
|--------|------|-------------|
| `plan` | TEXT | PK (composite) |
| `resource` | TEXT | PK (composite) |
| `max_count` | INTEGER | NOT NULL (-1 = unlimited) |

**Default data:** starter (25v/5u/20b), pro (100v/20u/100b), enterprise (unlimited).

### invitations

Onboarding invitations created by superadmin (migration 018).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` |
| `tenant_id` | UUID | NOT NULL, FK `tenants(id)` |
| `email` | TEXT | NOT NULL |
| `role` | `user_role` | NOT NULL |
| `invited_by` | UUID | NOT NULL, FK `users(id)` |
| `temp_password_hash` | TEXT | NOT NULL |
| `accepted_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` |

**Indexes:**
- `idx_invitations_tenant` on `tenant_id`
- `idx_invitations_email` on `email` WHERE `accepted_at IS NULL`

## Row Level Security (RLS)

### Mechanism

RLS is enforced via the `TenantMiddleware` on every authenticated request:

```go
// TenantMiddleware acquires a connection and sets RLS context
conn, _ := pool.Acquire(c.Context())
conn.Exec(c.Context(), "SET LOCAL app.current_tenant_id = $1", tenantID.String())
```

`SET LOCAL` scopes the setting to the current connection session, preventing cross-tenant data leaks.

### Tables with RLS

| Table | Policy Name | Condition |
|-------|------------|-----------|
| `users` | `users_tenant_isolation` | `tenant_id = current_setting(...)` |
| `vehicles` | `vehicles_tenant_isolation` | `tenant_id = current_setting(...)` |
| `bays` | `bays_tenant_isolation` | `tenant_id = current_setting(...)` |
| `events` | `events_tenant_isolation` | `tenant_id = current_setting(...)` |
| `tasks` | `tasks_tenant_isolation` | `tenant_id = current_setting(...)` |
| `documents` | `documents_tenant_isolation` | `tenant_id = current_setting(...)` |

### Tables WITHOUT RLS

| Table | Reason |
|-------|--------|
| `tenants` | Root table, accessed for validation |
| `audit_log` | Admin-only access, handler-level filtering |
| `refresh_tokens` | Looked up by token hash, not tenant-scoped queries |

## Connection Pool

Configured in `internal/db/db.go` using `pgxpool`:

| Setting | Value | Purpose |
|---------|-------|---------|
| `MaxConns` | 25 | Prevent connection exhaustion |
| `MinConns` | 5 | Keep warm connections |
| `MaxConnLifetime` | 2 hours | Rotate connections to prevent stale state |
| `MaxConnIdleTime` | 5 minutes | Release unused connections |

Connection timeout: 10 seconds. The pool pings the database on creation to verify connectivity.

## Index Strategy

### Partial Indexes

Most indexes use `WHERE deleted_at IS NULL` (or equivalent conditions) to exclude soft-deleted rows, keeping the index smaller and faster.

### Composite Indexes

Multi-column indexes are ordered for common query patterns:
- `(tenant_id, status)` — filter by tenant then status
- `(vehicle_id, occurred_at DESC)` — vehicle timeline, newest first
- `(assigned_to, due_date)` — technician task queue
- `(resource_type, resource_id, occurred_at DESC)` — audit trail by resource

### Unique Constraints

- `(email, tenant_id)` on users — same email allowed in different tenants
- `(code, tenant_id)` on bays — bay codes unique per tenant
- `qr_token` on vehicles/bays — globally unique QR tokens
- `s3_key` on documents — prevents duplicate file references
- `token_hash` on refresh_tokens — one-to-one hash lookup
