CREATE TYPE vehicle_status AS ENUM ('stored', 'out', 'transit', 'maintenance', 'sold');

CREATE TABLE vehicles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    make            TEXT NOT NULL,
    model           TEXT NOT NULL,
    year            INTEGER,
    color           TEXT,
    license_plate   TEXT,
    vin             TEXT,
    owner_name      TEXT NOT NULL,
    owner_email     TEXT,
    owner_phone     TEXT,
    owner_notes     TEXT,
    status          vehicle_status NOT NULL DEFAULT 'stored',
    current_bay_id  UUID,
    notes           TEXT,
    tags            TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_vehicles_tenant ON vehicles(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_status ON vehicles(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vehicles_owner ON vehicles(tenant_id, owner_email) WHERE deleted_at IS NULL;

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY vehicles_tenant_isolation ON vehicles
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
