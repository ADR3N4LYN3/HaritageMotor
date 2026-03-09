package main

import (
	"context"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/chriis/heritage-motor/internal/auth"
	"github.com/chriis/heritage-motor/internal/config"
	"github.com/chriis/heritage-motor/internal/db"
	authhandler "github.com/chriis/heritage-motor/internal/handler/auth"
	bayhandler "github.com/chriis/heritage-motor/internal/handler/bay"
	dochandler "github.com/chriis/heritage-motor/internal/handler/document"
	eventhandler "github.com/chriis/heritage-motor/internal/handler/event"
	scanhandler "github.com/chriis/heritage-motor/internal/handler/scan"
	taskhandler "github.com/chriis/heritage-motor/internal/handler/task"
	userhandler "github.com/chriis/heritage-motor/internal/handler/user"
	vehiclehandler "github.com/chriis/heritage-motor/internal/handler/vehicle"
	auditloghandler "github.com/chriis/heritage-motor/internal/handler/audit"
	"github.com/chriis/heritage-motor/internal/middleware"
	authsvc "github.com/chriis/heritage-motor/internal/service/auth"
	baysvc "github.com/chriis/heritage-motor/internal/service/bay"
	docsvc "github.com/chriis/heritage-motor/internal/service/document"
	eventsvc "github.com/chriis/heritage-motor/internal/service/event"
	tasksvc "github.com/chriis/heritage-motor/internal/service/task"
	usersvc "github.com/chriis/heritage-motor/internal/service/user"
	vehiclesvc "github.com/chriis/heritage-motor/internal/service/vehicle"
	"github.com/chriis/heritage-motor/internal/storage"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	// Validate production config
	if cfg.AppEnv == "production" {
		if cfg.JWTSecret == "dev-secret-change-in-production" || len(cfg.JWTSecret) < 32 {
			log.Fatal().Msg("JWT_SECRET must be at least 32 characters in production")
		}
	}

	// Setup logging
	level, _ := zerolog.ParseLevel(cfg.LogLevel)
	zerolog.SetGlobalLevel(level)
	if cfg.AppEnv == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

	// Database
	pool, err := db.NewPool(cfg.DatabaseURL)
	if err != nil {
		if cfg.AppEnv == "development" {
			log.Warn().Err(err).Msg("database not available - API routes will not work, landing page only")
		} else {
			log.Fatal().Err(err).Msg("failed to connect to database")
		}
	}
	if pool != nil {
		defer pool.Close()
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
		if pool == nil {
			dbStatus = "unavailable"
		}
		return c.JSON(fiber.Map{"status": "ok", "service": "heritage-motor", "database": dbStatus})
	})

	// Static files and landing page
	app.Static("/static", "./web/static")
	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendFile("./web/static/index.html")
	})

	// API routes require database
	if pool != nil {
		// Services
		authService := authsvc.NewService(pool, jwtManager)
		vehicleService := vehiclesvc.NewService(pool)
		bayService := baysvc.NewService(pool)
		eventService := eventsvc.NewService(pool)
		taskService := tasksvc.NewService(pool)
		docService := docsvc.NewService(pool, cfg.S3Bucket)
		userService := usersvc.NewService(pool)

		// Handlers
		authHandler := authhandler.NewHandler(authService)
		vehicleHandler := vehiclehandler.NewHandler(vehicleService)
		bayHandler := bayhandler.NewHandler(bayService)
		eventHandler := eventhandler.NewHandler(eventService)
		taskHandler := taskhandler.NewHandler(taskService)
		docHandler := dochandler.NewHandler(docService, s3Client)
		userHandler := userhandler.NewHandler(userService)
		auditHandler := auditloghandler.NewHandler(pool)
		scanHandler := scanhandler.NewHandler(pool)

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

		// Auth routes (no auth middleware, rate limited)
		authGroup := api.Group("/auth")
		authGroup.Post("/login", authLimiter, authHandler.Login)
		authGroup.Post("/mfa/verify", authLimiter, authHandler.VerifyMFA)
		authGroup.Post("/refresh", authLimiter, authHandler.Refresh)

		// Authenticated routes
		authed := api.Use(middleware.AuthMiddleware(jwtManager))
		authed.Use(middleware.TenantMiddleware(pool))
		authed.Use(middleware.AuditMiddleware(pool))

		// Auth routes requiring authentication
		authAuthed := authed.Group("/auth")
		authAuthed.Post("/logout", authHandler.Logout)
		authAuthed.Get("/me", authHandler.GetMe)
		authAuthed.Post("/mfa/setup", authHandler.SetupMFA)
		authAuthed.Post("/mfa/enable", authHandler.EnableMFA)
		authAuthed.Delete("/mfa", middleware.RequireAdmin(), authHandler.DisableMFA)

		// Vehicles
		vehicles := authed.Group("/vehicles")
		vehicles.Get("/", vehicleHandler.List)
		vehicles.Get("/:id", vehicleHandler.GetByID)
		vehicles.Post("/", middleware.RequireOperatorOrAbove(), vehicleHandler.Create)
		vehicles.Patch("/:id", middleware.RequireOperatorOrAbove(), vehicleHandler.Update)
		vehicles.Delete("/:id", middleware.RequireAdmin(), vehicleHandler.Delete)
		vehicles.Post("/:id/move", middleware.RequireOperatorOrAbove(), vehicleHandler.Move)
		vehicles.Post("/:id/exit", middleware.RequireOperatorOrAbove(), vehicleHandler.Exit)
		vehicles.Get("/:id/timeline", vehicleHandler.GetTimeline)

		// Documents (nested under vehicles)
		vehicles.Get("/:id/documents", docHandler.List)
		vehicles.Post("/:id/documents", middleware.RequireTechnicianOrAbove(), docHandler.Create)
		vehicles.Get("/:id/documents/:docId", docHandler.GetByID)
		vehicles.Delete("/:id/documents/:docId", middleware.RequireAdmin(), docHandler.Delete)

		// Events
		events := authed.Group("/events")
		events.Get("/", eventHandler.List)
		events.Post("/", middleware.RequireTechnicianOrAbove(), eventHandler.Create)
		events.Get("/:id", eventHandler.GetByID)

		// Bays
		bays := authed.Group("/bays")
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

		// Audit log (admin only)
		authed.Get("/audit", middleware.RequireAdmin(), auditHandler.List)
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
