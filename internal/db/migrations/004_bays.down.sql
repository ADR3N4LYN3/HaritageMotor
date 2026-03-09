ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS fk_vehicles_bay;
DROP POLICY IF EXISTS bays_tenant_isolation ON bays;
DROP TABLE IF EXISTS bays;
DROP TYPE IF EXISTS bay_status;
