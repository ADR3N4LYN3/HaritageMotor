-- no-transaction
-- ALTER TYPE ADD VALUE cannot run inside a transaction.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin';
