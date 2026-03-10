package testutil

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/chriis/heritage-motor/internal/auth"
	"github.com/chriis/heritage-motor/internal/db"
	adminhandler "github.com/chriis/heritage-motor/internal/handler/admin"
	auditloghandler "github.com/chriis/heritage-motor/internal/handler/audit"
	authhandler "github.com/chriis/heritage-motor/internal/handler/auth"
	bayhandler "github.com/chriis/heritage-motor/internal/handler/bay"
	contacthandler "github.com/chriis/heritage-motor/internal/handler/contact"
	dochandler "github.com/chriis/heritage-motor/internal/handler/document"
	eventhandler "github.com/chriis/heritage-motor/internal/handler/event"
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
	tasksvc "github.com/chriis/heritage-motor/internal/service/task"
	usersvc "github.com/chriis/heritage-motor/internal/service/user"
	vehiclesvc "github.com/chriis/heritage-motor/internal/service/vehicle"
)

// Env holds all test dependencies.
type Env struct {
	OwnerPool  *pgxpool.Pool
	AppPool    *pgxpool.Pool
	JWTManager *auth.JWTManager
	App        *fiber.App
}

var (
	globalEnv  *Env
	setupOnce  sync.Once
	setupError error
)

// Setup returns a shared test environment. Call t.Cleanup(env.TruncateAll) in each test.
// Skips the test if DATABASE_URL_TEST is not set.
func Setup(t *testing.T) *Env {
	t.Helper()
	setupOnce.Do(func() {
		globalEnv, setupError = initEnv()
	})
	if setupError != nil {
		t.Fatalf("test setup failed: %v", setupError)
	}
	if globalEnv == nil {
		t.Skip("DATABASE_URL_TEST not set, skipping integration tests")
	}
	t.Cleanup(func() { globalEnv.TruncateAll(t) })
	return globalEnv
}

func initEnv() (*Env, error) {
	// Resolve paths relative to this file (works from any test package)
	_, thisFile, _, _ := runtime.Caller(0)
	testutilDir := filepath.Dir(thisFile)
	migrationsDir := filepath.Join(testutilDir, "..", "db", "migrations")

	// Load .env.test if present
	_ = godotenv.Load(filepath.Join(testutilDir, "..", "..", ".env.test"))

	dbURL := os.Getenv("DATABASE_URL_TEST")
	if dbURL == "" {
		return nil, nil // skip, not error
	}

	ctx := context.Background()

	// Owner pool (migrations, auth, audit — bypasses RLS)
	ownerPool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return nil, fmt.Errorf("owner pool: %w", err)
	}

	// Run migrations
	if err = db.RunMigrations(ownerPool, migrationsDir); err != nil {
		return nil, fmt.Errorf("migrations: %w", err)
	}

	// App pool (heritage_app role, RLS enforced)
	appURL := os.Getenv("DATABASE_APP_URL_TEST")
	var appPool *pgxpool.Pool
	if appURL != "" {
		appPool, err = pgxpool.New(ctx, appURL)
		if err != nil {
			return nil, fmt.Errorf("app pool: %w", err)
		}
	} else {
		// Fallback to owner pool if no separate app pool for tests
		appPool = ownerPool
	}

	jwtManager := auth.NewJWTManager("test-secret-at-least-32-characters-long", 15*time.Minute, 168*time.Hour)

	// Build Fiber app identical to main.go
	app := buildApp(ownerPool, appPool, jwtManager)

	return &Env{
		OwnerPool:  ownerPool,
		AppPool:    appPool,
		JWTManager: jwtManager,
		App:        app,
	}, nil
}

func buildApp(ownerPool, appPool *pgxpool.Pool, jwtManager *auth.JWTManager) *fiber.App {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
		BodyLimit: 50 * 1024 * 1024,
	})
	app.Use(recover.New())

	// Services
	authService := authsvc.NewService(ownerPool, jwtManager)
	vehicleService := vehiclesvc.NewService(appPool)
	bayService := baysvc.NewService(appPool)
	eventService := eventsvc.NewService(appPool)
	taskService := tasksvc.NewService(appPool)
	docService := docsvc.NewService(appPool, "test-bucket")
	userService := usersvc.NewService(appPool)
	planService := plansvc.NewService(ownerPool)
	mailerService := mailersvc.NewService("", "", "http://localhost:3000") // no-op mailer in tests
	adminService := adminsvc.NewService(ownerPool, mailerService)
	contactService := contactsvc.NewService(ownerPool, "", "", "", "")

	// Handlers
	authHandler := authhandler.NewHandler(authService)
	vehicleHandler := vehiclehandler.NewHandler(vehicleService, planService)
	bayHandler := bayhandler.NewHandler(bayService, planService)
	eventHandler := eventhandler.NewHandler(eventService)
	taskHandler := taskhandler.NewHandler(taskService)
	docHandler := dochandler.NewHandler(docService, nil) // nil s3Client for tests
	userHandler := userhandler.NewHandler(userService, ownerPool, jwtManager.AccessExpiry(), planService)
	auditHandler := auditloghandler.NewHandler(appPool)
	scanHandler := scanhandler.NewHandler(appPool)
	adminHandler := adminhandler.NewHandler(adminService)
	contactHandler := contacthandler.NewHandler(contactService)

	api := app.Group("/api/v1")

	// Public
	api.Post("/contact", contactHandler.Submit)

	// Auth (no auth middleware)
	authGroup := api.Group("/auth")
	authGroup.Post("/login", authHandler.Login)
	authGroup.Post("/mfa/verify", authHandler.VerifyMFA)
	authGroup.Post("/refresh", authHandler.Refresh)

	// Authenticated (isolated group)
	authed := api.Group("")
	authed.Use(middleware.AuthMiddleware(jwtManager, ownerPool))
	authed.Post("/auth/change-password", authHandler.ChangePassword)
	authed.Use(middleware.RequirePasswordChanged())
	authed.Use(middleware.TenantMiddleware(ownerPool, appPool))
	authed.Use(middleware.AuditMiddleware(ownerPool))

	// Auth (authenticated)
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

	uploadLimiter := middleware.UploadLimiter(middleware.UploadLimiterConfig{
		MaxBytes: 200 * 1024 * 1024,
		Window:   10 * time.Minute,
	})

	// Documents
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

	// Users
	users := authed.Group("/users", middleware.RequireAdmin())
	users.Get("/", userHandler.List)
	users.Post("/", userHandler.Create)
	users.Patch("/:id", userHandler.Update)
	users.Delete("/:id", userHandler.Delete)

	// Scan
	authed.Get("/scan/:token", scanHandler.Resolve)

	// Audit
	authed.Get("/audit", middleware.RequireAdmin(), auditHandler.List)

	// Superadmin
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

	return app
}

// ---------- Data helpers ----------

// CreateTenant inserts a tenant directly via ownerPool.
func (e *Env) CreateTenant(t *testing.T, name, plan string) (uuid.UUID, string) {
	t.Helper()
	var id uuid.UUID
	slug := name
	err := e.OwnerPool.QueryRow(context.Background(),
		`INSERT INTO tenants (name, slug, plan, active, status)
		 VALUES ($1, $2, $3, true, 'active')
		 RETURNING id`,
		name, slug, plan,
	).Scan(&id)
	if err != nil {
		t.Fatalf("CreateTenant: %v", err)
	}
	return id, slug
}

// CreateUser inserts a user with a hashed password. Returns user ID.
func (e *Env) CreateUser(t *testing.T, tenantID uuid.UUID, email, password, role string) uuid.UUID {
	t.Helper()
	hash, err := auth.HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	var id uuid.UUID
	err = e.OwnerPool.QueryRow(context.Background(),
		`INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
		 VALUES ($1, $2, $3, 'Test', 'User', $4)
		 RETURNING id`,
		tenantID, email, hash, role,
	).Scan(&id)
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	return id
}

// CreateSuperAdmin inserts a superadmin user (no tenant).
func (e *Env) CreateSuperAdmin(t *testing.T, email, password string) uuid.UUID {
	t.Helper()
	hash, err := auth.HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	var id uuid.UUID
	err = e.OwnerPool.QueryRow(context.Background(),
		`INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
		 VALUES (NULL, $1, $2, 'Super', 'Admin', 'superadmin')
		 RETURNING id`,
		email, hash,
	).Scan(&id)
	if err != nil {
		t.Fatalf("CreateSuperAdmin: %v", err)
	}
	return id
}

// CreateVehicle inserts a vehicle. Returns vehicle ID.
func (e *Env) CreateVehicle(t *testing.T, tenantID uuid.UUID, vmake, model, ownerName string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := e.OwnerPool.QueryRow(context.Background(),
		`INSERT INTO vehicles (tenant_id, make, model, owner_name, status)
		 VALUES ($1, $2, $3, $4, 'stored')
		 RETURNING id`,
		tenantID, vmake, model, ownerName,
	).Scan(&id)
	if err != nil {
		t.Fatalf("CreateVehicle: %v", err)
	}
	return id
}

// CreateBay inserts a bay. Returns bay ID.
func (e *Env) CreateBay(t *testing.T, tenantID uuid.UUID, code string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := e.OwnerPool.QueryRow(context.Background(),
		`INSERT INTO bays (tenant_id, code, status)
		 VALUES ($1, $2, 'free')
		 RETURNING id`,
		tenantID, code,
	).Scan(&id)
	if err != nil {
		t.Fatalf("CreateBay: %v", err)
	}
	return id
}

// AuthToken generates a valid access token for testing.
func (e *Env) AuthToken(t *testing.T, userID, tenantID uuid.UUID, role string) string {
	t.Helper()
	token, err := e.JWTManager.GenerateAccessToken(userID, tenantID, role, false)
	if err != nil {
		t.Fatalf("GenerateAccessToken: %v", err)
	}
	return token
}

// AuthTokenPCR generates a token with password_change_required=true.
func (e *Env) AuthTokenPCR(t *testing.T, userID, tenantID uuid.UUID, role string) string {
	t.Helper()
	token, err := e.JWTManager.GenerateAccessToken(userID, tenantID, role, true)
	if err != nil {
		t.Fatalf("GenerateAccessToken: %v", err)
	}
	return token
}

// ---------- HTTP helpers ----------

// DoRequest performs an HTTP request against the test Fiber app.
func (e *Env) DoRequest(t *testing.T, method, path, token string, body interface{}) *http.Response {
	t.Helper()
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, "/api/v1"+path, bodyReader)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := e.App.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	return resp
}

// ReadJSON decodes a JSON response body into dst.
func ReadJSON(t *testing.T, resp *http.Response, dst interface{}) {
	t.Helper()
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(dst); err != nil {
		t.Fatalf("decode response: %v", err)
	}
}

// BgCtx returns a background context. Convenience for direct SQL queries in tests.
func BgCtx() context.Context {
	return context.Background()
}

// ---------- Cleanup ----------

// TruncateAll removes all data from all tables (preserves plan_limits seed data).
func (e *Env) TruncateAll(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	tables := []string{
		"audit_log",
		"token_blacklist",
		"invitations",
		"refresh_tokens",
		"documents",
		"tasks",
		"events",
		"vehicles",
		"bays",
		"users",
		"tenants",
		"contact_requests",
	}
	for _, table := range tables {
		if _, err := e.OwnerPool.Exec(ctx, fmt.Sprintf("TRUNCATE %s CASCADE", table)); err != nil {
			t.Logf("truncate %s: %v", table, err)
		}
	}
}
