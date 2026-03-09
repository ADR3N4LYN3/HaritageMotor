CREATE TYPE event_type AS ENUM (
    'vehicle_intake',
    'vehicle_exit',
    'vehicle_moved',
    'task_completed',
    'document_added',
    'photo_added',
    'status_changed',
    'note_added',
    'incident_reported'
);

CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    event_type      event_type NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    photo_keys      TEXT[] DEFAULT '{}',
    notes           TEXT,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source          TEXT NOT NULL DEFAULT 'web_app'
);

CREATE INDEX idx_events_vehicle_timeline ON events(vehicle_id, occurred_at DESC);
CREATE INDEX idx_events_tenant ON events(tenant_id, occurred_at DESC);
CREATE INDEX idx_events_type ON events(tenant_id, event_type, occurred_at DESC);

CREATE RULE no_update_events AS ON UPDATE TO events DO INSTEAD NOTHING;
CREATE RULE no_delete_events AS ON DELETE TO events DO INSTEAD NOTHING;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_tenant_isolation ON events
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
