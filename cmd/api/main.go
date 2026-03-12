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
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/chriis/heritage-motor/internal/auth"
	"github.com/chriis/heritage-motor/internal/config"
	"github.com/chriis/heritage-motor/internal/db"
	adminhandler "github.com/chriis/heritage-motor/internal/handler/admin"
	auditloghandler "github.com/chriis/heritage-motor/internal/handler/audit"
	authhandler "github.com/chriis/heritage-motor/internal/handler/auth"
	bayhandler "github.com/chriis/heritage-motor/internal/handler/bay"
	contacthandler "github.com/chriis/heritage-motor/internal/handler/contact"
	dochandler "github.com/chriis/heritage-motor/internal/handler/document"
	eventhandler "github.com/chriis/heritage-motor/internal/handler/event"
	photohandler "github.com/chriis/heritage-motor/internal/handler/photo"
	scanhandler "github.com/chriis/heritage-motor/internal/handler/scan"
	taskhandler "github.com/chriis/heritage-motor/internal/handler/task"
	userhandler "github.com/chriis/heritage-motor/internal/handler/user"
	vehiclehandler "github.com/chriis/heritage-motor/internal/handler/vehicle"
	"github.com/chriis/heritage-motor/internal/middleware"
	adminsvc "github.com/chriis/heritage-motor/internal/service/admin"
	authsvc "github.com/chriis/heritage-motor/internal/service/auth"
	baysvc "github.com/chriis/heritage-motor/internal/service/bay"
	contactsvc "github.com/chriis/heritage-motor/internal/service/contact"
	docsvc "github.com/chriis/heritage-motor/internal/service/document"
	eventsvc "github.com/chriis/heritage-motor/internal/service/event"
	mailersvc "github.com/chriis/heritage-motor/internal/service/mailer"
	plansvc "github.com/chriis/heritage-motor/internal/service/plan"
	reportsvc "github.com/chriis/heritage-motor/internal/service/report"
	tasksvc "github.com/chriis/heritage-motor/internal/service/task"
	usersvc "github.com/chriis/heritage-motor/internal/service/user"
	vehiclesvc "github.com/chriis/heritage-motor/internal/service/vehicle"
	"github.com/chriis/heritage-motor/internal/storage"
	"github.com/chriis/heritage-motor/internal/turnstile"
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

	// Start periodic cleanup of expired token blacklist entries.
	if ownerPool != nil {
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
	}

	// Start periodic cleanup of expired/revoked refresh tokens (every 24h).
	if ownerPool != nil {
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

	// Fiber app
	app := fiber.New(fiber.Config{
		EnableTrustedProxyCheck: true,
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
		// Services
		authService := authsvc.NewService(ownerPool, jwtManager)
		vehicleService := vehiclesvc.NewService(appPool)
		bayService := baysvc.NewService(appPool)
		eventService := eventsvc.NewService(appPool)
		taskService := tasksvc.NewService(appPool)
		docService := docsvc.NewService(appPool, cfg.S3Bucket)
		userService := usersvc.NewService(appPool)
		planService := plansvc.NewService(ownerPool)
		mailerService := mailersvc.NewService(cfg.ResendAPIKey, cfg.EmailFrom, cfg.AppBaseURL)
		adminService := adminsvc.NewService(ownerPool, mailerService)
		reportService := reportsvc.NewService(appPool)

		// Turnstile verifier (shared between auth and contact)
		turnstileVerifier := turnstile.NewVerifier(cfg.TurnstileSecretKey)

		// Handlers
		authHandler := authhandler.NewHandler(authService, turnstileVerifier)
		vehicleHandler := vehiclehandler.NewHandler(vehicleService, planService, reportService)
		bayHandler := bayhandler.NewHandler(bayService, planService)
		eventHandler := eventhandler.NewHandler(eventService)
		taskHandler := taskhandler.NewHandler(taskService)
		docHandler := dochandler.NewHandler(docService, s3Client)
		userHandler := userhandler.NewHandler(userService, ownerPool, jwtManager.AccessExpiry(), planService)
		auditHandler := auditloghandler.NewHandler(appPool)
		photoHandler := photohandler.NewHandler(s3Client)
		scanHandler := scanhandler.NewHandler(appPool)
		adminHandler := adminhandler.NewHandler(adminService)

		// Contact service (public, uses ownerPool — no RLS needed)
		contactService := contactsvc.NewService(ownerPool, cfg.ResendAPIKey, cfg.EmailFrom, cfg.ContactEmailTo, turnstileVerifier)
		contactHandler := contacthandler.NewHandler(contactService)

		// Rate limiter for auth endpoints: 5 req per 15 min per IP
		authLimiter := limiter.New(limiter.Config{
			Max:        5,
			Expiration: 15 * time.Minute,
			KeyGenerator: func(c *fiber.Ctx) string {
				return c.IP() + ":" + strings.TrimPrefix(c.Path(), "/api/v1/auth/")
			},
			LimitReached: func(c *fiber.Ctx) error {
				return c.Status(429).JSON(fiber.Map{"error": "too many attempts, try again later"})
			},
		})

		// API v1 routes
		api := app.Group("/api/v1")

		// Contact form (public, rate limited: 3 per 15 min per IP)
		contactLimiter := limiter.New(limiter.Config{
			Max:        3,
			Expiration: 15 * time.Minute,
			KeyGenerator: func(c *fiber.Ctx) string {
				return c.IP() + ":contact"
			},
			LimitReached: func(c *fiber.Ctx) error {
				return c.Status(429).JSON(fiber.Map{"error": "too many requests, try again later"})
			},
		})
		api.Post("/contact", contactLimiter, contactHandler.Submit)

		// Auth routes (no auth middleware, rate limited)
		authGroup := api.Group("/auth")
		authGroup.Post("/login", authLimiter, authHandler.Login)
		authGroup.Post("/mfa/verify", authLimiter, authHandler.VerifyMFA)
		authGroup.Post("/refresh", authLimiter, authHandler.Refresh)

		// Authenticated routes (isolated group — middleware does not leak to other groups)
		authed := api.Group("")
		authed.Use(middleware.AuthMiddleware(jwtManager, ownerPool))

		// Per-user rate limiter: 100 req/min keyed by user_id from JWT.
		authed.Use(limiter.New(limiter.Config{
			Max:        100,
			Expiration: 1 * time.Minute,
			KeyGenerator: func(c *fiber.Ctx) string {
				if uid := middleware.UserIDFromCtx(c); uid != uuid.Nil {
					return uid.String()
				}
				return c.IP()
			},
			LimitReached: func(c *fiber.Ctx) error {
				return c.Status(429).JSON(fiber.Map{"error": "rate limit exceeded"})
			},
		}))

		// Change-password route: accessible even with password_change_required.
		// Placed BEFORE RequirePasswordChanged and TenantMiddleware.
		authed.Post("/auth/change-password", authHandler.ChangePassword)

		authed.Use(middleware.RequirePasswordChanged())
		authed.Use(middleware.TenantMiddleware(ownerPool, appPool))
		authed.Use(middleware.AuditMiddleware(ownerPool))

		// Auth routes requiring authentication
		authAuthed := authed.Group("/auth")
		authAuthed.Post("/logout", authHandler.Logout)
		authAuthed.Get("/me", authHandler.GetMe)
		authAuthed.Post("/mfa/setup", authHandler.SetupMFA)
		authAuthed.Post("/mfa/enable", authHandler.EnableMFA)
		authAuthed.Delete("/mfa", middleware.RequireAdmin(), authHandler.DisableMFA)

		// Vehicles
		vehicles := authed.Group("/vehicles")
		vehicles.Get("/qr-sheet", middleware.RequireAdmin(), vehicleHandler.QRSheet)
		vehicles.Get("/", vehicleHandler.List)
		vehicles.Get("/:id", vehicleHandler.GetByID)
		vehicles.Post("/", middleware.RequireOperatorOrAbove(), vehicleHandler.Create)
		vehicles.Patch("/:id", middleware.RequireOperatorOrAbove(), vehicleHandler.Update)
		vehicles.Delete("/:id", middleware.RequireAdmin(), vehicleHandler.Delete)
		vehicles.Post("/:id/move", middleware.RequireOperatorOrAbove(), vehicleHandler.Move)
		vehicles.Post("/:id/exit", middleware.RequireOperatorOrAbove(), vehicleHandler.Exit)
		vehicles.Get("/:id/timeline", vehicleHandler.GetTimeline)
		vehicles.Get("/:id/report", middleware.RequireOperatorOrAbove(), vehicleHandler.GetReport)

		// Upload bandwidth limiter: 200MB cumulative per user per 10 minutes.
		uploadLimiter := middleware.UploadLimiter(middleware.UploadLimiterConfig{
			MaxBytes: 200 * 1024 * 1024,
			Window:   10 * time.Minute,
		})

		// Documents (nested under vehicles)
		vehicles.Get("/:id/documents", docHandler.List)
		vehicles.Post("/:id/documents", uploadLimiter, middleware.RequireTechnicianOrAbove(), docHandler.Create)
		vehicles.Get("/:id/documents/:docId", docHandler.GetByID)
		vehicles.Delete("/:id/documents/:docId", middleware.RequireAdmin(), docHandler.Delete)

		// Events
		events := authed.Group("/events")
		events.Get("/", eventHandler.List)
		events.Post("/", uploadLimiter, middleware.RequireTechnicianOrAbove(), eventHandler.Create)
		events.Get("/:id", eventHandler.GetByID)

		// Bays
		bays := authed.Group("/bays")
		bays.Get("/qr-sheet", middleware.RequireAdmin(), bayHandler.QRSheet)
		bays.Get("/", bayHandler.List)
		bays.Get("/:id", bayHandler.GetByID)
		bays.Post("/", middleware.RequireOperatorOrAbove(), bayHandler.Create)
		bays.Patch("/:id", middleware.RequireOperatorOrAbove(), bayHandler.Update)
		bays.Delete("/:id", middleware.RequireOperatorOrAbove(), bayHandler.Delete)

		// Tasks
		tasks := authed.Group("/tasks")
		tasks.Get("/", taskHandler.List)
		tasks.Get("/:id", taskHandler.GetByID)
		tasks.Post("/", middleware.RequireTechnicianOrAbove(), taskHandler.Create)
		tasks.Patch("/:id", middleware.RequireTechnicianOrAbove(), taskHandler.Update)
		tasks.Post("/:id/complete", middleware.RequireTechnicianOrAbove(), taskHandler.Complete)
		tasks.Delete("/:id", middleware.RequireAdmin(), taskHandler.Delete)

		// Users (admin only)
		users := authed.Group("/users", middleware.RequireAdmin())
		users.Get("/", userHandler.List)
		users.Post("/", userHandler.Create)
		users.Patch("/:id", userHandler.Update)
		users.Delete("/:id", userHandler.Delete)

		// Scan
		authed.Get("/scan/:token", scanHandler.Resolve)

		// Photos (signed URL for download)
		authed.Get("/photos/:key/signed-url", photoHandler.GetSignedURL)

		// Audit log (admin only)
		authed.Get("/audit", middleware.RequireAdmin(), auditHandler.List)

		// ---- Super-Admin routes (isolated group, no tenant, no RLS) ----
		sa := api.Group("/admin",
			middleware.AuthMiddleware(jwtManager, ownerPool),
			middleware.RequireSuperAdmin(),
			middleware.AuditMiddleware(ownerPool),
		)
		sa.Get("/dashboard", adminHandler.DashboardStats)
		sa.Get("/tenants", adminHandler.ListTenants)
		sa.Get("/tenants/:id", adminHandler.GetTenant)
		sa.Post("/tenants", adminHandler.CreateTenant)
		sa.Patch("/tenants/:id", adminHandler.UpdateTenant)
		sa.Delete("/tenants/:id", adminHandler.DeleteTenant)
		sa.Post("/invitations", adminHandler.InviteUser)
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
