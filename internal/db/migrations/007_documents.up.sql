CREATE TYPE document_type AS ENUM (
    'storage_contract',
    'insurance',
    'mandate',
    'technical_control',
    'expertise',
    'other'
);

CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    doc_type        document_type NOT NULL,
    filename        TEXT NOT NULL,
    s3_key          TEXT NOT NULL UNIQUE,
    mime_type       TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    expires_at      TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_documents_vehicle ON documents(vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_tenant ON documents(tenant_id) WHERE deleted_at IS NULL;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_tenant_isolation ON documents
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
