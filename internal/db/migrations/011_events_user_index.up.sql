CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id, occurred_at DESC);
