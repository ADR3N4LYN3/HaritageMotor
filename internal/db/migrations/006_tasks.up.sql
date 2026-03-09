CREATE TYPE task_type AS ENUM (
    'battery_start',
    'tire_pressure',
    'wash',
    'fluid_check',
    'custom'
);

CREATE TYPE task_status AS ENUM ('pending', 'completed', 'overdue', 'cancelled');

CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
    task_type       task_type NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    status          task_status NOT NULL DEFAULT 'pending',
    due_date        TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    completed_by    UUID REFERENCES users(id),
    recurrence_days INTEGER,
    next_due_date   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_tasks_vehicle ON tasks(vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to, due_date) WHERE deleted_at IS NULL AND status = 'pending';

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_tenant_isolation ON tasks
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
