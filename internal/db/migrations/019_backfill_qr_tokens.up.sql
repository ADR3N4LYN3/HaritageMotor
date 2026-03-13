-- Backfill qr_token for existing bays and vehicles that have NULL qr_token
UPDATE bays SET qr_token = gen_random_uuid()::TEXT WHERE qr_token IS NULL;
UPDATE vehicles SET qr_token = gen_random_uuid()::TEXT WHERE qr_token IS NULL;
