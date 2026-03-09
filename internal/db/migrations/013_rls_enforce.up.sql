-- Migration 013: Enforce RLS with a dedicated application role.
--
-- Creates 'heritage_app' role for the application connection pool.
-- The owner role (used for migrations) bypasses RLS; the app role does not.
-- Policies are updated with missing_ok=true so an unset tenant returns no rows
-- instead of raising an error.

-- 1. Create the application role (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'heritage_app') THEN
    CREATE ROLE heritage_app LOGIN PASSWORD 'heritage_app_dev';
    RAISE NOTICE 'Created role heritage_app — change the password in production!';
  END IF;
END
$$;

-- 2. Grant schema and table privileges
GRANT USAGE ON SCHEMA public TO heritage_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  users, vehicles, bays, events, tasks, documents, refresh_tokens
TO heritage_app;

-- Read-only tables for the app role
GRANT SELECT ON tenants, audit_log, schema_migrations TO heritage_app;

-- Future tables automatically get basic grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO heritage_app;

-- 3. Recreate policies with missing_ok=true (returns NULL instead of error when unset)

-- Users
DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Vehicles
DROP POLICY IF EXISTS vehicles_tenant_isolation ON vehicles;
CREATE POLICY vehicles_tenant_isolation ON vehicles
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Bays
DROP POLICY IF EXISTS bays_tenant_isolation ON bays;
CREATE POLICY bays_tenant_isolation ON bays
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Events
DROP POLICY IF EXISTS events_tenant_isolation ON events;
CREATE POLICY events_tenant_isolation ON events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Tasks
DROP POLICY IF EXISTS tasks_tenant_isolation ON tasks;
CREATE POLICY tasks_tenant_isolation ON tasks
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Documents
DROP POLICY IF EXISTS documents_tenant_isolation ON documents;
CREATE POLICY documents_tenant_isolation ON documents
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- 4. Add RLS to refresh_tokens (was missing)
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY refresh_tokens_tenant_isolation ON refresh_tokens
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
