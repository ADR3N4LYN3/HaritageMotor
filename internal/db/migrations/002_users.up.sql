CREATE TYPE user_role AS ENUM ('admin', 'operator', 'technician', 'viewer');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    role            user_role NOT NULL DEFAULT 'operator',
    totp_secret     TEXT,
    totp_enabled    BOOLEAN NOT NULL DEFAULT false,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_users_email_tenant ON users(email, tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_tenant ON users(tenant_id) WHERE deleted_at IS NULL;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_tenant_isolation ON users
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
