DROP INDEX IF EXISTS idx_bays_qr_token;
ALTER TABLE bays DROP COLUMN IF EXISTS qr_token;

DROP INDEX IF EXISTS idx_vehicles_qr_token;
ALTER TABLE vehicles DROP COLUMN IF EXISTS qr_token;
