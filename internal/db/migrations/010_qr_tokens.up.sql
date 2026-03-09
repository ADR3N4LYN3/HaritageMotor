ALTER TABLE vehicles ADD COLUMN qr_token TEXT;
CREATE UNIQUE INDEX idx_vehicles_qr_token ON vehicles(qr_token) WHERE qr_token IS NOT NULL;

ALTER TABLE bays ADD COLUMN qr_token TEXT;
CREATE UNIQUE INDEX idx_bays_qr_token ON bays(qr_token) WHERE qr_token IS NOT NULL;
