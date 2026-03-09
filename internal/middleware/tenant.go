package middleware

import (
	"sync"
	"time"

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
func lookupTenantActive(pool *pgxpool.Pool, c *fiber.Ctx, tenantID uuid.UUID) (bool, error) {
	key := tenantID.String()

	if cached, ok := tenantCache.Load(key); ok {
		entry := cached.(tenantCacheEntry)
		if time.Now().Before(entry.expiresAt) {
			return entry.active, nil
		}
		tenantCache.Delete(key)
	}

	var active bool
	err := pool.QueryRow(c.Context(),
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

func TenantMiddleware(pool *pgxpool.Pool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := TenantIDFromCtx(c)
		if tenantID == uuid.Nil {
			return c.Status(401).JSON(fiber.Map{"error": "missing tenant context"})
		}

		// Verify tenant exists and is active (cached)
		active, err := lookupTenantActive(pool, c, tenantID)
		if err != nil {
			log.Warn().Err(err).Str("tenant_id", tenantID.String()).Msg("tenant lookup failed")
			return c.Status(403).JSON(fiber.Map{"error": "tenant not found"})
		}
		if !active {
			return c.Status(403).JSON(fiber.Map{"error": "tenant inactive"})
		}

		conn, err := pool.Acquire(c.Context())
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "database connection error"})
		}
		defer conn.Release()

		// Set tenant context for RLS
		_, err = conn.Exec(c.Context(),
			"SET LOCAL app.current_tenant_id = $1", tenantID.String())
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to set tenant context"})
		}

		c.Locals("db_conn", conn)

		return c.Next()
	}
}
