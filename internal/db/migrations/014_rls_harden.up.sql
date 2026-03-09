-- Migration 014: Harden RLS policies
--
--   1. FORCE RLS on business tables (defense in depth — prevents owner bypass)
--   2. RLS on audit_log (heritage_app can only SELECT its own tenant's logs)
--   3. Revoke over-broad DEFAULT PRIVILEGES granted in migration 013

-- 1. FORCE RLS on all business tables.
-- The owner role (heritage_motor) is a superuser and bypasses RLS regardless,
-- but FORCE protects against future non-superuser table owners.
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE vehicles FORCE ROW LEVEL SECURITY;
ALTER TABLE bays FORCE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;

-- 2. Enable RLS on audit_log for defense in depth.
-- heritage_app only has SELECT on audit_log (migration 013), but without RLS
-- it could read all tenants' logs. This policy restricts reads to the current tenant.
-- The audit middleware uses ownerPool (superuser) for INSERT, so no INSERT policy needed.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_tenant_read ON audit_log
  FOR SELECT TO heritage_app
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- 3. Revoke over-broad DEFAULT PRIVILEGES from migration 013.
-- Future tables should receive explicit GRANTs in their own migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM heritage_app;
