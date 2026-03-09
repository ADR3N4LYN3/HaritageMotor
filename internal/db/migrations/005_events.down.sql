DROP RULE IF EXISTS no_update_events ON events;
DROP RULE IF EXISTS no_delete_events ON events;
DROP POLICY IF EXISTS events_tenant_isolation ON events;
DROP TABLE IF EXISTS events;
DROP TYPE IF EXISTS event_type;
