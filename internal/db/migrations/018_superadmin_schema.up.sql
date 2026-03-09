-- Tenant status (replaces simple active boolean)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'trial'));
-- Backfill from active boolean
UPDATE tenants SET status = CASE WHEN active THEN 'active' ELSE 'suspended' END;

-- Password change required flag (for onboarding flow)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN NOT NULL DEFAULT false;

-- Make users.tenant_id nullable (superadmin has no tenant)
ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;

-- Make refresh_tokens.tenant_id nullable (superadmin tokens)
ALTER TABLE refresh_tokens ALTER COLUMN tenant_id DROP NOT NULL;

-- Plan limits table
CREATE TABLE IF NOT EXISTS plan_limits (
    plan     TEXT NOT NULL,
    resource TEXT NOT NULL,
    max_count INT NOT NULL,
    PRIMARY KEY (plan, resource)
);

-- Seed default plan limits (-1 = unlimited)
INSERT INTO plan_limits (plan, resource, max_count) VALUES
    ('starter', 'vehicles', 25),
    ('starter', 'users', 5),
    ('starter', 'bays', 20),
    ('pro', 'vehicles', 100),
    ('pro', 'users', 20),
    ('pro', 'bays', 100),
    ('enterprise', 'vehicles', -1),
    ('enterprise', 'users', -1),
    ('enterprise', 'bays', -1)
ON CONFLICT DO NOTHING;

-- Invitations table (onboarding flow)
CREATE TABLE IF NOT EXISTS invitations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email              TEXT NOT NULL,
    role               user_role NOT NULL DEFAULT 'operator',
    invited_by         UUID NOT NULL REFERENCES users(id),
    temp_password_hash TEXT NOT NULL,
    accepted_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email) WHERE accepted_at IS NULL;

-- Grant app role access to new tables
GRANT SELECT ON plan_limits TO heritage_app;
GRANT SELECT, INSERT, UPDATE ON invitations TO heritage_app;
