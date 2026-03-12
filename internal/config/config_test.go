package config

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoad_Defaults(t *testing.T) {
	// Clear any env vars that might interfere, ensure development mode
	t.Setenv("APP_ENV", "development")
	// Clear production-required vars so defaults kick in
	t.Setenv("DATABASE_URL", "")
	t.Setenv("JWT_SECRET", "")

	cfg, err := Load()
	require.NoError(t, err)

	assert.Equal(t, "development", cfg.AppEnv)
	assert.Equal(t, "3000", cfg.AppPort)
	assert.Equal(t, "http://localhost:3000", cfg.AppBaseURL)
	assert.Equal(t, 15*time.Minute, cfg.JWTAccessExpiry)
	assert.Equal(t, 168*time.Hour, cfg.JWTRefreshExpiry)
	assert.Equal(t, "heritage-motor-dev", cfg.S3Bucket)
	assert.Equal(t, "eu-central", cfg.S3Region)
	assert.Equal(t, "noreply@heritagemotor.app", cfg.EmailFrom)
	assert.Equal(t, "welcome@heritagemotor.app", cfg.ContactEmailTo)
	assert.Equal(t, "info", cfg.LogLevel)
}

func TestLoad_ProductionMissingRequired(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	// DATABASE_APP_URL is required in production but empty by default
	t.Setenv("DATABASE_APP_URL", "")
	// Set others to non-empty to isolate which one fails
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("S3_ENDPOINT", "https://s3.example.com")
	t.Setenv("S3_ACCESS_KEY", "key")
	t.Setenv("S3_SECRET_KEY", "secret")
	t.Setenv("S3_BUCKET", "bucket")
	t.Setenv("RESEND_API_KEY", "re_xxx")
	t.Setenv("TURNSTILE_SECRET_KEY", "ts_xxx")
	t.Setenv("APP_BASE_URL", "https://app.example.com")

	_, err := Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "production")
}

func TestLoad_ProductionAllSet(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("APP_PORT", "8080")
	t.Setenv("APP_BASE_URL", "https://app.heritagemotor.app")
	t.Setenv("DATABASE_URL", "postgres://prod:pass@db:5432/hm")
	t.Setenv("DATABASE_APP_URL", "postgres://app:pass@db:5432/hm")
	t.Setenv("JWT_SECRET", "super-secret-production-key")
	t.Setenv("JWT_ACCESS_EXPIRY", "10m")
	t.Setenv("JWT_REFRESH_EXPIRY", "72h")
	t.Setenv("S3_ENDPOINT", "https://s3.eu-central.example.com")
	t.Setenv("S3_BUCKET", "hm-prod")
	t.Setenv("S3_ACCESS_KEY", "AKID")
	t.Setenv("S3_SECRET_KEY", "SKEY")
	t.Setenv("S3_REGION", "eu-west-1")
	t.Setenv("RESEND_API_KEY", "re_prod")
	t.Setenv("EMAIL_FROM", "no-reply@heritagemotor.app")
	t.Setenv("CONTACT_EMAIL_TO", "contact@heritagemotor.app")
	t.Setenv("TURNSTILE_SECRET_KEY", "ts_prod")
	t.Setenv("TURNSTILE_SITE_KEY", "site_prod")
	t.Setenv("LOG_LEVEL", "warn")

	cfg, err := Load()
	require.NoError(t, err)

	assert.Equal(t, "production", cfg.AppEnv)
	assert.Equal(t, "8080", cfg.AppPort)
	assert.Equal(t, "https://app.heritagemotor.app", cfg.AppBaseURL)
	assert.Equal(t, "postgres://prod:pass@db:5432/hm", cfg.DatabaseURL)
	assert.Equal(t, "postgres://app:pass@db:5432/hm", cfg.DatabaseAppURL)
	assert.Equal(t, "super-secret-production-key", cfg.JWTSecret)
	assert.Equal(t, 10*time.Minute, cfg.JWTAccessExpiry)
	assert.Equal(t, 72*time.Hour, cfg.JWTRefreshExpiry)
	assert.Equal(t, "https://s3.eu-central.example.com", cfg.S3Endpoint)
	assert.Equal(t, "hm-prod", cfg.S3Bucket)
	assert.Equal(t, "AKID", cfg.S3AccessKey)
	assert.Equal(t, "SKEY", cfg.S3SecretKey)
	assert.Equal(t, "eu-west-1", cfg.S3Region)
	assert.Equal(t, "re_prod", cfg.ResendAPIKey)
	assert.Equal(t, "no-reply@heritagemotor.app", cfg.EmailFrom)
	assert.Equal(t, "contact@heritagemotor.app", cfg.ContactEmailTo)
	assert.Equal(t, "ts_prod", cfg.TurnstileSecretKey)
	assert.Equal(t, "site_prod", cfg.TurnstileSiteKey)
	assert.Equal(t, "warn", cfg.LogLevel)
}

func TestLoad_InvalidDuration_FallsBackToDefault(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_ACCESS_EXPIRY", "not-a-duration")
	t.Setenv("JWT_REFRESH_EXPIRY", "also-invalid")

	cfg, err := Load()
	require.NoError(t, err)

	assert.Equal(t, 15*time.Minute, cfg.JWTAccessExpiry)
	assert.Equal(t, 168*time.Hour, cfg.JWTRefreshExpiry)
}

func TestLoad_CustomDurations(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_ACCESS_EXPIRY", "30m")
	t.Setenv("JWT_REFRESH_EXPIRY", "48h")

	cfg, err := Load()
	require.NoError(t, err)

	assert.Equal(t, 30*time.Minute, cfg.JWTAccessExpiry)
	assert.Equal(t, 48*time.Hour, cfg.JWTRefreshExpiry)
}
