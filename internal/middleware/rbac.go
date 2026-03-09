package middleware

import (
	"github.com/chriis/heritage-motor/internal/domain"
	"github.com/gofiber/fiber/v2"
)

func RequireRole(roles ...string) fiber.Handler {
	roleSet := make(map[string]bool, len(roles))
	for _, r := range roles {
		roleSet[r] = true
	}

	return func(c *fiber.Ctx) error {
		role := RoleFromCtx(c)
		if !roleSet[role] {
			return c.Status(403).JSON(fiber.Map{"error": "forbidden"})
		}
		return c.Next()
	}
}

func RequireAdmin() fiber.Handler {
	return RequireRole(domain.RoleAdmin)
}

func RequireOperatorOrAbove() fiber.Handler {
	return RequireRole(domain.RoleAdmin, domain.RoleOperator)
}

func RequireTechnicianOrAbove() fiber.Handler {
	return RequireRole(domain.RoleAdmin, domain.RoleOperator, domain.RoleTechnician)
}

func RequireSuperAdmin() fiber.Handler {
	return RequireRole(domain.RoleSuperAdmin)
}

// RequirePasswordChanged blocks requests when the user must change their password.
// Only /auth/change-password is allowed through.
func RequirePasswordChanged() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if PasswordChangeRequiredFromCtx(c) {
			return c.Status(403).JSON(fiber.Map{
				"error":   "password_change_required",
				"message": "you must change your password before accessing this resource",
			})
		}
		return c.Next()
	}
}
