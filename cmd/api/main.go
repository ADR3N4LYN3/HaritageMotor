package main

import (
	"context"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/chriis/heritage-motor/internal/auth"
	"github.com/chriis/heritage-motor/internal/config"
	"github.com/chriis/heritage-motor/internal/db"
	"github.com/chriis/heritage-motor/internal/storage"
)

func main() {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	// Setup logging
	level, _ := zerolog.ParseLevel(cfg.LogLevel)
	zerolog.SetGlobalLevel(level)
	if cfg.AppEnv == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

	// Handle "migrate" subcommand (always uses owner role)
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		var pool *pgxpool.Pool
		pool, err = db.NewPool(cfg.DatabaseURL)
		if err != nil {
			log.Fatal().Err(err).Msg("failed to connect to database for migration")
		}
		defer pool.Close()

		migrationsDir := "./migrations"
		if len(os.Args) > 2 {
			migrationsDir = os.Args[2]
		}
		if err := db.RunMigrations(pool, migrationsDir); err != nil { //nolint:govet // scoped err in if block
			log.Fatal().Err(err).Msg("migration failed")
		}
		log.Info().Msg("migrations completed successfully")
		return
	}

	// Validate production config
	if cfg.AppEnv == "production" {
		if cfg.JWTSecret == "dev-secret-change-in-production" || len(cfg.JWTSecret) < 32 {
			log.Fatal().Msg("JWT_SECRET must be at least 32 characters in production")
		}
	}

	// Database — owner pool (migrations, auth login, audit log)
	ownerPool, err := db.NewPool(cfg.DatabaseURL)
	if err != nil {
		if cfg.AppEnv == "development" {
			log.Warn().Err(err).Msg("database not available - API routes will not work, landing page only")
		} else {
			log.Fatal().Err(err).Msg("failed to connect to database")
		}
	}
	if ownerPool != nil {
		defer ownerPool.Close()
	}

	// Database — app pool (RLS enforced via heritage_app role)
	// Falls back to owner pool in dev when DATABASE_APP_URL is not set.
	var appPool *pgxpool.Pool
	if ownerPool != nil {
		if cfg.DatabaseAppURL != "" {
			appPool, err = db.NewAppPool(cfg.DatabaseAppURL)
			if err != nil {
				log.Fatal().Err(err).Msg("failed to connect app pool")
			}
			defer appPool.Close()
		} else {
			log.Warn().Msg("DATABASE_APP_URL not set — using owner pool for all queries (RLS not enforced)")
			appPool = ownerPool
		}
	}

	// Start periodic cleanup goroutines
	if ownerPool != nil {
		startCleanupRoutines(ownerPool)
	}

	// S3 Storage
	s3Client, err := storage.NewS3Client(
		cfg.S3Endpoint, cfg.S3Bucket,
		cfg.S3AccessKey, cfg.S3SecretKey, cfg.S3Region,
	)
	if err != nil {
		log.Fatal().Msg("failed to initialize S3 client — check S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET environment variables")
	}

	// JWT Manager
	jwtManager := auth.NewJWTManager(cfg.JWTSecret, cfg.JWTAccessExpiry, cfg.JWTRefreshExpiry)

	// CORS origins
	allowedOrigins := "https://app.heritagemotor.app,https://heritagemotor.app"
	if cfg.AppEnv == "development" {
		allowedOrigins = "http://localhost:3001,http://localhost:3000"
	}
	if envOrigins := os.Getenv("CORS_ORIGINS"); envOrigins != "" {
		allowedOrigins = envOrigins
	}

	// Trusted proxies: only in production behind Caddy, not in dev/test
	// to avoid c.IP() returning empty when requests come from 127.0.0.1 without X-Forwarded-For
	enableProxy := cfg.AppEnv == "production"

	// Fiber app
	app := fiber.New(fiber.Config{
		EnableTrustedProxyCheck: enableProxy,
		TrustedProxies:          []string{"127.0.0.1", "::1"},
		ProxyHeader:             "X-Forwarded-For",
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
		BodyLimit: 50 * 1024 * 1024, // 50MB for photo uploads
	})

	// Global middleware
	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: true,
	}))

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		dbStatus := "connected"
		if ownerPool == nil {
			dbStatus = "unavailable"
		}
		return c.JSON(fiber.Map{"status": "ok", "service": "heritage-motor", "database": dbStatus})
	})

	// Static files and landing page
	app.Static("/static", "./web/static")
	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendFile("./web/static/index.html")
	})
	app.Get("/contact", func(c *fiber.Ctx) error {
		data, err := os.ReadFile("./web/static/contact.html")
		if err != nil {
			return c.Status(500).SendString("internal error")
		}
		html := strings.Replace(string(data), "__TURNSTILE_SITE_KEY__", cfg.TurnstileSiteKey, 1)
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.SendString(html)
	})

	// API routes require database
	if ownerPool != nil {
		setupRoutes(app, &routesDeps{
			ownerPool:          ownerPool,
			appPool:            appPool,
			jwtManager:         jwtManager,
			s3Client:           s3Client,
			s3Bucket:           cfg.S3Bucket,
			resendAPIKey:       cfg.ResendAPIKey,
			emailFrom:          cfg.EmailFrom,
			contactEmailTo:     cfg.ContactEmailTo,
			appBaseURL:         cfg.AppBaseURL,
			turnstileSecretKey: cfg.TurnstileSecretKey,
		})
	}

	// Graceful shutdown with timeout
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		log.Info().Msg("shutting down server...")
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = app.ShutdownWithContext(ctx)
	}()

	// Start
	addr := ":" + cfg.AppPort
	log.Info().Str("addr", addr).Str("env", cfg.AppEnv).Msg("starting Heritage Motor API")
	if err := app.Listen(addr); err != nil {
		log.Fatal().Err(err).Msg("server failed")
	}
}

func startCleanupRoutines(ownerPool *pgxpool.Pool) {
	// Cleanup expired token blacklist entries (every hour)
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
			tag, cleanupErr := ownerPool.Exec(cleanupCtx, "DELETE FROM token_blacklist WHERE expires_at < NOW()")
			cleanupCancel()
			if cleanupErr != nil {
				log.Warn().Err(cleanupErr).Msg("token blacklist cleanup failed")
			} else if tag.RowsAffected() > 0 {
				log.Info().Int64("deleted", tag.RowsAffected()).Msg("token blacklist cleanup")
			}
		}
	}()

	// Cleanup expired/revoked refresh tokens (every 24h)
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
			tag, cleanupErr := ownerPool.Exec(cleanupCtx, "DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '7 days'")
			cleanupCancel()
			if cleanupErr != nil {
				log.Warn().Err(cleanupErr).Msg("refresh token cleanup failed")
			} else if tag.RowsAffected() > 0 {
				log.Info().Int64("deleted", tag.RowsAffected()).Msg("refresh token cleanup")
			}
		}
	}()
}
