-- Revert migration 013: remove app role grants and restore original policies.

-- Remove RLS from refresh_tokens
DROP POLICY IF EXISTS refresh_tokens_tenant_isolation ON refresh_tokens;
ALTER TABLE refresh_tokens DISABLE ROW LEVEL SECURITY;

-- Restore original policies (without missing_ok — errors if tenant not set)
DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

DROP POLICY IF EXISTS vehicles_tenant_isolation ON vehicles;
CREATE POLICY vehicles_tenant_isolation ON vehicles
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

DROP POLICY IF EXISTS bays_tenant_isolation ON bays;
CREATE POLICY bays_tenant_isolation ON bays
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

DROP POLICY IF EXISTS events_tenant_isolation ON events;
CREATE POLICY events_tenant_isolation ON events
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

DROP POLICY IF EXISTS tasks_tenant_isolation ON tasks;
CREATE POLICY tasks_tenant_isolation ON tasks
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

DROP POLICY IF EXISTS documents_tenant_isolation ON documents;
CREATE POLICY documents_tenant_isolation ON documents
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Revoke app role privileges
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM heritage_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM heritage_app;
REVOKE USAGE ON SCHEMA public FROM heritage_app;

-- Note: role heritage_app is NOT dropped (may be referenced by active connections).
