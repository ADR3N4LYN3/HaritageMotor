CREATE TYPE bay_status AS ENUM ('free', 'occupied', 'reserved', 'maintenance');

CREATE TABLE bays (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code        TEXT NOT NULL,
    zone        TEXT,
    description TEXT,
    status      bay_status NOT NULL DEFAULT 'free',
    features    TEXT[] DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_bays_code_tenant ON bays(code, tenant_id);
CREATE INDEX idx_bays_tenant_status ON bays(tenant_id, status);

ALTER TABLE bays ENABLE ROW LEVEL SECURITY;
CREATE POLICY bays_tenant_isolation ON bays
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

ALTER TABLE vehicles ADD CONSTRAINT fk_vehicles_bay
    FOREIGN KEY (current_bay_id) REFERENCES bays(id) ON DELETE SET NULL;
