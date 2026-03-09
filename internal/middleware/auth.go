package middleware

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/chriis/heritage-motor/internal/auth"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// blacklistCache caches token blacklist lookups to avoid a DB hit on every request.
var blacklistCache sync.Map

const blacklistCacheTTL = 30 * time.Second

type blacklistEntry struct {
	blacklisted bool
	cachedAt    time.Time
}

type contextKey string

const (
	UserIDKey                 contextKey = "user_id"
	TenantIDKey               contextKey = "tenant_id"
	RoleKey                   contextKey = "role"
	RequestIDKey              contextKey = "request_id"
	JTIKey                    contextKey = "jti"
	TokenExpiresAtKey         contextKey = "token_expires_at"
	PasswordChangeRequiredKey contextKey = "password_change_required"
)

func AuthMiddleware(jwtManager *auth.JWTManager, pool *pgxpool.Pool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get("Authorization")
		if header == "" {
			return c.Status(401).JSON(fiber.Map{"error": "missing authorization header"})
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(401).JSON(fiber.Map{"error": "invalid authorization format"})
		}

		claims, err := jwtManager.ValidateAccessToken(parts[1])
		if err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "invalid or expired token"})
		}

		// Check token blacklist (by jti or user-level block).
		if pool != nil && claims.ID != "" {
			blacklisted, blErr := isTokenBlacklisted(c.UserContext(), pool, claims.ID, claims.UserID)
			if blErr != nil {
				log.Warn().Err(blErr).Msg("blacklist check failed — allowing request")
			} else if blacklisted {
				return c.Status(401).JSON(fiber.Map{"error": "token revoked"})
			}
		}

		c.Locals(string(UserIDKey), claims.UserID)
		c.Locals(string(TenantIDKey), claims.TenantID)
		c.Locals(string(RoleKey), claims.Role)
		c.Locals(string(JTIKey), claims.ID)
		if claims.ExpiresAt != nil {
			c.Locals(string(TokenExpiresAtKey), claims.ExpiresAt.Time)
		}
		if claims.PasswordChangeRequired {
			c.Locals(string(PasswordChangeRequiredKey), true)
		}

		return c.Next()
	}
}

// isTokenBlacklisted checks if a token's jti or user is in the blacklist.
// Results are cached for 30s to avoid a DB round-trip on every request.
func isTokenBlacklisted(ctx context.Context, pool *pgxpool.Pool, jti string, userID uuid.UUID) (bool, error) {
	cacheKey := jti + ":" + userID.String()

	if v, ok := blacklistCache.Load(cacheKey); ok {
		entry := v.(blacklistEntry)
		if time.Since(entry.cachedAt) < blacklistCacheTTL {
			return entry.blacklisted, nil
		}
		blacklistCache.Delete(cacheKey)
	}

	var exists bool
	err := pool.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM token_blacklist
			WHERE (jti = $1 OR user_id = $2) AND expires_at > NOW()
		)`,
		jti, userID,
	).Scan(&exists)
	if err != nil {
		return false, err
	}

	blacklistCache.Store(cacheKey, blacklistEntry{blacklisted: exists, cachedAt: time.Now()})
	return exists, nil
}

// InvalidateBlacklistCache removes the cached entry for a specific jti+user pair.
// Call after logout or user deletion to ensure immediate revocation.
// Uses direct key lookup (O(1)) instead of iterating the entire cache.
func InvalidateBlacklistCache(jti string, userID uuid.UUID) {
	cacheKey := jti + ":" + userID.String()
	blacklistCache.Delete(cacheKey)
}

func UserIDFromCtx(c *fiber.Ctx) uuid.UUID {
	if v, ok := c.Locals(string(UserIDKey)).(uuid.UUID); ok {
		return v
	}
	return uuid.Nil
}

func TenantIDFromCtx(c *fiber.Ctx) uuid.UUID {
	if v, ok := c.Locals(string(TenantIDKey)).(uuid.UUID); ok {
		return v
	}
	return uuid.Nil
}

func RoleFromCtx(c *fiber.Ctx) string {
	if v, ok := c.Locals(string(RoleKey)).(string); ok {
		return v
	}
	return ""
}

func JTIFromCtx(c *fiber.Ctx) string {
	if v, ok := c.Locals(string(JTIKey)).(string); ok {
		return v
	}
	return ""
}

func TokenExpiresAtFromCtx(c *fiber.Ctx) time.Time {
	if v, ok := c.Locals(string(TokenExpiresAtKey)).(time.Time); ok {
		return v
	}
	return time.Time{}
}

func PasswordChangeRequiredFromCtx(c *fiber.Ctx) bool {
	v, _ := c.Locals(string(PasswordChangeRequiredKey)).(bool)
	return v
}

// RequestIDFromGoCtx extracts the request ID from a standard Go context.
// Set by AuditMiddleware via c.SetUserContext().
func RequestIDFromGoCtx(ctx context.Context) string {
	if v, ok := ctx.Value(RequestIDKey).(string); ok {
		return v
	}
	return ""
}

// Logger returns a zerolog.Logger enriched with the request_id from context.
// Use in services: middleware.Logger(ctx).Info().Msg("...")
func Logger(ctx context.Context) zerolog.Logger {
	l := log.Logger
	if rid := RequestIDFromGoCtx(ctx); rid != "" {
		l = l.With().Str("request_id", rid).Logger()
	}
	return l
}
