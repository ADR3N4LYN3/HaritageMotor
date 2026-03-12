package config

import (
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv     string
	AppPort    string
	AppBaseURL string

	DatabaseURL    string
	DatabaseAppURL string // App role connection (RLS enforced); falls back to DatabaseURL in dev

	JWTSecret        string
	JWTAccessExpiry  time.Duration
	JWTRefreshExpiry time.Duration

	S3Endpoint  string
	S3Bucket    string
	S3AccessKey string
	S3SecretKey string
	S3Region    string

	ResendAPIKey   string
	EmailFrom      string
	ContactEmailTo string

	TurnstileSecretKey string
	TurnstileSiteKey   string

	LogLevel string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		AppEnv:     getEnv("APP_ENV", "development"),
		AppPort:    getEnv("APP_PORT", "3000"),
		AppBaseURL: getEnv("APP_BASE_URL", "http://localhost:3000"),

		DatabaseURL:    getEnv("DATABASE_URL", "postgresql://heritage_motor:password@localhost:5432/heritage_motor?sslmode=disable"),
		DatabaseAppURL: getEnv("DATABASE_APP_URL", ""),

		JWTSecret: getEnv("JWT_SECRET", "dev-secret-change-in-production"),

		S3Endpoint:  getEnv("S3_ENDPOINT", ""),
		S3Bucket:    getEnv("S3_BUCKET", "heritage-motor-dev"),
		S3AccessKey: getEnv("S3_ACCESS_KEY", ""),
		S3SecretKey: getEnv("S3_SECRET_KEY", ""),
		S3Region:    getEnv("S3_REGION", "eu-central"),

		ResendAPIKey:   getEnv("RESEND_API_KEY", ""),
		EmailFrom:      getEnv("EMAIL_FROM", "noreply@heritagemotor.app"),
		ContactEmailTo: getEnv("CONTACT_EMAIL_TO", "welcome@heritagemotor.app"),

		TurnstileSecretKey: getEnv("TURNSTILE_SECRET_KEY", ""),
		TurnstileSiteKey:   getEnv("TURNSTILE_SITE_KEY", ""),

		LogLevel: getEnv("LOG_LEVEL", "info"),
	}

	var err error
	cfg.JWTAccessExpiry, err = time.ParseDuration(getEnv("JWT_ACCESS_EXPIRY", "15m"))
	if err != nil {
		cfg.JWTAccessExpiry = 15 * time.Minute
	}

	cfg.JWTRefreshExpiry, err = time.ParseDuration(getEnv("JWT_REFRESH_EXPIRY", "168h"))
	if err != nil {
		cfg.JWTRefreshExpiry = 168 * time.Hour
	}

	// Validate required config in production
	if cfg.AppEnv == "production" {
		required := map[string]string{
			"DATABASE_URL":         cfg.DatabaseURL,
			"DATABASE_APP_URL":     cfg.DatabaseAppURL,
			"S3_ENDPOINT":          cfg.S3Endpoint,
			"S3_ACCESS_KEY":        cfg.S3AccessKey,
			"S3_SECRET_KEY":        cfg.S3SecretKey,
			"S3_BUCKET":            cfg.S3Bucket,
			"RESEND_API_KEY":       cfg.ResendAPIKey,
			"TURNSTILE_SECRET_KEY": cfg.TurnstileSecretKey,
			"APP_BASE_URL":         cfg.AppBaseURL,
		}
		for name, val := range required {
			if val == "" {
				return nil, fmt.Errorf("required config %s is not set in production", name)
			}
		}
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
