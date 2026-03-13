package main

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/chriis/heritage-motor/internal/auth"
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

func setupRoutes(app *fiber.App, cfg *routesDeps) {
	// Services
	authService := authsvc.NewService(cfg.ownerPool, cfg.jwtManager)
	vehicleService := vehiclesvc.NewService(cfg.appPool)
	bayService := baysvc.NewService(cfg.appPool)
	eventService := eventsvc.NewService(cfg.appPool)
	taskService := tasksvc.NewService(cfg.appPool)
	docService := docsvc.NewService(cfg.appPool, cfg.s3Bucket)
	userService := usersvc.NewService(cfg.appPool)
	planService := plansvc.NewService(cfg.ownerPool)
	mailerService := mailersvc.NewService(cfg.resendAPIKey, cfg.emailFrom, cfg.appBaseURL)
	adminService := adminsvc.NewService(cfg.ownerPool, mailerService)
	reportService := reportsvc.NewService(cfg.appPool)

	// Turnstile verifier (shared between auth and contact)
	turnstileVerifier := turnstile.NewVerifier(cfg.turnstileSecretKey)

	// Handlers
	authHandler := authhandler.NewHandler(authService, turnstileVerifier)
	vehicleHandler := vehiclehandler.NewHandler(vehicleService, planService, reportService)
	bayHandler := bayhandler.NewHandler(bayService, planService)
	eventHandler := eventhandler.NewHandler(eventService)
	taskHandler := taskhandler.NewHandler(taskService)
	docHandler := dochandler.NewHandler(docService, cfg.s3Client)
	userHandler := userhandler.NewHandler(userService, cfg.ownerPool, cfg.jwtManager.AccessExpiry(), planService)
	auditHandler := auditloghandler.NewHandler(cfg.ownerPool)
	photoHandler := photohandler.NewHandler(cfg.s3Client)
	scanHandler := scanhandler.NewHandler(cfg.appPool)
	adminHandler := adminhandler.NewHandler(adminService)

	// Contact service (public, uses ownerPool — no RLS needed)
	contactService := contactsvc.NewService(cfg.ownerPool, cfg.resendAPIKey, cfg.emailFrom, cfg.contactEmailTo, turnstileVerifier)
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
	authed.Use(middleware.AuthMiddleware(cfg.jwtManager, cfg.ownerPool))

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
	authed.Use(middleware.TenantMiddleware(cfg.ownerPool, cfg.appPool))
	authed.Use(middleware.AuditMiddleware(cfg.ownerPool))

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
		middleware.AuthMiddleware(cfg.jwtManager, cfg.ownerPool),
		middleware.RequireSuperAdmin(),
		middleware.AuditMiddleware(cfg.ownerPool),
	)
	sa.Get("/dashboard", adminHandler.DashboardStats)
	sa.Get("/tenants", adminHandler.ListTenants)
	sa.Get("/tenants/:id", adminHandler.GetTenant)
	sa.Post("/tenants", adminHandler.CreateTenant)
	sa.Patch("/tenants/:id", adminHandler.UpdateTenant)
	sa.Delete("/tenants/:id", adminHandler.DeleteTenant)
	sa.Post("/invitations", adminHandler.InviteUser)
}

type routesDeps struct {
	ownerPool          *pgxpool.Pool
	appPool            *pgxpool.Pool
	jwtManager         *auth.JWTManager
	s3Client           *storage.S3Client
	s3Bucket           string
	resendAPIKey       string
	emailFrom          string
	contactEmailTo     string
	appBaseURL         string
	turnstileSecretKey string
}
