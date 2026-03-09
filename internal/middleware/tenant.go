package middleware

import (
	"sync"
	"time"

	"github.com/chriis/heritage-motor/internal/db"
	"github.com/chriis/heritage-motor/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// tenantCacheEntry holds a cached tenant active status with expiry.
type tenantCacheEntry struct {
	active    bool
	expiresAt time.Time
}

var (
	tenantCache    sync.Map
	tenantCacheTTL = 5 * time.Minute
)

// lookupTenantActive checks the cache first, then queries the DB.
// Uses the owner pool because the tenants table has no RLS.
func lookupTenantActive(ownerPool *pgxpool.Pool, c *fiber.Ctx, tenantID uuid.UUID) (bool, error) {
	key := tenantID.String()

	if cached, ok := tenantCache.Load(key); ok {
		entry := cached.(tenantCacheEntry)
		if time.Now().Before(entry.expiresAt) {
			return entry.active, nil
		}
		tenantCache.Delete(key)
	}

	var active bool
	err := ownerPool.QueryRow(c.UserContext(),
		`SELECT active FROM tenants WHERE id = $1 AND deleted_at IS NULL`, tenantID,
	).Scan(&active)
	if err != nil {
		return false, err
	}

	tenantCache.Store(key, tenantCacheEntry{
		active:    active,
		expiresAt: time.Now().Add(tenantCacheTTL),
	})

	return active, nil
}

// TenantMiddleware validates the tenant and wraps each request in a transaction
// with SET LOCAL app.current_tenant_id, so PostgreSQL RLS policies filter rows
// automatically.
//
// ownerPool is used for the tenant-active lookup (bypasses RLS).
// appPool is used for the per-request transaction (RLS enforced).
func TenantMiddleware(ownerPool, appPool *pgxpool.Pool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Superadmin has no tenant — skip RLS entirely.
		if RoleFromCtx(c) == domain.RoleSuperAdmin {
			return c.Next()
		}

		tenantID := TenantIDFromCtx(c)
		if tenantID == uuid.Nil {
			return c.Status(401).JSON(fiber.Map{"error": "missing tenant context"})
		}

		// Verify tenant exists and is active (cached)
		active, err := lookupTenantActive(ownerPool, c, tenantID)
		if err != nil {
			log.Warn().Err(err).Str("tenant_id", tenantID.String()).Msg("tenant lookup failed")
			return c.Status(403).JSON(fiber.Map{"error": "tenant not found"})
		}
		if !active {
			return c.Status(403).JSON(fiber.Map{"error": "tenant inactive"})
		}

		// Begin a transaction on the app pool (heritage_app role, RLS enforced).
		tx, err := appPool.Begin(c.UserContext())
		if err != nil {
			log.Error().Err(err).Msg("failed to begin RLS transaction")
			return c.Status(500).JSON(fiber.Map{"error": "internal error"})
		}

		// Set the tenant ID for RLS policies within this transaction.
		_, err = tx.Exec(c.UserContext(), "SET LOCAL app.current_tenant_id = $1", tenantID.String())
		if err != nil {
			_ = tx.Rollback(c.UserContext())
			log.Error().Err(err).Msg("failed to set tenant context for RLS")
			return c.Status(500).JSON(fiber.Map{"error": "internal error"})
		}

		// Inject the transaction into the Go context so services pick it up
		// via db.Conn(ctx, fallbackPool).
		ctx := db.WithTx(c.UserContext(), tx)
		c.SetUserContext(ctx)

		// Execute the rest of the middleware chain + handler.
		chainErr := c.Next()

		// Rollback on handler error; commit otherwise.
		if chainErr != nil {
			_ = tx.Rollback(c.UserContext())
			return chainErr
		}

		if err := tx.Commit(c.UserContext()); err != nil {
			log.Error().Err(err).Msg("failed to commit RLS transaction")
			return c.Status(500).JSON(fiber.Map{"error": "internal error"})
		}

		return nil
	}
}
