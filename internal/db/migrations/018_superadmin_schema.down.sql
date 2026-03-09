DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS plan_limits;

ALTER TABLE refresh_tokens ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE users DROP COLUMN IF EXISTS password_change_required;
ALTER TABLE tenants DROP COLUMN IF EXISTS status;
