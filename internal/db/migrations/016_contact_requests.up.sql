-- Contact form submissions (public, no tenant/RLS)
CREATE TABLE contact_requests (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    company    TEXT NOT NULL DEFAULT '',
    vehicles   TEXT NOT NULL DEFAULT '',
    message    TEXT NOT NULL DEFAULT '',
    ip_address TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_requests_created ON contact_requests(created_at DESC);
