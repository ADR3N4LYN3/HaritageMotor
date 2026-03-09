-- 015_token_blacklist.up.sql
-- Token blacklist for immediate JWT revocation on logout / user deletion.
-- Entries auto-expire (expires_at); periodic cleanup recommended.

CREATE TABLE token_blacklist (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jti        TEXT,           -- specific access-token jti (NULL for user-level block)
    user_id    UUID,           -- blocks ALL tokens for this user (NULL for jti-specific)
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jti IS NOT NULL OR user_id IS NOT NULL)
);

-- Fast lookup by jti (unique per token)
CREATE UNIQUE INDEX idx_token_blacklist_jti ON token_blacklist(jti) WHERE jti IS NOT NULL;
-- Fast lookup by user_id (user-level block)
CREATE INDEX idx_token_blacklist_user ON token_blacklist(user_id) WHERE user_id IS NOT NULL;

-- Allow heritage_app role to read/write blacklist entries.
GRANT SELECT, INSERT, DELETE ON token_blacklist TO heritage_app;
