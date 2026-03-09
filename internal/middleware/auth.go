package middleware

import (
	"context"
	"strings"

	"github.com/chriis/heritage-motor/internal/auth"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

type contextKey string

const (
	UserIDKey   contextKey = "user_id"
	TenantIDKey contextKey = "tenant_id"
	RoleKey     contextKey = "role"
	RequestIDKey contextKey = "request_id"
)

func AuthMiddleware(jwtManager *auth.JWTManager) fiber.Handler {
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

		c.Locals(string(UserIDKey), claims.UserID)
		c.Locals(string(TenantIDKey), claims.TenantID)
		c.Locals(string(RoleKey), claims.Role)

		return c.Next()
	}
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
